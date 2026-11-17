# Contributing

Thanks for helping. Every fix to an answer makes the guide better for the next person preparing an interview.

You can contribute in English or French. Small pull requests are easiest to review, so one question, one fix or one translation per pull request is ideal.

## Ways to help

| You want to… | Do this |
| --- | --- |
| Fix a mistake or a typo in an answer | Edit the `.md` file directly on GitHub (the **View on GitHub** link on each question takes you there) and open a pull request |
| Say an answer is wrong, without fixing it | [Open a "Content error" issue](https://github.com/ahmedgourmat/Frontend-roadmap/issues/new?template=content-error.yml) |
| Propose a new question | [Open a "New question" issue](https://github.com/ahmedgourmat/Frontend-roadmap/issues/new?template=new-question.yml) first, so we can check it is not already covered |
| Improve the French | Edit the file in `content/fr/` or `site/src/i18n/fr.ts` |
| Fix a bug in the site | [Open a "Site bug" issue](https://github.com/ahmedgourmat/Frontend-roadmap/issues/new?template=site-bug.yml) or send a pull request |

## Set up the project

You need Node.js 18.18 or newer and npm. Please use npm, not pnpm or yarn, so there is only one lockfile.

```bash
git clone https://github.com/<your-username>/Frontend-roadmap.git
cd Frontend-roadmap/site
npm install
npm run dev
```

Before you open a pull request, run:

```bash
npm run build
```

It type-checks the whole site and fails if something is broken.

## How a question is built

A question has up to five parts. Every part uses the same **slug**: the file name without the extension, starting with a two-digit number, for example `07-array-index-as-key`.

| Part | Path | Required |
| --- | --- | --- |
| English question and answer | `content/<level>/<slug>.md` | Yes |
| Entry on the map | `site/src/catalog.ts` | Yes |
| Live demo | `site/src/demos/<level>/<slug>.tsx` | Yes for new questions |
| French question and answer | `content/fr/<level>/<slug>.md` | Recommended |
| French short label and demo text | `site/src/i18n/fr.ts` and `site/src/demos/fr.ts` | Recommended |

`<level>` is `junior`, `mid` or `senior`.

### 1. The markdown file

Copy this template. The site splits the answer on the four `##` headings, so keep them **exactly as written, in English, even in the French files**.

````markdown
# The interview question, phrased as the interviewer would ask it?

**Level:** Junior
**Merged from (original phrasings):**
- Another way the same question is asked.
- And another one.

## The concept (short answer)
- The answer the interviewer expects, in a few bullet points.
- Why it works, and the common pitfalls.

## Real-life example: the problem
A short production story: what the user saw, what the team noticed, and the broken code.

```js
// BROKEN: …
```

## How to fix it
The fixed code, and why it works.

```js
// FIXED: …
```

## How to say it in the interview
- The one sentence to say first.
- Traps, trade-offs and follow-up questions to expect.
````

Writing guidelines:

- Write for someone who will say the answer out loud. Short sentences, plain words.
- The problem must be a believable production bug, not a toy example.
- Code must run. If it uses a framework, say which version when it matters.
- Don't copy text from other websites or books. Write it in your own words and link to sources when useful.
- `**Merged from**` lists other phrasings of the same question. Leave it out if there are none.

### 2. The map entry

Add one line to the right level in `site/src/catalog.ts`:

```ts
['07-array-index-as-key', 'Index as key', 'react'],
//  slug                   short label     topic
```

The short label is what the map shows, so keep it under about 25 characters. The topic must be one of the ids in `CATEGORIES` in the same file (`js`, `react`, `css`, `perf`, `render`, `data`, `security`, `arch`, `tooling`, `team`).

### 3. The live demo

Create `site/src/demos/<level>/<slug>.tsx`. It must export:

| Export | Type | What it is |
| --- | --- | --- |
| `scenario` | `string` | One sentence setting the scene. It must **not** reveal the cause or the fix. |
| `task` | `string` (optional) | What the learner should do to see the bug, for example "Click Pay twice quickly". |
| `solutionNote` | `string` (optional) | One sentence on what changed in the fix. |
| `Problem` | React component | A working app that shows the bug. |
| `Solution` | React component | The same app with the fix. Keep the same UI so the difference is obvious. |

Build it with the pieces in `site/src/demo-kit` (`Browser`, `Button`, `Input`, `Console`, `Stat`, `Code`, `fakeRequest`, …) so every demo looks the same in light and dark mode. Look at `site/src/demos/junior/01-closures.tsx` for a complete example.

Demos run in the reader's browser, so:

- no real network calls: use `fakeRequest` instead;
- clean up every timer, listener and subscription when the component unmounts;
- keep the text inside the demo in English.

### 4. The French version

- Translate the markdown into `content/fr/<level>/<slug>.md`. Translate the title, the text and the code comments. Keep the four `##` headings in English, as explained above.
- Add the French short label under `short` in `site/src/i18n/fr.ts`, keyed `'<level>/<slug>'`.
- Add the French `scenario`, `task` and `solutionNote` to `site/src/demos/fr.ts`, keyed `'<level>/<slug>'`.

Keep technical terms that French developers use in English (closure, hook, state, props, debounce…).

### 5. The content index

Add the question to the table in `content/README.md`.

## Changing the site

The site is Vite, React 18 and TypeScript. Some conventions:

- Colors, spacing and radii are CSS variables at the top of `site/src/styles/global.css`. Use them instead of new hard-coded values, and check both themes.
- Every piece of interface text goes through i18next. Add the key to both `site/src/i18n/en.ts` and `site/src/i18n/fr.ts`.
- Check your change at phone width (about 375px) and with the keyboard only.

## Pull requests

1. Fork the repo and create a branch: `fix/closures-typo`, `content/new-question-web-workers`, `i18n/fr-mid-level`…
2. Make your change and run `npm run build` in `site/`.
3. Open the pull request and fill in the checklist.

Commit messages follow the style already in the history: `feat: …`, `fix: …`, `content: …`, `i18n: …`, `docs: …`.

## License of your contribution

By contributing, you agree that your code is released under the [MIT license](LICENSE) and your written content under [CC BY 4.0](content/LICENSE), like the rest of the project.
