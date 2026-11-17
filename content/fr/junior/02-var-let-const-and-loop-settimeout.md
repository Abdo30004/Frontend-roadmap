# Quelle est la différence entre var, let et const (et pourquoi var casse une boucle for avec setTimeout) ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Quelle est la différence entre « var », « let » et « const » ?
- Expliquez la différence entre var, let et const en JavaScript.
- Que se passe-t-il quand on utilise « var » dans une boucle « for » avec « setTimeout() » ?
- Question de code : `for (var i = 0; i < 3; i++) { setTimeout(() => { console.log(i); }); }` Quel est le résultat ? Pourquoi ? Comment le corriger avec let ou une closure ?

## The concept (short answer)

| | `var` | `let` | `const` |
|---|---|---|---|
| Portée | fonction | bloc `{ }` | bloc `{ }` |
| Hoisting | remontée (hoisted), initialisée à `undefined` | remontée, mais dans la **Temporal Dead Zone (TDZ)** jusqu'à l'exécution de sa ligne | comme `let` |
| Redéclaration dans la même portée | oui | non (SyntaxError) | non |
| Réaffectation | oui | oui | **non** |
| Propriété globale (`window.x`) | oui, au niveau global | non | non |

- `const` empêche la **réaffectation**, pas la mutation : `const cart = []; cart.push(item)` fonctionne très bien.
- Utiliser `let`/`const` avant la ligne de déclaration lève une `ReferenceError` (TDZ). Utiliser `var` avant donne `undefined`, ce qui masque les bugs.
- Règle moderne : `const` par défaut, `let` quand vous devez réaffecter, et évitez `var`.

### La question de code

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => {
    console.log(i);
  });
}
```

**Résultat :** `3`, `3`, `3`.

**Pourquoi :**
1. `var` a une portée de fonction, donc il n'existe qu'**un seul** `i` partagé par toute la boucle.
2. `setTimeout` place chaque callback dans la file des tâches (task queue). Ils ne s'exécutent qu'après la fin du code synchrone en cours (toute la boucle), même avec un délai de 0.
3. À la fin de la boucle, `i` vaut `3` (c'est la valeur qui a rendu `i < 3` faux).
4. Les trois callbacks sont des closures sur le **même** `i`, donc tous affichent `3`.

**Correction 1 : utiliser `let` (la meilleure).** `let` dans l'en-tête d'un `for` crée une **nouvelle liaison à chaque itération**, donc chaque callback capture son propre `i`.

```js
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i)); // 0, 1, 2
}
```

**Correction 2 : une closure avec une IIFE (la méthode d'avant ES6).** L'appel de fonction crée une nouvelle portée avec sa propre copie `j`.

```js
for (var i = 0; i < 3; i++) {
  (function (j) {
    setTimeout(() => console.log(j)); // 0, 1, 2
  })(i);
}
```

**Correction 3 : passer la valeur en argument à `setTimeout`.** Les arguments supplémentaires sont transmis au callback.

```js
for (var i = 0; i < 3; i++) {
  setTimeout((j) => console.log(j), 0, i); // 0, 1, 2
}
```

## Real-life example: the problem
Imaginez une application de livraison de repas qui affiche un écran « Votre commande est en préparation » avec 3 étapes (Reçue, En cuisine, En route). Chaque étape doit s'allumer l'une après l'autre, toutes les secondes. En production, rien ne s'est animé pendant 3 secondes, puis la page a levé trois fois `TypeError: Cannot read properties of undefined (reading 'classList')`. Les indicateurs d'étape sont restés gris.

```js
// BUGUÉ
const steps = document.querySelectorAll('.order-step'); // 3 éléments

for (var i = 0; i < steps.length; i++) {
  setTimeout(() => {
    steps[i].classList.add('active'); // i vaut 3 ici -> steps[3] est undefined
  }, (i + 1) * 1000);
}
```

Remarque : les délais sont corrects (1 s, 2 s, 3 s) car `(i + 1) * 1000` est calculé **pendant** la boucle. Seul le code **à l'intérieur** du callback lit `i` plus tard, une fois la boucle terminée.

## How to fix it

```js
// CORRIGÉ
const steps = document.querySelectorAll('.order-step');

for (let i = 0; i < steps.length; i++) {
  setTimeout(() => {
    steps[i].classList.add('active'); // chaque callback a son propre i : 0, 1, 2
  }, (i + 1) * 1000);
}

// Bien aussi : forEach donne à chaque callback son propre paramètre
steps.forEach((step, index) => {
  setTimeout(() => step.classList.add('active'), (index + 1) * 1000);
});
```

Pourquoi ça marche : avec `let`, la boucle crée un nouveau `i` à chaque itération, et chaque fonction fléchée capture sa propre copie. `forEach` fonctionne aussi, car chaque appel du callback a ses propres paramètres `step` et `index`.

Un autre piège de `const` à connaître :

```js
const user = { name: 'Ana' };
user.name = 'Bob';   // OK : on modifie l'objet
user = {};           // TypeError: Assignment to constant variable.
// Utilisez Object.freeze(user) si vous avez vraiment besoin d'un objet immuable (superficiel uniquement).
```

## How to say it in the interview
- « `var` a une portée de fonction et est remonté (hoisted) avec la valeur `undefined` ; `let` et `const` ont une portée de bloc et restent dans la Temporal Dead Zone jusqu'à leur déclaration. `const` empêche la réaffectation, pas la mutation. »
- Pour la boucle : « Ça affiche 3, 3, 3 parce qu'il n'y a qu'un seul `i` partagé et que les callbacks s'exécutent après la boucle. `let` crée une nouvelle liaison à chaque itération, donc ça affiche 0, 1, 2. Avant ES6, on utilisait une IIFE pour créer une nouvelle portée. »
- Piège : dire que « `setTimeout` avec 0 ms s'exécute immédiatement ». Ce n'est pas le cas. Il s'exécute une fois la pile d'appels (call stack) vide (event loop).
- Compromis et bonne pratique : utilisez `const` par défaut, car il exprime l'intention et évite les réaffectations accidentelles. Utilisez `let` pour les compteurs et les valeurs qui changent. Les linters (`no-var`, `prefer-const`) imposent cette règle.
