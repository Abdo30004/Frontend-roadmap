import { useState } from 'react';
import { Badge, Button, Code, Console, Panel, Row, Stack, Stat, useConsole, type Tone } from '../../demo-kit';

export const scenario =
  'Friday at a SaaS startup: Ana and Ben both change Dashboard.tsx in the same repo, and main auto-deploys to production.';
export const task = 'Run each command in order (the next one lights up). Then check whose work is on main.';
export const solutionNote = 'Same two changes, but via feature branches, PRs, a rebase and a protected main.';

interface Commit {
  sha: string;
  msg: string;
  who: 'init' | 'Ana' | 'Ben';
}
interface Model {
  main: Commit[];
  lost: Commit[];
  conflict: boolean;
}
interface Cmd {
  who: 'Ana' | 'Ben';
  cmd: string;
  run: (m: Model) => { m: Model; out: [string, Tone][] };
}

const C0: Commit = { sha: 'c0f1e2a', msg: 'Initial dashboard', who: 'init' };
const A1: Commit = { sha: 'a71c9d3', msg: 'feat: CSV export button', who: 'Ana' };
const B1: Commit = { sha: 'b3e05f8', msg: 'fix: chart colors', who: 'Ben' };
const B1R: Commit = { sha: 'b9d41c2', msg: 'fix: chart colors', who: 'Ben' };

const PROBLEM: Cmd[] = [
  {
    who: 'Ana',
    cmd: 'git commit -am "stuff" && git push origin main',
    run: (m) => ({
      m: { ...m, main: [...m.main, A1] },
      out: [
        ['To github.com:acme/dashboard.git', 'neutral'],
        ['   c0f1e2a..a71c9d3  main -> main', 'good'],
        ['🚀 auto-deploy: production now runs a71c9d3', 'info'],
      ],
    }),
  },
  {
    who: 'Ben',
    cmd: 'git commit -am "fix: chart colors"',
    run: (m) => ({ m, out: [['[main b3e05f8] fix: chart colors (based on c0f1e2a)', 'neutral']] }),
  },
  {
    who: 'Ben',
    cmd: 'git push origin main',
    run: (m) => ({
      m,
      out: [
        [' ! [rejected]  main -> main (fetch first)', 'bad'],
        ['hint: Updates were rejected because the remote contains work that you do not have locally.', 'warn'],
      ],
    }),
  },
  {
    who: 'Ben',
    cmd: 'git push --force origin main',
    run: (m) => ({
      m: { ...m, main: [C0, B1], lost: [A1] },
      out: [
        [' + a71c9d3...b3e05f8 main -> main (forced update)', 'warn'],
        ['🚀 auto-deploy: production now runs b3e05f8', 'info'],
      ],
    }),
  },
];

const SOLUTION: Cmd[] = [
  {
    who: 'Ana',
    cmd: 'git switch -c feature/csv-export && git push -u origin feature/csv-export',
    run: (m) => ({
      m,
      out: [
        ['* [new branch]  feature/csv-export', 'good'],
        ['PR #12 opened → CI: lint ✓ test ✓ build ✓ → 1 approval', 'good'],
      ],
    }),
  },
  {
    who: 'Ana',
    cmd: 'gh pr merge 12 --squash',
    run: (m) => ({
      m: { ...m, main: [...m.main, A1] },
      out: [
        ['✓ Squashed and merged PR #12 into main', 'good'],
        ['🚀 auto-deploy: production now runs a71c9d3', 'info'],
      ],
    }),
  },
  {
    who: 'Ben',
    cmd: 'git push --force origin main   # old habit',
    run: (m) => ({
      m,
      out: [
        ['remote: error: GH006: Protected branch update failed for refs/heads/main.', 'bad'],
        ['remote: Force pushes are not allowed. Changes must be made through a pull request.', 'warn'],
      ],
    }),
  },
  {
    who: 'Ben',
    cmd: 'git fetch origin && git rebase origin/main',
    run: (m) => ({
      m: { ...m, conflict: true },
      out: [
        ['CONFLICT (content): Merge conflict in src/Dashboard.tsx', 'warn'],
        ['error: could not apply b3e05f8... fix: chart colors', 'warn'],
      ],
    }),
  },
  {
    who: 'Ben',
    cmd: 'edit Dashboard.tsx (keep both) && git add . && git rebase --continue',
    run: (m) => ({
      m: { ...m, conflict: false },
      out: [
        ['Successfully rebased and updated refs/heads/feature/chart-colors.', 'good'],
        ['b9d41c2 fix: chart colors  (now on top of a71c9d3)', 'neutral'],
      ],
    }),
  },
  {
    who: 'Ben',
    cmd: 'git push --force-with-lease && gh pr merge 13 --squash',
    run: (m) => ({
      m: { ...m, main: [...m.main, B1R] },
      out: [
        ['+ feature/chart-colors (own branch, lease ok)', 'neutral'],
        ['PR #13 → CI ✓ → ✓ Squashed and merged into main', 'good'],
      ],
    }),
  },
];

const START: Model = { main: [C0], lost: [], conflict: false };

function GitSim({ fixed }: { fixed: boolean }) {
  const script = fixed ? SOLUTION : PROBLEM;
  const [model, setModel] = useState<Model>(START);
  const [next, setNext] = useState(0);
  const term = useConsole();

  const run = (i: number) => {
    const cmd = script[i];
    term.log(`${cmd.who.toLowerCase()}@laptop $ ${cmd.cmd}`, 'neutral');
    const { m, out } = cmd.run(model);
    out.forEach(([text, tone]) => term.log(text, tone));
    setModel(m);
    setNext(i + 1);
  };
  const reset = () => {
    setModel(START);
    setNext(0);
    term.clear();
  };

  const anaOnMain = model.main.some((c) => c.who === 'Ana');
  const benOnMain = model.main.some((c) => c.who === 'Ben');
  const finished = next >= script.length;

  return (
    <Stack gap={14}>
      <Stack gap={6}>
        {script.map((c, i) => (
          <Row key={i} gap={8} wrap={false}>
            <Badge tone={c.who === 'Ana' ? 'info' : 'warn'}>{c.who}</Badge>
            <Button
              tone={i === next ? 'primary' : 'ghost'}
              disabled={i !== next}
              onClick={() => run(i)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'left', minWidth: 0, overflowWrap: 'anywhere' }}
            >
              {i < next ? '✓ ' : '$ '}
              {c.cmd}
            </Button>
          </Row>
        ))}
      </Stack>

      <Panel title="origin/main (what production runs)">
        <Row gap={6}>
          {model.main.map((c, i) => (
            <Row key={c.sha} gap={6}>
              {i > 0 && <span style={{ color: 'var(--ink-3)' }}>→</span>}
              <Badge tone={c.who === 'Ana' ? 'info' : c.who === 'Ben' ? 'warn' : 'neutral'}>
                {c.sha.slice(0, 7)} {c.msg}
              </Badge>
            </Row>
          ))}
          {model.lost.map((c) => (
            <Badge key={c.sha} tone="bad">
              <s>
                {c.sha} {c.msg}
              </s>{' '}
              lost from remote
            </Badge>
          ))}
        </Row>
      </Panel>

      {model.conflict && (
        <Code>{`<<<<<<< HEAD (origin/main, Ana)
  <ExportCsvButton rows={rows} />
=======
  <Chart palette="accessible" />
>>>>>>> b3e05f8 (Ben: fix chart colors)`}</Code>
      )}

      <Row gap={8}>
        <Stat
          label="Ana's CSV export on main"
          value={anaOnMain ? 'yes' : next > 0 ? 'NO' : '-'}
          tone={anaOnMain ? 'good' : next > 0 ? 'bad' : 'neutral'}
        />
        <Stat label="Ben's fix on main" value={benOnMain ? 'yes' : '-'} tone={benOnMain ? 'good' : 'neutral'} />
        <Button tone="ghost" onClick={reset}>
          Reset repo
        </Button>
      </Row>
      {finished && !fixed && <Badge tone="bad">Ana's morning of work is gone from GitHub, and production lost the CSV export.</Badge>}
      {finished && fixed && <Badge tone="good">Both changes reviewed, tested and on main. Nobody's work was overwritten.</Badge>}

      <Console title="Terminal" lines={term.lines} height={150} onClear={term.clear} />
    </Stack>
  );
}

export function Problem() {
  return <GitSim fixed={false} />;
}

export function Solution() {
  return <GitSim fixed />;
}
