# Frontend Field Guide

Repository: https://github.com/ahmedgourmat/Frontend-roadmap

73 frontend interview questions (junior → mid → senior), deduplicated from several interview lists.
Every question starts with a **live, running bug**. The learner thinks first, then reveals the answer.
The answer contains the **live fix**, the concept, a real-life case and how to say it in an interview.

```
interview-questions/
├── content/            ← the questions, one markdown file each (single source of truth)
│   ├── junior/  mid/  senior/
│   └── README.md       ← index of all questions + which duplicates were merged
└── site/               ← the website (Vite + React + TypeScript)
    └── src/
        ├── catalog.ts          short labels + categories for the home map
        ├── content.ts          loads and parses content/*.md
        ├── demos/<level>/<slug>.tsx   live Problem / Solution demo per question
        ├── demo-kit/           shared building blocks for demos
        ├── components/  pages/  styles/
```

## Run it

```bash
cd site
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into site/dist
npm run preview    # serve the production build
```

## Edit content
- To fix or improve a question, edit its `.md` file in `content/`. The site picks it up automatically.
  Keep the four `##` headings: *The concept*, *Real-life example: the problem*, *How to fix it*, *How to say it in the interview*.
- To change a live demo, edit `site/src/demos/<level>/<slug>.tsx`. It exports `scenario`, `task`, `solutionNote`, `Problem` and `Solution`.
- To add a question, add the `.md` file, add a line to `site/src/catalog.ts`, and optionally add a demo with the same slug.

## GitHub links
The site links to the repo in the top bar, on the home page and on every question ("View on GitHub" → the question's `.md`).
The URL, branch and content folder are set in `site/src/site.ts`. Per-question links assume `content/` sits at the repo root on the `main` branch.

## Deploy
`site/dist` is a static single-page app. `site/public/_redirects` (Netlify) and `site/vercel.json` (Vercel) send every route to `index.html`, so `/mid#07-array-index-as-key` links work on refresh.
On Vercel/Netlify, set the root directory to `site`, the build command to `npm run build`, and the output to `dist`.
