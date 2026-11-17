# Les fonctionnalités concurrentes de React 18 et leur impact sur l'architecture

**Niveau :** Senior
**Merged from (original phrasings):**
- Expliquez les fonctionnalités concurrentes de React 18 et leur impact sur l'architecture d'une application.

## The concept (short answer)

Le concurrent rendering signifie que React peut **préparer une nouvelle UI en arrière-plan, l'interrompre et la jeter** si quelque chose de plus urgent survient. On l'active au cas par cas, mise à jour par mise à jour, grâce à ces fonctionnalités :

- **Batching automatique :** plusieurs appels à `setState` dans le même tick produisent un seul rendu - désormais aussi dans les promises, `setTimeout` et les gestionnaires d'événements natifs (avant React 18, seuls les gestionnaires d'événements React étaient regroupés). `flushSync` permet d'en sortir.
- **`useTransition` / `startTransition` :** marque une mise à jour comme non urgente. Les mises à jour urgentes (saisie, clic) l'interrompent ; `isPending` permet d'afficher un retour visuel pendant que l'ancienne UI reste interactive.
- **`useDeferredValue` :** la version « je n'ai pas la main sur le setter » - React refait d'abord le rendu avec l'ancienne valeur, puis rend la valeur différée en arrière-plan.
- **Suspense + streaming SSR :** le serveur envoie immédiatement le squelette HTML, puis streame le HTML de chaque frontière `<Suspense>` dès que ses données sont prêtes (`renderToPipeableStream` ; le App Router de Next.js le fait par défaut). Des données lentes ne bloquent plus toute la page.
- **Hydratation sélective :** les frontières s'hydratent indépendamment ; si l'utilisateur clique sur une partie pas encore hydratée, React hydrate cette frontière en priorité.

**Impact sur l'architecture :** les fonctions de rendu doivent être pures et idempotentes (elles peuvent s'exécuter plusieurs fois ou être abandonnées - StrictMode les appelle deux fois pour le détecter) ; les stores externes mutables doivent utiliser `useSyncExternalStore` pour éviter le **tearing** (des composants affichant des versions différentes du store dans un même rendu) ; vous concevez la page en **frontières Suspense** (états de chargement placés selon la mise en page, pas par chaque composant) ; et vous classez les mises à jour en urgentes ou en transitions. La concurrence ne rend pas le code lent rapide - elle garde la saisie réactive pendant que le code lent s'exécute.

## Real-life example: the problem

Un catalogue de pièces B2B de 8 000 références filtrées côté client. Taper « brake » dans le champ de recherche semble cassé sur les portables du bureau : chaque frappe fige le champ pendant environ 300ms, les lettres apparaissent par à-coups, et basculer entre les onglets « Grid » et « Table » bloque toute la page.

```jsx
function Catalog({ products }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');

  // S'exécute à chaque frappe, de façon synchrone, avec la même priorité que la saisie elle-même
  const results = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search parts" />
      <button onClick={() => setView('grid')}>Grid</button>
      <button onClick={() => setView('table')}>Table</button>
      {view === 'grid' ? <ProductGrid items={results} /> : <ProductTable items={results} />}
    </>
  );
}
```

La mise à jour du champ et le rendu coûteux de la liste forment un seul rendu synchrone. React ne peut pas peindre le nouveau caractère tant que les 8 000 lignes ne sont pas comparées, donc la saisie paraît lente et les clics s'accumulent.

## How to fix it

Séparez la mise à jour urgente (le champ) de la mise à jour coûteuse (la liste), et mémoïsez la liste pour que le rendu en arrière-plan puisse être évité ou interrompu.

```jsx
import { memo, useDeferredValue, useMemo, useState, useTransition } from 'react';

const ProductGrid = memo(function ProductGrid({ items }) { /* ...affiche les cartes... */ });
const ProductTable = memo(function ProductTable({ items }) { /* ...affiche les lignes... */ });

function Catalog({ products }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');
  const [isPending, startTransition] = useTransition();

  const deferredQuery = useDeferredValue(query);   // prend du retard pendant les rendus lourds
  const isStale = query !== deferredQuery;

  const results = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(deferredQuery.toLowerCase())),
    [products, deferredQuery]
  );

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search parts" />
      <button onClick={() => startTransition(() => setView('grid'))}>Grid</button>
      <button onClick={() => startTransition(() => setView('table'))}>Table</button>
      <div style={{ opacity: isStale || isPending ? 0.6 : 1 }}>
        {view === 'grid' ? <ProductGrid items={results} /> : <ProductTable items={results} />}
      </div>
    </>
  );
}
```

Pourquoi ça marche : la frappe déclenche immédiatement un rendu avec l'*ancien* `deferredQuery`, donc `memo` permet à React de sauter la liste et de peindre le caractère. Ensuite, React rend la liste avec la nouvelle valeur en arrière-plan, par tranches d'environ 5ms ; si une autre touche arrive, ce rendu en arrière-plan est abandonné et relancé. Les changements d'onglet sont des transitions, donc la vue actuelle reste interactive pendant que la nouvelle se rend. Si 8 000 lignes restent trop lentes par rendu, la vraie solution est la virtualisation (`@tanstack/react-virtual`) ou le filtrage côté serveur - la concurrence masque la latence, elle ne supprime pas le travail.

Streaming + hydratation sélective sur la page produit (App Router) :

```jsx
export default async function ProductPage({ params }) {
  const { sku } = await params;
  const product = await getProduct(sku);            // rapide, critique : dans le squelette
  return (
    <>
      <ProductHeader product={product} />
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews sku={sku} />                       {/* service lent : streamé plus tard, hydraté indépendamment */}
      </Suspense>
    </>
  );
}
```

## How to say it in the interview

- « React concurrent rend le rendu interruptible et priorisé. Je marque les mises à jour coûteuses et non urgentes comme des transitions ou des valeurs différées pour que la saisie gagne toujours, et je conçois les pages en frontières Suspense pour que les données lentes arrivent en streaming au lieu de tout bloquer. »
- Piège : `useTransition` ne peut pas envelopper le state propre d'un input contrôlé - l'input doit se mettre à jour en urgence ; différez plutôt ce qui le consomme. Et les transitions ne font pas de debounce des requêtes réseau ; utilisez `AbortController` ou une librairie de requêtes pour cela.
- Question de suivi : « Qu'est-ce que le tearing ? » - un rendu concurrent qui lit un store externe mutable modifié en plein rendu ; résolu par `useSyncExternalStore` (Redux, Zustand et TanStack Query l'utilisent déjà).
- Compromis : la concurrence coûte du travail de rendu supplémentaire (des rendus peuvent être jetés) et rend le timing moins prévisible ; elle brille pour les UI gourmandes en CPU, pas pour les lenteurs liées aux I/O.
