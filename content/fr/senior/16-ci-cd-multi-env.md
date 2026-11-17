# Concevoir un pipeline CI/CD frontend avec plusieurs environnements

**Niveau :** Senior
**Merged from (original phrasings):**
- Comment concevez-vous un pipeline CI/CD pour des applications frontend avec plusieurs environnements ?

## The concept (short answer)
- **CI sur chaque PR** : installation avec un lockfile et un cache, puis lint, typecheck, tests unitaires et build dans des jobs parallèles ; échouez vite. Ajoutez des smoke tests E2E sur un **déploiement de preview** par PR, pour que les reviewers et la QA testent la vraie application.
- **Build once, deploy many** : exactement le même artefact (même hash) part en dev, en staging et en prod. Les différences d'environnement (URL d'API, DSN Sentry, clés de flags) viennent d'une **configuration au runtime**, pas d'un nouveau build avec des fichiers `.env` différents. Sinon, ce que vous avez testé en staging n'est pas ce que vous livrez.
- **Promotion** : un merge sur main déploie automatiquement en dev, puis en staging, puis en prod derrière une approbation manuelle (GitHub Environments avec reviewers obligatoires), chaque étape étant conditionnée par des smoke tests.
- Le **rollback** doit être un simple changement de pointeur (repointer vers l'artefact immuable précédent / le déploiement précédent), qui se mesure en secondes, pas un nouveau build.
- Les secrets vivent dans le gestionnaire de secrets de la CI, cloisonnés par environnement, jamais dans le repo ni dans le bundle client.

## Real-life example: the problem
Imaginez l'équipe d'un dashboard bancaire. Une release a passé le staging, mais la production a affiché une page blanche pendant 40 minutes : le build de prod a lancé `npm install` (sans lockfile) et récupéré une nouvelle version mineure d'une bibliothèque de dates, et `VITE_API_URL` manquait à l'étape de build de prod, si bien que le bundle appelait `undefined/accounts`. Le rollback a consisté à revert le commit et à attendre 15 minutes un nouveau build.

```yaml
# .github/workflows/deploy.yml - CASSÉ
name: deploy
on:
  push:
    branches: [main, staging, production]   # une branche par environnement
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install                       # non reproductible
      - run: npm run build                     # rebuild par env, variables d'env figées dans le bundle
        env:
          VITE_API_URL: ${{ vars.API_URL }}    # vide sur la branche 'production'
      - run: aws s3 sync dist s3://bank-dashboard-${{ github.ref_name }}
        env:
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_KEY }}
    # pas de lint, pas de tests, pas de typecheck, pas d'approbation, pas de plan de rollback
```

## How to fix it
```yaml
# .github/workflows/ci.yml - s'exécute sur chaque PR
name: ci
on: [pull_request]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  checks:
    runs-on: ubuntu-latest
    strategy:
      matrix: { task: [lint, typecheck, 'test -- --coverage'] }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run ${{ matrix.task }}
  preview:
    needs: checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - id: deploy                              # URL de preview unique par PR
        run: echo "url=$(npx vercel deploy --yes --token=${{ secrets.VERCEL_TOKEN }})" >> "$GITHUB_OUTPUT"
      - run: npx playwright install --with-deps && BASE_URL=${{ steps.deploy.outputs.url }} npm run e2e:smoke
```

```yaml
# .github/workflows/release.yml - un seul build sur main, puis promotion du même artefact
name: release
on: { push: { branches: [main] } }
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.v.outputs.version }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci && npm run build            # AUCUNE variable spécifique à un environnement
      - id: v
        run: echo "version=${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"
      - run: aws s3 sync dist s3://artifacts/dashboard/${{ steps.v.outputs.version }}/

  deploy-dev:
    needs: build
    uses: ./.github/workflows/deploy-env.yml
    with: { env: dev, version: '${{ needs.build.outputs.version }}' }
    secrets: inherit
  deploy-staging:
    needs: deploy-dev
    uses: ./.github/workflows/deploy-env.yml
    with: { env: staging, version: '${{ needs.build.outputs.version }}' }
    secrets: inherit
  deploy-prod:
    needs: deploy-staging
    uses: ./.github/workflows/deploy-env.yml   # son job définit `environment: production`
    with: { env: production, version: '${{ needs.build.outputs.version }}' }
    secrets: inherit
```
`deploy-env.yml` déclare `environment: ${{ inputs.env }}` (la production attend donc un reviewer obligatoire), utilise OIDC pour endosser un rôle cloud (pas de clés longue durée), copie l'artefact immuable dans le bucket de l'environnement, écrit le `config.json` de l'environnement, invalide le CDN et lance un smoke test.

```ts
// Config au runtime : chargée avant le démarrage de l'app, servie par environnement
// public/config.json en prod : { "apiUrl": "https://api.bank.example", "sentryDsn": "..." }
const config = await fetch('/config.json', { cache: 'no-store' }).then((r) => r.json());
createRoot(document.getElementById('root')!).render(<App config={config} />);
```

**Rollback** : relancez `deploy-env` pour la production avec la `version` précédente (ou « promote previous deployment » sur Vercel/Netlify). Pas de rebuild, cela prend quelques secondes.

Pourquoi ça fonctionne : `npm ci` avec un lockfile rend les builds reproductibles ; un seul artefact signifie que le staging a testé exactement ce qui tourne en prod ; la config est une donnée par environnement, donc une valeur manquante est détectée par une validation de schéma au démarrage plutôt que par une page blanche ; les approbations et les smoke tests conditionnent chaque promotion.

## How to say it in the interview
- « Je build une seule fois, je tague l'artefact avec le SHA du commit et je promeus exactement les mêmes octets en dev, staging et prod ; seule la config au runtime change. »
- « Chaque PR a droit au lint, au typecheck, aux tests et à une URL de preview avec un smoke test E2E, pour que la review se fasse sur l'application qui tourne. »
- Piège : Next.js/Vite injectent `NEXT_PUBLIC_*` / `VITE_*` au moment du build. Pour builder une seule fois, il vous faut un endpoint de config au runtime, une lecture des variables d'environnement côté serveur, ou une étape de remplacement de placeholders au démarrage du conteneur.
- Compromis : une suite E2E complète sur chaque PR est lente et instable ; gardez une petite suite de smoke tests sur les PR et la suite complète en nightly ou avant la promotion en prod.
