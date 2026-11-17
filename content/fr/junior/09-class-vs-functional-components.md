# Quelle est la différence entre les composants de classe et les composants fonctionnels en React ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Expliquez la différence entre les composants de classe et les composants fonctionnels.

## The concept (short answer)
- Un **composant de classe** étend `React.Component`, garde son state dans `this.state`, le met à jour avec `this.setState` et utilise des **méthodes de cycle de vie** (`componentDidMount`, `componentDidUpdate`, `componentWillUnmount`). Il doit avoir une méthode `render()`.
- Un **composant fonctionnel** est une simple fonction qui reçoit des props et renvoie du JSX. Depuis React 16.8, il utilise des **hooks** pour le state (`useState`), les effets de bord (`useEffect`), les refs, le context, etc.
- Pourquoi les composants fonctionnels sont devenus la norme :
  - Moins de code, pas de problèmes de binding de `this`.
  - La logique liée reste regroupée dans un seul `useEffect` au lieu d'être répartie sur 3 méthodes de cycle de vie.
  - La logique peut être réutilisée avec des **custom hooks** (au lieu des HOC et des render props).
  - Les nouvelles fonctionnalités de React (Server Components, `use`, `useTransition`, React Compiler) sont conçues pour les composants fonctionnels.
- Un composant fonctionnel **capture les props et le state de chaque rendu** (closures). Une classe lit `this.props` au moment où le code s'exécute, ce qui peut être plus récent que prévu.
- Les composants de classe fonctionnent toujours et vous en verrez dans du code ancien. Une seule chose nécessite encore une classe : les **Error Boundaries** (`componentDidCatch` / `getDerivedStateFromError`), ou alors une bibliothèque comme `react-error-boundary`.

## Real-life example: the problem
Imaginez une page de scores sportifs en direct avec un composant de classe `ScoreBoard` qui s'abonne à un WebSocket pour le match sélectionné. Les utilisateurs qui passaient du match A au match B continuaient de voir **les buts du match A apparaître** sur l'écran du match B. Après avoir consulté plusieurs matchs, l'onglet devenait lent, car de nombreux sockets restaient ouverts. Et un clic sur « Suivre » plantait avec `TypeError: Cannot read properties of undefined (reading 'setState')`.

```jsx
// BUGUÉ : ScoreBoard.jsx (classe)
import React from 'react';

export class ScoreBoard extends React.Component {
  state = { score: null, following: false };

  componentDidMount() {
    this.socket = openMatchSocket(this.props.matchId);
    this.socket.onmessage = (e) => this.setState({ score: JSON.parse(e.data) });
  }
  // componentDidUpdate manquant : un changement de matchId garde l'ancien socket
  // componentWillUnmount manquant : le socket n'est jamais fermé

  handleFollow() {
    this.setState({ following: true }); // `this` est undefined : méthode non liée (bind)
  }

  render() {
    return (
      <div>
        <h2>{this.state.score ? `${this.state.score.home} - ${this.state.score.away}` : 'Loading...'}</h2>
        <button onClick={this.handleFollow}>Follow</button>
      </div>
    );
  }
}
```

## How to fix it
Réécrivez-le en composant fonctionnel. Un seul `useEffect` avec `matchId` comme dépendance gère l'abonnement, le réabonnement et le désabonnement au même endroit.

```jsx
// CORRIGÉ : ScoreBoard.jsx (composant fonctionnel)
import { useEffect, useState } from 'react';

export function ScoreBoard({ matchId }) {
  const [score, setScore] = useState(null);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    setScore(null); // efface l'ancien match pendant la connexion
    const socket = openMatchSocket(matchId);
    socket.onmessage = (e) => setScore(JSON.parse(e.data));

    return () => socket.close(); // s'exécute au démontage ET avant de relancer l'effet pour un nouveau matchId
  }, [matchId]);

  return (
    <div>
      <h2>{score ? `${score.home} - ${score.away}` : 'Loading...'}</h2>
      <button onClick={() => setFollowing(true)} disabled={following}>
        {following ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}
```

Pourquoi ça marche : l'effet dépend de `matchId`. Quand il change, React exécute d'abord le cleanup (qui ferme l'ancien socket), puis relance l'effet pour le nouveau match. Au démontage, le cleanup s'exécute aussi. Il n'y a pas de `this`, donc le handler du clic ne peut pas perdre son contexte.

Si vous devez garder la classe, la correction consiste à : ajouter `componentDidUpdate(prevProps)` pour comparer `matchId` et se réabonner, ajouter `componentWillUnmount` pour fermer le socket, et lier le handler (`handleFollow = () => {...}` sous forme de fonction fléchée en champ de classe).

Correspondance à retenir :

| Classe | Fonction |
|---|---|
| `this.state` / `this.setState` | `useState` / `useReducer` |
| `componentDidMount` + `componentDidUpdate` + `componentWillUnmount` | `useEffect` avec dépendances et cleanup |
| `shouldComponentUpdate` / `PureComponent` | `React.memo` |
| `createRef` | `useRef` |
| `static contextType` | `useContext` |

## How to say it in the interview
- « Les composants de classe utilisent `this.state` et des méthodes de cycle de vie ; les composants fonctionnels sont de simples fonctions qui utilisent des hooks. Aujourd'hui, j'écris des composants fonctionnels, car ils sont plus courts, évitent `this` et me permettent de réutiliser la logique avec des custom hooks. »
- « `useEffect` n'est pas une copie 1:1 des méthodes de cycle de vie ; je raisonne en termes de "se synchroniser avec ce système externe quand ces dépendances changent", avec un cleanup. »
- Question de suivi : « Y a-t-il encore quelque chose qui nécessite une classe ? » Oui, les Error Boundaries (ou utilisez `react-error-boundary`).
- Compromis : migrer de grosses bases de code en classes qui fonctionnent a un coût. Une bonne approche consiste à écrire le nouveau code avec des composants fonctionnels et à convertir les anciens quand vous y touchez.
