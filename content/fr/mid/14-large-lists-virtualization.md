# Comment afficher et déboguer de très grandes listes (10 000 à 50 000+ lignes) sans ralentissement ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Comment afficheriez-vous efficacement un tableau contenant plus de 50 000 enregistrements ?
- Une page affiche 10 000 éléments et commence à ramer. Que faites-vous ?
- Une liste de 5 000 lignes saccade. Comment trouvez-vous la cause avant de toucher au code ?

## The concept (short answer)
- **Mesurez d'abord.** Enregistrez une trace dans l'onglet Performance des Chrome DevTools (cherchez les long tasks, les blocs « Recalculate Style »/« Layout » et le temps de scripting) et dans le Profiler des React DevTools (quels composants font un re-render, à quelle fréquence et pourquoi : activez « Record why each component rendered »). La cause peut être la taille du DOM, des avalanches de re-renders, un travail coûteux par ligne ou du layout thrashing, et chacune appelle une correction différente.
- **La cause principale est la taille du DOM.** 50 000 lignes x 8 cellules, cela fait 400 000 nœuds DOM. Le style, le layout et le paint augmentent tous avec le nombre de nœuds, et React doit réconcilier chaque ligne à chaque re-render du parent.
- **La virtualisation (windowing)** n'affiche que les lignes visibles dans le viewport plus une petite marge (overscan, environ 30 lignes), et utilise un élément d'espacement de la hauteur totale pour que la barre de défilement reste correcte. Bibliothèques : TanStack Virtual (`@tanstack/react-virtual`), react-window.
- **N'envoyez pas toutes les données au navigateur.** Utilisez la pagination côté serveur ou le chargement infini, ainsi que le filtrage et le tri côté serveur. 50k lignes de JSON, c'est aussi un coût en réseau et en mémoire.
- **Réduisez le coût des re-renders :** utilisez des lignes `React.memo` avec des props stables (handlers en `useCallback`, des ids plutôt que de nouveaux objets), sortez autant que possible le state de sélection du parent, et utilisez `useDeferredValue` ou un debounce pour les champs de filtre.
- **Le CSS peut aider :** `content-visibility: auto` permet au navigateur de ne pas rendre le contenu hors écran quand vous ne pouvez pas virtualiser.

## Real-life example: the problem
Dans un back-office de logistique, la page « Expéditions » charge 20 000 expéditions dans un tableau avec un champ de recherche. Les utilisateurs signalent que chaque frappe dans la recherche fige la page pendant environ 2 secondes, et que le défilement saccade. L'onglet Performance montre des long tasks de 1,8 s à chaque frappe. Le Profiler React montre que chaque `ShipmentRow` refait un render à chaque frappe, parce que `onSelect` est une nouvelle fonction et que `filtered` est recalculé à chaque render.

```jsx
function ShipmentsPage({ shipments }) { // 20 000 éléments
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const filtered = shipments.filter(s =>
    s.customer.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <table>
        <tbody>
          {filtered.map(s => (
            <ShipmentRow
              key={s.id}
              shipment={s}
              selected={s.id === selectedId}
              onSelect={() => setSelectedId(s.id)} // nouvelle fonction par ligne à chaque render
            />
          ))}
        </tbody>
      </table>
    </>
  );
}
```

Problèmes : 20 000 éléments `<tr>` dans le DOM, tous réconciliés à chaque frappe, un filtrage sur le chemin critique de la saisie, et aucune mémoïsation.

## How to fix it
```jsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';

const ROW_HEIGHT = 40;

const ShipmentRow = memo(function ShipmentRow({ shipment, selected, onSelect, style }) {
  return (
    <div role="row" style={style} className={selected ? 'row selected' : 'row'}
         onClick={() => onSelect(shipment.id)}>
      <span role="cell">{shipment.trackingNo}</span>
      <span role="cell">{shipment.customer}</span>
      <span role="cell">{shipment.status}</span>
    </div>
  );
});

function ShipmentsPage({ shipments }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query); // la saisie reste réactive
  const [selectedId, setSelectedId] = useState(null);
  const onSelect = useCallback(id => setSelectedId(id), []); // référence stable

  const filtered = useMemo(() => {
    const q = deferredQuery.toLowerCase();
    return shipments.filter(s => s.customerLower.includes(q)); // mis en minuscules une seule fois en amont
  }, [shipments, deferredQuery]);

  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customer" />
      <div ref={parentRef} role="table" style={{ height: 600, overflow: 'auto' }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(v => {
            const s = filtered[v.index];
            return (
              <ShipmentRow
                key={s.id}
                shipment={s}
                selected={s.id === selectedId}
                onSelect={onSelect}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%',
                         height: v.size, transform: `translateY(${v.start}px)` }}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
```

Pourquoi ça marche :
- Seules environ 25 lignes sont dans le DOM à tout moment au lieu de 20 000, donc le coût du layout et du paint reste constant quel que soit le volume de données.
- `memo` et un `onSelect` stable font qu'un changement de sélection ne provoque le re-render que des deux lignes concernées.
- `useDeferredValue` permet au champ de se mettre à jour immédiatement, tandis que le filtrage et le rendu de la liste se font avec une priorité plus basse.
- Étape suivante au-delà de 50k lignes : déplacer le filtrage et le tri vers l'API (`GET /shipments?q=acme&page=3&sort=eta`) et utiliser des requêtes paginées ou infinies, pour que le navigateur ne détienne jamais le jeu de données complet.

Alternatives : react-window (`FixedSizeList`) pour les cas simples ; AG Grid ou TanStack Table associé à un virtualizer pour de vraies grilles de données ; une pagination classique quand les utilisateurs n'ont pas besoin de faire défiler en continu. La pagination offre d'ailleurs souvent une meilleure UX pour les tableaux d'administration.

## How to say it in the interview
- « Avant de modifier le code, je profile : l'onglet Performance me dit si le temps part dans le scripting ou dans le layout et le paint, et le Profiler React me dit quels composants font un re-render et pourquoi. Ensuite je choisis la correction qui correspond à la cause. »
- « Pour des dizaines de milliers de lignes, la virtualisation garde le DOM à une taille constante. Pour de très gros jeux de données, je déplace aussi la pagination, le filtrage et le tri côté serveur. »
- Piège : la virtualisation casse Ctrl+F (la recherche du navigateur), complique l'accessibilité (utilisez `aria-rowcount`/`aria-rowindex`) et demande du travail supplémentaire pour les hauteurs de ligne variables (`measureElement` dans TanStack Virtual).
- Compromis : mettre `React.memo` partout n'est pas gratuit. Mémoïsez les lignes, qui sont le chemin critique, et corrigez les props instables, sinon memo n'a aucun effet.
