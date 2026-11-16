# Multiple browser tabs are open and one logs out. How do the others know?

**Level:** Mid
**Merged from (original phrasings):**
- Multiple browser tabs are open and one logs out. How do the others know?

## The concept (short answer)
- Each tab has its **own JS memory** (React state, Redux store, in-memory access token). Logging out in tab A clears A's state, and tab B keeps showing private data and acting as the logged-in user until something tells it otherwise.
- **Cross-tab messaging (same origin):**
  - **`BroadcastChannel`**: `new BroadcastChannel('auth').postMessage({ type: 'logout' })`. Every other tab with a channel of the same name receives it. It is clean and purpose-built, and supported in all modern browsers.
  - **`storage` event:** writing to `localStorage` fires a `storage` event in **other** tabs (not in the tab that wrote). It is the classic fallback, also used for "login in another tab". Write a timestamp so repeated writes still change the value.
  - Libraries such as `broadcast-channel` wrap both. Service workers can also relay messages.
- **The server is the source of truth:** logout must **invalidate the session server-side** (delete the session, revoke the refresh token). Then even a tab that missed the message (asleep, frozen by the browser, offline) gets a **401 on its next request** and must handle it with a global interceptor that clears state and redirects to login.
- **Re-check on focus:** on `visibilitychange`/`focus`, revalidate the session (React Query `refetchOnWindowFocus`) to catch tabs that were suspended.
- Do the same for **login** (another tab logs in as a different user, so reload) and for token refresh (share one refresh across tabs to avoid refresh-token rotation conflicts).

## Real-life example: the problem
In an online banking app, a user on a shared family computer clicks "Log out" in one tab and walks away. A second tab with the "Accounts" page is still open and shows balances and recent transactions. The next person who sits down can still see everything, and because the access token is held in that tab's memory and logout didn't revoke anything server-side, they can even submit a transfer form until the token expires.

```jsx
// LogoutButton.jsx
function LogoutButton() {
  const { setUser, setAccessToken } = useAuth();
  return (
    <button onClick={() => {
      setUser(null);              // only THIS tab's state
      setAccessToken(null);
      navigate('/login');         // no server call: session/refresh token still valid
    }}>
      Log out
    </button>
  );
}

// api.js: 401s are ignored, so stale tabs just show errors or old data
export const api = axios.create({ baseURL: '/api', withCredentials: true });
```

## How to fix it
```js
// auth-sync.js: one module for cross-tab auth events
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('auth') : null;
const STORAGE_KEY = 'auth:event';

export function broadcastAuth(type) {
  const msg = { type, at: Date.now() };
  channel?.postMessage(msg);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msg)); } catch {} // fallback for old browsers
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
    queryClient.clear();                       // wipe cached balances/transactions
    window.location.replace('/login?reason=signed-out'); // hard navigation: drops all in-memory state
  }, [queryClient]);

  // 1. React to logout in other tabs
  useEffect(() => onAuthEvent(msg => { if (msg.type === 'logout') clearLocalSession(); }), [clearLocalSession]);

  // 2. Server says the session is gone (missed message, expiry, admin revoke)
  useEffect(() => {
    const id = api.interceptors.response.use(undefined, err => {
      if (err.response?.status === 401) clearLocalSession();
      return Promise.reject(err);
    });
    return () => api.interceptors.response.eject(id);
  }, [clearLocalSession]);

  // 3. Re-validate when a sleeping tab becomes visible again
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') api.get('/session').catch(() => {}); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); }   // server: delete session, revoke refresh token, clear cookie
    finally {
      broadcastAuth('logout');                 // tell the other tabs
      clearLocalSession();                     // and this one
    }
  }, [clearLocalSession]);

  return <AuthContext.Provider value={{ user, setUser, logout }}>{children}</AuthContext.Provider>;
}
```

```js
// server
app.post('/auth/logout', async (req, res) => {
  await sessions.destroy(req.cookies.sid);           // invalidates for every tab and device using this session
  await refreshTokens.revokeFamily(req.user?.id, req.cookies.sid);
  res.clearCookie('sid', { httpOnly: true, secure: true, sameSite: 'lax' });
  res.sendStatus(204);
});
```

Why it works: open, active tabs receive the logout message within milliseconds and redirect, and the cached data is wiped. Tabs that missed it (frozen in the background, laptop asleep) fail their next API call with a 401, because the server session no longer exists, and the interceptor logs them out. The visibility check makes this happen as soon as the user looks at the tab, not only when they click something.

Alternatives: in Next.js with httpOnly cookies, `router.refresh()` on focus re-runs Server Components that check the session; with Auth.js, `useSession` already syncs across tabs via `BroadcastChannel`/storage events.

## How to say it in the interview
- "Tabs don't share memory, so I broadcast the logout with BroadcastChannel and use the `storage` event as a fallback. But the real guarantee is invalidating the session on the server, so any tab that missed the message gets a 401 and logs out."
- "I handle the opposite cases too: login as a different user in another tab, and coordinated token refresh so tabs don't race on a rotating refresh token."
- Trap: the `storage` event doesn't fire in the tab that made the change, and only fires when the value actually changes, so include a timestamp. And `sessionStorage` is per tab, so it can't be used for this.
- Trade-off: a hard redirect (`location.replace`) is blunt but guarantees no private data stays in memory. A soft redirect is smoother but risks leftover cached state.
