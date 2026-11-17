// Builds src/generated/titles.json: the "# " title of every question, in English and French.
// The map shows one interview question per concept card without downloading every answer.
// Runs automatically before `npm run dev` and `npm run build` (see package.json).
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const content = join(here, '..', '..', 'content');
const out = join(here, '..', 'src', 'generated', 'titles.json');
const LEVELS = ['junior', 'mid', 'senior'];

function titles(dir) {
  const map = {};
  for (const level of LEVELS) {
    const folder = join(dir, level);
    if (!existsSync(folder)) continue;
    for (const file of readdirSync(folder)
      .filter((f) => f.endsWith('.md'))
      .sort()) {
      const first = readFileSync(join(folder, file), 'utf8')
        .split(/\r?\n/)
        .find((l) => l.startsWith('# '));
      if (first) map[`${level}/${file.slice(0, -3)}`] = first.slice(2).trim();
    }
  }
  return map;
}

mkdirSync(dirname(out), { recursive: true });
const data = { en: titles(content), fr: titles(join(content, 'fr')) };
writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
console.log(`titles: ${Object.keys(data.en).length} en, ${Object.keys(data.fr).length} fr`);
