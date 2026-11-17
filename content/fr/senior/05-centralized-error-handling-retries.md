# Gestion centralisée des erreurs, rafraîchissement du token et logique de retry face à des échecs d'API simultanés

**Niveau :** Senior
**Merged from (original phrasings):**
- Comment géreriez-vous des échecs d'API simultanés avec une gestion centralisée des erreurs et une logique de retry ?

## The concept (short answer)

- **Un seul client HTTP, un seul endroit pour les règles transverses :** une instance axios avec des interceptors (ou un wrapper autour de `fetch`) gère les en-têtes d'authentification, le rafraîchissement du token, les retries, la normalisation des erreurs et les logs. Les composants ne réimplémentent jamais cela.
- **Rafraîchissement du token en single-flight :** quand l'access token expire, 10 requêtes parallèles reçoivent toutes un `401`. Un **seul** appel de rafraîchissement doit avoir lieu ; les autres attendent la même promise, puis sont rejouées avec le nouveau token. Sans cela, la rotation des refresh tokens fait échouer 9 rafraîchissements sur 10 et l'utilisateur est déconnecté.
- **Ne rejouez que ce qui est sûr :** rejouez les échecs transitoires (erreur réseau, `408`, `429`, `502/503/504`) et uniquement les requêtes **idempotentes** (`GET`, `PUT`, `DELETE`, ou `POST` avec un `Idempotency-Key`). Ne rejouez jamais un `400/401/403/404/422` - il échouera de nouveau.
- **Backoff exponentiel + jitter :** `delay = random(0, base * 2^attempt)` (« full jitter ») pour que des milliers de clients ne relancent pas leurs requêtes au même rythme et ne fassent pas un DDoS sur un serveur en train de se rétablir. Respectez `Retry-After`. Plafonnez le nombre de tentatives.
- **Normalisez les erreurs** dans une forme unique (`{ kind, status, message, retryable }`) et aiguillez-les : traitement **global** pour les échecs transverses (bannière hors ligne, session expirée -> page de connexion, un seul toast dédupliqué pour les 5xx), traitement **local** pour les erreurs que le composant sait expliquer (messages de validation à côté des champs, page « introuvable », bouton de retry intégré dans un widget).

## Real-life example: the problem

Un tableau de bord bancaire charge en parallèle les comptes, les cartes, les transactions, les notifications et les plafonds. Après 15 minutes d'inactivité, l'access token expire. L'utilisateur clique sur « Actualiser » : six requêtes reçoivent un `401`, l'interceptor déclenche six appels de rafraîchissement, le backend fait tourner le refresh token dès le premier appel et traite les cinq suivants comme une réutilisation de token - il révoque la session. L'utilisateur est déconnecté en pleine tâche. Par ailleurs, un `503` intermittent sur « Faire un virement » a été rejoué automatiquement et le virement est passé **deux fois**. Et l'écran a affiché six toasts rouges identiques « Something went wrong ».

```js
const api = axios.create({ baseURL: '/api' });

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config;
    if (error.response?.status === 401) {
      // Chaque requête en échec lance son propre rafraîchissement
      const { data } = await axios.post('/api/auth/refresh');
      tokenStore.set(data.accessToken);
      config.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(config);
    }
    // Rejoue tout, y compris POST /transfers, immédiatement et indéfiniment
    if (!error.response || error.response.status >= 500) {
      return api(config);
    }
    toast.error('Something went wrong');   // un toast par requête en échec
    throw error;
  }
);
```

## How to fix it

```js
const api = axios.create({ baseURL: '/api', timeout: 15_000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- rafraîchissement single-flight : tous les 401 simultanés partagent une seule promise
let refreshPromise = null;
function refreshAccessToken() {
  refreshPromise ??= axios                       // axios brut : pas d'interceptors, pas de récursion
    .post('/api/auth/refresh', null, { withCredentials: true })
    .then(({ data }) => { tokenStore.set(data.accessToken); return data.accessToken; })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

const IDEMPOTENT = new Set(['get', 'head', 'options', 'put', 'delete']);
const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504]);
const MAX_RETRIES = 3;

api.interceptors.response.use(undefined, async (error) => {
  const config = error.config;
  const status = error.response?.status;
  if (!config || axios.isCancel(error)) throw error;

  if (status === 401 && !config._authRetried) {
    config._authRetried = true;
    try {
      const token = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return api(config);                          // rejoue la requête d'origine une seule fois
    } catch (refreshError) {
      authEvents.emit('session-expired');          // global : une seule redirection vers la connexion
      throw normalizeError(refreshError);
    }
  }

  const safeToRetry = IDEMPOTENT.has(config.method) || config.headers['Idempotency-Key'];
  const transient = !error.response || RETRYABLE_STATUS.has(status);
  config._retryCount ??= 0;

  if (safeToRetry && transient && config._retryCount < MAX_RETRIES) {
    config._retryCount += 1;
    const retryAfter = Number(error.response?.headers?.['retry-after']) * 1000;
    const backoff = Math.random() * Math.min(10_000, 300 * 2 ** config._retryCount); // full jitter
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : backoff);
    return api(config);
  }

  const normalized = normalizeError(error);
  if (normalized.kind === 'server' || normalized.kind === 'network') {
    notify.global(normalized);                     // dédupliqué par type sur une fenêtre de temps
  }
  throw normalized;                                // les appelants gèrent les 4xx localement
});

function normalizeError(error) {
  const status = error.response?.status;
  if (!error.response) return { kind: 'network', status: 0, message: 'You appear to be offline.', retryable: true };
  if (status >= 500) return { kind: 'server', status, message: 'Service temporarily unavailable.', retryable: true };
  return { kind: 'client', status, message: error.response.data?.message ?? 'Request failed.', fieldErrors: error.response.data?.errors, retryable: false };
}
```

Les mutations qui doivent pouvoir être rejouées sans risque reçoivent une clé d'idempotence générée une seule fois par intention de l'utilisateur :

```js
const key = crypto.randomUUID();                 // créée quand l'utilisateur clique sur « Envoyer », réutilisée lors des retries
api.post('/transfers', payload, { headers: { 'Idempotency-Key': key } });
```

Pourquoi ça marche : la `refreshPromise` partagée regroupe N erreurs 401 simultanées en un seul rafraîchissement ; les autres l'attendent puis sont rejouées ; le flag d'authentification empêche les boucles infinies de 401. Les retries n'ont lieu que pour les erreurs transitoires sur des requêtes idempotentes, espacés par un backoff avec jitter, donc un serveur en difficulté n'est pas submergé et l'argent n'est jamais envoyé deux fois (le serveur déduplique grâce à la clé d'idempotence). Les erreurs arrivent dans les composants sous une forme unique et prévisible, les erreurs transverses ne sont affichées qu'une fois globalement, et la validation des champs reste locale. Alternative : rafraîchir proactivement le token peu avant `exp` pour éviter la plupart des 401 ; avec TanStack Query, configurez `retry` par requête et un `onError` sur le `QueryCache` pour les toasts globaux.

## How to say it in the interview

- « Un client unique avec des interceptors gère l'authentification, les retries et la normalisation des erreurs. Les 401 simultanés passent par une promise de rafraîchissement single-flight, puis les requêtes d'origine sont rejouées une fois. »
- « Je ne rejoue que les erreurs transitoires sur des requêtes idempotentes, avec un backoff exponentiel plus jitter et en respectant `Retry-After` ; les mutations non idempotentes ont besoin d'une clé d'idempotence, sinon elles ne sont pas rejouées. »
- Piège : l'appel de rafraîchissement qui passe lui-même par le même interceptor (boucle infinie), ou rejouer aveuglément un `POST /payments`. Question de suivi : le circuit breaker - arrêter les retries après des échecs répétés et afficher un mode dégradé.
- Compromis : les retries améliorent la résilience mais ajoutent de la latence et de la charge ; les toasts globaux sont cohérents mais génériques, donc les erreurs propres à un composant doivent toujours être affichées localement (error boundaries par widget).
