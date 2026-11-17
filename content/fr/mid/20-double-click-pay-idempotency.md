# Un utilisateur double-clique sur « Payer ». Comment empêchez-vous la requête en double ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Un utilisateur double-clique sur « Payer ». Comment empêchez-vous la requête en double ?

## The concept (short answer)
- **Deux niveaux, et les deux sont indispensables.**
  1. **Client :** empêchez la seconde soumission. Utilisez un verrou synchrone « requête en cours » (un `useRef` positionné tout en haut du handler, avant le moindre `await`). `disabled={loading}` ne prend effet qu'après un re-render, donc tout `await` avant `setLoading(true)` (validation, rafraîchissement d'un token, vérification 3-D Secure) laisse une fenêtre pendant laquelle un second clic passe. Désactivez aussi le bouton et affichez « Traitement en cours... ».
  2. **Serveur :** rendez l'opération **idempotente** grâce à une **clé d'idempotence**. Le client génère une clé unique (`crypto.randomUUID()`) une fois par tentative de paiement et l'envoie avec chaque nouvel essai. Le serveur stocke la clé avec le résultat et, s'il revoit la même clé, renvoie le résultat d'origine au lieu de débiter à nouveau.
- **Pourquoi la correction côté client ne suffit pas :** les nouvelles tentatives après un timeout réseau (la requête a réussi mais la réponse s'est perdue), les utilisateurs qui rafraîchissent ou font Retour puis soumettent à nouveau, deux onglets ouverts, les proxies ou bibliothèques qui relancent les requêtes, et n'importe qui avec curl. Seul le serveur peut garantir « exactement un débit ».
- Les prestataires de paiement le prennent directement en charge (par exemple l'en-tête `Idempotency-Key` de Stripe). Votre propre API devrait proposer le même pattern pour tout POST non idempotent : commandes, virements, réservations.
- Le debounce ou le throttle n'est **pas** le bon outil ici : il retarde ou ignore des clics en fonction du temps et ne garantit rien.

## Real-life example: the problem
Sur un site de billetterie, pendant la prévente d'un concert, l'API de paiement est lente (4 à 6 s). Les utilisateurs double-cliquent sur « Payer » ou recliquent parce que rien ne semble se passer. Le support reçoit des dizaines de plaintes de personnes débitées deux fois pour les mêmes billets, et les rétrofacturations (chargebacks) augmentent. Le développeur avait ajouté `disabled={loading}`, mais les doublons continuent. Le handler attend d'abord une vérification du panier (~300 ms) avant de positionner `loading`, donc un second clic pendant cet await lance un second paiement. Les nouvelles tentatives sur timeout réseau du client API renvoient aussi le POST, et les utilisateurs qui rafraîchissent ou réessaient depuis un autre onglet créent de nouveaux débits.

```jsx
function PayButton({ cartId, amount }) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    if (loading) return;
    await api.get(`/carts/${cartId}/check`); // ~300 ms : le bouton est encore actif pendant cet await
    setLoading(true);              // trop tard : un second clic a déjà lancé un autre paiement
    await api.post('/payments', { cartId, amount }, { retry: 2 }); // les nouvelles tentatives créent de nouveaux débits
    setLoading(false);
    router.push('/confirmation');
  }

  return <button onClick={handlePay} disabled={loading}>Pay {amount} EUR</button>;
}
```

```js
// serveur : débite pour chaque requête reçue
app.post('/payments', async (req, res) => {
  const charge = await psp.charge(req.body.cartId, req.body.amount);
  res.json({ status: 'paid', chargeId: charge.id });
});
```

## How to fix it
**Client :**
```jsx
function PayButton({ cartId, amount }) {
  const [status, setStatus] = useState('idle'); // idle | processing | error
  const inFlight = useRef(false);
  // Une clé par tentative de paiement ; réutilisée lors des nouveaux essais, régénérée seulement pour une nouvelle tentative
  const idempotencyKey = useRef(crypto.randomUUID());

  async function handlePay() {
    if (inFlight.current) return;   // verrou synchrone, positionné avant tout await
    inFlight.current = true;
    setStatus('processing');
    try {
      await api.post('/payments', { cartId, amount }, {
        headers: { 'Idempotency-Key': idempotencyKey.current },
        retry: 2,                    // les nouvelles tentatives sont désormais sûres : même clé
      });
      router.push('/confirmation');
    } catch (err) {
      setStatus('error');
      inFlight.current = false;      // autorise un nouvel essai avec la MÊME clé
    }
  }

  return (
    <button onClick={handlePay} disabled={status === 'processing'} aria-busy={status === 'processing'}>
      {status === 'processing' ? 'Processing payment...' : `Pay ${amount} EUR`}
    </button>
  );
}
```

**Serveur :**
```js
app.post('/payments', async (req, res) => {
  const key = req.get('Idempotency-Key');
  if (!key) return res.status(400).json({ error: 'Idempotency-Key required' });

  // Insertion atomique : une contrainte d'unicité sur (user_id, key) fait échouer ici les doublons concurrents
  const inserted = await db.idempotency.insertIfAbsent({
    userId: req.user.id, key, requestHash: hash(req.body), status: 'processing',
  });

  if (!inserted) {
    const existing = await db.idempotency.find(req.user.id, key);
    if (existing.requestHash !== hash(req.body)) return res.status(422).json({ error: 'Key reused with different payload' });
    if (existing.status === 'processing') return res.status(409).json({ error: 'Payment in progress' });
    return res.status(existing.httpStatus).json(existing.response); // renvoie le résultat d'origine
  }

  const charge = await psp.charge(req.body.cartId, req.body.amount, { idempotencyKey: key });
  const response = { status: 'paid', chargeId: charge.id };
  await db.idempotency.complete(req.user.id, key, { httpStatus: 200, response });
  res.json(response);
});
```

Pourquoi ça marche : la ref bloque un second clic de façon synchrone, avant tout re-render. Le bouton désactivé et le libellé « Traitement en cours... » dissuadent les utilisateurs de recliquer. Côté serveur, la contrainte d'unicité garantit qu'une seule requête par clé peut créer un débit : tout doublon, qu'il vienne d'un double clic, d'une nouvelle tentative, d'un second onglet ou d'un rafraîchissement, reçoit le résultat stocké ou une 409. Transmettre la même clé au prestataire de paiement protège aussi le dernier maillon. Les clés expirent au bout d'environ 24 h.

Alternative pour les formulaires classiques : le pattern Post/Redirect/Get associé à un token de formulaire à usage unique. Dans React 19, `useActionState`/`useFormStatus` vous donnent `pending` pour le bouton, mais ils ne remplacent toujours pas l'idempotence côté serveur.

## How to say it in the interview
- « Désactiver le bouton, c'est de l'UX, pas de la correction. J'ajoute un verrou synchrone avec une ref côté client et une clé d'idempotence garantie par une contrainte d'unicité côté serveur. »
- « La clé est créée une fois par tentative de paiement et réutilisée lors des nouveaux essais. Une nouvelle clé à chaque clic n'aurait aucun intérêt. »
- Question de suivi : « Pourquoi ne pas simplement vérifier `if (loading)` ? » `setState` est asynchrone et la closure est obsolète, donc deux clics dans le même tick passent tous les deux. Une ref se met à jour de façon synchrone.
- Compromis : il faut un stockage et une durée de vie (TTL) pour les clés, et gérer l'état « toujours en cours » (renvoyer une 409 ou attendre), mais c'est bien moins coûteux que des remboursements et des rétrofacturations.
