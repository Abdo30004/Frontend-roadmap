# Fonctionnalités temps réel : WebSockets vs SSE, reconnexion et ordre des messages

**Niveau :** Senior
**Merged from (original phrasings):**
- Expliquez votre stratégie pour implémenter des fonctionnalités temps réel (WebSockets, Server-Sent Events).
- Les messages WebSocket arrivent dans le désordre. Que doit faire le client ?

## The concept (short answer)

**Choisir le transport**
- **Polling / long polling :** mises à jour peu fréquentes (toutes les 30s ou plus), infrastructure la plus simple, fonctionne partout. Suffisant plus souvent qu'on ne l'admet.
- **Server-Sent Events (SSE) :** flux unidirectionnel serveur -> client sur du HTTP classique (`EventSource`). Reconnexion automatique et reprise via `Last-Event-ID` intégrées, compatible avec HTTP/2, les proxies et les cookies d'authentification. Idéal pour les notifications, les flux en direct, les tableaux de bord, le streaming de tokens d'un LLM. Le sens client -> serveur passe par des requêtes HTTP normales.
- **WebSockets :** full-duplex, faible latence, support du binaire. Nécessaires pour un chat avec indicateurs de saisie, l'édition collaborative, le multijoueur, le trading. La reconnexion, les heartbeats, l'authentification à la connexion et l'infrastructure sticky / stateful sont à votre charge.

**Stratégie de fiabilité (quel que soit le transport)**
- **Reconnexion avec backoff exponentiel + jitter**, plus des heartbeats (ping/pong) pour détecter les connexions mortes ; mettez en pause hors ligne ou quand la page est masquée, reprenez sur `online`/`visibilitychange`.
- **Ordre :** TCP préserve l'ordre *au sein d'une connexion*, mais en pratique les messages arrivent tout de même « dans le désordre » : plusieurs instances backend qui publient via un pub/sub, une reconnexion à un autre nœud, un snapshot REST en concurrence avec les événements en direct, ou des gestionnaires asynchrones. La solution est un **numéro de séquence monotone (ou une version) par flux**, attribué par le serveur.
- **Algorithme côté client :** conservez `lastSeq`. `seq <= lastSeq` -> doublon, ignorer. `seq === lastSeq + 1` -> appliquer, puis vider les successeurs en mémoire tampon. `seq > lastSeq + 1` -> **mettre en tampon** et attendre brièvement ; si le trou n'est pas comblé à temps, **récupérer un snapshot** (avec son seq) et reprendre à partir de là. À la reconnexion, demandez au serveur de reprendre depuis `lastSeq`.
- **Gestionnaires idempotents :** appliquer deux fois le même événement ne doit rien dupliquer (upsert par id, last-write-wins par version) - la livraison at-least-once est la garantie réaliste.

## Real-life example: the problem

Le suivi de commande en direct d'une application de livraison de repas. Les utilisateurs signalent que le statut revient en arrière : « Récupérée par le livreur » repasse à « En préparation », et le repère du livreur recule sur la carte. Après un tunnel de métro (coupure réseau), le suivi se fige jusqu'à la réouverture de l'application ; dans le chat du support, certains messages apparaissent en double. Le backend tourne sur trois instances qui publient via Redis pub/sub ; les mises à jour de statut du service restaurant et du service livreur peuvent se doubler mutuellement.

```js
// Client naïf : le dernier message gagne, pas de reconnexion, pas de déduplication
function useOrderTracking(orderId) {
  const [order, setOrder] = useState(null);
  useEffect(() => {
    fetch(`/api/orders/${orderId}`).then((r) => r.json()).then(setOrder);   // en concurrence avec le socket
    const ws = new WebSocket(`wss://rt.example.com/orders/${orderId}`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      setOrder((o) => ({ ...o, ...msg.patch }));      // un événement plus ancien peut écraser un state plus récent
      if (msg.type === 'chat') appendChat(msg.message); // doublons après un renvoi du serveur
    };
    return () => ws.close();                            // et onclose ? rien : la connexion reste morte
  }, [orderId]);
  return order;
}
```

## How to fix it

Contrat côté serveur : chaque événement du flux `order:{id}` porte un `seq` (monotone par commande), les snapshots portent le `seq` qu'ils reflètent, et le socket accepte `?since=<seq>` pour rejouer les événements manqués.

```js
class OrderStream {
  constructor(orderId, onState) {
    Object.assign(this, { orderId, onState, state: null, lastSeq: -1, buffer: new Map(), attempt: 0 });
    this.connect();
  }

  async loadSnapshot() {
    const res = await fetch(`/api/orders/${this.orderId}`);       // { seq, order, chat: [...] }
    const snap = await res.json();
    this.state = snap;
    this.lastSeq = snap.seq;
    for (const s of [...this.buffer.keys()]) if (s <= this.lastSeq) this.buffer.delete(s);
    this.drain();
    this.onState(this.state);
  }

  connect() {
    const since = this.lastSeq >= 0 ? `?since=${this.lastSeq}` : '';
    this.ws = new WebSocket(`wss://rt.example.com/orders/${this.orderId}${since}`);
    this.ws.onopen = () => { this.attempt = 0; if (this.lastSeq < 0) this.loadSnapshot(); };
    this.ws.onmessage = (e) => this.receive(JSON.parse(e.data));
    this.ws.onclose = () => { if (!this.closed) this.reconnect(); };
  }

  reconnect() {
    const delay = Math.random() * Math.min(30_000, 500 * 2 ** this.attempt++); // backoff + full jitter
    this.timer = setTimeout(() => this.connect(), delay);
  }

  receive(event) {
    if (event.seq <= this.lastSeq || this.buffer.has(event.seq)) return;      // doublon
    this.buffer.set(event.seq, event);
    if (this.lastSeq < 0) return;                                             // snapshot en attente
    this.drain();
    if (this.buffer.size > 0 && !this.gapTimer) {                             // trou détecté
      this.gapTimer = setTimeout(() => { this.gapTimer = null; this.loadSnapshot(); }, 2000);
    }
  }

  drain() {
    let next;
    while ((next = this.buffer.get(this.lastSeq + 1))) {
      this.buffer.delete(next.seq);
      this.state = applyEvent(this.state, next);                              // pur + idempotent
      this.lastSeq = next.seq;
    }
    if (this.buffer.size === 0 && this.gapTimer) { clearTimeout(this.gapTimer); this.gapTimer = null; }
    this.onState(this.state);
  }

  close() { this.closed = true; clearTimeout(this.timer); clearTimeout(this.gapTimer); this.ws.close(); }
}

function applyEvent(state, e) {
  switch (e.type) {
    case 'status': return { ...state, order: { ...state.order, status: e.status } };
    case 'courier_location': return { ...state, order: { ...state.order, courier: e.position } };
    case 'chat':  // upsert par id de message : un message renvoyé ne peut pas créer de doublon
      return state.chat.some((m) => m.id === e.message.id) ? state : { ...state, chat: [...state.chat, e.message] };
    default: return state;
  }
}

function useOrderTracking(orderId) {
  const [state, setState] = useState(null);
  useEffect(() => {
    const stream = new OrderStream(orderId, setState);
    return () => stream.close();
  }, [orderId]);
  return state;
}
```

Pourquoi ça marche : le numéro de séquence donne au client un ordre total par flux de commande, quelle que soit l'instance serveur qui a envoyé quoi. Les doublons sont écartés, les événements arrivés en avance attendent dans le tampon, et un trou persistant est comblé par un snapshot qui porte son propre `seq`, si bien que les événements en direct et le snapshot ne peuvent jamais s'écraser mutuellement. Les reconnexions reprennent depuis `lastSeq` avec un backoff à jitter (pas d'effet « thundering herd » après un redémarrage du serveur). Les gestionnaires sont idempotents, donc la livraison at-least-once est sans danger. Pour des données à haute fréquence où seule la dernière valeur compte, comme la position du livreur, vous pouvez renoncer à l'ordre strict et simplement écarter tout ce qui a un timestamp / une version plus ancienne. Si ce suivi était uniquement unidirectionnel, SSE fournirait gratuitement la reconnexion et la reprise via `Last-Event-ID` :

```js
const es = new EventSource(`/api/orders/${orderId}/events`); // le serveur définit `id: <seq>` sur chaque événement
es.addEventListener('status', (e) => stream.receive(JSON.parse(e.data)));
```

## How to say it in the interview

- « Par défaut, SSE pour les flux serveur vers client, et WebSockets uniquement quand j'ai besoin d'un trafic bidirectionnel à faible latence ; du polling pour les données peu fréquentes. »
- « L'ordre se règle avec des numéros de séquence par flux attribués par le serveur : ignorer les doublons, mettre en tampon les événements arrivés en avance, récupérer un snapshot versionné en cas de trou persistant, et reprendre depuis le dernier seq à la reconnexion. »
- Piège : « TCP garantit l'ordre, donc ça ne peut pas arriver » - l'ordre se casse entre instances serveur, lors des reconnexions et dans les courses entre snapshot et flux en direct. Question de suivi : faire passer les WebSockets à l'échelle - sticky sessions ou fan-out via pub/sub (Redis, NATS), limites de connexions par nœud, expiration du token d'authentification sur les connexions de longue durée.
- Compromis : l'ordre strict avec mise en tampon ajoute de la latence et consomme de la mémoire ; pour les données où la dernière valeur l'emporte (positions, prix), utilisez des versions et écartez les mises à jour périmées au lieu de les réordonner.
