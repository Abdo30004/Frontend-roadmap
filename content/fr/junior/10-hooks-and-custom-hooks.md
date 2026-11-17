# Que sont les hooks React, et comment créer un custom hook ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Que sont les hooks React et comment créer des custom hooks ?

## The concept (short answer)
- Les **hooks** sont des fonctions dont le nom commence par `use` et qui permettent aux composants fonctionnels d'utiliser les fonctionnalités de React : le state (`useState`, `useReducer`), les effets de bord (`useEffect`), les refs (`useRef`), le context (`useContext`), la mémoïsation (`useMemo`, `useCallback`), et plus encore.
- React stocke les données des hooks de chaque composant dans une liste et les associe **selon l'ordre d'appel** à chaque rendu. C'est pour cela que les **règles des hooks** (Rules of Hooks) existent :
  1. N'appelez les hooks qu'au **niveau supérieur** : jamais dans un `if`, une boucle, une fonction imbriquée ou après un `return` anticipé.
  2. N'appelez les hooks que depuis des **composants fonctionnels React ou des custom hooks**, pas depuis des fonctions classiques ni des event handlers.
- Un **custom hook** est votre propre fonction, dont le nom commence par `use` et qui appelle d'autres hooks. Il permet de **réutiliser une logique avec état** (pas de l'UI) entre plusieurs composants.
- Chaque composant qui appelle un custom hook obtient son **propre state indépendant**. Les custom hooks partagent de la logique, pas des données.
- Le plugin ESLint `eslint-plugin-react-hooks` vérifie ces règles ainsi que les dépendances manquantes des effets.

## Real-life example: the problem
Imaginez un site d'actualités où la page article et la section commentaires ont toutes deux besoin de savoir si le visiteur est sur un écran mobile, et la popup de newsletter aussi. Le même code de `resize` avait été copié-collé dans trois composants ; une des copies oubliait de retirer son listener, si bien que la page devenait **plus lente après chaque navigation**. Une autre copie plaçait un hook dans un `if`, et les utilisateurs qui se connectaient en cours de session voyaient la page **planter** avec « Rendered more hooks than during the previous render ».

```jsx
// BUGUÉ : ArticlePage.jsx
import { useEffect, useState } from 'react';

export function ArticlePage({ article, user }) {
  if (!article) return <p>Loading...</p>;      // return anticipé AVANT les hooks

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    // pas de cleanup -> le listener reste après le démontage
  }, []);

  if (user) {
    const [saved, setSaved] = useState(false); // hook dans une condition
  }

  return isMobile ? <MobileArticle article={article} /> : <DesktopArticle article={article} />;
}
```

Quand `article` passe de `undefined` à chargé, ou que `user` passe de `null` à connecté, le nombre et l'ordre des hooks changent d'un rendu à l'autre : React ne peut plus associer ses données stockées et lève une erreur.

## How to fix it
Extrayez la logique réutilisable dans un custom hook avec un cleanup correct, et appelez chaque hook au niveau supérieur, avant tout `return` anticipé.

```jsx
// CORRIGÉ : hooks/useMediaQuery.js
import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);

    setMatches(mql.matches);                    // resynchronise si query a changé
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange); // cleanup
  }, [query]);

  return matches;
}
```

```jsx
// CORRIGÉ : ArticlePage.jsx
import { useState } from 'react';
import { useMediaQuery } from './hooks/useMediaQuery';

export function ArticlePage({ article, user }) {
  const isMobile = useMediaQuery('(max-width: 767px)'); // niveau supérieur
  const [saved, setSaved] = useState(false);            // niveau supérieur, toujours appelé

  if (!article) return <p>Loading...</p>;               // return anticipé APRÈS les hooks

  return (
    <>
      {user && (
        <button onClick={() => setSaved(true)} disabled={saved}>
          {saved ? 'Saved' : 'Save for later'}
        </button>
      )}
      {isMobile ? <MobileArticle article={article} /> : <DesktopArticle article={article} />}
    </>
  );
}

// Réutilisable partout, chaque composant avec son propre state :
// const isMobile = useMediaQuery('(max-width: 767px)');
// const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
```

Pourquoi ça marche : les hooks sont désormais appelés dans le même ordre à chaque rendu, donc React peut associer son state stocké. La condition a été déplacée dans le JSX (ou dans la logique du hook), et non autour de l'appel du hook. Le custom hook regroupe le listener et son cleanup au même endroit, donc aucun composant ne peut l'oublier. `matchMedia` ne se déclenche que lorsque le breakpoint est franchi, pas à chaque pixel de redimensionnement.

Un autre petit custom hook très courant :

```jsx
import { useCallback, useState } from 'react';

export function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn((v) => !v), []);
  return [on, toggle];
}
```

Pour la récupération de données, préférez une bibliothèque (TanStack Query, SWR) ou les fonctionnalités du framework à un `useFetch` écrit à la main.

## How to say it in the interview
- « Les hooks permettent aux composants fonctionnels d'utiliser le state, les effets, les refs et le context. React les suit selon leur ordre d'appel, donc ils doivent être appelés au niveau supérieur, toujours dans le même ordre. »
- « Un custom hook est une fonction qui commence par `use` et qui appelle d'autres hooks ; il partage de la logique, pas du state. Chaque composant qui l'utilise obtient sa propre copie. »
- Piège : placer un hook après un `return` anticipé ou dans un `if` casse l'ordre et provoque les erreurs « Rendered more/fewer hooks ».
- Compromis : ne transformez pas chaque petit bout de code en hook ; extrayez-en un quand la logique est réutilisée ou quand cela rend clairement un composant plus lisible. Cachez les effets et le cleanup dans le hook pour que les appelants ne puissent pas mal les utiliser.
