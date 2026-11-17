# Monitoring et suivi des erreurs pour les applications frontend en production

**Niveau :** Senior
**Merged from (original phrasings):**
- Comment mettez-vous en place le monitoring et le suivi des erreurs pour des applications frontend en production ?

## The concept (short answer)
- Trois couches : le **suivi des erreurs** (exceptions non capturées, promesses rejetées non gérées, error boundaries React, appels d'API en échec) avec un outil comme Sentry, Bugsnag ou Datadog RUM ; le **real-user monitoring (RUM)** des performances (Core Web Vitals : LCP, INP, CLS, plus TTFB) via la bibliothèque `web-vitals` ; et l'**alerting** sur des taux, pas sur des erreurs isolées.
- Des stack traces minifiées sont inutilisables, donc **uploadez les source maps** vers l'outil d'erreurs en CI, mais **ne les servez pas publiquement** (générez des source maps `hidden` et supprimez-les du résultat du build avant déploiement).
- Taguez chaque événement avec une **release** (SHA git) et un **environnement**, pour pouvoir dire « le taux d'erreur a bondi dans la release `a1b2c3d` », faire le lien avec les déploiements, et marquer des issues comme résolues « dans la prochaine release ».
- Ajoutez du contexte : ID utilisateur (pas de données personnelles), route, feature flags, **breadcrumbs** (clics, navigation, appels réseau précédant l'erreur).
- **Filtrez le bruit** : extensions de navigateur, avertissements `ResizeObserver loop`, bots, requêtes annulées, scripts tiers. Sinon le signal est noyé et plus personne ne regarde.
- Alertez sur ce qui compte : baisse du taux de sessions sans crash, taux d'erreur d'une release au-dessus de la référence, régression du p75 LCP/INP, et routez l'alerte vers l'équipe propriétaire.

## Real-life example: the problem
Un cas typique : le checkout d'une application de livraison de repas a été cassé pour un moyen de paiement pendant six heures un samedi. Personne n'a été alerté ; l'équipe l'a appris par des avis furieux. En regardant, ils ont trouvé 50 000 « issues » par jour dans l'outil d'erreurs (surtout des erreurs d'extensions), des stack traces pointant vers `main.3f9a.js:1:84213`, personne ne pouvait dire quel déploiement avait introduit le bug, et les source maps étaient téléchargeables publiquement depuis le CDN, exposant tout le code source et les commentaires sur l'API interne.

```js
// vite.config.js - CASSÉ
export default defineConfig({
  build: { sourcemap: true },              // fichiers .map déployés publiquement sur le CDN
});
```

```tsx
// main.tsx - CASSÉ
Sentry.init({
  dsn: 'https://public@o0.ingest.sentry.io/0',
  // pas de release, pas d'environnement, pas de filtrage, 100 % des traces en prod
  tracesSampleRate: 1.0,
});

// les erreurs pendant le rendu React finissent en écran blanc par défaut,
// et les échecs de fetch (HTTP 500) ne lèvent jamais d'exception, donc ne sont jamais remontés
const res = await fetch('/api/pay', { method: 'POST', body });
const data = await res.json();
```

## How to fix it
```js
// vite.config.js
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: { sourcemap: 'hidden' },                       // maps générées, sans commentaire sourceMappingURL
  plugins: [
    react(),
    sentryVitePlugin({
      org: 'acme', project: 'web',
      authToken: process.env.SENTRY_AUTH_TOKEN,         // secret de CI
      release: { name: process.env.GIT_SHA },
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },   // jamais déployées
    }),
  ],
});
```

```tsx
// monitoring.ts
import * as Sentry from '@sentry/react';
import { onLCP, onINP, onCLS, type Metric } from 'web-vitals';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  release: import.meta.env.VITE_GIT_SHA,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,                               // échantillonner les traces de performance
  replaysOnErrorSampleRate: 1.0,                       // session replay uniquement autour des erreurs
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration({ maskAllText: true })],
  allowUrls: [/https:\/\/(www|static)\.fooddelivery\.example/],   // écarter le bruit des extensions/tiers
  ignoreErrors: ['ResizeObserver loop limit exceeded', 'AbortError', /^Non-Error promise rejection/],
  beforeSend(event) {
    if (event.user) delete event.user.email;           // pas de données personnelles
    return event;
  },
});

function sendVital(m: Metric) {
  navigator.sendBeacon('/rum', JSON.stringify({
    name: m.name, value: m.value, rating: m.rating,
    route: location.pathname, release: import.meta.env.VITE_GIT_SHA,
  }));
}
onLCP(sendVital); onINP(sendVital); onCLS(sendVital);
```

```tsx
// App.tsx - capturer les erreurs de rendu, remonter explicitement les échecs HTTP
<Sentry.ErrorBoundary fallback={<CheckoutError />} beforeCapture={(s) => s.setTag('area', 'checkout')}>
  <Checkout />
</Sentry.ErrorBoundary>

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  Sentry.addBreadcrumb({ category: 'api', message: `${init?.method ?? 'GET'} ${url}` });
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = new Error(`API ${res.status} ${url}`);
    Sentry.captureException(err, { tags: { endpoint: url, status: res.status } });
    throw err;
  }
  return res.json();
}
```

Alerting (configuré dans l'outil, géré par chaque équipe) :
- Nouvelle issue dans la dernière release touchant plus de 50 utilisateurs en 10 minutes : alerter (page) l'astreinte de la zone concernée.
- Taux de sessions sans crash inférieur à 99,5 % ou taux d'erreur du checkout 3 fois supérieur à la référence sur 7 jours : alerter l'astreinte.
- Régression de plus de 20 % du p75 INP ou LCP après une release : message Slack, pas d'appel d'astreinte.

Pourquoi ça fonctionne : les source maps cachées donnent des stack traces lisibles sans divulguer le code ; les tags de release relient chaque pic d'erreurs à un déploiement (et permettent de décider vite d'un rollback) ; le filtrage réduit la liste d'issues à une taille que les gens lisent vraiment ; les alertes basées sur des taux préviennent un humain en quelques minutes au lieu d'attendre les avis clients.

## How to say it in the interview
- « Je suis trois choses : les erreurs, les performances réelles côté utilisateurs, et des indicateurs de santé business comme le taux de réussite du checkout, le tout tagué avec la release et l'environnement. »
- « Les source maps sont uploadées en CI vers l'outil de suivi d'erreurs puis supprimées du résultat du build ; la production ne les sert jamais. »
- Piège en question de relance : `fetch` ne lève pas d'exception sur les 4xx/5xx et React ne remonte les erreurs de rendu que via les error boundaries ; vous devez capturer ces cas explicitement.
- Compromis : plus de données coûte de l'argent et de l'attention. Échantillonnez les traces et les replays, filtrez le bruit de façon agressive, et alertez sur des taux et sur l'impact utilisateur, pas sur chaque exception.
