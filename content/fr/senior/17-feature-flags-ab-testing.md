# Feature flags et A/B tests dans les grandes applications React

**Niveau :** Senior
**Merged from (original phrasings):**
- Quelle est votre approche pour implémenter des feature flags dans de grandes applications frontend ?
- Expliquez votre stratégie d'A/B testing dans les applications React.

## The concept (short answer)
- Un **feature flag** découple le déploiement de la mise en production fonctionnelle (release) : le code est livré désactivé, puis activé par utilisateur, par segment ou par pourcentage, avec un kill switch. Un **A/B test** est un flag avec plusieurs variantes, plus une métrique et une analyse statistique.
- Utilisez un **fournisseur de flags** (LaunchDarkly, Unleash, GrowthBook, Statsig, Flagsmith, ou un service maison) derrière votre propre surcouche légère (`useFlag('new-checkout')`), pour pouvoir changer de fournisseur et typer les flags.
- **Flicker** : si les flags sont récupérés dans le navigateur après le premier affichage, l'utilisateur voit la version de contrôle, puis la variante apparaît d'un coup. La solution : **évaluer côté serveur** (Server Components, middleware, edge) ou injecter les valeurs des flags dans le HTML, et bloquer le rendu tant que les flags ne sont pas connus.
- **Assignation stable (sticky)** : répartissez les utilisateurs selon un ID stable (ID utilisateur, ou cookie d'ID anonyme posé à l'edge) avec un hachage déterministe, pour qu'un utilisateur voie la même variante d'un rechargement et d'un appareil à l'autre.
- **Mesurez correctement** : enregistrez un événement d'exposition quand la variante est réellement affichée, définissez à l'avance une métrique principale et des métriques garde-fous, allez jusqu'à une taille d'échantillon calculée au préalable, et ne regardez pas les résultats en cours de route pour arrêter plus tôt.
- **Les flags sont de la dette** : chaque flag a un responsable et une date d'expiration ; les flags obsolètes sont supprimés (règles de lint, dashboards des flags à 100 % depuis plus de 30 jours).

## Real-life example: the problem
Imaginez un A/B test sur le checkout d'un site e-commerce : « checkout en une page » contre le checkout actuel en trois étapes. Les résultats semblaient excellents pour la variante, mais des tickets de support disaient « la page a changé pendant que je tapais ». L'équipe a découvert que : (1) les utilisateurs voyaient l'ancien checkout pendant ~400 ms avant qu'il soit remplacé, parfois après avoir commencé à saisir ; (2) l'assignation utilisait `Math.random()` à chaque chargement de page, donc le même utilisateur passait d'une variante à l'autre et était compté dans les deux ; (3) les conversions étaient attribuées à tous ceux qui avaient chargé le bundle, et non à ceux qui avaient réellement vu la variante. Un an plus tard, la base de code contenait encore 140 flags, dont beaucoup activés en permanence, avec des branches `if` imbriquées que personne n'osait supprimer.

```tsx
// CheckoutPage.tsx - CASSÉ
'use client';
export default function CheckoutPage() {
  const [variant, setVariant] = useState<'control' | 'onepage'>('control');

  useEffect(() => {
    // récupéré après le premier affichage -> flicker ; aléatoire à chaque chargement -> pas de stabilité
    fetch('/api/flags').then(() => {
      setVariant(Math.random() < 0.5 ? 'onepage' : 'control');
    });
    analytics.track('checkout_viewed');          // pas de variante, pas d'événement d'exposition
  }, []);

  return variant === 'onepage' ? <OnePageCheckout /> : <ThreeStepCheckout />;
}
```

## How to fix it
```ts
// middleware.ts - attribuer à chaque visiteur un ID anonyme stable avant le rendu
import { NextResponse, type NextRequest } from 'next/server';
export function middleware(req: NextRequest) {
  if (req.cookies.get('anon_id')) return NextResponse.next();
  const id = crypto.randomUUID();
  req.cookies.set('anon_id', id);                     // visible par les Server Components dès CETTE requête
  const res = NextResponse.next({ request: { headers: req.headers } });
  res.cookies.set('anon_id', id, { maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: 'lax' });
  return res;
}
```

```ts
// lib/flags.ts - surcouche typée autour du fournisseur, évaluée côté serveur
import { cookies } from 'next/headers';
import { flagClient } from './flag-provider';        // par ex. SDK serveur GrowthBook/LaunchDarkly

export type Flags = { 'checkout-onepage': 'control' | 'onepage' };

export async function getVariant<K extends keyof Flags>(key: K, userId?: string): Promise<Flags[K]> {
  const anonId = (await cookies()).get('anon_id')?.value;
  // le fournisseur hache (flagKey + id stable) -> même bucket à chaque requête
  return flagClient.variation(key, { key: userId ?? anonId ?? 'anonymous' }, 'control');
}
```

```tsx
// app/checkout/page.tsx - Server Component : la bonne variante dès le premier HTML
import { getVariant } from '@/lib/flags';
import { ExposureLogger } from './ExposureLogger';

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  const variant = await getVariant('checkout-onepage', user?.id);
  return (
    <>
      <ExposureLogger experiment="checkout-onepage" variant={variant} />
      {variant === 'onepage' ? <OnePageCheckout /> : <ThreeStepCheckout />}
    </>
  );
}
```

```tsx
// ExposureLogger.tsx - n'enregistrer l'exposition que lorsque la variante est réellement affichée
'use client';
export function ExposureLogger({ experiment, variant }: { experiment: string; variant: string }) {
  useEffect(() => {
    analytics.track('$exposure', { experiment, variant });   // achats rapprochés via l'id anonyme/utilisateur
  }, [experiment, variant]);
  return null;
}
```

```ts
// flags.registry.ts - chaque flag a un responsable et une date d'expiration
export const FLAG_REGISTRY = {
  'checkout-onepage': { owner: 'team-checkout', type: 'experiment', expires: '2027-01-31' },
} as const;
// un script de CI échoue quand un flag a dépassé `expires`, ou quand une clé utilisée dans le code
// est absente du registre ; un rapport hebdomadaire liste les flags à 100 % depuis plus de 30 jours.
```

Pourquoi ça fonctionne : le serveur choisit la variante avant d'envoyer le HTML, donc pas de flicker ni de décalage de mise en page ; le hachage d'un ID stable donne des buckets stables et équilibrés ; les événements d'exposition font que l'analyse ne compte que les utilisateurs qui ont vu la variante ; le registre et la vérification en CI transforment le nettoyage des flags en tâche de routine plutôt qu'en travail d'archéologie.

Alternatives : pour une SPA purement côté client, injectez les flags dans un `<script>` du HTML, ou bloquez le rendu derrière un court skeleton avec un repli sur la version de contrôle après un timeout. Les rewrites à l'edge (un middleware qui réécrit vers `/checkout/onepage`) évitent aussi le flicker et gardent les pages cachables par variante.

## How to say it in the interview
- « Les flags séparent le déploiement de la release ; j'enveloppe le fournisseur dans un hook/helper typé, j'évalue côté serveur pour éviter le flicker, et je répartis selon un ID stable pour que l'assignation reste la même. »
- « Pour les expérimentations : définir à l'avance la métrique principale et les garde-fous, enregistrer l'exposition au moment du rendu, calculer la taille d'échantillon, et ne pas arrêter plus tôt parce que la courbe a l'air bonne. »
- Piège en question de relance : « Et le cache ? » Les variantes évaluées côté serveur cassent le cache CDN partagé ; faites varier le cache selon un cookie de variante ou réécrivez vers des chemins spécifiques à chaque variante.
- Compromis : les flags ajoutent des branches et des combinaisons à tester. Gardez-les de courte durée, donnez à chacun un responsable et une date d'expiration, et supprimez la branche perdante juste après la décision.
