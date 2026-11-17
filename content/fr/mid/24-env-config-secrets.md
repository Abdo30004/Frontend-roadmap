# Comment gérer la configuration d'environnement sans exposer de secrets dans les bundles frontend ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Comment gérez-vous la configuration d'environnement sans exposer de secrets dans les bundles frontend ?

## The concept (short answer)
- **Règle :** tout ce qui est envoyé au navigateur est public. La minification n'est pas une protection : n'importe qui peut ouvrir les DevTools, l'onglet Sources ou les fichiers `.js` et chercher `sk_` ou `key`.
- **Comment les bundlers exposent les variables d'environnement :** au moment du build, les références comme `process.env.NEXT_PUBLIC_X` ou `import.meta.env.VITE_X` sont **remplacées par des chaînes littérales** dans le JS. Seules les variables préfixées sont injectées (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_` dans CRA). Le préfixe signifie **« rendre ceci public »**, et non « rendre ceci configurable ».
- **Configuration publique** (acceptable dans le bundle) : URL de base des API, feature flags, identifiants analytics, clés Stripe *publishable*, DSN Sentry, clés Maps **restreintes par référent HTTP et par API**.
- **Secrets** (jamais dans le bundle) : identifiants de base de données, clés Stripe *secret*, clés OpenAI ou d'autres API payantes, tokens de service, secrets de signature. Ils ne vivent que sur le serveur (Route Handlers, Server Components, Server Actions, BFF, edge functions), et le navigateur appelle **votre** endpoint, qui ajoute la clé et applique l'authentification et le rate limiting.
- **Défense en profondeur :** le package `server-only` fait échouer le build si un module est importé dans du code client. Ajoutez une détection de secrets (gitleaks, GitHub secret scanning) dans la CI. Gardez les `.env*.local` dans le `.gitignore`. Stockez les secrets dans la plateforme d'hébergement ou dans un coffre-fort (vault), pas dans Git.
- **Configuration à l'exécution :** comme les variables publiques sont figées au moment du build, une même image Docker ne peut pas être promue de staging à prod avec des valeurs différentes. Servez plutôt la configuration à l'exécution (un `/config.json` récupéré au démarrage, ou des valeurs lues par un Server Component et transmises aux enfants) pour que le même artefact fonctionne dans tous les environnements.

## Real-life example: the problem
L'application « rédacteur de CV par IA » d'une startup est une SPA Vite qui appelle un fournisseur de LLM directement depuis le navigateur. Pour que cela fonctionne, le développeur a mis la clé d'API dans `VITE_OPENAI_KEY`. En quelques jours, quelqu'un a trouvé la clé dans le bundle de production (`assets/index-3f9a.js`) et l'a utilisée pour ses propres traitements. L'entreprise a reçu une facture à cinq chiffres et a dû faire tourner la clé en urgence, ce qui a cassé l'application. Le même code contenait aussi `VITE_ADMIN_TOKEN` pour un endpoint d'administration interne.

```bash
# .env (également commité dans Git)
VITE_OPENAI_KEY=sk-proj-abc123...
VITE_ADMIN_TOKEN=adm_9f8e7d...
VITE_API_URL=https://api.resumeai.example.com
```

```js
// src/lib/ai.js : s'exécute dans le navigateur
export async function improveResume(text) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_OPENAI_KEY}`, // injectée en littéral dans le bundle
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: text }] }),
  });
  return res.json();
}
```

## How to fix it
Déplacez l'appel derrière votre propre endpoint serveur (ici un Route Handler Next.js ; une fonction Express ou edge placée devant une application Vite fonctionne de la même façon) :

```bash
# .env.local (dans le .gitignore), et défini dans le gestionnaire de secrets de la plateforme d'hébergement pour la prod
OPENAI_API_KEY=sk-proj-...           # pas de préfixe, donc jamais injecté dans le code client
NEXT_PUBLIC_API_URL=https://api.resumeai.example.com   # public par conception
```

```js
// lib/server/ai.js
import 'server-only';                // erreur de build si un client component importe ce fichier

export async function callLLM(messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 800 }),
  });
  if (!res.ok) throw new Error(`LLM error ${res.status}`);
  return res.json();
}
```

```js
// app/api/improve-resume/route.js
import { callLLM } from '@/lib/server/ai';
import { getCurrentUser } from '@/server/auth';
import { rateLimit } from '@/server/rate-limit';

export async function POST(req) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  if (!(await rateLimit(`improve:${user.id}`, { max: 20, per: '1h' }))) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }
  const { text } = await req.json();
  if (typeof text !== 'string' || text.length > 10_000) return Response.json({ error: 'Invalid input' }, { status: 400 });

  const data = await callLLM([{ role: 'user', content: `Improve this resume:\n${text}` }]);
  return Response.json({ result: data.choices[0].message.content });
}
```

```js
// client : aucun secret, appelle notre propre endpoint
const { result } = await fetch('/api/improve-resume', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
}).then(r => r.json());
```

Étapes de nettoyage : **faites tourner** (rotation) immédiatement les clés exposées (les supprimer du code ne suffit pas, car elles restent dans l'historique Git et dans les anciens bundles sur les CDN), retirez complètement le token d'administration du client, ajoutez `gitleaks` à la CI, et ajoutez une vérification qui fait échouer le build si un motif `sk-` apparaît dans `dist/`.

Pourquoi ça marche : le secret n'existe que dans l'environnement serveur, et les variables sans préfixe ne sont jamais injectées dans les bundles client. L'endpoint serveur apporte en plus ce qu'une clé brute ne peut pas offrir : authentification, rate limiting, validation des entrées et maîtrise des coûts.

## How to say it in the interview
- « `NEXT_PUBLIC_` et `VITE_` veulent dire « publie ceci dans le JS ». Tout ce qui porte ces préfixes est public, donc les secrets n'ont jamais de préfixe et ne sont utilisés que côté serveur, via un proxy ou un endpoint BFF. »
- « Certaines clés sont conçues pour être publiques (Stripe publishable, Maps). Pour celles-là, la protection passe par des restrictions chez le fournisseur (référent, périmètre d'API, quotas), pas par le fait de les cacher. »
- Question de suivi : « Comment déployez-vous le même build en staging et en prod ? » Avec une configuration à l'exécution : servez un `/config.json` ou lisez l'environnement côté serveur et transmettez-le, au lieu de figer les valeurs au build.
- Piège : un secret exposé doit être **révoqué et remplacé** (rotation). Le retirer du code ne sert à rien, car il reste dans l'historique Git, dans les bundles en cache et dans les logs de l'attaquant.
