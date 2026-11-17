# Plusieurs onglets du navigateur sont ouverts et l'un d'eux se déconnecte. Comment les autres le savent-ils ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Plusieurs onglets du navigateur sont ouverts et l'un d'eux se déconnecte. Comment les autres le savent-ils ?

## The concept (short answer)
- Chaque onglet a **sa propre mémoire JS** (state React, store Redux, access token en mémoire). Se déconnecter dans l'onglet A vide le state de A, et l'onglet B continue d'afficher des données privées et d'agir en tant qu'utilisateur connecté tant que rien ne lui dit le contraire.
- **Messagerie entre onglets (même origine) :**
  - **`BroadcastChannel`** : `new BroadcastChannel('auth').postMessage({ type: 'logout' })`. Tous les autres onglets disposant d'un canal du même nom reçoivent le message. C'est propre, conçu exactement pour cela, et pris en charge par tous les navigateurs modernes.
  - **L'événement `storage` :** écrire dans `localStorage` déclenche un événement `storage` dans les **autres** onglets (pas dans celui qui a écrit). C'est la solution de repli classique, utilisée aussi pour « connexion dans un autre onglet ». Écrivez un horodatage pour que des écritures répétées modifient bien la valeur.
  - Des bibliothèques comme `broadcast-channel` encapsulent les deux. Les service workers peuvent aussi relayer les messages.
- **Le serveur est la source de vérité :** la déconnexion doit **invalider la session côté serveur** (supprimer la session, révoquer le refresh token). Ainsi, même un onglet qui a manqué le message (en veille, gelé par le navigateur, hors ligne) reçoit une **401 à sa prochaine requête**, qu'il doit gérer avec un intercepteur global qui vide le state et redirige vers la connexion.
- **Revérifier au retour du focus :** sur `visibilitychange`/`focus`, revalidez la session (`refetchOnWindowFocus` de React Query) pour rattraper les onglets qui étaient suspendus.
- Faites de même pour la **connexion** (un autre onglet se connecte avec un autre utilisateur, donc rechargez) et pour le rafraîchissement des tokens (partagez un seul rafraîchissement entre les onglets pour éviter les conflits liés à la rotation du refresh token).

## Real-life example: the problem
Dans une application de banque en ligne, un utilisateur sur un ordinateur familial partagé clique sur « Se déconnecter » dans un onglet et s'en va. Un second onglet avec la page « Comptes » est toujours ouvert et affiche les soldes et les dernières opérations. La personne suivante qui s'installe peut encore tout voir, et comme l'access token est conservé dans la mémoire de cet onglet et que la déconnexion n'a rien révoqué côté serveur, elle peut même soumettre un formulaire de virement jusqu'à l'expiration du token.

```jsx
// LogoutButton.jsx
function LogoutButton() {
  const { setUser, setAccessToken } = useAuth();
  return (
    <button onClick={() => {
      setUser(null);              // uniquement le state de CET onglet
      setAccessToken(null);
      navigate('/login');         // aucun appel serveur : la session / le refresh token restent valides
    }}>
      Log out
    </button>
  );
}

// api.js : les 401 sont ignorées, donc les onglets obsolètes affichent simplement des erreurs ou d'anciennes données
export const api = axios.create({ baseURL: '/api', withCredentials: true });
```

## How to fix it
```js
// auth-sync.js : un seul module pour les événements d'authentification entre onglets
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('auth') : null;
const STORAGE_KEY = 'auth:event';

export function broadcastAuth(type) {
  const msg = { type, at: Date.now() };
  channel?.postMessage(msg);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msg)); } catch {} // solution de repli pour les anciens navigateurs
}

export function onAuthEvent(handler) {
  const onMessage = e => handler(e.data);
  const onStorage = e => { if (e.key === STORAGE_KEY && e.newValue) handler(JSON.parse(e.newValue)); };
  channel?.addEventListener('message', onMessage);
  window.addEventListener('storage', onStorage);
  return () => {
    channel?.removeEventListener('message', onMessage);
    window.removeEventListener('storage', onStorage);
  };
}
```

```jsx
// AuthProvider.jsx
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

  const clearLocalSession = useCallback(() => {
    setUser(null);
    queryClient.clear();                       // efface les soldes / opérations en cache
    window.location.replace('/login?reason=signed-out'); // navigation complète : supprime tout le state en mémoire
  }, [queryClient]);

  // 1. Réagir à la déconnexion dans les autres onglets
  useEffect(() => onAuthEvent(msg => { if (msg.type === 'logout') clearLocalSession(); }), [clearLocalSession]);

  // 2. Le serveur indique que la session n'existe plus (message manqué, expiration, révocation par un admin)
  useEffect(() => {
    const id = api.interceptors.response.use(undefined, err => {
      if (err.response?.status === 401) clearLocalSession();
      return Promise.reject(err);
    });
    return () => api.interceptors.response.eject(id);
  }, [clearLocalSession]);

  // 3. Revalider quand un onglet en veille redevient visible
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') api.get('/session').catch(() => {}); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); }   // serveur : supprimer la session, révoquer le refresh token, effacer le cookie
    finally {
      broadcastAuth('logout');                 // prévenir les autres onglets
      clearLocalSession();                     // et celui-ci
    }
  }, [clearLocalSession]);

  return <AuthContext.Provider value={{ user, setUser, logout }}>{children}</AuthContext.Provider>;
}
```

```js
// serveur
app.post('/auth/logout', async (req, res) => {
  await sessions.destroy(req.cookies.sid);           // invalide la session pour tous les onglets et appareils qui l'utilisent
  await refreshTokens.revokeFamily(req.user?.id, req.cookies.sid);
  res.clearCookie('sid', { httpOnly: true, secure: true, sameSite: 'lax' });
  res.sendStatus(204);
});
```

Pourquoi ça marche : les onglets ouverts et actifs reçoivent le message de déconnexion en quelques millisecondes et redirigent, et les données en cache sont effacées. Les onglets qui l'ont manqué (gelés en arrière-plan, ordinateur en veille) voient leur prochain appel API échouer avec une 401, car la session serveur n'existe plus, et l'intercepteur les déconnecte. La vérification de visibilité déclenche cela dès que l'utilisateur regarde l'onglet, et pas seulement quand il clique quelque part.

Alternatives : dans Next.js avec des cookies httpOnly, `router.refresh()` au retour du focus réexécute les Server Components qui vérifient la session ; avec Auth.js, `useSession` se synchronise déjà entre onglets via `BroadcastChannel`/les événements `storage`.

## How to say it in the interview
- « Les onglets ne partagent pas leur mémoire, donc je diffuse la déconnexion avec BroadcastChannel et j'utilise l'événement `storage` comme solution de repli. Mais la vraie garantie, c'est l'invalidation de la session côté serveur : tout onglet qui a manqué le message reçoit une 401 et se déconnecte. »
- « Je gère aussi les cas inverses : une connexion avec un autre utilisateur dans un autre onglet, et un rafraîchissement des tokens coordonné pour que les onglets ne se fassent pas concurrence sur un refresh token en rotation. »
- Piège : l'événement `storage` ne se déclenche pas dans l'onglet qui a fait la modification, et seulement quand la valeur change réellement, donc incluez un horodatage. Et `sessionStorage` est propre à chaque onglet, il ne peut donc pas servir à cela.
- Compromis : une redirection complète (`location.replace`) est brutale mais garantit qu'aucune donnée privée ne reste en mémoire. Une redirection « douce » est plus fluide mais risque de laisser du state en cache.
