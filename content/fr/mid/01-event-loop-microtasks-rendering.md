# Comment fonctionne l'event loop de JavaScript (tasks, microtasks, Promises, rendu) ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Expliquez l'event loop en JavaScript.
- Comment l'event loop gère-t-elle les Promises, async/await et le rendu ?

## The concept (short answer)
- JavaScript s'exécute sur **un seul thread** avec une seule **call stack**. Un code synchrone long bloque tout : les clics, les timers et l'affichage (paint).
- L'event loop du navigateur répète ce cycle :
  1. Prendre **une task** (macrotask) dans une file de tasks : un callback de `setTimeout`, un gestionnaire de clic, un événement `message`, un callback réseau. L'exécuter jusqu'à ce que la stack soit vide.
  2. **Vider entièrement la file des microtasks** : `.then/.catch/.finally` des Promises, code situé après un `await`, `queueMicrotask`, `MutationObserver`. Les microtasks ajoutées pendant cette étape s'exécutent elles aussi avant de passer à la suite.
  3. **Éventuellement faire un rendu** (environ toutes les 16.6ms à 60Hz) : exécuter les callbacks de `requestAnimationFrame`, puis style, layout et paint.
- `async/await` n'est que du sucre syntaxique au-dessus des Promises. Tout ce qui précède le premier `await` s'exécute de façon synchrone. Le reste de la fonction est mis en file comme microtask une fois la valeur attendue résolue.
- Pourquoi c'est important : les microtasks peuvent **affamer le rendu**, car le navigateur ne peut pas peindre tant que la file n'est pas vide. Une long task (>50ms) provoque du jank visible et dégrade l'INP.

### Casse-tête : dans quel ordre s'affichent les logs ?
```js
console.log('1 sync');

setTimeout(() => console.log('2 timeout'), 0);

requestAnimationFrame(() => console.log('3 rAF'));

Promise.resolve()
  .then(() => console.log('4 micro A'))
  .then(() => console.log('5 micro B'));

(async () => {
  console.log('6 async start');
  await null;
  console.log('7 after await');
})();

queueMicrotask(() => console.log('8 queueMicrotask'));

console.log('9 sync end');
```
Sortie :
```
1 sync
6 async start          <- la partie synchrone d'une fonction async s'exécute immédiatement
9 sync end
4 micro A              <- les microtasks s'exécutent dans l'ordre FIFO
7 after await
8 queueMicrotask
5 micro B              <- le .then chaîné n'a été mis en file qu'une fois A terminé
2 timeout              <- task suivante (en général avant rAF, mais ce n'est pas garanti)
3 rAF                  <- juste avant le prochain paint
```
L'ordre entre `2 timeout` et `3 rAF` dépend du timing des frames. Les microtasks passent toujours avant les deux.

## Real-life example: the problem
Un dashboard logistique importe un CSV de 20 000 lignes d'expéditions. Le développeur ajoute une barre de progression et « rend la main » avec `await Promise.resolve()` après chaque bloc, en s'attendant à voir la barre avancer. Les utilisateurs voient l'onglet se figer pendant 4 secondes avec la barre bloquée à 0 %, puis elle saute directement à 100 %. Sur les portables les plus lents, Chrome affiche la boîte de dialogue « Page ne répondant pas ».

```js
async function importRows(rows, onProgress) {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    rows.slice(i, i + CHUNK).forEach(validateAndNormalize); // travail CPU lourd
    onProgress(Math.round(((i + CHUNK) / rows.length) * 100)); // met à jour le DOM
    await Promise.resolve(); // BUG : cela ne fait que mettre une microtask en file
  }
}
```
Pourquoi ça casse : chaque `await Promise.resolve()` place la suite de la boucle dans la **file des microtasks**. Le navigateur vide les microtasks avant de faire le rendu, donc toute la boucle forme un seul long bloc. Aucun paint n'a lieu et aucun clic n'est traité avant la fin.

## How to fix it
Rendez la main à une **task** (macrotask) pour que le navigateur puisse faire le rendu et traiter les entrées utilisateur entre deux blocs :

```js
// Préférer scheduler.yield() quand il est disponible ; sinon, se rabattre sur une macrotask.
function yieldToMain() {
  if (globalThis.scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function importRows(rows, onProgress) {
  const CHUNK = 500;
  let deadline = performance.now() + 50; // garder chaque task sous ~50ms

  for (let i = 0; i < rows.length; i += CHUNK) {
    rows.slice(i, i + CHUNK).forEach(validateAndNormalize);

    if (performance.now() >= deadline) {
      onProgress(Math.min(100, Math.round(((i + CHUNK) / rows.length) * 100)));
      await yieldToMain(); // termine la task courante : le rendu et les entrées peuvent s'exécuter
      deadline = performance.now() + 50;
    }
  }
  onProgress(100);
}
```
Pourquoi ça marche : `setTimeout`/`scheduler.yield()` termine la task courante. L'event loop peut alors exécuter l'étape de rendu (la barre de progression se redessine) et traiter les clics en attente avant le bloc suivant. `scheduler.yield()` est préférable à `setTimeout` car la continuation conserve sa priorité et ne se retrouve pas derrière les autres tasks en file ni derrière le bridage à 4ms des timers imbriqués.

Alternatives : déplacer le parsing dans un **Web Worker** (la meilleure option pour un travail CPU vraiment lourd). Pour les mises à jour visuelles, utilisez `requestAnimationFrame` afin que les écritures dans le DOM aient lieu une seule fois par frame.

## How to say it in the interview
- « Une task s'exécute, puis **toutes** les microtasks sont vidées, puis le navigateur peut faire un rendu. Les Promises et les continuations d'`await` sont des microtasks, donc elles passent toujours avant le prochain `setTimeout` et avant le prochain paint. »
- Piège : « `await` rend mon code non bloquant. » Faux. Il ne fait que reporter le code dans une microtask. Pour laisser le navigateur peindre, vous devez rendre la main via une **task** (`setTimeout`, `MessageChannel`, `scheduler.yield()`) ou déplacer le travail dans un worker.
- Question de relance « où s'exécute `requestAnimationFrame` ? » : dans l'étape de rendu, juste avant style/layout/paint. C'est le bon endroit pour les écritures DOM des animations, et il est mis en pause dans les onglets en arrière-plan.
- Compromis : des blocs plus petits rendent l'UI plus réactive, mais le traitement total prend plus de temps (surcoût d'ordonnancement). Un budget de temps par bloc (environ 50ms) est un bon équilibre.
