# SSR, CSR et hydratation (et SSG/ISR) : quelles différences, et quand utiliser chacun ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Expliquez le SSR (Server-Side Rendering) et le CSR (Client-Side Rendering).
- SSR, CSR et hydratation : quelles différences, et quand les utiliser ?
- Expliquez le concept de rendu côté serveur (SSR) dans Next.js.
- Comment mettez-vous en place le rendu côté serveur avec hydratation pour des applications complexes ?

## The concept (short answer)
- **CSR :** le serveur envoie une coquille HTML quasi vide et un bundle JS, puis le navigateur récupère les données et construit le DOM. Vous avez un écran blanc ou un spinner tant que le JS n'a pas tourné, ainsi qu'un SEO et des aperçus sur les réseaux sociaux moins bons. Adapté aux dashboards authentifiés et aux applications très interactives.
- **SSR :** le serveur exécute les composants React à chaque requête et envoie du HTML complet. Vous obtenez un premier affichage rapide (FCP/LCP), un contenu bien indexé par les moteurs de recherche, et des données propres à chaque requête comme la personnalisation et l'authentification. Les coûts : du CPU serveur par requête, et un TTFB plus lent si la récupération des données est lente.
- **SSG / ISR :** le HTML est généré au moment du build (SSG), ou généré puis régénéré en arrière-plan après N secondes ou à la demande (ISR). La page est servie depuis un CDN, c'est donc l'option la plus rapide. Adapté aux pages marketing, aux blogs et aux fiches produit.
- **Hydratation :** le HTML issu du SSR n'est pas interactif. Le navigateur télécharge le même JS, React refait le rendu en mémoire, puis attache les gestionnaires d'événements au DOM existant au lieu de le recréer. Le premier rendu côté client doit produire exactement le même balisage que le serveur, sinon vous obtenez une **hydration mismatch** (incohérence d'hydratation).
- **Avec l'App Router de Next.js :** les composants sont des Server Components par défaut (rendus sur le serveur, sans JS envoyé pour eux). `'use client'` marque les îlots interactifs qui seront hydratés. Une route est statique ou dynamique selon ce qu'elle utilise (`cookies()`, `headers()`, fetch non mis en cache).
- **Applications complexes :** utilisez le **streaming SSR avec Suspense** pour que la coquille soit envoyée immédiatement et que les sections lentes arrivent en flux à mesure qu'elles se résolvent, avec l'**hydratation sélective** (React hydrate en priorité les parties avec lesquelles l'utilisateur interagit). Gardez les client components petits pour avoir moins de JS à hydrater.

## Real-life example: the problem
Sur un site de réservation de voyages, la page de résultats de recherche est rendue côté serveur. En production, les utilisateurs situés dans d'autres fuseaux horaires voient les heures « Départ à » passer d'une valeur à une autre au chargement. Sentry enregistre aussi `Hydration failed because the server rendered text didn't match the client`, et une bannière promo perd parfois son gestionnaire de clic. La cause : le serveur (UTC) et le navigateur (fuseau de l'utilisateur) formatent la date différemment, et le composant lit `window`/`localStorage` pendant le rendu.

```jsx
'use client';

export function FlightCard({ flight }) {
  // Serveur (UTC) : "08:00". Navigateur (UTC+2) : "10:00", donc incohérence
  const departs = new Date(flight.departureIso).toLocaleTimeString();

  // Serveur : window est undefined, donc false. Client : peut-être true, donc balisage différent
  const isReturning = typeof window !== 'undefined' && localStorage.getItem('seenPromo');

  return (
    <article>
      <h3>{flight.route}</h3>
      <p>Departs at {departs}</p>
      {!isReturning && <PromoBanner />}
    </article>
  );
}
```

React ne parvient pas à faire correspondre le HTML du serveur. Selon la version, soit il jette le sous-arbre et refait le rendu côté client (lent, provoque un flash visible), soit, avec React 19, il journalise l'erreur et se rattrape en faisant un rendu client jusqu'à la boundary Suspense la plus proche. Dans les deux cas, les utilisateurs voient le contenu sauter et le premier rendu perd l'avantage du SSR.

## How to fix it
```jsx
'use client';
import { useEffect, useState } from 'react';

export function FlightCard({ flight }) {
  // 1. Formatage déterministe : locale fixe + fuseau horaire de l'aéroport (envoyé par le serveur)
  const departs = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: flight.originTimeZone,
  }).format(new Date(flight.departureIso));

  // 2. Le state propre au navigateur est lu APRÈS l'hydratation, dans un effet
  const [isReturning, setIsReturning] = useState(false); // même valeur initiale côté serveur et côté client
  useEffect(() => {
    setIsReturning(localStorage.getItem('seenPromo') === '1');
  }, []);

  return (
    <article>
      <h3>{flight.route}</h3>
      <p>Departs at <time dateTime={flight.departureIso}>{departs}</time></p>
      {!isReturning && <PromoBanner />}
    </article>
  );
}
```

Et envoyez en streaming la partie lente de la page au lieu de bloquer toute la réponse :

```jsx
// app/search/page.jsx (Server Component)
import { Suspense } from 'react';

export default async function SearchPage({ searchParams }) {
  const { from, to } = await searchParams; // Next 15 : searchParams est une Promise
  return (
    <>
      <SearchForm from={from} to={to} />                 {/* envoyé immédiatement */}
      <Suspense fallback={<ResultsSkeleton />}>
        <FlightResults from={from} to={to} />            {/* arrive en streaming quand l'API répond */}
      </Suspense>
    </>
  );
}
```

Pourquoi ça marche : le premier rendu côté client produit désormais exactement le même HTML que le serveur, donc l'hydratation se contente d'attacher les gestionnaires. Les valeurs propres au navigateur sont appliquées lors d'un second rendu, après le montage. Grâce au streaming, une API de vols lente ne retarde que la section des résultats, et non le TTFB de toute la page.

Alternatives : `suppressHydrationWarning` sur un seul élément dont le texte diffère légitimement, comme un horodatage (cela ne fonctionne que sur un niveau et ce n'est pas une solution générale) ; `next/dynamic(() => import(...), { ssr: false })` pour les composants qui ne peuvent pas du tout s'exécuter sur le serveur (graphiques, cartes).

## How to say it in the interview
- « Le SSR vous donne du HTML rapidement, l'hydratation le rend interactif, et le contrat entre les deux, c'est que le premier rendu client doit correspondre exactement à ce qu'a produit le serveur. »
- « Je choisis route par route : SSG/ISR pour un contenu identique pour tout le monde, SSR ou streaming pour des données personnalisées ou fraîches, CSR pour des écrans de type application derrière une connexion. »
- Piège : « Le SSR rend la page plus rapide. » Il améliore le FCP/LCP, mais le temps jusqu'à l'interactivité dépend toujours de la taille du JS. Une page peut sembler prête et pourtant ignorer les clics tant que l'hydratation n'est pas terminée (l'« uncanny valley »).
- Causes fréquentes d'incohérence : `Date`/`Math.random()` pendant le rendu, des tests sur `window`/`localStorage`, une imbrication HTML invalide (`<div>` dans un `<p>`), et des extensions de navigateur qui modifient le DOM.
