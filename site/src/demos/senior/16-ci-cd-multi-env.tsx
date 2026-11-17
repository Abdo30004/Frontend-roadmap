import { useEffect, useState } from 'react';
import { Badge, Browser, Button, Code, Note, Panel, Row, Stack, Stat, Steps, usePlayer, type Tone } from '../../demo-kit';

export const scenario =
  'A banking dashboard ships release v2.4 through staging to production. QA signs off on staging before it goes live.';
export const task = 'Press "Release v2.4" and watch which bundle each environment runs. If production breaks, press "Roll back".';
export const solutionNote =
  'Build once, promote the same artifact with a per-environment config.json, and roll back by re-pointing to the previous artifact.';

type EnvName = 'staging' | 'production';
interface Env {
  build: string;
  version: string;
  api: string;
  ok: boolean;
}
type Envs = Record<EnvName, Env>;
interface Step {
  label: string;
  detail: string;
  tone?: Tone;
  apply?: (e: Envs) => Envs;
  down?: number;
}

const STABLE: Env = { build: '2c81f0a', version: 'v2.3', api: '', ok: true };
const INITIAL: Envs = {
  staging: { ...STABLE, api: 'https://api-staging.bank.example' },
  production: { ...STABLE, api: 'https://api.bank.example' },
};

const RELEASE_BROKEN: Step[] = [
  { label: 'push → staging branch', detail: 'npm install (no lockfile) → date-fns@3.6.0', tone: 'info' },
  { label: 'build #1 for staging', detail: 'VITE_API_URL=https://api-staging… baked in → bundle a1f3c9', tone: 'info' },
  {
    label: 'deploy staging · QA',
    detail: 'QA tests bundle a1f3c9 ✓',
    tone: 'good',
    apply: (e) => ({ ...e, staging: { build: 'a1f3c9', version: 'v2.4', api: 'https://api-staging.bank.example', ok: true } }),
  },
  { label: 'push → production branch', detail: 'npm install → date-fns@3.7.0 (new minor)', tone: 'warn' },
  { label: 'build #2 for production', detail: 'VITE_API_URL is empty here → bundle 7c2e04, never tested', tone: 'bad' },
  {
    label: 'deploy production',
    detail: 'GET undefined/accounts → blank page',
    tone: 'bad',
    apply: (e) => ({ ...e, production: { build: '7c2e04', version: 'v2.4', api: 'undefined', ok: false } }),
  },
];
const ROLLBACK_BROKEN: Step[] = [
  { label: 'notice + git revert', detail: 'found via customer calls; no old artifact, so rebuild', tone: 'warn', down: 20 },
  { label: 'npm install + build #3', detail: 'another untested bundle e4b7d2 (~15 min)', tone: 'warn', down: 15 },
  {
    label: 'deploy production',
    detail: 'v2.3 back after ~40 min of blank page',
    tone: 'good',
    down: 5,
    apply: (e) => ({ ...e, production: { build: 'e4b7d2', version: 'v2.3', api: 'https://api.bank.example', ok: true } }),
  },
];
const RELEASE_FIXED: Step[] = [
  { label: 'PR #482 checks + preview', detail: 'lint · typecheck · tests ✓ → pr-482.preview.bank.example', tone: 'info' },
  { label: 'merge → build once', detail: 'npm ci (lockfile) → artifact 3e9d1c7, no env values inside', tone: 'info' },
  {
    label: 'promote → staging',
    detail: '3e9d1c7 + config.json { apiUrl: api-staging… } · QA ✓',
    tone: 'good',
    apply: (e) => ({ ...e, staging: { build: '3e9d1c7', version: 'v2.4', api: 'https://api-staging.bank.example', ok: true } }),
  },
  { label: 'approval', detail: 'environment "production": required reviewer approves', tone: 'info' },
  {
    label: 'promote → production',
    detail: 'SAME 3e9d1c7 + config.json { apiUrl: api.bank… } · smoke ✓',
    tone: 'good',
    apply: (e) => ({ ...e, production: { build: '3e9d1c7', version: 'v2.4', api: 'https://api.bank.example', ok: true } }),
  },
];
const ROLLBACK_FIXED: Step[] = [
  {
    label: 'promote previous artifact',
    detail: 'production → 2c81f0a + same config.json · no rebuild · ~20 s',
    tone: 'good',
    apply: (e) => ({ ...e, production: { ...STABLE, api: 'https://api.bank.example' } }),
  },
];

function Pipeline({ fixed }: { fixed: boolean }) {
  const [envs, setEnvs] = useState<Envs>(INITIAL);
  const [steps, setSteps] = useState<Step[]>([]);
  const [downtime, setDowntime] = useState(0);
  const player = usePlayer(steps.length, 900);

  // Apply each step's effect when the player reaches it.
  useEffect(() => {
    const s = steps[player.step];
    if (!s) return;
    if (s.apply) setEnvs(s.apply);
    if (s.down) setDowntime((d) => d + (s.down ?? 0));
  }, [player.step]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = (list: Step[]) => {
    setSteps(list);
    setTimeout(player.play, 0);
  };
  const prod = envs.production;
  const released = envs.staging.version === 'v2.4';
  const compared = released && prod.version === 'v2.4';
  const same = envs.staging.build === prod.build;

  return (
    <Stack gap={14}>
      <Row>
        <Button tone="primary" onClick={() => run(fixed ? RELEASE_FIXED : RELEASE_BROKEN)} disabled={player.playing || released}>
          Release v2.4
        </Button>
        <Button
          tone="danger"
          onClick={() => run(fixed ? ROLLBACK_FIXED : ROLLBACK_BROKEN)}
          disabled={player.playing || prod.version !== 'v2.4'}
        >
          Roll back production
        </Button>
        <Button
          tone="ghost"
          onClick={() => {
            player.reset();
            setSteps([]);
            setEnvs(INITIAL);
            setDowntime(0);
          }}
        >
          Reset
        </Button>
      </Row>

      {steps.length > 0 && <Steps steps={steps} active={player.step} />}

      <Row gap={10} align="stretch">
        {(['staging', 'production'] as EnvName[]).map((name) => {
          const e = envs[name];
          return (
            <Panel key={name} title={name} tone={e.ok ? undefined : 'bad'} style={{ flex: '1 1 200px' }}>
              <Stack gap={6}>
                <Row gap={6}>
                  <Badge tone="info">{e.version}</Badge>
                  <Badge tone={e.ok ? 'good' : 'bad'}>bundle {e.build}</Badge>
                </Row>
                <code style={{ fontSize: 12, wordBreak: 'break-all' }}>
                  {fixed ? 'config.json' : 'VITE_API_URL'} = {e.api || '(empty)'}
                </code>
              </Stack>
            </Panel>
          );
        })}
      </Row>

      <Row gap={8}>
        <Stat
          label="prod runs what QA tested?"
          value={compared ? (same ? 'yes' : 'no') : '-'}
          tone={compared ? (same ? 'good' : 'bad') : 'neutral'}
        />
        <Stat label="production" value={prod.ok ? 'up' : 'down'} tone={prod.ok ? 'good' : 'bad'} />
        {!fixed && (
          <Stat
            label="minutes of blank page"
            value={!prod.ok && !downtime ? 'ongoing' : downtime}
            tone={downtime || !prod.ok ? 'bad' : 'neutral'}
          />
        )}
        {fixed && <Stat label="rollback time" value="~20 s" tone="good" />}
      </Row>

      <Browser url="dashboard.bank.example/accounts">
        {prod.ok ? (
          <Stack gap={6}>
            <strong>Your accounts</strong>
            <Row gap={8}>
              <Badge>Checking · €4,210.55</Badge>
              <Badge>Savings · €12,800.00</Badge>
            </Row>
            <Note>
              Running {prod.version} · bundle {prod.build}
            </Note>
          </Stack>
        ) : (
          <Stack gap={4} style={{ minHeight: 64, justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>(blank page)</span>
            <code style={{ fontSize: 12, color: 'var(--bad)' }}>GET https://dashboard.bank.example/undefined/accounts 404</code>
          </Stack>
        )}
      </Browser>

      <Code>
        {fixed
          ? `build:   npm ci && npm run build        # once, on main → s3://artifacts/3e9d1c7\ndeploy:  copy artifact + write config.json per env\nboot:    const config = await fetch('/config.json').then(r => r.json())\nrollback: promote 2c81f0a (no rebuild)`
          : `on: push: branches: [main, staging, production]\n- run: npm install          # not reproducible\n- run: npm run build        # rebuilt per env\n  env: { VITE_API_URL: \${{ vars.API_URL }} }  # empty on production`}
      </Code>
    </Stack>
  );
}

export function Problem() {
  return <Pipeline fixed={false} />;
}

export function Solution() {
  return <Pipeline fixed />;
}
