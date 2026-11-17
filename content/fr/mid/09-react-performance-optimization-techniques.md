# Quelles techniques utilisez-vous pour optimiser les performances d'une application React ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Quelles sont les différentes techniques d'optimisation en React ?
- Comment améliorez-vous les performances d'une application React ?
- Comment optimisez-vous les performances des applications React ?

## The concept (short answer)
Commencez par **mesurer** (Lighthouse/Core Web Vitals pour le chargement, le Profiler des React DevTools et le panneau Performance pour l'exécution). Choisissez ensuite la technique adaptée au goulot d'étranglement :

| Problème | Technique |
|---|---|
| Des composants se re-render sans raison | Colocation du state, `memo` + `useMemo`/`useCallback`, React Compiler (pour approfondir : `08-unnecessary-rerenders-and-memo.md`) |
| Calcul coûteux à chaque rendu | `useMemo`, ou le déplacer côté serveur / dans un Web Worker |
| Gros bundle JS, premier chargement lent | Code splitting avec `React.lazy`, `import()` dynamique, chunks par route (pour approfondir : `13-lazy-loading-code-splitting.md`) |
| Longues listes / gros tableaux | Virtualisation (`@tanstack/react-virtual`, `react-window`) : n'afficher que les lignes visibles |
| La saisie rame pendant la mise à jour d'une grosse liste | `useTransition` / `useDeferredValue` : marquer les mises à jour lourdes comme non urgentes |
| Une mise à jour du context re-render toute l'app | Découper les contexts, mémoïser la valeur, ou utiliser un store avec sélecteurs (Zustand) |
| LCP lent, décalages de mise en page | Optimisation des images : `next/image` ou `srcset`, formats modernes, dimensions explicites, `loading="lazy"` sous la ligne de flottaison, `fetchpriority="high"` pour l'image principale (hero) |
| Cascades de requêtes (waterfalls) | Fetch côté serveur (RSC), requêtes en parallèle, cache avec TanStack Query |

Quelques mots sur chacune :
- **Mémoïsation** : n'aide que si les props sont stables et que le travail évité est coûteux. N'enveloppez pas tout.
- **Colocation du state** : gardez le state dans le composant le plus bas qui en a besoin ; les mises à jour fréquentes ne re-render alors qu'un petit sous-arbre.
- **Code splitting** : n'envoyez que le JS de la route courante ; chargez les widgets lourds (éditeurs, graphiques, cartes) à la demande.
- **Virtualisation** : 10 000 lignes dans le DOM, c'est lent, aussi bien mémoïsé que soit le code. Affichez-en environ 30.
- **Transitions** : gardez la saisie réactive en laissant React interrompre le rendu non urgent.
- **Images** : en général les éléments les plus lourds de la page et l'élément LCP le plus fréquent.

## Real-life example: the problem
Un site d'annonces immobilières : la page de recherche met 6 secondes à charger sur mobile (LCP de 5.8s), et la saisie dans le filtre « Ville » fige la page un instant à chaque frappe. Un cas typique : une équipe voit de mauvais Core Web Vitals dans la Search Console et personne ne sait par où commencer.

```jsx
import { MapView } from './MapView'; // bibliothèque de cartes d'~400KB, chargée sur chaque page

export default function SearchPage({ listings }) { // 3 000 annonces
  const [city, setCity] = useState('');
  const filtered = listings.filter((l) => l.city.toLowerCase().includes(city.toLowerCase()));

  return (
    <>
      <img src="/hero-4000px.jpg" />                    {/* 2.5MB, sans dimensions, sans priorité */}
      <input value={city} onChange={(e) => setCity(e.target.value)} />
      <MapView listings={filtered} />
      <ul>
        {filtered.map((l) => <ListingCard key={l.id} listing={l} />)} {/* 3 000 lignes dans le DOM */}
      </ul>
    </>
  );
}
```
Constats du Profiler et de Lighthouse : la grande image hero est l'élément LCP, la bibliothèque de cartes alourdit le bundle principal, et chaque frappe fait le rendu de 3 000 cartes d'annonces plus la carte géographique.

## How to fix it
```jsx
'use client'; // Next.js App Router : cette partie de la page utilise du state et des hooks

import { lazy, Suspense, useDeferredValue, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useVirtualizer } from '@tanstack/react-virtual';

const MapView = lazy(() => import('./MapView')); // chunk séparé, chargé au moment du rendu

export default function SearchPage({ listings }) {
  const [city, setCity] = useState('');
  const deferredCity = useDeferredValue(city); // l'input se met à jour d'abord, la liste suit

  const filtered = useMemo(() => {
    const q = deferredCity.toLowerCase();
    return listings.filter((l) => l.city.toLowerCase().includes(q));
  }, [listings, deferredCity]);

  const parentRef = useRef(null);
  const rows = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
  });

  return (
    <>
      <Image src="/hero.jpg" alt="Homes for sale" width={1200} height={500} priority sizes="100vw" />
      <input value={city} onChange={(e) => setCity(e.target.value)} />
      <Suspense fallback={<div className="map-skeleton" />}>
        <MapView listings={filtered} />
      </Suspense>
      <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
        <div style={{ height: rows.getTotalSize(), position: 'relative' }}>
          {rows.getVirtualItems().map((v) => (
            <div key={filtered[v.index].id}
                 style={{ position: 'absolute', top: 0, width: '100%', transform: `translateY(${v.start}px)` }}>
              <ListingCard listing={filtered[v.index]} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
```
Pourquoi ça marche : l'image hero est redimensionnée, servie dans un format moderne et chargée en priorité haute (meilleur LCP). Le code de la carte est dans son propre chunk (bundle principal plus léger). `useDeferredValue` garde l'input instantané pendant que la liste rattrape son retard dans un rendu interruptible. La virtualisation ne garde dans le DOM que les cartes visibles. Chaque correctif cible un goulot d'étranglement mesuré.

## How to say it in the interview
- « Je mesure d'abord, puis je distingue les performances de **chargement** (taille du bundle, images, cascades de données) des performances d'**exécution** (re-renders, gros DOM, travail bloquant). Chacune a ses propres outils. »
- « Mes gains les plus importants viennent en général du code splitting, de l'optimisation des images, de la virtualisation des longues listes et de la colocation du state. La mémoïsation vient après, ou le React Compiler s'en charge. »
- Piège : « J'utilise `useMemo` partout. » Le recruteur vous demandera comment vous savez que cela a aidé. Répondez avec une mesure avant/après au Profiler.
- Compromis : chaque optimisation ajoute de la complexité (états de chargement pour les chunks lazy, hauteurs de ligne fixes pour la virtualisation, UI qui semble en retard avec les valeurs différées). Appliquez-les là où les chiffres le justifient.
