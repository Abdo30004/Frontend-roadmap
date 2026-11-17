# Comment construire un hook d'API avec annulation, retries, gestion d'erreurs et sans race conditions ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Comment implémentez-vous les appels API et la gestion d'erreurs en React ?
- Comment construiriez-vous un custom hook d'API avec annulation, retries et gestion d'erreurs ?
- Comment évitez-vous les race conditions lors d'un fetch dans des effects ?

## The concept (short answer)
- Une **race condition** survient quand la requête A démarre, puis la requête B démarre (l'utilisateur a changé le filtre), et que **A se termine en dernier**. Les anciennes données de A écrasent celles de B. L'UI affiche des résultats qui ne correspondent pas à la saisie actuelle.
- Deux outils dans le cleanup de l'effect :
  - **`AbortController`** : annule la requête réseau elle-même (économise de la bande passante ; `fetch` rejette avec une `AbortError`).
  - **Flag `ignore`** : `let ignore = false; return () => { ignore = true }`. Même si une réponse arrive, elle n'est pas écrite dans le state. Fonctionne avec n'importe quelle Promise (SDK, clients GraphQL qui ne savent pas annuler).
- **Gestion d'erreurs** : `fetch` ne rejette **pas** sur un HTTP 404/500, donc vérifiez `res.ok`. Séparez les états : `loading`, `error`, `data` (ou une enum de statut). Affichez un bouton « Réessayer » et conservez les anciennes données quand c'est pertinent.
- **Retries** : uniquement pour les échecs transitoires (erreurs réseau, 5xx, 429), jamais pour les erreurs de validation 4xx. Utilisez un **backoff exponentiel avec jitter** (par exemple 500ms, 1s, 2s + aléatoire) et un nombre maximal de tentatives. Respectez `Retry-After` sur un 429.
- Réponse « production » : **TanStack Query** (ou SWR, ou le fetch côté serveur dans les React Server Components). Il gère le cache, la déduplication, l'annulation, les retries avec backoff, le refetch au focus et le stale-while-revalidate. Un custom hook est utile pour montrer que vous comprenez la mécanique.

## Real-life example: the problem
Sur une page de recherche de vols, l'utilisateur tape « Par », puis rapidement « Paris ». La requête pour « Par » est lente (beaucoup de résultats) et arrive après celle de « Paris ». La liste affiche les aéroports correspondant à « Par » (Parme, Paro...) sous l'input « Paris ». Quand l'API renvoie une erreur 500, la page affiche « undefined » parce que `fetch` n'a pas levé d'erreur, et une courte coupure du Wi-Fi laisse la page vide indéfiniment.

```jsx
function useAirports(query) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/airports?q=${query}`)
      .then((res) => res.json())       // l'erreur 500 en HTML/JSON est parsée comme des données
      .then((json) => {
        setData(json.items);           // BUG : une réponse plus ancienne peut arriver en dernier et l'emporter
        setLoading(false);
      });                              // pas de catch : erreur réseau -> chargement infini
  }, [query]);

  return { data, loading };
}
```

## How to fix it
```js
import { useCallback, useEffect, useState } from 'react';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
  });

const isRetryable = (err) =>
  err.name === 'TypeError' ||                                    // échec réseau
  (err instanceof HttpError && (err.status >= 500 || err.status === 429));

async function fetchJson(url, { signal, retries = 3, baseDelay = 500 }) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new HttpError(res.status, `Request failed: ${res.status}`);
      return await res.json();
    } catch (err) {
      if (signal.aborted || attempt >= retries || !isRetryable(err)) throw err;
      const delay = baseDelay * 2 ** attempt + Math.random() * 200; // backoff + jitter
      await sleep(delay, signal);
    }
  }
}

export function useApi(url) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let ignore = false;

    setState((s) => ({ ...s, status: 'loading', error: null })); // conserver les anciennes données pendant le chargement

    fetchJson(url, { signal: controller.signal })
      .then((data) => { if (!ignore) setState({ status: 'success', data, error: null }); })
      .catch((error) => {
        if (ignore || error.name === 'AbortError') return;
        setState((s) => ({ ...s, status: 'error', error }));
      });

    return () => {
      ignore = true;        // ne jamais écrire une réponse périmée
      controller.abort();   // et l'annuler côté réseau
    };
  }, [url, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);
  return { ...state, retry };
}

// Utilisation
function AirportSearch({ query }) {
  const { status, data, error, retry } = useApi(
    query ? `/api/airports?q=${encodeURIComponent(query)}` : null
  );
  if (status === 'error') return <ErrorBox message={error.message} onRetry={retry} />;
  return <AirportList items={data?.items ?? []} loading={status === 'loading'} />;
}
```
Pourquoi ça marche : chaque exécution de l'effect possède son propre `AbortController` et son propre flag `ignore`. Quand `query` change, le cleanup annule l'ancienne requête et la marque comme ignorée avant que la nouvelle ne démarre, donc seule la dernière réponse peut mettre à jour le state. `res.ok` transforme les erreurs HTTP en vraies erreurs. Les échecs transitoires sont relancés avec des délais croissants, et l'attente entre deux tentatives est elle aussi annulable. L'UI a des états explicites loading/error/success et un retry manuel.

### La version production
```jsx
const { data, error, isPending, refetch } = useQuery({
  queryKey: ['airports', query],
  queryFn: ({ signal }) => fetchJson(`/api/airports?q=${encodeURIComponent(query)}`, { signal, retries: 0 }),
  enabled: query.length > 1,
  retry: 3,                // backoff exponentiel intégré
  staleTime: 60_000,
});
```
Les résultats sont mis en cache par key, donc taper « Paris » -> « Par » -> « Paris » affiche instantanément le résultat en cache. Les race conditions ne peuvent pas se produire car les données sont stockées par key.

## How to say it in the interview
- « Un fetch dans un effect a besoin d'un cleanup : `AbortController` pour annuler la requête et un flag `ignore` pour qu'une réponse tardive n'écrase jamais un state plus récent. »
- « `fetch` ne rejette que sur les erreurs réseau, donc je vérifie `res.ok`. Je ne relance que les erreurs transitoires (réseau, 5xx, 429), avec un backoff exponentiel et du jitter. »
- « En production, j'utilise TanStack Query ou je fais le fetch dans des Server Components. Un custom hook finit généralement par réimplémenter, mal, le cache, la déduplication et le refetch. »
- Compromis / piège : les retries masquent les pannes aux utilisateurs mais ajoutent de la charge sur un serveur déjà en difficulté. Le jitter et une limite de tentatives évitent un effet « thundering herd ». Ne relancez jamais automatiquement des requêtes non idempotentes comme `POST /payments` sans clé d'idempotence.
