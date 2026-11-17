# Comment détecter et éviter les re-renders inutiles, et quand memo échoue-t-il ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Comment détectez-vous et évitez-vous les re-renders inutiles dans une grosse application React ?
- Quand un parent se re-render, quels enfants se re-render, et quand memo échoue-t-il ?

## The concept (short answer)
- Un composant se re-render quand **son state change, quand son parent se re-render, ou quand un context qu'il lit change**. Par défaut, quand un parent se re-render, **tous les enfants présents dans son JSX se re-render**, même si leurs props n'ont pas changé.
- `React.memo(Child)` saute le re-render si chaque prop est **superficiellement égale** (`Object.is`) à la précédente.
- memo **échoue** quand une prop est une nouvelle référence à chaque rendu :
  - objets/tableaux inline : `style={{...}}`, `options={[...]}`, `filter={{ status }}`
  - fonctions inline : `onClick={() => ...}`
  - du JSX passé en `children` (un nouvel objet élément à chaque rendu)
  - l'enfant lit un context dont la valeur change (memo ne bloque pas les mises à jour de context)
- Solutions : `useMemo`/`useCallback` pour les props passées aux enfants mémoïsés, **descendre le state** (colocation), **passer les composants en `children`** pour qu'ils soient créés par un parent qui ne se re-render pas, découper les contexts.
- **Mesurer d'abord, optimiser ensuite** : le Profiler des React DevTools (enregistrez, regardez le flame graph, activez « Record why each component rendered »), « Highlight updates when components render », `why-did-you-render` en dev, et l'API `<Profiler>` pour mesurer les temps dans le code.
- Le **React Compiler** (stable depuis fin 2025) ajoute automatiquement la mémoïsation au moment du build, ce qui supprime la plupart des `useMemo`/`useCallback`/`memo` manuels. Une bonne structure du state reste nécessaire.

## Real-life example: the problem
Dans le panneau d'administration d'un CRM, la saisie dans la zone de texte « Note rapide » en haut de la page clients est lente : chaque frappe prend environ 150ms. Le Profiler montre que chaque frappe re-render le `CustomerTable` et ses 500 lignes, alors que le tableau est enveloppé dans `memo`.

```jsx
const CustomerTable = memo(function CustomerTable({ customers, filter, onSelect }) {
  const visible = customers.filter((c) => c.status === filter.status);
  return visible.map((c) => <CustomerRow key={c.id} customer={c} onSelect={onSelect} />);
});

function CustomersPage({ customers }) {
  const [note, setNote] = useState('');          // change à chaque frappe
  const [status, setStatus] = useState('active');
  const [selectedId, setSelectedId] = useState(null);

  return (
    <>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      <StatusTabs value={status} onChange={setStatus} />
      <CustomerTable
        customers={customers}
        filter={{ status }}                       // nouvel objet à chaque rendu -> memo échoue
        onSelect={(id) => setSelectedId(id)}      // nouvelle fonction à chaque rendu -> memo échoue
      />
      <CustomerDrawer id={selectedId} />
    </>
  );
}
```
Profiler, « Why did this render? » : `Props changed: filter, onSelect`. Les valeurs sont égales, mais les références sont nouvelles.

## How to fix it
Deux étapes : descendre le state qui change souvent, et garder des props stables.

```jsx
// 1. Colocation du state : le state de la note vit dans son propre composant.
function QuickNote() {
  const [note, setNote] = useState('');
  return <textarea value={note} onChange={(e) => setNote(e.target.value)} />;
}

function CustomersPage({ customers }) {
  const [status, setStatus] = useState('active');
  const [selectedId, setSelectedId] = useState(null);

  // 2. Références stables pour l'enfant mémoïsé
  const filter = useMemo(() => ({ status }), [status]);
  const handleSelect = useCallback((id) => setSelectedId(id), []);

  return (
    <>
      <QuickNote />                       {/* la saisie ne re-render que QuickNote */}
      <StatusTabs value={status} onChange={setStatus} />
      <CustomerTable customers={customers} filter={filter} onSelect={handleSelect} />
      <CustomerDrawer id={selectedId} />
    </>
  );
}
```
Pourquoi ça marche : la saisie met désormais à jour le state à l'intérieur de `QuickNote`, donc `CustomersPage` ne se re-render plus du tout. Quand la page se re-render (par exemple quand `selectedId` change), `filter` et `handleSelect` gardent les mêmes références, et `memo` peut sauter le tableau. Encore plus simple : passez `status` (une string) au lieu d'un objet `filter` ; les primitives se comparent par valeur.

### Le pattern « children en props »
```jsx
function ScrollTracker({ children }) {
  const [y, setY] = useState(0);
  useEffect(() => {
    const onScroll = () => setY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <div><ProgressBar value={y} />{children}</div>;
}

// <HeavyArticle /> est créé par App, pas par ScrollTracker,
// donc le scroll re-render ScrollTracker mais PAS HeavyArticle.
<ScrollTracker><HeavyArticle /></ScrollTracker>
```

### Mise en place de la détection
```js
// src/wdyr.js, importé en premier, uniquement dans le point d'entrée de dev
import React from 'react';
if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, { trackAllPureComponents: true });
}
```
Remarque : `why-did-you-render` patche les internes de React et fonctionne surtout bien avec React 18. Avec React 19 et le Compiler, appuyez-vous principalement sur le Profiler des DevTools.

## How to say it in the interview
- « Quand un parent fait un rendu, tous ses enfants font un rendu par défaut. `memo` n'aide que si chaque prop est stable en référence, donc les objets inline, les fonctions inline et le JSX passé en `children` le cassent sans bruit. »
- « Je mesure d'abord avec le Profiler. La plupart des re-renders sont peu coûteux ; je n'optimise que ceux qui sont lents ou très fréquents. »
- « Mes premiers outils sont structurels : descendre le state, remonter le contenu en `children`, découper le context. `useMemo`/`useCallback` viennent ensuite, et le React Compiler peut s'en charger en grande partie automatiquement. »
- Compromis : la mémoïsation coûte de la mémoire et des comparaisons, et ajoute du code. Tout envelopper dans `memo` sans mesurer peut rendre le code plus lent et plus difficile à lire.
