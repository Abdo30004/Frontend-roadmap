import { useState } from 'react';
import { Badge, Browser, Button, Code, Meter, Note, Panel, Row, Stack, Stat, Steps, usePlayer, type Tone } from '../../demo-kit';

export const scenario =
  'A SaaS analytics dashboard: after two quarters of PRs, the login page (a form, nothing else) ships far more JavaScript than it used to.';
export const task = 'Read the analyzer for the login route, then press "Run CI" to see what the size budget says.';
export const solutionNote = 'Same analyzer: apply the four fixes one by one and watch KB, load time and the CI budget.';

type FixId = 'intl' | 'lodash' | 'barrel' | 'dedupe';
interface Mod {
  name: string;
  kb: number;
  why: string;
  fix?: FixId;
  after?: number;
}

// parsed (minified) KB in the login route's entry chunk
const MODULES: Mod[] = [
  { name: 'monaco-editor', kb: 2900, why: 'components/index.ts → SqlEditor (barrel)', fix: 'barrel', after: 0 },
  { name: 'echarts (full build)', kb: 1000, why: 'components/index.ts → RevenueChart (barrel)', fix: 'barrel', after: 0 },
  { name: 'moment + 160 locales', kb: 290, why: "utils/date.js: import moment from 'moment'", fix: 'intl', after: 0 },
  { name: 'react-dom + framework', kb: 140, why: 'needed' },
  { name: 'some-ui-kit', kb: 120, why: 'Button, Input' },
  { name: 'lodash-es (whole)', kb: 90, why: "a teammate's import * as _ from 'lodash-es'", fix: 'lodash', after: 3 },
  { name: 'date-fns@3', kb: 80, why: 'required by some-ui-kit' },
  { name: 'date-fns@2', kb: 75, why: 'our package.json pins ^2.30 → duplicate', fix: 'dedupe', after: 0 },
  { name: 'lodash (CJS, whole)', kb: 70, why: "utils/array.js: import _ from 'lodash'", fix: 'lodash', after: 0 },
  { name: 'app code (login)', kb: 40, why: 'needed' },
];

const FIXES: { id: FixId; label: string; code: string }[] = [
  {
    id: 'barrel',
    label: 'Direct imports, lazy chart & editor',
    code: "import { Button } from '@/components/Button';\nconst SqlEditor = dynamic(() => import('./SqlEditor'));",
  },
  { id: 'intl', label: 'Replace moment with Intl', code: "new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })" },
  { id: 'lodash', label: 'Per-method ESM import', code: "import uniqBy from 'lodash-es/uniqBy';" },
  { id: 'dedupe', label: 'Dedupe date-fns', code: 'npm i date-fns@^3 && npm dedupe' },
];

const GZIP = 0.28; // typical JS gzip ratio
const BUDGET_GZ = 120; // size-limit: "login route" ≤ 120 KB gz
const NET_KBPS = 200; // ~1.6 Mbps effective 4G
const PARSE_KB_PER_MS = 2; // mid-range Android parse+compile

function Analyzer({ fixed }: { fixed: boolean }) {
  const [applied, setApplied] = useState<Set<FixId>>(new Set());
  const [ci, setCi] = useState<{ steps: { label: string; detail: string; tone?: Tone }[]; pass: boolean } | null>(null);
  const player = usePlayer(ci?.steps.length ?? 0, 600);

  const size = (m: Mod) => (m.fix && applied.has(m.fix) ? (m.after ?? 0) : m.kb);
  const parsed = MODULES.reduce((a, m) => a + size(m), 0);
  const gz = Math.round(parsed * GZIP);
  const loadMs = (gz / NET_KBPS) * 1000 + parsed / PARSE_KB_PER_MS;
  const max = MODULES[0].kb;
  const over = gz > BUDGET_GZ;

  const toggle = (id: FixId) => {
    setApplied((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setCi(null);
    player.reset();
  };

  const runCi = () => {
    setCi({
      pass: !over,
      steps: [
        { label: 'npm ci', detail: 'installed', tone: 'good' },
        { label: 'next build', detail: 'compiled ✓ (no warnings)', tone: 'good' },
        over
          ? { label: 'size-limit', detail: `login route ${gz} KB gz > ${BUDGET_GZ} KB budget ✕`, tone: 'bad' }
          : { label: 'size-limit', detail: `login route ${gz} KB gz ≤ ${BUDGET_GZ} KB ✓`, tone: 'good' },
        over
          ? { label: 'PR blocked', detail: 'check "size" failed', tone: 'bad' }
          : { label: 'Ready to merge', detail: 'all checks passed', tone: 'good' },
      ],
    });
    setTimeout(player.play, 0);
  };

  return (
    <Stack gap={12}>
      <Browser url="analytics.example.com/login · bundle analyzer">
        <Stack gap={8}>
          {MODULES.map((m) => {
            const kb = size(m);
            return (
              <div key={m.name} style={{ opacity: kb === 0 ? 0.45 : 1, transition: 'opacity 200ms ease' }}>
                <Row gap={6} style={{ fontSize: 12, justifyContent: 'space-between' }}>
                  <span>
                    <strong>{m.name}</strong> <span style={{ color: 'var(--ink-3)' }}>{m.why}</span>
                  </span>
                  <code>{kb === 0 ? (m.fix === 'barrel' ? 'lazy chunk' : 'removed') : `${kb} KB`}</code>
                </Row>
                <Meter value={kb} max={max} tone={m.fix && kb === m.kb ? 'bad' : kb === 0 ? 'good' : 'info'} />
              </div>
            );
          })}
        </Stack>
      </Browser>

      <Row gap={8}>
        <Stat label="login JS (parsed)" value={`${(parsed / 1000).toFixed(2)} MB`} tone={over ? 'bad' : 'good'} />
        <Stat label="gzipped" value={`${gz} KB`} tone={over ? 'bad' : 'good'} />
        <Stat label="est. load on mid Android, 4G" value={`${(loadMs / 1000).toFixed(1)} s`} tone={loadMs > 2500 ? 'bad' : 'good'} />
      </Row>

      {fixed ? (
        <Panel title="Fixes">
          <Stack gap={8}>
            {FIXES.map((f) => (
              <Row key={f.id} gap={8}>
                <Button tone={applied.has(f.id) ? 'primary' : 'default'} onClick={() => toggle(f.id)}>
                  {applied.has(f.id) ? '✓ ' : ''}
                  {f.label}
                </Button>
                {applied.has(f.id) && <code style={{ fontSize: 11, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{f.code}</code>}
              </Row>
            ))}
          </Stack>
        </Panel>
      ) : (
        <Note>The login page only renders a Button and an Input.</Note>
      )}

      <Row gap={8}>
        <Button tone="primary" onClick={runCi} disabled={player.playing}>
          Run CI
        </Button>
        {ci && player.done && <Badge tone={ci.pass ? 'good' : 'bad'}>{ci.pass ? 'build passed' : 'build failed: over budget'}</Badge>}
      </Row>
      {ci && <Steps steps={ci.steps} active={player.step} />}

      <Code>{`// package.json  (size-limit)\n"size-limit": [{ "name": "login route",\n  "path": ".next/static/chunks/app/login/*.js", "limit": "${BUDGET_GZ} KB" }]`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <Analyzer fixed={false} />;
}

export function Solution() {
  return <Analyzer fixed />;
}
