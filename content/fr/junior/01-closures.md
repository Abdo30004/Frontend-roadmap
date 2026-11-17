# Qu'est-ce qu'une closure en JavaScript, et comment l'utiliser ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Qu'est-ce qu'une closure ? Expliquez avec un exemple.
- Que sont les closures en JavaScript et comment les utilisez-vous ?

## The concept (short answer)
- Une **closure** est une fonction accompagnée des variables de la portée (scope) dans laquelle elle a été **créée**. La fonction garde l'accès à ces variables même après que la fonction externe a terminé son exécution.
- Pourquoi ça marche : JavaScript utilise une **portée lexicale**. Quand une fonction est créée, elle conserve une référence vers sa portée environnante. Tant que la fonction interne reste accessible, cette portée reste en mémoire et n'est pas libérée par le garbage collector.
- La fonction détient une **référence vivante** vers la variable, pas une copie de sa valeur. Si la variable change plus tard, la closure voit la nouvelle valeur.
- Usages courants : état privé (compteurs, caches), fabriques de fonctions (`makeFormatter('EUR')`), event handlers et callbacks qui « se souviennent » de données, `debounce`/`throttle`, et la façon dont les hooks React capturent les props et le state à chaque rendu.
- Pièges : les **stale closures** (un callback garde une ancienne valeur) et les fuites mémoire (un listener qui vit longtemps garde un gros objet en vie).

```js
function makeCounter() {
  let count = 0;            // privé : rien à l'extérieur ne peut y toucher directement
  return () => ++count;     // la fonction fléchée « capture » count (closure)
}
const next = makeCounter();
next(); // 1
next(); // 2 -> count a survécu après le retour de makeCounter()
```

## Real-life example: the problem
Imaginez la page produit d'un site e-commerce avec un champ de recherche qui suggère des produits pendant que l'utilisateur tape. Le développeur a écrit un helper `debounce` pour que l'API ne soit appelée qu'une fois que l'utilisateur a arrêté de taper pendant 300 ms. Les utilisateurs ont signalé que les suggestions clignotaient toujours, et l'onglet Network montrait une requête **par frappe**. Le debounce ne servait à rien.

Le bug : la variable `timerId` est créée **à l'intérieur** de la fonction retournée, donc chaque frappe obtient un tout nouveau `timerId`. `clearTimeout` n'annule rien.

```js
// BUGUÉ : debounce.js
export function debounce(fn, delay) {
  return function (...args) {
    let timerId;                      // nouvelle variable à CHAQUE appel
    clearTimeout(timerId);            // annule toujours undefined
    timerId = setTimeout(() => fn(...args), delay);
  };
}

// search.js
const input = document.querySelector('#search');

async function fetchSuggestions(query) {
  const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`);
  renderSuggestions(await res.json());
}

input.addEventListener('input', debounce((e) => {
  fetchSuggestions(e.target.value);
}, 300));
// Taper « laptop » déclenche 6 requêtes.
```

## How to fix it
Déplacez `timerId` dans la fonction **externe**, pour que chaque appel de la fonction retournée partage la même variable grâce à la closure.

```js
// CORRIGÉ : debounce.js
export function debounce(fn, delay) {
  let timerId;                        // créée une seule fois, partagée par tous les appels

  return function (...args) {
    clearTimeout(timerId);            // annule l'appel précédent en attente
    timerId = setTimeout(() => {
      fn.apply(this, args);           // conserve `this` pour un usage en méthode
    }, delay);
  };
}

// search.js (inchangé)
input.addEventListener('input', debounce((e) => {
  fetchSuggestions(e.target.value);
}, 300));
// Taper « laptop » déclenche 1 requête, 300 ms après la dernière touche.
```

Pourquoi ça marche : `debounce` s'exécute **une seule fois** et crée un seul `timerId`. La fonction retournée est une closure sur cette unique variable, donc chaque frappe peut annuler le timer posé par la frappe précédente. La variable est privée : aucun autre code ne peut la réinitialiser ou la casser.

Même idée pour un état privé, avec une fabrique de fonctions :

```js
function makePriceFormatter(currency) {
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency });
  return (amount) => fmt.format(amount); // se souvient de fmt et de currency
}
const toEUR = makePriceFormatter('EUR');
toEUR(19.9); // "€19.90"
```

Alternatives : une classe avec un champ privé (`#timerId`) fait le même travail. En React, on garde généralement le timer dans un `useRef` pour qu'il survive aux re-renders.

## How to say it in the interview
- « Une closure est une fonction qui se souvient des variables de la portée où elle a été définie, même après la fin de l'exécution de cette portée. Elle garde une référence, pas une copie. »
- Donnez tout de suite un usage concret : un état privé (compteur, cache) ou `debounce`. Les recruteurs préfèrent un vrai cas d'usage à une définition.
- Question de suivi fréquente : l'énigme du `var` dans une boucle `for` avec `setTimeout`. Tous les callbacks capturent le même `i`, donc on obtient la valeur finale. La correction : `let` (une nouvelle liaison à chaque itération) ou une IIFE.
- Compromis : les closures gardent leur portée en vie. Un event listener qui vit longtemps et capture un gros objet peut provoquer une fuite mémoire, donc retirez les listeners dont vous n'avez plus besoin. En React, méfiez-vous des **stale closures** dans les callbacks de `useEffect` et de `setInterval`.
