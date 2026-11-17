# L'API met 5 secondes à répondre. Que voit l'utilisateur pendant ce temps ?

**Niveau :** Mid
**Merged from (original phrasings):**
- L'API met 5 secondes à répondre. Que voit l'utilisateur pendant ce temps ?

## The concept (short answer)
- **Jamais un écran blanc ni une interface figée.** Affichez quelque chose immédiatement, montrez la progression, et gardez le reste de la page utilisable.
- **Des skeletons** qui reprennent la mise en page finale, plutôt qu'un spinner pleine page. La vitesse perçue s'améliore et la mise en page ne bouge pas (CLS) quand les données arrivent.
- **Affichez d'abord les données périmées :** mettez en cache les réponses précédentes (`staleTime` de React Query/SWR, stale-while-revalidate) et affichez-les instantanément pendant le rechargement en arrière-plan, avec un indicateur discret « Mise à jour... ».
- **Rendu progressif ou en streaming :** ne bloquez pas toute la page sur l'appel le plus lent. Chaque section a son propre état de chargement ou sa propre boundary Suspense, et le streaming de Next.js envoie la coquille en premier.
- **Optimistic UI** pour les mutations : mettez à jour l'interface immédiatement et revenez en arrière en cas d'erreur (likes, toggles, ajout au panier).
- **Un retour progressif :** un spinner après environ 300 ms (pour éviter le clignotement sur les réponses rapides), un message après environ 3 s (« Toujours en cours, recherche parmi 400 hôtels... »), et un **timeout** avec possibilité de réessayer après environ 10 à 15 s.
- **Annulation :** `AbortController` permet à l'utilisateur de partir ou de changer sa recherche sans que des réponses obsolètes écrasent les plus récentes.
- Et signalez ces 5 s à l'équipe backend comme un bug : un cache, de la pagination, ou un job asynchrone avec polling ou webhooks est peut-être la vraie solution.

## Real-life example: the problem
Sur un comparateur d'assurances, la page « Obtenir des devis » appelle un agrégateur qui met entre 3 et 8 s à répondre. Les utilisateurs voient une page blanche avec un spinner centré, sans aucun texte. Beaucoup pensent que le site est cassé et cliquent sur « Retour » ou rafraîchissent, ce qui envoie une nouvelle requête de 8 secondes. S'ils changent de modèle de voiture pendant que la première requête tourne encore, l'ancienne réponse arrive en dernier et écrase les nouveaux résultats : les utilisateurs voient des devis pour la mauvaise voiture. Les analytics montrent 35 % d'abandon sur cette page.

```jsx
function QuotesPage({ carId }) {
  const [quotes, setQuotes] = useState(null);

  useEffect(() => {
    setQuotes(null);
    fetch(`/api/quotes?car=${carId}`)          // pas de timeout, pas d'annulation
      .then(r => r.json())
      .then(setQuotes);                        // une réponse tardive pour un ancien carId l'emporte quand même
  }, [carId]);

  if (!quotes) return <div className="spinner" />;  // toute la page remplacée par un spinner
  return <QuoteList quotes={quotes} />;
}
```

## How to fix it
```jsx
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

async function fetchQuotes(carId, signal) {
  const timeout = AbortSignal.timeout(15000);
  const res = await fetch(`/api/quotes?car=${carId}`, {
    signal: AbortSignal.any([signal, timeout]), // annulée au démontage / changement de clé OU après 15 s
  });
  if (!res.ok) throw new Error(`Quotes failed: ${res.status}`);
  return res.json();
}

function useElapsed(active) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!active) { setMs(0); return; }
    const start = Date.now();
    const id = setInterval(() => setMs(Date.now() - start), 500);
    return () => clearInterval(id);
  }, [active]);
  return ms;
}

function QuotesPage({ carId }) {
  const { data, isPending, isFetching, isPlaceholderData, error, refetch } = useQuery({
    queryKey: ['quotes', carId],
    queryFn: ({ signal }) => fetchQuotes(carId, signal), // React Query annule les requêtes obsolètes
    staleTime: 5 * 60 * 1000,                            // revenir sur la page est instantané
    placeholderData: keepPreviousData,                   // garde les anciens résultats visibles pendant le rechargement
  });
  const elapsed = useElapsed(isFetching);

  return (
    <main>
      <SearchSummary carId={carId} />           {/* le cadre de la page est utilisable immédiatement */}

      {isFetching && elapsed > 3000 && (
        <p role="status" aria-live="polite">
          Still comparing 40+ insurers. This usually takes under 10 seconds.
        </p>
      )}

      {error ? (
        <ErrorPanel
          message={error.name === 'TimeoutError' ? 'This is taking longer than usual.' : 'Could not load quotes.'}
          onRetry={() => refetch()}
        />
      ) : isPending ? (
        <QuoteListSkeleton rows={5} />           // même forme que la vraie liste, pas de décalage de mise en page
      ) : (
        <div aria-busy={isFetching} style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
          <QuoteList quotes={data} />
        </div>
      )}
    </main>
  );
}
```

Pourquoi ça marche :
- Les utilisateurs voient tout de suite le cadre de la page et un skeleton, puis un message de progression honnête : ils savent que la page travaille.
- `keepPreviousData` combiné à `staleTime` fait que changer de filtre ou revenir sur la page affiche instantanément les devis en cache au lieu d'un écran vide.
- Les abort signals annulent les requêtes obsolètes : une ancienne réponse lente ne peut plus écraser la nouvelle (race condition corrigée), et le timeout transforme un spinner sans fin en une option claire pour réessayer.
- Améliorations possibles : envoyer les résultats partiels en streaming (SSE, ou le BFF renvoie les assureurs au fur et à mesure qu'ils répondent) ou afficher chaque section dans sa propre boundary `<Suspense>` avec Next.js.

## How to say it in the interview
- « Je conçois l'attente : un skeleton immédiatement, des données en cache ou périmées si j'en ai, des messages progressifs, un timeout avec possibilité de réessayer, et l'annulation pour que des réponses obsolètes ne gagnent pas la course. »
- « Pour les écritures, j'utilise des mises à jour optimistes avec rollback. Pour les lectures, j'utilise stale-while-revalidate. »
- Piège : le spinner pleine page. Il masque tout ce que l'utilisateur pourrait déjà utiliser, et un spinner affiché moins de 300 ms ne fait que clignoter. Retardez-le, ou utilisez des skeletons.
- Compromis : l'optimistic UI et les données périmées peuvent afficher brièvement une information fausse. C'est acceptable pour un compteur de likes, pas pour un solde bancaire ou un prix final. Choisissez fonctionnalité par fonctionnalité.
