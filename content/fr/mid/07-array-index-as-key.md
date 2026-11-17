# Qu'est-ce qui casse concrètement quand on utilise l'index du tableau comme key ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Qu'est-ce qui casse concrètement quand on utilise l'index du tableau comme key ?

## The concept (short answer)
- React utilise `key` pour faire correspondre les éléments d'un rendu à l'autre : « le composant qui avait la key X la dernière fois est le même que celui qui a la key X maintenant ». Il conserve le **state, le nœud DOM et les refs** de ce composant, et ne met à jour que ses props.
- Avec `key={index}`, la key décrit la **position**, pas l'**élément**. Quand vous insérez en tête, supprimez au milieu, triez ou filtrez, l'élément à l'index 2 change, mais React pense que « la key 2 correspond toujours au même composant ».
- Ce qui casse :
  - **Le state local reste attaché à la mauvaise ligne** : `checked` d'une checkbox, indicateur « déplié », mode édition.
  - **Les inputs non contrôlés gardent l'ancien texte** : le `<input>` du DOM est réutilisé, donc le texte saisi reste en place pendant que les libellés se déplacent.
  - **Le focus, la position de scroll, les animations et les médias** (une `<video>` en lecture) restent liés à la position, pas à l'élément.
  - **Les performances** : insérer en tête change les props de toutes les lignes, donc toutes les lignes se re-render au lieu d'une seule ajoutée.
- Les keys basées sur l'index ne conviennent que si la liste est **statique** : jamais réordonnée, filtrée ni modifiée par insertion (sauf en fin de liste), et que les éléments n'ont pas de state.
- Utilisez un **ID unique et stable issu des données** (ID en base, slug). Générez l'ID au moment où l'élément est **créé** (`crypto.randomUUID()`), jamais pendant le rendu.

## Real-life example: the problem
Un outil de gestion de projet affiche une liste de to-dos par tâche. Chaque ligne a un input « note » non contrôlé et un state local « fait » pour la checkbox. Les nouveaux to-dos sont ajoutés **en tête**. Un utilisateur coche « Order materials » comme fait et écrit « call the supplier » dans sa note, puis ajoute un nouveau to-do « Book venue ». Résultat : « Book venue » apparaît comme fait avec la note « call the supplier », et « Order materials » est décoché avec une note vide. L'utilisateur enregistre, et les mauvaises notes partent au serveur.

```jsx
function TodoRow({ todo }) {
  const [done, setDone] = useState(false); // state local par ligne
  return (
    <li>
      <input type="checkbox" checked={done} onChange={() => setDone(!done)} />
      <span>{todo.title}</span>
      <input name={`note-${todo.id}`} placeholder="Note" /> {/* non contrôlé */}
    </li>
  );
}

function TodoList() {
  const [todos, setTodos] = useState([{ id: 'a1', title: 'Order materials' }]);

  const addTodo = (title) =>
    setTodos((prev) => [{ id: crypto.randomUUID(), title }, ...prev]); // ajouté en tête

  return (
    <ul>
      {todos.map((todo, index) => (
        <TodoRow key={index} todo={todo} /> // BUG : key = position
      ))}
    </ul>
  );
}
```
Ce que voit React après l'ajout de « Book venue » en tête :
```
avant : key 0 -> "Order materials" (done=true, note="call the supplier")
après : key 0 -> "Book venue"       -> même composant réutilisé : done=true, note conservée
        key 1 -> "Order materials"  -> NOUVEAU composant : done=false, note vide
```

## How to fix it
```jsx
function TodoRow({ todo, onToggle }) {
  return (
    <li>
      <input type="checkbox" checked={todo.done} onChange={onToggle} />
      <span>{todo.title}</span>
      <input name={`note-${todo.id}`} placeholder="Note" />
    </li>
  );
}

function TodoList() {
  const [todos, setTodos] = useState([{ id: 'a1', title: 'Order materials', done: false }]);

  const addTodo = (title) =>
    setTodos((prev) => [{ id: crypto.randomUUID(), title, done: false }, ...prev]); // ID créé une seule fois

  const toggle = (id) =>
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  return (
    <ul>
      {todos.map((todo) => (
        <TodoRow key={todo.id} todo={todo} onToggle={() => toggle(todo.id)} />
      ))}
    </ul>
  );
}
```
Pourquoi ça marche : la key appartient désormais à l'élément. Quand un nouvel élément est ajouté en tête, React voit une seule nouvelle key et crée une seule nouvelle ligne. Toutes les lignes existantes conservent leurs propres nœuds DOM, le texte de leurs inputs et leur state. Déplacer `done` dans les données de la liste (remonter le state, ou lifting state up) lui permet aussi de survivre au filtrage et à l'enregistrement.

Fausses « solutions » à éviter :
- `key={Math.random()}` ou `key={crypto.randomUUID()}` dans le rendu : une nouvelle key à chaque rendu, donc chaque ligne est démontée puis remontée. Le state et le focus sont perdus à chaque frappe.
- `key={todo.title}` : les titres ne sont pas uniques, donc les doublons provoquent des avertissements et des lignes mélangées.

### Astuce utile : changer la key pour réinitialiser le state volontairement
```jsx
<EditProfileForm key={selectedUserId} user={user} /> // changer d'utilisateur = state du formulaire tout neuf
```

## How to say it in the interview
- « La key est l'identité du composant. Les keys basées sur l'index lient l'identité à la position, donc lors d'une insertion, d'une suppression ou d'un tri, le state et le DOM restent à la position pendant que les données se déplacent. »
- « C'est acceptable pour des listes statiques dont l'ordre ne change jamais et qui n'ont pas de state. Sinon, j'utilise un ID stable issu des données, créé en même temps que l'élément. »
- Piège : « React n'avertit que lorsque les keys sont absentes, pas lorsqu'il s'agit d'index », donc le bug reste silencieux jusqu'à ce que quelqu'un trie ou insère.
- Compromis / relance : changer une key volontairement est une façon propre de réinitialiser le state d'un composant, mais cela remonte aussi tout le sous-arbre, ce qui a un coût en performances.
