# Comment gérez-vous l'authentification et l'autorisation dans les applications frontend ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Comment gérez-vous l'authentification et l'autorisation dans les applications frontend ?

## The concept (short answer)
- L'**authentification** répond à « qui êtes-vous ? » (connexion, session, tokens). L'**autorisation** répond à « qu'avez-vous le droit de faire ? » (rôles, permissions, propriété des ressources).
- **La vraie frontière de sécurité, c'est le serveur.** Les gardes de route côté frontend et les boutons masqués relèvent uniquement de l'UX. N'importe qui peut appeler votre API avec curl ou modifier le state JS dans les DevTools, donc chaque endpoint de l'API doit lui-même vérifier la session et la permission.
- **Stockage du token :**
  - `localStorage`/`sessionStorage` : lisible par n'importe quel JS de la page, donc une seule faille XSS ou un script npm ou analytics compromis suffit à voler le token.
  - **Cookie httpOnly + Secure + SameSite** : le JS ne peut pas le lire et le navigateur l'envoie automatiquement. C'est l'approche à privilégier, idéalement avec un BFF qui conserve côté serveur les vrais access et refresh tokens. Il faut tout de même une protection CSRF (SameSite=Lax/Strict, un token CSRF pour les méthodes non sûres).
  - Si vous devez utiliser des bearer tokens dans une SPA : gardez l'access token **en mémoire**, avec une courte durée de vie (5 à 15 min), et le **refresh token dans un cookie httpOnly**, renouvelé à chaque utilisation (rotation).
- **Flux de rafraîchissement :** sur une 401, rafraîchissez une seule fois, mettez en file d'attente les autres requêtes qui échouent pendant le rafraîchissement, puis relancez-les. Si le rafraîchissement échoue, déconnectez l'utilisateur.
- **Gardes de route :** vérifiez la session avant d'afficher les pages protégées (middleware Next.js ou vérification côté serveur dans le layout ou la page ; dans une SPA, un composant de garde) pour éviter de faire apparaître brièvement du contenu protégé, et redirigez vers la connexion avec un paramètre `returnTo`.
- **Autorisation au niveau de l'interface :** le serveur envoie les permissions de l'utilisateur et l'interface masque ou désactive les actions en conséquence, uniquement pour une meilleure UX.

## Real-life example: the problem
Dans un SaaS B2B de facturation, un audit de sécurité a relevé deux problèmes. (1) Le JWT était stocké dans `localStorage` et l'application charge un widget de chat tiers : n'importe quel script de la page pouvait lire le token et agir au nom de l'utilisateur pendant 30 jours (le token n'expirait jamais). (2) Le bouton « Supprimer la facture » était masqué pour les non-administrateurs, mais l'API ne vérifiait pas le rôle. Un utilisateur au rôle « lecteur » qui a ouvert les DevTools et rejoué la requête `DELETE /invoices/:id` a supprimé des factures de toute l'entreprise.

```jsx
// connexion
const { token } = await api.post('/login', creds);
localStorage.setItem('token', token);              // lisible par n'importe quel script de la page

// client API
axios.defaults.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;

// « autorisation » uniquement dans l'interface
function InvoiceActions({ invoice, user }) {
  return user.role === 'admin' ? <button onClick={() => api.delete(`/invoices/${invoice.id}`)}>Delete</button> : null;
}
```

```js
// API : authentifie mais n'autorise jamais
app.delete('/invoices/:id', requireLogin, async (req, res) => {
  await db.invoices.delete(req.params.id);          // n'importe quel utilisateur connecté, la facture de n'importe quelle entreprise
  res.sendStatus(204);
});
```

## How to fix it
**Serveur : session dans un cookie httpOnly, et autorisation sur chaque endpoint.**
```js
app.post('/login', async (req, res) => {
  const user = await verifyCredentials(req.body);
  const sessionId = await sessions.create(user.id, { ttl: '8h' });
  res.cookie('sid', sessionId, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  res.json({ id: user.id, name: user.name, permissions: user.permissions }); // pas de token dans le corps
});

app.delete('/invoices/:id', requireSession, async (req, res) => {
  const invoice = await db.invoices.find(req.params.id);
  if (!invoice || invoice.companyId !== req.user.companyId) return res.sendStatus(404); // vérification du tenant
  if (!req.user.permissions.includes('invoice:delete')) return res.sendStatus(403);    // vérification de la permission
  await db.invoices.delete(invoice.id);
  res.sendStatus(204);
});
```

**Next.js : protéger les routes avant le rendu, et conditionner l'interface aux permissions.**
```js
// middleware.js (renommé proxy.js dans Next 16) : redirection rapide en l'absence de session (vérification optimiste uniquement)
import { NextResponse } from 'next/server';
export function middleware(req) {
  if (!req.cookies.get('sid')) {
    const url = new URL('/login', req.url);
    url.searchParams.set('returnTo', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
}
export const config = { matcher: ['/app/:path*'] };
```

```jsx
// app/app/layout.jsx : vraie validation de la session côté serveur
import { getCurrentUser } from '@/server/auth';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }) {
  const user = await getCurrentUser();        // valide sid auprès du stockage de sessions
  if (!user) redirect('/login');
  return <PermissionsProvider value={user.permissions}>{children}</PermissionsProvider>;
}

// Autorisation au niveau de l'interface : simple confort, l'API l'applique de toute façon
function Can({ permission, children }) {
  const permissions = usePermissions();
  return permissions.includes(permission) ? children : null;
}
// <Can permission="invoice:delete"><DeleteButton id={invoice.id} /></Can>
```

Pourquoi ça marche : l'identifiant de session ne peut pas être lu par des scripts injectés (httpOnly), n'est envoyé qu'en HTTPS (Secure), et n'est pas envoyé lors de POST cross-site (SameSite=Lax). L'API vérifie à la fois le tenant et la permission, donc les requêtes rejouées ou forgées échouent. La garde dans le layout serveur garantit que le HTML protégé n'est jamais envoyé aux utilisateurs anonymes, et l'interface masque les actions que l'utilisateur ne peut pas effectuer.

Alternatives : OAuth/OIDC avec un fournisseur d'identité (Auth0, Keycloak, Entra ID) en Authorization Code + PKCE, idéalement via un BFF ; des bibliothèques comme Auth.js/NextAuth qui gèrent la session par cookie pour vous.

## How to say it in the interview
- « L'authentification côté frontend, c'est de l'UX : gardes, boutons masqués, redirections. La sécurité est appliquée côté serveur à chaque requête : authentifier la session, puis autoriser l'action précise sur la ressource précise. »
- « Je préfère les cookies httpOnly, Secure, SameSite à localStorage, parce qu'une faille XSS ou un script tiers malveillant ne peut pas voler ce que le JS ne peut pas lire. Les cookies nécessitent alors une protection CSRF. »
- Question de suivi : « Comment rafraîchissez-vous les tokens ? » Avec un access token à courte durée de vie et un refresh token en rotation dans un cookie httpOnly, et un seul rafraîchissement en cours partagé par les 401 concurrentes.
- Compromis : les sessions serveur sont faciles à révoquer mais nécessitent un stockage de sessions. Les JWT stateless passent facilement à l'échelle mais sont difficiles à révoquer avant leur expiration, donc gardez-les à courte durée de vie.
