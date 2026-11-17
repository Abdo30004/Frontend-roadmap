// Checks that every question is complete and consistent, so a pull request can't break the site quietly.
// Run with `npm run check:content`. Exits with code 1 when there is an error.
//
// Errors (the site would break or show something wrong):
//   - a question file without a "# " title or without one of the four "## " sections
//   - a question file with no line in src/catalog.ts, or a catalog line with no question file
//   - a catalog line with an unknown topic, a duplicate slug or a slug that doesn't match the "NN-name" pattern
//   - a demo file missing one of its required exports, or a question without a demo
//   - a French file with no English file
// Warnings (the site falls back to English):
//   - an English question without its French file, French short label or French demo text
//   - a question missing from content/README.md
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(site, '..');
const content = join(root, 'content');
const LEVELS = ['junior', 'mid', 'senior'];
const SECTIONS = ['The concept', 'Real-life example', 'How to fix it', 'How to say it in the interview'];
const DEMO_EXPORTS = ['scenario', 'Problem', 'Solution'];

const errors = [];
const warnings = [];
const rel = (p) => relative(root, p).replace(/\\/g, '/');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const mdFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .sort()
    : [];

/** "## " headings outside fenced code blocks. */
function headings(md) {
  const found = [];
  let fence = false;
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    else if (!fence && line.startsWith('## ')) found.push(line.slice(3).trim());
  }
  return found;
}

function checkQuestion(file) {
  const md = read(file);
  if (!md.split('\n').some((l) => l.startsWith('# '))) errors.push(`${rel(file)}: missing the "# " title line`);
  const found = headings(md);
  let last = -1;
  for (const section of SECTIONS) {
    const at = found.findIndex((h) => h.toLowerCase().startsWith(section.toLowerCase()));
    if (at < 0) errors.push(`${rel(file)}: missing the "## ${section}" section (keep the heading in English, even in French files)`);
    else if (at < last) errors.push(`${rel(file)}: "## ${section}" is out of order`);
    else last = at;
  }
}

/* ---- catalog: [slug, short label, topic] per level ---- */
const catalogSrc = read(join(site, 'src', 'catalog.ts'));
const topics = new Set([...catalogSrc.matchAll(/\{\s*id:\s*'([a-z]+)',\s*label:/g)].map((m) => m[1]));
for (const l of LEVELS) topics.delete(l); // the LEVELS array uses the same shape
const catalog = {};
const blocks = catalogSrc.split(/^\s{2}(junior|mid|senior): \[/m);
for (let i = 1; i < blocks.length; i += 2) {
  const level = blocks[i];
  const body = blocks[i + 1].split(/^\s{2}\],?/m)[0];
  catalog[level] = [...body.matchAll(/\[\s*'([^']+)',\s*'((?:[^'\\]|\\.)*)',\s*'([^']+)'\s*\]/g)].map((m) => ({
    slug: m[1],
    short: m[2],
    topic: m[3],
  }));
}

const frShort = read(join(site, 'src', 'i18n', 'fr.ts'));
const frDemos = read(join(site, 'src', 'demos', 'fr.ts'));
const index = existsSync(join(content, 'README.md')) ? read(join(content, 'README.md')) : '';
let total = 0;

for (const level of LEVELS) {
  const entries = catalog[level] ?? [];
  if (!catalog[level]) errors.push(`site/src/catalog.ts: no "${level}" list found in CATALOG`);
  const en = mdFiles(join(content, level));
  const fr = mdFiles(join(content, 'fr', level));
  const slugs = new Set();

  for (const e of entries) {
    const where = `site/src/catalog.ts (${level}/${e.slug})`;
    if (slugs.has(e.slug)) errors.push(`${where}: duplicate slug`);
    slugs.add(e.slug);
    if (!/^\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/.test(e.slug)) errors.push(`${where}: slug must look like "07-array-index-as-key"`);
    if (!topics.has(e.topic)) errors.push(`${where}: unknown topic "${e.topic}" (use one of: ${[...topics].join(', ')})`);
    if (!en.includes(`${e.slug}.md`)) errors.push(`${where}: no question file content/${level}/${e.slug}.md`);
  }

  for (const f of en) {
    const slug = f.slice(0, -3);
    const id = `${level}/${slug}`;
    total++;
    checkQuestion(join(content, level, f));
    if (!slugs.has(slug)) errors.push(`content/${id}.md: no line for it in site/src/catalog.ts`);

    const demo = join(site, 'src', 'demos', level, `${slug}.tsx`);
    if (!existsSync(demo)) errors.push(`content/${id}.md: no demo at site/src/demos/${id}.tsx`);
    else {
      const src = read(demo);
      for (const name of DEMO_EXPORTS) {
        if (!new RegExp(`export\\s+(const|function|let)\\s+${name}\\b`).test(src))
          errors.push(`site/src/demos/${id}.tsx: missing "export ${name}"`);
      }
    }

    if (!fr.includes(f)) warnings.push(`content/${id}.md: no French version at content/fr/${id}.md`);
    if (!frShort.includes(`'${id}':`)) warnings.push(`${id}: no French short label in site/src/i18n/fr.ts`);
    if (!frDemos.includes(`'${id}':`)) warnings.push(`${id}: no French demo text in site/src/demos/fr.ts`);
    if (!index.includes(`(${id}.md)`)) warnings.push(`${id}: not listed in content/README.md`);
  }

  for (const f of fr) {
    const file = join(content, 'fr', level, f);
    if (!en.includes(f)) errors.push(`${rel(file)}: no English file content/${level}/${f}`);
    checkQuestion(file);
  }
}

for (const w of warnings) console.warn(`warning  ${w}`);
for (const e of errors) console.error(`error    ${e}`);
const summary = `${total} questions checked: ${errors.length} error(s), ${warnings.length} warning(s)`;
if (errors.length) {
  console.error(`\n${summary}`);
  process.exit(1);
}
console.log(summary);
