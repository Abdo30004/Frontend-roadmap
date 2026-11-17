# Diagnostiquer les pages lentes et les performances sur appareils réels (Core Web Vitals)

**Niveau :** Senior
**Merged from (original phrasings):**
- Comment diagnostiqueriez-vous une page React qui met 5 secondes à devenir interactive ?
- Votre application est rapide en local mais lente sur de vrais appareils Android. Que mesurez-vous en premier ?
- Comment optimisez-vous les performances web et réduisez-vous les temps de chargement ?

## The concept (short answer)

- **Mesurez d'abord les vrais utilisateurs (données terrain), puis reproduisez en labo.** Données terrain = RUM (la librairie `web-vitals` qui envoie vers votre outil d'analytics) et CrUX / Search Console. Données de labo = Lighthouse, panneau Performance des DevTools, WebPageTest. Votre MacBook sur la fibre exécute le JS environ 4 à 6 fois plus vite qu'un Android milieu de gamme ; un test en labo sans **CPU throttling (4x-6x)** ni bridage réseau ment.
- **Core Web Vitals (évalués au 75e percentile) :**
  - **LCP** (Largest Contentful Paint, chargement) <= 2.5s - à décomposer en TTFB, délai avant chargement de la ressource, durée de chargement de la ressource, délai de rendu.
  - **INP** (Interaction to Next Paint, réactivité, a remplacé le FID en 2024) <= 200ms - délai d'entrée + temps de traitement + délai de présentation.
  - **CLS** (Cumulative Layout Shift, stabilité) <= 0.1 - réservez l'espace pour les images, publicités et polices.
- **« 5 secondes avant d'être interactive », c'est presque toujours du JS sur le main thread :** de gros bundles à parser, l'**hydratation** d'un énorme arbre client, du travail coûteux dans le rendu ou les effets, des scripts tiers. Cherchez les **long tasks** (> 50ms) dans le panneau Performance ; toute long task bloque les entrées utilisateur.
- **Solutions selon la cause :** livrer moins de JS (Server Components, code splitting), hydrater moins (garder les parties statiques côté serveur uniquement, islands), découper les long tasks (`scheduler.yield()`, `setTimeout`, transitions), virtualiser les longues listes, différer les scripts tiers, précharger l'image LCP, rendre le contenu critique dans le HTML.

## Real-life example: the problem

La page de résultats de recherche d'une marketplace de seconde main. Lighthouse sur le portable du développeur : 98. Le RUM montre un INP p75 de 600ms et un LCP de 4.8s sur Android ; les utilisateurs touchent « Filtres » et rien ne se passe pendant plusieurs secondes, puis la page saute. Trace Performance avec CPU throttling 6x : une long task de 3.2s au chargement (hydratation de 500 cartes d'annonces + tri + formatage de dates), un widget de chat et deux tags d'analytics chargés de façon synchrone, et l'image principale découverte seulement après l'exécution du JS.

```tsx
'use client';                                            // toute la page s'hydrate côté client
import { useEffect, useState } from 'react';
import ChatWidget from 'heavy-chat-sdk';

export default function SearchPage({ initialListings }) {
  const [listings, setListings] = useState([]);

  useEffect(() => {
    // Travail synchrone coûteux juste après l'hydratation : une gigantesque long task
    const enriched = initialListings
      .map((l) => ({ ...l, score: computeRelevance(l), price: formatPrice(l.price) }))
      .sort((a, b) => b.score - a.score);
    setListings(enriched);                               // d'abord une liste vide -> layout shift
  }, [initialListings]);

  return (
    <>
      <div className="hero" style={{ backgroundImage: `url(${initialListings[0]?.photo})` }} />
      <FiltersPanel />
      <div className="grid">{listings.map((l) => <ListingCard key={l.id} listing={l} />)}</div>
      <ChatWidget />
    </>
  );
}
```

## How to fix it

D'abord, mesurez sur le terrain avec l'attribution, pour savoir *quel* élément et *quelle* interaction sont lents :

```js
// rum.js - chargé une seule fois dans le layout racine (client)
import { onCLS, onINP, onLCP, onTTFB } from 'web-vitals/attribution';

function send(metric) {
  const body = JSON.stringify({
    name: metric.name, value: metric.value, rating: metric.rating, id: metric.id,
    page: location.pathname,
    device: { mem: navigator.deviceMemory, cpus: navigator.hardwareConcurrency, net: navigator.connection?.effectiveType },
    attribution: metric.name === 'INP'
      ? { target: metric.attribution.interactionTarget, inputDelay: metric.attribution.inputDelay,
          processing: metric.attribution.processingDuration, presentation: metric.attribution.presentationDelay }
      : metric.name === 'LCP'
      ? { target: metric.attribution.target, ttfb: metric.attribution.timeToFirstByte,
          loadDelay: metric.attribution.resourceLoadDelay, renderDelay: metric.attribution.elementRenderDelay }
      : metric.name === 'CLS' ? { target: metric.attribution.largestShiftTarget } : {},
  });
  if (!navigator.sendBeacon?.('/rum', body)) fetch('/rum', { method: 'POST', body, keepalive: true });
}

[onCLS, onINP, onLCP, onTTFB].forEach((fn) => fn(send));
```

Ensuite, corrigez les causes : rendez la liste côté serveur, n'hydratez que les feuilles interactives, faites le travail lourd là où il doit être fait, et différez les scripts tiers.

```tsx
// app/search/page.tsx - Server Component : aucun coût d'hydratation pour 500 cartes statiques
import Image from 'next/image';
import Script from 'next/script';
import { FiltersPanel } from './FiltersPanel';           // feuille 'use client'
import { ListingGrid } from './ListingGrid';             // rendu côté serveur, virtualisé si énorme

export default async function SearchPage({ searchParams }) {
  const listings = await searchListings(await searchParams); // tri par pertinence fait dans la base / le moteur de recherche
  return (
    <>
      <Image src={listings[0].photo} alt="" width={1200} height={400} priority /> {/* LCP préchargé, taille fixe : pas de CLS */}
      <FiltersPanel />
      <ListingGrid listings={listings} />
      <Script src="https://chat.example.com/widget.js" strategy="lazyOnload" />
    </>
  );
}
```

Pour le travail côté client inévitable, rendez la main au main thread afin que les taps soient traités entre deux morceaux :

```js
const yieldToMain = () =>
  globalThis.scheduler?.yield ? scheduler.yield() : new Promise((r) => setTimeout(r, 0));

async function enrichInChunks(items, chunkSize = 50) {
  const out = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(...items.slice(i, i + chunkSize).map(enrich));
    await yieldToMain();                                 // aucune tâche de plus de ~50ms
  }
  return out;
}
```

Pourquoi ça marche : les données terrain avec attribution désignent l'élément et l'interaction exacts ; le rendu serveur retire des centaines de composants de l'hydratation (la long task de 3.2s disparaît) ; l'image LCP est dans le HTML avec `priority` (préchargée) et des dimensions fixes ; le SDK de chat se charge une fois la page inactive ; le travail découpé garde chaque tâche courte, ce qui maintient l'INP sous 200ms. Vérifiez en relançant la trace avec un CPU throttling 6x et en surveillant le p75 dans le RUM les jours suivants.

## How to say it in the interview

- « D'abord les données terrain - RUM avec l'attribution de web-vitals, segmenté par catégorie d'appareil - car le labo sur une machine de développeur masque le coût CPU. Ensuite, je reproduis avec du CPU throttling et j'analyse les long tasks dans le panneau Performance. »
- « Le LCP est un problème de chargement (serveur, chemin critique, priorité des images), l'INP un problème de main thread (long tasks, hydratation, gestionnaires lourds), le CLS un problème d'espace réservé. »
- Piège : optimiser le score Lighthouse au lieu des données terrain au p75 ; et le « TTI » ne fait plus partie des Core Web Vitals - parlez d'INP et de Total Blocking Time. Question de suivi : comment trouver les interactions lentes - l'attribution de l'INP plus la Long Animation Frames API.
- Compromis : déplacer du travail côté serveur réduit le CPU client mais augmente le TTFB et le coût serveur ; streamez avec Suspense pour garder un TTFB bas.
