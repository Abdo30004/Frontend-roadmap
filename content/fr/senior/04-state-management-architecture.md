# Architecture de la gestion d'état : Redux Toolkit vs Context vs Zustand vs librairies de server state

**Niveau :** Senior
**Merged from (original phrasings):**
- Redux Toolkit vs Context API vs librairies de server state : quand choisiriez-vous chacun ?
- Expliquez les compromis entre les différents patterns de gestion d'état (Redux, Zustand, Context API).
- Comment gérez-vous le state et le cache quand l'application grandit jusqu'à plus de 100 écrans ?

## The concept (short answer)

Le réflexe senior consiste à arrêter de se demander « quelle librairie ? » et à d'abord **classer le state**, car chaque type a un propriétaire et un cycle de vie différents :

| Type | Exemples | Meilleur emplacement |
|---|---|---|
| **Server state** | commandes, utilisateurs, prix - appartiennent au backend, peuvent devenir obsolètes | TanStack Query / RTK Query / SWR (cache, déduplication, invalidation, refetch) |
| **State d'URL** | filtres, tri, page, onglet sélectionné, recherche | l'URL (`useSearchParams`) - partageable, survit au rafraîchissement, le bouton retour fonctionne |
| **State de formulaire** | modifications en cours, erreurs de validation | state local ou React Hook Form, jeté à la soumission |
| **State client / UI** | sidebar ouverte, thème, assistant en plusieurs étapes, panier avant paiement | `useState` -> remonter le state -> Zustand/Redux quand c'est vraiment global |

Compromis entre librairies pour le state *client* restant :
- **Context API :** de l'injection de dépendances, pas un gestionnaire d'état. Chaque consommateur refait un rendu quand la valeur change, sans sélecteurs. Idéal pour les valeurs qui changent rarement (thème, langue, utilisateur courant, feature flags).
- **Redux Toolkit :** store unique, flux unidirectionnel strict, devtools avec time travel, middleware ; parfait pour les grandes équipes qui ont besoin de conventions et d'une logique client complexe partagée entre fonctionnalités. Plus verbeux ; RTK Query couvre le server state si vous êtes déjà sur Redux.
- **Zustand :** minuscule, basé sur des hooks, abonnements par sélecteur (nouveau rendu uniquement pour la portion lue), utilisable hors de React. Moins structuré - l'équipe doit s'accorder sur des conventions.

À **100+ écrans** : la plupart du « state global » s'avère être du cache serveur. Gardez une factory de query keys par fonctionnalité, définissez un `staleTime` par type de données, invalidez par préfixe de clé après les mutations, colocalisez les stores par fonctionnalité (pas de god-store) et ne gardez en global que le state client réellement partagé.

## Real-life example: the problem

Une application de back-office logistique. La liste des commandes était récupérée une seule fois puis copiée dans Redux. Un répartiteur ouvre une commande, passe son statut à « Shipped », revient en arrière - la liste affiche toujours « Pending ». Les modifications d'un collègue n'apparaissent qu'après un rechargement complet. Quelqu'un a « corrigé » le problème en refaisant le fetch à cinq endroits, et maintenant la liste clignote et envoie des requêtes en double.

```jsx
// ordersSlice.js - données serveur clonées dans le state client
const ordersSlice = createSlice({
  name: 'orders',
  initialState: { items: [], loading: false, filter: 'all' },
  reducers: {
    setOrders: (s, a) => { s.items = a.payload; },
    setLoading: (s, a) => { s.loading = a.payload; },
    setFilter: (s, a) => { s.filter = a.payload; },
  },
});

function OrdersPage() {
  const dispatch = useDispatch();
  const { items, filter } = useSelector((s) => s.orders);
  useEffect(() => {
    if (items.length === 0) {                 // « cache » : ne refait jamais le fetch une fois rempli
      dispatch(setLoading(true));
      fetch('/api/orders').then((r) => r.json()).then((d) => dispatch(setOrders(d)));
    }
  }, []);
  return <OrdersTable orders={items.filter((o) => filter === 'all' || o.status === filter)} />;
}

function OrderDetail({ id }) {
  const ship = () => fetch(`/api/orders/${id}/ship`, { method: 'POST' });  // la liste n'en est jamais informée
  /* ... */
}
```

Problèmes : un cache fait maison sans notion d'obsolescence, sans invalidation, sans déduplication, sans refetch au retour sur la fenêtre ; le filtre vit dans Redux, donc il ne peut pas être mis en favori ni partagé, et il est perdu au rechargement.

## How to fix it

Le server state dans un cache de requêtes, le filtre dans l'URL, Redux/Zustand uniquement pour le vrai state client.

```jsx
// orders/queries.js - une factory de clés par fonctionnalité
export const orderKeys = {
  all: ['orders'],
  list: (status) => ['orders', 'list', { status }],
  detail: (id) => ['orders', 'detail', id],
};

export function useOrders(status) {
  return useQuery({
    queryKey: orderKeys.list(status),
    queryFn: ({ signal }) => fetch(`/api/orders?status=${status}`, { signal }).then((r) => r.json()),
    staleTime: 30_000,            // frais pendant 30s, puis revalidé en arrière-plan au montage / au focus
  });
}

export function useShipOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => fetch(`/api/orders/${id}/ship`, { method: 'POST' }).then((r) => r.json()),
    onSuccess: (updated) => {
      qc.setQueryData(orderKeys.detail(updated.id), updated);
      qc.invalidateQueries({ queryKey: orderKeys.all });   // toutes les variantes de liste refont le fetch
    },
  });
}

// OrdersPage.jsx - le filtre vit dans l'URL
function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'all';
  const { data = [], isPending, error } = useOrders(status);
  /* ... setParams({ status: 'pending' }) quand le filtre change ... */
}

// store UI (Zustand) - uniquement le vrai state client
export const useUiStore = create((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
```

Pourquoi ça marche : le backend reste l'unique source de vérité ; le cache de requêtes connaît l'âge de chaque entrée, déduplique les requêtes simultanées, refait le fetch au retour sur la fenêtre, et l'invalidation par préfixe de clé met à jour toutes les listes après la mutation. L'URL rend les filtres partageables. Redux n'est plus une copie périmée de la base de données. Si l'équipe a déjà beaucoup investi dans Redux, RTK Query avec `providesTags`/`invalidatesTags` obtient le même résultat.

## How to say it in the interview

- « Je commence par séparer le state en server state, state d'URL, state de formulaire et state client. Le server state va dans une librairie de cache, les filtres dans l'URL, les formulaires restent locaux, et seul le petit reste a besoin de Redux ou de Zustand. »
- « Context sert à injecter des valeurs qui changent rarement ; il refait le rendu de chaque consommateur et n'a pas de sélecteurs, donc il convient mal à un state global qui change souvent. »
- Piège : copier les données récupérées dans Redux ou dans un `useState` crée une deuxième source de vérité qui devient obsolète. Question de suivi : « Comment faire passer cela à l'échelle ? » - des factories de query keys détenues par chaque fonctionnalité, un `staleTime` par type de données, l'invalidation par préfixe, des optimistic updates pour des mutations réactives.
- Compromis : Redux apporte des conventions et un outillage solides au prix d'une certaine verbosité ; Zustand est plus léger mais exige de la discipline d'équipe ; une librairie de requêtes ajoute une dépendance mais supprime l'essentiel du code de chargement / cache écrit à la main.
