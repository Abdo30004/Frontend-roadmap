import { useState } from 'react';
import { Badge, Browser, Button, Code, Meter, Note, Panel, Row, Stack, Stat } from '../../demo-kit';

export const scenario =
  'A five-year-old React SaaS app: the team plans 40 points per sprint, and the "reports" area keeps blowing its estimates.';
export const task = 'Press "Run next sprint" five or six times. Watch the feature points delivered and the bugs per sprint.';
export const solutionNote =
  'Same team and capacity, but 20% of every sprint pays down the top item of a debt register, and lint ratchets block new debt.';

const CAPACITY = 40;
const START_DEBT = 35;
const MAX_SPRINTS = 8;

interface Sprint {
  n: number;
  features: number;
  debtWork: number;
  bugs: number;
  debt: number;
  note: string;
}

const REGISTER = [
  { id: 'D-3', text: 'Flaky E2E tests (9%) → ~6 dev-hours/week lost' },
  { id: 'D-1', text: 'Reports filters: untyped, legacy Redux + setTimeout' },
  { id: 'D-2', text: 'moment.js (72 KB gz) → +0.4 s mobile LCP' },
  { id: 'D-4', text: 'Class components in billing, no tests' },
];

const PROBLEM_NOTES = [
  'Shipped the export feature. Added 3 more `any` to hit the deadline.',
  'Date filter estimated 3 days, took 8. Regression in reports.',
  '"We need a rewrite" raised in retro. Product: no.',
  'Hotfix sprint: two P1 bugs in reports. More TODOs.',
  'New hire takes 3 weeks to make a first change in reports.',
  'Half the sprint goes to bugs. Roadmap slips a quarter.',
  'Senior dev leaves: "I spend my days fighting the codebase."',
  'Every estimate now has a "reports tax" of x2.',
];

function simulate(prev: Sprint | undefined, n: number, fixed: boolean): Sprint {
  const debt = prev ? prev.debt : START_DEBT;
  const efficiency = 1 - debt / 110; // the interest you pay on every feature
  const debtWork = fixed ? CAPACITY * 0.2 : 0;
  const features = Math.round((CAPACITY - debtWork) * efficiency);
  const bugs = Math.round(2 + debt / 5);
  const added = fixed ? 2 : 9; // lint ratchet blocks most new debt
  const nextDebt = Math.max(8, Math.min(95, debt + added - debtWork * 1.1));
  const note = fixed
    ? n <= REGISTER.length
      ? `Paid down ${REGISTER[n - 1].id} (8 pts). Features still shipped.`
      : 'Boy-scout fixes inside feature PRs; register reviewed with PM.'
    : PROBLEM_NOTES[n - 1];
  return { n, features, debtWork, bugs, debt: Math.round(nextDebt), note };
}

function Planner({ fixed }: { fixed: boolean }) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const last = sprints[sprints.length - 1];
  const first = sprints[0];
  const debt = last ? last.debt : START_DEBT;

  const run = () => setSprints((s) => [...s, simulate(s[s.length - 1], s.length + 1, fixed)]);
  const trend = last && first ? last.features - first.features : 0;

  return (
    <Stack gap={14}>
      <Browser url="tracker.acme.example/teams/web/sprints">
        <Stack gap={12}>
          <Row style={{ justifyContent: 'space-between' }}>
            <strong>Sprint planner · team Web</strong>
            <Badge tone={fixed ? 'good' : 'warn'}>{fixed ? 'Plan: 80% features · 20% debt' : 'Plan: 100% features'}</Badge>
          </Row>
          <Row>
            <Button tone="primary" onClick={run} disabled={sprints.length >= MAX_SPRINTS}>
              Run next sprint
            </Button>
            <Button tone="ghost" onClick={() => setSprints([])}>
              Reset
            </Button>
          </Row>

          {sprints.length === 0 && <Note>No sprints run yet. Capacity: {CAPACITY} points per sprint.</Note>}
          <Stack gap={10}>
            {sprints.map((s) => (
              <Stack key={s.n} gap={4}>
                <Row style={{ justifyContent: 'space-between', fontSize: 13 }}>
                  <strong>Sprint {s.n}</strong>
                  <span>
                    {s.features} feature pts{s.debtWork ? ` + ${s.debtWork} debt` : ''} ·{' '}
                    <span style={{ color: 'var(--bad)' }}>{s.bugs} bugs</span>
                  </span>
                </Row>
                <Meter value={s.features} max={CAPACITY} tone={s.features >= 25 ? 'good' : s.features >= 18 ? 'warn' : 'bad'} />
                <Meter value={s.bugs} max={22} tone="bad" />
                <Note>{s.note}</Note>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Browser>

      <Row gap={8}>
        <Stat label="feature pts last sprint" value={last ? last.features : '-'} tone={!last ? 'neutral' : trend < 0 ? 'bad' : 'good'} />
        <Stat
          label="change since sprint 1"
          value={last ? `${trend > 0 ? '+' : ''}${trend}` : '-'}
          tone={!last ? 'neutral' : trend < 0 ? 'bad' : 'good'}
        />
        <Stat label="bugs last sprint" value={last ? last.bugs : '-'} tone={last && last.bugs > 12 ? 'bad' : 'neutral'} />
        <Stat label="debt level" value={`${debt}%`} tone={debt > 50 ? 'bad' : debt > 25 ? 'warn' : 'good'} />
      </Row>

      {fixed ? (
        <Panel title="Debt register (reviewed monthly with the PM)">
          <Stack gap={4}>
            {REGISTER.map((r, i) => (
              <Row key={r.id} gap={6} style={{ fontSize: 13 }}>
                <Badge tone={i < sprints.length ? 'good' : 'warn'}>{i < sprints.length ? 'done' : 'open'}</Badge>
                <code>{r.id}</code> {r.text}
              </Row>
            ))}
          </Stack>
        </Panel>
      ) : (
        <Panel title="Where the debt is tracked">
          <Code>{`// TODO: refactor this mess
// TODO: remove moment
// FIXME: why does this need setTimeout??
// (${300 + sprints.length * 24} TODO comments, no owner, no priority)`}</Code>
        </Panel>
      )}
      {fixed && (
        <Code>{`rules: { '@typescript-eslint/no-explicit-any': 'error',\n  'no-restricted-imports': ['error', { paths: [{ name: 'moment' }] }] }\n// legacy folders: 'warn' + ratchet: CI fails if the count goes UP`}</Code>
      )}
    </Stack>
  );
}

export function Problem() {
  return <Planner fixed={false} />;
}

export function Solution() {
  return <Planner fixed />;
}
