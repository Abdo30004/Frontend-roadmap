# Comment gérez-vous le contrôle de version et la collaboration avec Git ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Comment gérez-vous le contrôle de version et la collaboration avec Git ?

## The concept (short answer)
- Git est un système de contrôle de version **distribué** : chaque développeur possède tout l'historique en local, travaille sur des **branches** et partage ses modifications via un dépôt distant (GitHub, GitLab, Bitbucket).
- Un workflow d'équipe typique (GitHub Flow / trunk-based) : `main` est toujours déployable ; pour chaque tâche, créez une **feature branch** de courte durée, faites des commits petits et ciblés, poussez, ouvrez une **Pull Request**, obtenez une **code review** et une **CI** au vert (lint, tests, build), puis mergez.
- Gardez votre branche à jour avec `git fetch` + `git rebase origin/main` (ou en y mergeant `main`), et résolvez les conflits en local avant la review.
- Écrivez des messages de commit explicites (par exemple avec Conventional Commits : `fix(cart): prevent negative quantity`), un changement logique par commit.
- Protégez `main` avec des règles de protection de branche : pas de push direct, review obligatoire, checks de CI obligatoires, pas de force-push.
- Connaissez les outils de sécurité : `git stash`, `git revert` (annuler proprement un commit déjà poussé), `git reset` (uniquement pour du travail local non poussé), `git reflog` (retrouver des commits « perdus »), `.gitignore` pour les secrets et les fichiers de build.

## Real-life example: the problem
Un cas typique : une petite équipe qui développe un tableau de bord SaaS pousse directement sur `main`, qui se déploie automatiquement en production. Un vendredi, deux développeurs modifient le même fichier. Le push du développeur B est rejeté ; il lance `git push --force` et efface du dépôt distant les commits de toute la matinée du développeur A. Plus tard, un commit contenant `.env` avec une clé secrète Stripe de production est poussé sur un dépôt public, et le site casse en production parce que du code non testé est passé directement d'un ordinateur portable aux clients.

```bash
# Le « workflow » avant
git add .                       # inclut .env et les modifications de node_modules
git commit -m "stuff"           # message sans signification, 40 fichiers modifiés
git push origin main            # rejeté : le dépôt distant a de nouveaux commits
git push --force origin main    # écrase le travail du collègue sur le dépôt distant
```

```yaml
# Paramètres du dépôt : aucun. Pas de protection de branche, pas de CI, pas de .gitignore.
```

## How to fix it
```bash
# 1. Partir d'un main à jour, sur une branche nommée d'après le ticket
git switch main
git pull --ff-only
git switch -c feature/DASH-142-export-csv

# 2. Des commits petits et ciblés ; relisez ce que vous indexez
git add -p                                   # indexer les blocs (hunks) un par un, en interactif dans un terminal
git commit -m "feat(reports): add CSV export button"

# 3. Se synchroniser avec main avant d'ouvrir la PR
git fetch origin
git rebase origin/main                       # résoudre les conflits, puis : git rebase --continue
git push -u origin feature/DASH-142-export-csv
# Si vous avez rebasé une branche déjà poussée (uniquement votre propre branche) :
git push --force-with-lease                  # refuse si quelqu'un d'autre a poussé entre-temps

# 4. Ouvrir une PR -> review -> CI au vert -> squash & merge -> supprimer la branche
```

```gitignore
# .gitignore
node_modules/
.next/
dist/
.env
.env.*.local
```

```yaml
# .github/workflows/ci.yml : s'exécute sur chaque PR, exigé par la protection de branche
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --ci
      - run: npm run build
```

Et dans les paramètres GitHub : protégez `main` (PR obligatoire, 1 approbation, `checks` au vert, force-push bloqués).

Pourquoi ça fonctionne :
- Grâce aux feature branches et aux PR, personne ne touche directement à `main` ; la review et la CI détectent les bugs avant le déploiement.
- `--force-with-lease` n'écrase le dépôt distant que s'il est toujours dans l'état de votre dernier fetch : vous ne pouvez donc pas supprimer sans le savoir les commits d'un collègue ; la protection de branche bloque totalement le force-push sur `main`.
- `.gitignore` garde les secrets et les fichiers générés hors de l'historique. Si un secret a déjà été poussé, **changez la clé immédiatement** : supprimer le fichier ne le retire pas de l'historique Git.
- Des commits petits avec des messages clairs rendent la review, `git blame`, `git bisect` et `git revert` réellement utiles.

Réparer ses erreurs : annulez un mauvais merge sur `main` avec `git revert <sha>` (nouveau commit, historique préservé) ; retrouvez du travail local perdu avec `git reflog`.

## How to say it in the interview
- « J'utilise un workflow par feature branches : des branches de courte durée créées depuis `main`, de petits commits avec des messages clairs, une PR avec review et checks de CI, puis un squash-merge. `main` est protégée et toujours déployable. »
- Expliquez merge vs rebase : le merge conserve l'historique tel qu'il s'est déroulé (commits de merge) ; le rebase réécrit votre branche par-dessus `main` pour obtenir un historique linéaire. Ne rebasez jamais une branche partagée/publique.
- Piège : « Comment annuler un commit déjà poussé ? » Avec `git revert`, pas avec `git reset --hard` + force push, car d'autres ont peut-être déjà récupéré ce commit.
- Compromis : les feature branches de longue durée provoquent des conflits de merge pénibles ; préférez de petites PR mergées souvent, avec des feature flags pour le travail inachevé.
