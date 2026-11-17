# Comment utiliser la Context API pour un state global, et pourquoi une seule mise à jour re-render-t-elle tous les consommateurs ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Comment implémentez-vous la Context API pour la gestion d'un state global ?
- Pourquoi une seule mise à jour du context re-render-t-elle tous les consommateurs ? Comment corriger cela ?

## The concept (short answer)
- Le context transmet une valeur vers le bas de l'arbre sans prop drilling : `createContext` -> `<Ctx value={...}>` (React 19 ; `<Ctx.Provider>` dans les versions plus anciennes) -> `useContext(Ctx)` ou `use(Ctx)`.
- C'est un **mécanisme d'injection de dépendances, pas un gestionnaire de state**. On le combine avec `useState`/`useReducer` dans un composant provider.
- Quand la `value` du provider change (selon `Object.is`), **chaque composant qui lit ce context se re-render**, même s'il n'utilise qu'un champ qui n'a pas changé. Il n'y a pas de sélecteurs. `memo` sur le consommateur ne l'empêche pas.
- Deux causes fréquentes de rendus en trop :
  1. La valeur est un **nouvel objet à chaque rendu** (`value={{ user, setUser }}`), donc tous les consommateurs se re-render dès que le parent du provider se re-render.
  2. **Un seul gros context** contient des données sans rapport entre elles et qui changent vite (panier + utilisateur + thème + notifications).
- Solutions : mémoïser la valeur avec `useMemo`, **découper les contexts** selon leur fréquence de changement, **séparer le state des actions** (dispatch et setters sont stables), garder les providers près de l'endroit où ils sont utilisés. Pour un state global volumineux et souvent mis à jour, utilisez un store avec sélecteurs (**Zustand**, Redux Toolkit, Jotai) ou `useSyncExternalStore`.
- Bons usages du context : thème, langue (locale), utilisateur courant, feature flags. Des valeurs qui changent rarement.

## Real-life example: the problem
Une web app de livraison de repas garde tout dans un seul `AppContext` : l'utilisateur, le panier, le thème et une estimation d'arrivée (ETA) du livreur mise à jour chaque seconde. Sur la page restaurant avec 200 plats, chaque plat lit le context uniquement pour savoir si l'utilisateur est connecté. La page saccade toutes les secondes et le scroll manque de fluidité sur les téléphones milieu de gamme. Le Profiler montre que les 200 `MenuItem` se re-render une fois par seconde.

```jsx
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [eta, setEta] = useState(null);

  useEffect(() => {
    const id = setInterval(async () => setEta(await fetchEta()), 1000);
    return () => clearInterval(id);
  }, []);

  const addToCart = (item) => setCart((c) => [...c, item]);

  return (
    <AppContext.Provider value={{ user, setUser, cart, addToCart, eta }}>
      {children}
    </AppContext.Provider>
  );
}

const MenuItem = memo(function MenuItem({ dish }) {
  const { user, addToCart } = useContext(AppContext); // se re-render à chaque tick de l'ETA
  return <button disabled={!user} onClick={() => addToCart(dish)}>{dish.name}</button>;
});
```

## How to fix it
Découpez selon la fréquence de mise à jour et séparez les actions stables du state qui change.

```jsx
const UserContext = createContext(null);
const CartStateContext = createContext([]);
const CartActionsContext = createContext(null);
const EtaContext = createContext(null);

export function AppProviders({ children }) {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);

  const userValue = useMemo(() => ({ user, setUser }), [user]);
  const cartActions = useMemo(() => ({
    add: (item) => setCart((c) => [...c, item]),
    remove: (id) => setCart((c) => c.filter((i) => i.id !== id)),
  }), []); // les setters sont stables, donc cet objet ne change jamais

  return (
    <UserContext value={userValue}>
      <CartActionsContext value={cartActions}>
        <CartStateContext value={cart}>
          <EtaProvider>{children}</EtaProvider>
        </CartStateContext>
      </CartActionsContext>
    </UserContext>
  );
}

function EtaProvider({ children }) {
  const [eta, setEta] = useState(null); // state rapide isolé dans son propre provider
  useEffect(() => {
    const id = setInterval(async () => setEta(await fetchEta()), 1000);
    return () => clearInterval(id);
  }, []);
  return <EtaContext value={eta}>{children}</EtaContext>;
}

// Les custom hooks offrent une API claire et un message d'erreur utile
export function useCartActions() {
  const ctx = useContext(CartActionsContext);
  if (!ctx) throw new Error('useCartActions must be used inside AppProviders');
  return ctx;
}

const MenuItem = memo(function MenuItem({ dish }) {
  const { user } = useContext(UserContext);   // ne change qu'à la connexion/déconnexion
  const { add } = useCartActions();            // ne change jamais
  return <button disabled={!user} onClick={() => add(dish)}>{dish.name}</button>;
});
```
Pourquoi ça marche : le tick de l'ETA ne met à jour que `EtaContext`, que seul le bandeau du livreur lit. `children` est créé plus haut, donc le re-render d'`EtaProvider` ne re-render pas le menu. Ajouter au panier met à jour `CartStateContext`, mais les plats ne lisent que `CartActionsContext`, qui est stable. Chaque consommateur ne se re-render que lorsque les données qu'il lit changent.

Alternative pour un state complexe et souvent mis à jour : un store Zustand avec sélecteurs ne re-render que les composants dont la portion sélectionnée a changé :
```js
const user = useAppStore((s) => s.user);
const add = useAppStore((s) => s.addToCart);
```

## How to say it in the interview
- « Le context est un moyen de transmettre une valeur, pas un store. Quand la valeur change, chaque consommateur se re-render, sans sélecteurs, et `memo` ne l'empêche pas. »
- « Je corrige en mémoïsant la valeur, en découpant les contexts selon leur fréquence de mise à jour et en plaçant les actions dans leur propre context. Pour un state global à haute fréquence, j'utilise Zustand ou Redux avec des sélecteurs. »
- Piège : `value={{ a, b }}` en inline crée un nouvel objet à chaque rendu du provider, donc chaque consommateur se re-render même si `a` et `b` n'ont pas changé.
- Compromis : beaucoup de petits contexts, c'est plus de providers et de boilerplate. Un store externe ajoute une dépendance mais offre des abonnements fins.
