# Le virtual DOM, la reconciliation et React Fiber

**Niveau :** Senior
**Merged from (original phrasings):**
- Expliquez le virtual DOM dans React et comment il améliore les performances.
- Que se passe-t-il pendant la reconciliation de React, et comment fonctionne Fiber ?

## The concept (short answer)

**Commencez simple (la réponse junior) :**
- Le « virtual DOM » est l'arbre d'objets JS ordinaires (des éléments React) que renvoient vos composants. Il est peu coûteux à créer et à jeter.
- À chaque mise à jour, React construit un nouvel arbre, le compare au précédent (**reconciliation**) et n'applique que l'ensemble minimal de mutations du vrai DOM. Le gain n'est pas que « le virtual DOM est plus rapide que le DOM » (c'est un pur surcoût par-dessus le DOM) ; le gain, c'est que vous écrivez du code déclaratif « UI = f(state) » et que React regroupe et minimise pour vous les écritures coûteuses dans le DOM.

**Allez plus loin (la réponse senior) :**
- **Heuristiques de diff (O(n) au lieu de O(n^3)) :** (1) des éléments d'un **type différent** produisent un sous-arbre différent - React démonte l'ancien (state détruit, effets nettoyés) et monte le nouveau, sans comparer les enfants ; (2) un même type signifie que React conserve l'instance / le nœud DOM et ne met à jour que les props ; (3) les **keys** identifient les enfants d'une liste d'un rendu à l'autre, ce qui permet à React de déplacer au lieu de recréer. Les keys basées sur l'index cassent lors d'un réordonnancement ou d'une insertion (le state reste collé à la mauvaise ligne).
- **« Type » signifie identité :** `<A/>` vs `<B/>` à la même position, ou un composant défini à l'intérieur d'un autre composant (nouvelle fonction à chaque rendu), c'est un nouveau type à chaque fois, donc il est remonté.
- **Fiber** est la réécriture du reconciler (React 16). Chaque instance de composant reçoit un nœud fiber : une unité de travail avec des pointeurs `child` / `sibling` / `return`, ce qui permet à React de parcourir l'arbre avec une boucle plutôt qu'en récursion, et de **mettre en pause, reprendre ou abandonner** le travail.
- **Double buffering :** l'arbre `current` est celui affiché à l'écran ; React construit un arbre `workInProgress` (relié via `alternate`) et les échange au moment du commit.
- **Deux phases :** la **phase de render** (appel des composants, diff, marquage des effets) est pure et, en concurrent rendering, **interruptible** - elle peut être relancée, donc les composants doivent être purs. La **phase de commit** (mutations du DOM, refs, `useLayoutEffect`, puis `useEffect`) est synchrone et jamais interrompue, si bien que l'utilisateur ne voit jamais une UI à moitié mise à jour.
- **Priorités / lanes :** chaque mise à jour reçoit une lane (un bitmask) : `SyncLane` pour les entrées discrètes comme les clics, la lane par défaut, `TransitionLanes` pour `startTransition`, les lanes idle. Le scheduler travaille par tranches d'environ 5ms et rend la main au navigateur ; une mise à jour de haute priorité peut interrompre un rendu de basse priorité en cours.

## Real-life example: the problem

Un formulaire de devis d'assurance. L'utilisateur saisit son nom, son adresse et les informations de sa voiture, puis coche « Ajouter la couverture premium ». La carte autour du formulaire change de style - et **tous les champs saisis sont effacés**. Tickets au support : « le formulaire supprime mes données ». Personne n'a touché au state du formulaire ; le reconciler a fait exactement ce qu'on lui a demandé.

```jsx
function QuoteForm() {
  const [values, setValues] = useState({ name: '', address: '', plate: '' });
  const update = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  return (
    <>
      <input name="name" value={values.name} onChange={update} />
      <input name="address" value={values.address} onChange={update} />
      <input name="plate" value={values.plate} onChange={update} />
    </>
  );
}

function QuotePage() {
  const [premium, setPremium] = useState(false);

  // BUG 1 : le type du parent change, donc tout le sous-arbre (et le state de QuoteForm) est remonté
  const Card = premium ? PremiumCard : BasicCard;

  // BUG 2 : un composant défini pendant le rendu est un tout nouveau type à chaque rendu
  const PremiumToggle = () => (
    <input type="checkbox" checked={premium} onChange={(e) => setPremium(e.target.checked)} />
  );

  return (
    <Card>
      <QuoteForm />
      <PremiumToggle />
    </Card>
  );
}
```

Ce que voit React au moment du toggle : la position 0 était `BasicCard`, c'est maintenant `PremiumCard` - type différent, donc il détruit `BasicCard` et tout ce qu'il contient, y compris la fiber de `QuoteForm` et son `useState`. Le bug 2 est plus subtil : `PremiumToggle` est une nouvelle fonction à chaque rendu de `QuotePage`, donc la case à cocher (et tout ce qu'elle contient) est remontée à chaque frappe qui provoque un nouveau rendu du parent, et perd le focus.

## How to fix it

Gardez **la forme de l'arbre et les types de composants stables** ; exprimez la différence visuelle via les props.

```jsx
function Card({ variant, children }) {
  return <section className={variant === 'premium' ? 'card card--premium' : 'card'}>{children}</section>;
}

// Défini au niveau du module : identité stable d'un rendu à l'autre
function PremiumToggle({ checked, onChange }) {
  return <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />;
}

function QuotePage() {
  const [premium, setPremium] = useState(false);
  return (
    <Card variant={premium ? 'premium' : 'basic'}>
      <QuoteForm />
      <PremiumToggle checked={premium} onChange={setPremium} />
    </Card>
  );
}
```

Pourquoi ça marche : l'élément à chaque position a désormais le même type avant et après le toggle, donc React réutilise les fibers existantes et ne modifie que le `className`. Le state de `QuoteForm` vit sur sa fiber, qui survit.

Alternatives : si les deux mises en page doivent vraiment être des composants différents, **remontez le state du formulaire** (ou placez-le dans une librairie de formulaires / dans l'URL) pour qu'il survive à un remontage. Et utilisez volontairement la même règle quand vous *voulez* une réinitialisation : `<QuoteForm key={customerId} />` jette le state quand on change de client.

Les keys dans les listes suivent la même logique :

```jsx
// MAUVAIS : supprimez la ligne 0 et la note saisie dans la ligne 1 s'affiche dans la mauvaise ligne
{drivers.map((d, i) => <DriverRow key={i} driver={d} />)}
// BON : l'identité suit les données
{drivers.map((d) => <DriverRow key={d.id} driver={d} />)}
```

## How to say it in the interview

- « Le virtual DOM n'est pas plus rapide que le DOM ; il permet à React de calculer un ensemble minimal de mutations à partir d'une description déclarative. La reconciliation est un diff heuristique en O(n) : type différent signifie remontage, même type signifie mise à jour, et les keys donnent une identité aux éléments d'une liste. »
- « Fiber transforme l'arbre de composants en liste chaînée d'unités de travail. La phase de render est interruptible et priorisée par les lanes ; la phase de commit est synchrone, donc l'UI n'est jamais appliquée à moitié. »
- Piège / question de suivi : « Pourquoi le state de mon formulaire s'est-il réinitialisé ? » - un changement de type à cette position (wrapper conditionnel, composant déclaré dans le rendu, `key` modifiée). Autre point : comme le rendu peut s'exécuter plusieurs fois et être abandonné, les effets de bord dans le rendu sont des bugs - c'est pour cela que StrictMode l'appelle deux fois.
- Compromis : les heuristiques sacrifient l'optimalité du diff au profit de la vitesse - React ne détectera pas qu'un sous-arbre a « déménagé » sous un autre parent ; il le remonte. Structurez votre arbre pour que les éléments stables restent à des positions stables.
