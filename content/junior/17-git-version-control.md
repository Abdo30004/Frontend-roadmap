# How do you handle version control and collaboration using Git?

**Level:** Junior
**Merged from (original phrasings):**
- How do you handle version control and collaboration using Git?

## The concept (short answer)
- Git is a **distributed** version control system: every developer has the full history locally, works on **branches**, and shares changes through a remote (GitHub, GitLab, Bitbucket).
- A typical team workflow (GitHub Flow / trunk-based): `main` is always deployable; for each task create a short-lived **feature branch**, commit small focused changes, push, open a **Pull Request**, get **code review** and green **CI** (lint, tests, build), then merge.
- Keep your branch up to date with `git fetch` + `git rebase origin/main` (or merge `main` in), and resolve conflicts locally before review.
- Write meaningful commit messages (e.g. Conventional Commits: `fix(cart): prevent negative quantity`), one logical change per commit.
- Protect `main` with branch protection rules: no direct pushes, required review, required CI checks, no force-push.
- Know the safety tools: `git stash`, `git revert` (undo a pushed commit safely), `git reset` (only for local, unpushed work), `git reflog` (recover "lost" commits), `.gitignore` for secrets and build output.

## Real-life example: the problem
A typical case: a small team building a SaaS dashboard pushed directly to `main`, which auto-deploys to production. On a Friday two developers edited the same file. Developer B got a rejected push, ran `git push --force`, and wiped Developer A's morning of commits from the remote. Later a commit containing `.env` with a live Stripe secret key was pushed to a public repo, and the site broke in production because untested code went straight from a laptop to customers.

```bash
# "Workflow" before
git add .                       # includes .env and node_modules changes
git commit -m "stuff"           # meaningless message, 40 files changed
git push origin main            # rejected: remote has new commits
git push --force origin main    # overwrites teammate's work on the remote
```

```yaml
# Repository settings: none. No branch protection, no CI, no .gitignore.
```

## How to fix it
```bash
# 1. Start from an up-to-date main, on a branch named after the ticket
git switch main
git pull --ff-only
git switch -c feature/DASH-142-export-csv

# 2. Small, focused commits; review what you stage
git add -p                                   # stage hunks interactively in a terminal
git commit -m "feat(reports): add CSV export button"

# 3. Sync with main before opening the PR
git fetch origin
git rebase origin/main                       # resolve conflicts, then: git rebase --continue
git push -u origin feature/DASH-142-export-csv
# If you rebased an already-pushed branch (your own branch only):
git push --force-with-lease                  # refuses if someone else pushed meanwhile

# 4. Open a PR -> review -> CI green -> squash & merge -> delete branch
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
# .github/workflows/ci.yml: runs on every PR, required by branch protection
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

Plus in GitHub settings: protect `main` (require PR, 1 approval, passing `checks`, block force pushes).

Why it works:
- Feature branches + PRs mean nobody touches `main` directly; review and CI catch bugs before deploy.
- `--force-with-lease` only overwrites the remote if it is still what you last fetched, so you cannot silently delete a teammate's commits; branch protection blocks force-push on `main` entirely.
- `.gitignore` keeps secrets and generated files out of history. If a secret was already pushed, **rotate the key immediately**: deleting the file does not remove it from Git history.
- Small commits with clear messages make review, `git blame`, `git bisect` and `git revert` useful.

Recovering from mistakes: undo a bad merge on `main` with `git revert <sha>` (new commit, history preserved); find lost local work with `git reflog`.

## How to say it in the interview
- "I use a feature-branch workflow: short-lived branches off `main`, small commits with clear messages, a PR with review and CI checks, then squash-merge. `main` is protected and always deployable."
- Explain merge vs rebase: merge keeps history as it happened (merge commits); rebase rewrites your branch on top of `main` for a linear history. Never rebase shared/public branches.
- Trap: "How do you undo a pushed commit?" `git revert`, not `git reset --hard` + force push, because others may already have pulled it.
- Trade-off: long-lived feature branches cause painful merge conflicts; prefer small PRs merged often, with feature flags for unfinished work.
