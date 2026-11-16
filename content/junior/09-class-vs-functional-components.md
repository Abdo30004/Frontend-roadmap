# What is the difference between class components and functional components in React?

**Level:** Junior
**Merged from (original phrasings):**
- Explain the difference between class components and functional components.

## The concept (short answer)
- A **class component** extends `React.Component`, keeps state in `this.state`, updates it with `this.setState`, and uses **lifecycle methods** (`componentDidMount`, `componentDidUpdate`, `componentWillUnmount`). It must have a `render()` method.
- A **functional component** is a plain function that takes props and returns JSX. Since React 16.8 it uses **hooks** for state (`useState`), side effects (`useEffect`), refs, context, etc.
- Why functional components are the modern standard:
  - Less code, no `this` binding problems.
  - Related logic stays together in one `useEffect` instead of being split across 3 lifecycle methods.
  - Logic can be reused with **custom hooks** (instead of HOCs/render props).
  - New React features (Server Components, `use`, `useTransition`, React Compiler) are built for function components.
- A function component **captures props and state of each render** (closures). A class reads `this.props` at the moment the code runs, which can be newer than expected.
- Class components still work and you will see them in old code. One thing still needs a class: **Error Boundaries** (`componentDidCatch` / `getDerivedStateFromError`), or a library like `react-error-boundary`.

## Real-life example: the problem
Imagine a live sports scores page with a `ScoreBoard` class component that subscribes to a WebSocket for the selected match. Users who switched from match A to match B kept seeing **match A's goals pop up** on match B's screen. After visiting several matches the tab got slow because many sockets stayed open. Also clicking "Follow" crashed with `TypeError: Cannot read properties of undefined (reading 'setState')`.

```jsx
// BROKEN: ScoreBoard.jsx (class)
import React from 'react';

export class ScoreBoard extends React.Component {
  state = { score: null, following: false };

  componentDidMount() {
    this.socket = openMatchSocket(this.props.matchId);
    this.socket.onmessage = (e) => this.setState({ score: JSON.parse(e.data) });
  }
  // missing componentDidUpdate: matchId change keeps the old socket
  // missing componentWillUnmount: socket never closed

  handleFollow() {
    this.setState({ following: true }); // `this` is undefined: method not bound
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
Rewrite as a function component. One `useEffect` with `matchId` as a dependency handles subscribe, re-subscribe and unsubscribe in one place.

```jsx
// FIXED: ScoreBoard.jsx (function component)
import { useEffect, useState } from 'react';

export function ScoreBoard({ matchId }) {
  const [score, setScore] = useState(null);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    setScore(null); // clear the old match while connecting
    const socket = openMatchSocket(matchId);
    socket.onmessage = (e) => setScore(JSON.parse(e.data));

    return () => socket.close(); // runs on unmount AND before re-running for a new matchId
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

Why it works: the effect depends on `matchId`. When it changes, React first runs the cleanup (closing the old socket) and then runs the effect again for the new match. On unmount the cleanup also runs. There is no `this`, so the click handler cannot lose its context.

If you must keep the class, the fix is: add `componentDidUpdate(prevProps)` to compare `matchId` and re-subscribe, add `componentWillUnmount` to close the socket, and bind the handler (`handleFollow = () => {...}` as a class field arrow function).

Side-by-side mapping to remember:

| Class | Function |
|---|---|
| `this.state` / `this.setState` | `useState` / `useReducer` |
| `componentDidMount` + `componentDidUpdate` + `componentWillUnmount` | `useEffect` with dependencies and cleanup |
| `shouldComponentUpdate` / `PureComponent` | `React.memo` |
| `createRef` | `useRef` |
| `static contextType` | `useContext` |

## How to say it in the interview
- "Class components use `this.state` and lifecycle methods; function components are plain functions that use hooks. Today I write function components because they are shorter, avoid `this`, and let me reuse logic with custom hooks."
- "`useEffect` is not a 1:1 copy of lifecycle methods; I think in terms of 'synchronize with this external system when these dependencies change', with cleanup."
- Follow-up: "Is there anything you still need a class for?" Yes, Error Boundaries (or use `react-error-boundary`).
- Trade-off: migrating large, working class codebases has a cost. A good approach is to write new code with function components and convert old ones when you touch them.
