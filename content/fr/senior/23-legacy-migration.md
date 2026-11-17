# Migrer des applications frontend legacy vers une stack moderne

**Niveau :** Senior
**Merged from (original phrasings):**
- Expliquez votre stratégie pour migrer des applications frontend legacy vers des stacks techniques modernes.

## The concept (short answer)
- Évitez la **réécriture big bang** : elle gèle ou duplique le travail sur les fonctionnalités pendant des mois, la cible ne cesse de bouger, et le jour du lancement révèle d'un coup tous les cas limites oubliés.
- Utilisez le **pattern strangler fig** : placez une couche de routage (reverse proxy, règles CDN ou `rewrites` de Next.js) devant les deux applications, migrez **une route ou une fonctionnalité à la fois** vers la nouvelle stack, et renvoyez vers l'application legacy tout ce qui n'est pas encore migré. L'ancienne application rétrécit jusqu'à pouvoir être supprimée.
- Rendez les jointures invisibles pour les utilisateurs : **auth/session partagée** (un cookie sur le même domaine, compris par les deux applications), design tokens partagés pour que les pages se ressemblent, et analytics partagés.
- Prouvez l'équivalence avec des **tests de parité fonctionnelle** : les mêmes tests Playwright tournent contre la route legacy et la nouvelle avant de basculer le trafic ; livrez chaque route derrière un flag ou un rollout progressif par pourcentage, avec un moyen rapide de revenir en arrière.
- Ordonnez le travail selon la valeur et le risque : commencez par une route peu risquée, à fort trafic ou souvent modifiée, pour apprendre, et gardez pour la fin (ou pour jamais) les écrans rarement modifiés.
- Parcours typiques : de jQuery/AngularJS vers React (monter des îlots React dans l'ancienne application, ou découpage par route), de CRA vers Vite (essentiellement un changement d'outil de build, faisable en une seule PR), d'une SPA vers le Next.js App Router (route par route derrière un proxy).

## Real-life example: the problem
Un cas typique : un portail client d'assurance construit avec AngularJS 1.x, arrivé en fin de vie en janvier 2022 et qui ne reçoit plus de correctifs de sécurité. L'équipe a décidé d'une réécriture complète en Next.js dans un repo séparé. Dix-huit mois plus tard, l'application legacy avait continué de recevoir des fonctionnalités urgentes, si bien que la réécriture était toujours en retard. Le week-end du lancement, ils ont basculé le DNS vers la nouvelle application : les clients ayant des contrats joints ne pouvaient plus télécharger leurs documents PDF (une fonctionnalité legacy non documentée), les liens profonds mis en favoris renvoyaient des 404, et les utilisateurs étaient déconnectés parce que la nouvelle application utilisait un autre mécanisme de session. La bascule a été annulée au bout de deux jours, et la réécriture a perdu la confiance du métier.

Le plan ressemblait à ceci :

```nginx
# nginx.conf - CASSÉ : bascule en tout-ou-rien
server {
  server_name portal.insurer.example;
  location / {
    # basculer d'un coup du legacy vers la nouvelle app le jour du lancement
    proxy_pass http://next-app:3000;      # avant : http://angularjs-app:8080
  }
}
```

```js
// auth de la nouvelle app - CASSÉ : son propre login, ignore le cookie de session existant
export async function middleware(req) {
  if (!req.cookies.get('next_auth_token')) {
    return Response.redirect(new URL('/login', req.url));   // les utilisateurs legacy sont « déconnectés »
  }
}
```

## How to fix it
**1. Un seul point d'entrée, migration route par route, repli sur le legacy**
```js
// next.config.js - Next.js est la porte d'entrée ; les chemins non migrés vont vers l'app legacy
module.exports = {
  async rewrites() {
    return {
      // beforeFiles/afterFiles omis ; fallback ne s'applique que si aucune page Next.js ne correspond
      fallback: [
        { source: '/:path*', destination: `${process.env.LEGACY_ORIGIN}/:path*` },
      ],
    };
  },
};
```
Déjà migrés : `app/dashboard/page.tsx`, `app/claims/[id]/page.tsx`. Tout le reste (`/policies/*`, `/documents/*`) est encore servi par AngularJS via le fallback, sur le même domaine, avec les mêmes URLs, donc les favoris continuent de fonctionner.

**2. Session partagée : la nouvelle application fait confiance au cookie existant**
```ts
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { verifyLegacySession } from '@/lib/session';   // valide le MÊME cookie signé

const MIGRATED = ['/dashboard', '/claims'];

export async function middleware(req: NextRequest) {
  if (!MIGRATED.some((p) => req.nextUrl.pathname.startsWith(p))) return NextResponse.next();
  const session = await verifyLegacySession(req.cookies.get('PORTAL_SESSION')?.value);
  if (!session) return NextResponse.redirect(new URL('/login', req.url));  // page de login legacy
  return NextResponse.next();
}
```

**3. Des tests de parité exécutés contre les deux implémentations avant de basculer une route**
```ts
// parity/claims.spec.ts - à lancer avec BASE_URL=legacy et BASE_URL=new
test('joint policy holder can download claim documents', async ({ page }) => {
  await loginAs(page, 'joint-policy-holder');
  await page.goto('/claims/C-1042');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  expect((await download).suggestedFilename()).toMatch(/C-1042.*\.pdf$/);
});
```

**4. Rollout progressif par route**
```ts
// Dans le middleware : envoyer un pourcentage des utilisateurs vers la nouvelle route, de façon stable par utilisateur
if (pathname.startsWith('/claims') && !(await isEnabled('new-claims', session.userId))) {
  return NextResponse.rewrite(new URL(pathname + req.nextUrl.search, process.env.LEGACY_ORIGIN));
}
```
Surveillez le taux d'erreur, les Web Vitals et les tickets de support pour la route migrée ; désactivez le flag pour un rollback instantané. Quand une route est à 100 % depuis quelques semaines, supprimez son code legacy.

Pourquoi ça fonctionne : les utilisateurs arrivent toujours sur un seul domaine avec une seule session, donc les deux stacks sont invisibles ; chaque route est livrée indépendamment avec des tests qui prouvent la parité, si bien que les comportements non documentés se découvrent une fonctionnalité à la fois plutôt que le jour du lancement ; les nouvelles fonctionnalités ne sont développées que dans la nouvelle stack, donc la cible de la migration cesse de bouger ; le rollback est un flag, pas un changement de DNS.

Alternatives : pour une migration au niveau des widgets au sein d'une même page, montez des composants React dans l'application legacy (`createRoot` sur un nœud DOM depuis une directive AngularJS) et étendez progressivement ces îlots. Pour passer de CRA à Vite, une seule PR ciblée suffit généralement (déplacer `index.html` à la racine, `REACT_APP_*` vers `VITE_*` / `import.meta.env`, remplacer Jest par Vitest progressivement).

## How to say it in the interview
- « J'évite les réécritures big bang ; je place une couche de routage en amont, je migre route par route avec l'application legacy en repli, et je supprime le code legacy à mesure que chaque route atteint 100 %. »
- « Le travail caché, ce sont les jointures : session partagée, mêmes URLs, mêmes design tokens et analytics, et des tests de parité qui tournent contre les deux versions. »
- Piège en question de relance : « Comment convainquez-vous le métier ? » Montrez une valeur incrémentale : chaque route migrée apporte des gains mesurables (LCP plus rapide, moins de bugs, livraison de fonctionnalités plus rapide), et il n'y a jamais de longue période de gel.
- Compromis : faire tourner deux stacks pendant un temps coûte plus cher (deux builds, composants dupliqués, changements de contexte). Fixez un ordre clair et une date de fin, et arrêtez d'ajouter des fonctionnalités côté legacy.
