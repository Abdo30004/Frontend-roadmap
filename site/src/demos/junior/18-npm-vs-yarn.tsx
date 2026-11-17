import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Code, Console, Panel, Row, Stack, Stat, Steps, sleep, useConsole, type Tone } from '../../demo-kit';

export const scenario = 'A sales dashboard builds fine on every laptop. The team pushes to CI, which builds and deploys it to production.';
export const task = 'Build on the laptop, then press "chart-lib publishes 3.2.0", then "Push → CI build". Compare the installed versions.';
export const solutionNote = 'Same project, but package-lock.json is committed and CI runs npm ci.';

// Versions of chart-lib on the (simulated) npm registry. 3.2.0 has a breaking bug.
const BROKEN = '3.2.0';

/** Minimal semver caret resolution: highest version with the same major that is >= the range base. */
function resolveCaret(range: string, available: string[]): string {
  const base = range.replace('^', '').split('.').map(Number);
  const ok = available.filter((v) => {
    const p = v.split('.').map(Number);
    return p[0] === base[0] && (p[1] > base[1] || (p[1] === base[1] && p[2] >= base[2]));
  });
  return ok.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1) ?? 'none';
}

type Stage = { label: string; detail?: string; tone?: Tone };

function InstallSim({ fixed }: { fixed: boolean }) {
  const [registry, setRegistry] = useState(['3.0.4', '3.1.0']);
  const [laptop, setLaptop] = useState<string | null>(null);
  const [ci, setCi] = useState<{ version: string; ok: boolean } | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const log = useConsole();
  const alive = useRef(new AbortController());

  useEffect(() => () => alive.current.abort(), []);

  const lockfile = '3.1.0'; // what the laptop installed when the dep was added
  const buildLaptop = () => {
    setLaptop('3.1.0');
    log.log('laptop $ npm run build', 'neutral');
    log.log('node_modules/chart-lib@3.1.0 (installed weeks ago) → ✓ build ok', 'good');
  };

  const publish = () => {
    setRegistry((r) => [...r, BROKEN]);
    log.log(`registry: chart-lib@${BROKEN} published (contains a breaking bug)`, 'warn');
  };

  const runCi = async () => {
    const signal = alive.current.signal;
    const version = fixed ? lockfile : resolveCaret('^3.1.0', registry);
    const ok = version !== BROKEN;
    const steps: Stage[] = [
      { label: 'git checkout', detail: fixed ? 'package.json + package-lock.json' : 'package.json only (lockfile ignored)' },
      {
        label: fixed ? 'npm ci' : 'npm install',
        detail: fixed ? `lockfile says chart-lib@${lockfile}` : `^3.1.0 resolves to chart-lib@${version}`,
        tone: ok ? 'good' : 'warn',
      },
      {
        label: 'npm run build',
        detail: ok ? 'compiled successfully' : "TypeError: Cannot read properties of undefined (reading 'scales')",
        tone: ok ? 'good' : 'bad',
      },
      { label: 'deploy', detail: ok ? 'production updated' : 'skipped: build failed', tone: ok ? 'good' : 'bad' },
    ];
    setBusy(true);
    setCi(null);
    setStages(steps);
    log.log(`ci $ ${fixed ? 'npm ci' : 'npm install'}`, 'neutral');
    try {
      for (let i = 0; i < steps.length; i++) {
        setActive(i);
        await sleep(650, signal);
      }
      setCi({ version, ok });
      log.log(ok ? `✓ CI green (chart-lib@${version})` : `✗ CI red: chart-lib@${version} broke the build`, ok ? 'good' : 'bad');
      setBusy(false);
    } catch {
      /* unmounted */
    }
  };

  const reset = () => {
    setRegistry(['3.0.4', '3.1.0']);
    setLaptop(null);
    setCi(null);
    setStages([]);
    setActive(-1);
    log.clear();
  };
  const published = registry.includes(BROKEN);

  return (
    <Stack gap={14}>
      <Row gap={10} align="stretch">
        <Panel title="Repo" style={{ flex: '1 1 220px' }}>
          <Stack gap={6}>
            <code style={{ fontSize: 12 }}>"chart-lib": "^3.1.0"</code>
            <Row gap={6}>
              <Badge>package.json</Badge>
              {fixed ? <Badge tone="good">package-lock.json → 3.1.0</Badge> : <Badge tone="bad">package-lock.json (in .gitignore)</Badge>}
            </Row>
          </Stack>
        </Panel>
        <Panel title="npm registry: chart-lib" style={{ flex: '1 1 180px' }}>
          <Row gap={6}>
            {registry.map((v) => (
              <Badge key={v} tone={v === BROKEN ? 'bad' : 'neutral'}>
                {v}
              </Badge>
            ))}
          </Row>
        </Panel>
      </Row>

      <Row>
        <Button onClick={buildLaptop} disabled={busy}>
          Build on my laptop
        </Button>
        <Button onClick={publish} disabled={published || busy}>
          chart-lib publishes 3.2.0
        </Button>
        <Button tone="primary" onClick={runCi} disabled={busy}>
          Push → CI build
        </Button>
        <Button tone="ghost" onClick={reset} disabled={busy}>
          Reset
        </Button>
      </Row>

      {stages.length > 0 && <Steps steps={stages} active={active} />}

      <Row gap={8}>
        <Stat label="laptop has" value={laptop ?? '-'} tone={laptop ? 'good' : 'neutral'} />
        <Stat label="CI installed" value={ci?.version ?? '-'} tone={!ci ? 'neutral' : ci.ok ? 'good' : 'bad'} />
        <Stat label="CI build" value={!ci ? '-' : ci.ok ? 'passed' : 'FAILED'} tone={!ci ? 'neutral' : ci.ok ? 'good' : 'bad'} />
      </Row>
      {ci && !ci.ok && laptop && (
        <Badge tone="bad">
          "But it works on my machine!" (laptop: {laptop}, CI: {ci.version})
        </Badge>
      )}

      <Console title="Output" lines={log.lines} height={120} onClear={log.clear} />
      <Code>
        {fixed
          ? `# .gitignore\nnode_modules/          # lockfile is committed\n# CI\n- run: npm ci           # exact versions from package-lock.json`
          : `# .gitignore\nnode_modules/\npackage-lock.json      # "causes merge conflicts"\n# CI\n- run: npm install      # resolves ^ranges fresh every time`}
      </Code>
    </Stack>
  );
}

export function Problem() {
  return <InstallSim fixed={false} />;
}

export function Solution() {
  return <InstallSim fixed />;
}
