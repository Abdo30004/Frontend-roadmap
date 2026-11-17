# Pourquoi une Error Boundary n'attrape-t-elle pas une erreur asynchrone ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Pourquoi une Error Boundary n'attrape-t-elle pas une erreur asynchrone ?

## The concept (short answer)
- Une Error Boundary est un composant de classe (`getDerivedStateFromError` / `componentDidCatch`). React n'attrape que les erreurs levées **pendant qu'il appelle votre code lors du rendu** : fonctions de rendu, méthodes de cycle de vie, constructeurs et (via la phase de commit) le corps synchrone des effets.
- Les erreurs qui se produisent **en dehors de cette pile d'appels** ne sont pas attrapées :
  - **Les gestionnaires d'événements** (`onClick`) : React les appelle, mais ils ne font pas partie du rendu, et l'interface reste cohérente, donc React vous laisse les gérer.
  - **Le code asynchrone :** `fetch().then`, les fonctions `async` après un `await`, `setTimeout`, `setInterval`, les callbacks de WebSocket. Au moment où ils lèvent l'erreur, la pile d'appels du rendu n'existe plus, et l'erreur devient une promesse rejetée non gérée ou une erreur globale.
  - Les erreurs de SSR et les erreurs levées dans le composant boundary lui-même.
- **Solutions :**
  - Attrapez l'erreur asynchrone et **ramenez-la dans la phase de rendu** : `setState(() => { throw error; })` la relance lors du rendu suivant, là où la boundary l'attrape.
  - Utilisez **`react-error-boundary`** : `useErrorBoundary()` fournit `showBoundary(error)`, qui fait exactement cela, plus `resetKeys` et une fonction pour réessayer.
  - Utilisez une **récupération de données basée sur Suspense** (`use(promise)` dans React 19, le mode `suspense` de React Query/SWR / `useSuspenseQuery`, les Server Components) : une promesse rejetée est levée pendant le rendu, donc la boundary la plus proche l'attrape.
  - App Router de Next.js : `error.js` par segment de route est une Error Boundary intégrée.
- Ajoutez quand même un `window.addEventListener('unhandledrejection', ...)` global (ou Sentry) pour les erreurs qu'aucune boundary n'attrape.

## Real-life example: the problem
Dans un portail patient de santé, le widget « Résultats d'analyses » est enveloppé dans une Error Boundary pour qu'un widget en panne ne puisse pas faire tomber tout le dashboard. Quand l'API du laboratoire s'est mise à renvoyer du JSON malformé, la boundary n'a jamais affiché son fallback « Impossible de charger les résultats, réessayer ». À la place, le widget affichait un spinner sans fin, la console affichait `Uncaught (in promise) SyntaxError: Unexpected token '<'`, et les patients pensaient que leurs résultats étaient encore en attente. Cliquer sur « Télécharger le PDF » avec une session expirée échouait aussi en silence.

```jsx
<ErrorBoundary fallback={<WidgetError />}>
  <LabResults patientId={id} />
</ErrorBoundary>

function LabResults({ patientId }) {
  const [results, setResults] = useState(null);

  useEffect(() => {
    fetch(`/api/patients/${patientId}/labs`)
      .then(r => r.json())                 // lève une SyntaxError de façon asynchrone, non attrapée par la boundary
      .then(setResults);
  }, [patientId]);

  async function downloadPdf() {
    const res = await fetch(`/api/patients/${patientId}/labs.pdf`);
    if (!res.ok) throw new Error('Download failed'); // gestionnaire d'événement + async, non attrapé par la boundary
    saveBlob(await res.blob());
  }

  if (!results) return <Spinner />;        // reste affiché indéfiniment
  return <ResultsTable results={results} onDownload={downloadPdf} />;
}
```

## How to fix it
**Option 1 : `react-error-boundary` + `showBoundary`.**
```jsx
import { ErrorBoundary, useErrorBoundary } from 'react-error-boundary';

function LabResults({ patientId }) {
  const [results, setResults] = useState(null);
  const { showBoundary } = useErrorBoundary();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/patients/${patientId}/labs`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`Labs API ${r.status}`); return r.json(); })
      .then(setResults)
      .catch(err => { if (err.name !== 'AbortError') showBoundary(err); }); // ramenée dans la phase de rendu
    return () => controller.abort();
  }, [patientId, showBoundary]);

  async function downloadPdf() {
    try {
      const res = await fetch(`/api/patients/${patientId}/labs.pdf`);
      if (!res.ok) throw new Error('Download failed');
      saveBlob(await res.blob());
    } catch (err) {
      toast.error('Could not download the PDF. Please try again.'); // local et récupérable : inutile de remplacer le widget
    }
  }

  if (!results) return <Spinner />;
  return <ResultsTable results={results} onDownload={downloadPdf} />;
}

// utilisation, avec possibilité de réessayer et réinitialisation quand le patient change
<ErrorBoundary
  FallbackComponent={({ error, resetErrorBoundary }) => (
    <WidgetError message="Couldn't load lab results." onRetry={resetErrorBoundary} />
  )}
  onError={(error) => reportToSentry(error)}
  resetKeys={[id]}
>
  <LabResults patientId={id} />
</ErrorBoundary>
```

Sans la bibliothèque, la même astuce fonctionne à la main :
```jsx
const [, setState] = useState();
// ...
.catch(err => setState(() => { throw err; })); // l'updater s'exécute pendant le rendu, donc la boundary l'attrape
```

**Option 2 : Suspense + `use` (React 19) ou une suspense query, pour que les erreurs soient naturellement levées pendant le rendu.**
```jsx
function LabResults({ labsPromise }) {
  const results = use(labsPromise);   // la promesse rejetée est levée pendant le rendu et attrapée par la boundary
  return <ResultsTable results={results} />;
}

<ErrorBoundary FallbackComponent={LabsError}>
  <Suspense fallback={<Spinner />}>
    <LabResults labsPromise={labsPromise} />   {/* promesse créée par un parent, un loader du router ou un Server Component */}
  </Suspense>
</ErrorBoundary>
```

Pourquoi ça marche : les Error Boundaries ne gèrent que les erreurs levées pendant le rendu. `showBoundary` ou l'updater de state qui lève une erreur planifie un re-render qui lève l'erreur, et `use()` lève le rejet pendant le rendu : dans les deux cas, l'erreur se produit là où React peut l'attraper et afficher le fallback. Pour les gestionnaires d'événements, un try/catch local avec un toast offre généralement une meilleure UX que remplacer tout le widget.

## How to say it in the interview
- « Les boundaries attrapent les erreurs levées pendant le rendu. Les gestionnaires d'événements et les callbacks asynchrones s'exécutent plus tard, en dehors de la pile d'appels du rendu de React, donc l'erreur n'atteint jamais la boundary. Elle devient une promesse rejetée non gérée. »
- « Pour envoyer une erreur asynchrone vers une boundary, je la relance pendant le rendu : `showBoundary` de react-error-boundary, un updater de state qui lève l'erreur, ou une récupération basée sur Suspense avec `use()` ou `useSuspenseQuery`. »
- Piège : envelopper un `await` dans un try/catch sans rien faire ensuite donne un spinner sans fin. Chaque chemin asynchrone a besoin d'un état d'erreur explicite ou d'une boundary.
- Compromis : toutes les erreurs ne doivent pas remplacer l'interface par un fallback. Les erreurs d'actions récupérables (un téléchargement ou un enregistrement raté) sont mieux gérées par des messages inline ou des toasts, tandis que des données cassées pour toute une section relèvent d'une boundary.
