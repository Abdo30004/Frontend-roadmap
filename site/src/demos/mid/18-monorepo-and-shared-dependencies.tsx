import { useEffect, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Panel, Row, Stack, Stat, Steps, useConsole, usePlayer, type Tone } from '../../demo-kit';

export const scenario = 'A monorepo has apps/web (React 19) and packages/ui, the shared design system that exports <Dropdown>. A developer just updated the ui package.';
export const task = 'Run "pnpm install", look at the dependency tree, then start the app and open the page that uses <Dropdown>.';
export const solutionNote = 'React is a peerDependency of @acme/ui and the app links it with workspace:*, so there is exactly one React.';

interface Node { path: string; pkg: string; tone?: Tone; note?: string; depth: number }

const UI_PKG = {
  bug: `// packages/ui/package.json
"dependencies": {
  "react": "^18.2.0",        // its own React
  "react-dom": "^18.2.0",
  "clsx": "^2.1.0"
}`,
  fix: `// packages/ui/package.json
"peerDependencies": { "react": "^18.3.0 || ^19.0.0" },  // use the host app's React
"devDependencies":  { "react": "catalog:" },            // for its own tests only
"dependencies":     { "clsx": "^2.1.0" }
// apps/web: "@acme/ui": "workspace:*", "react": "catalog:"`,
};

function Monorepo({ fixed }: { fixed: boolean }) {
  const [installed, setInstalled] = useState(false);
  const [booted, setBooted] = useState(false);
  const c = useConsole();
  const player = usePlayer(4, 900);

  const tree: Node[] = fixed
    ? [
        { path: 'node_modules/react', pkg: 'react@19.0.0', tone: 'good', depth: 0 },
        { path: 'apps/web', pkg: 'web → react (hoisted)', depth: 1 },
        { path: 'packages/ui', pkg: '@acme/ui (workspace link) → react: peer, resolved from the app', depth: 1 },
      ]
    : [
        { path: 'node_modules/react', pkg: 'react@19.0.0', tone: 'info', note: 'copy A', depth: 0 },
        { path: 'apps/web', pkg: 'web → react@19.0.0 (copy A)', depth: 1 },
        { path: 'packages/ui/node_modules/react', pkg: 'react@18.3.1', tone: 'bad', note: 'copy B', depth: 1 },
        { path: 'packages/ui', pkg: '@acme/ui → react@18.3.1 (copy B)', depth: 2 },
      ];

  const steps: { label: string; detail: string; tone?: Tone }[] = [
    { label: 'Bundler resolves "react" for apps/web', detail: 'node_modules/react (19.0.0)' },
    { label: 'Bundler resolves "react" for @acme/ui', detail: fixed ? 'peer → same node_modules/react' : 'packages/ui/node_modules/react (18.3.1)', tone: fixed ? 'good' : 'warn' },
    { label: 'react-dom (copy A) renders <Dropdown>', detail: 'sets the hooks dispatcher on copy A' },
    fixed
      ? { label: 'Dropdown calls useState', detail: 'copy A dispatcher → works', tone: 'good' }
      : { label: 'Dropdown calls useState', detail: 'copy B dispatcher is null → crash', tone: 'bad' },
  ];

  const install = () => {
    setInstalled(true); setBooted(false); player.reset(); c.clear();
    c.log('$ pnpm install', 'info');
    c.log(fixed ? 'Packages: +412 · react resolved once (catalog: ^19.0.0)' : 'Packages: +431 · WARN packages/ui depends on react@^18.2.0', fixed ? 'good' : 'warn');
    c.log('$ pnpm why react', 'info');
    c.log(fixed ? 'react 19.0.0 ← web, @acme/ui (peer)' : 'react 19.0.0 ← web\nreact 18.3.1 ← @acme/ui', fixed ? 'good' : 'bad');
  };

  const boot = () => { setBooted(true); player.play(); };

  const done = booted && player.done;
  useEffect(() => {
    if (!done) return;
    if (fixed) c.log('✓ /settings rendered, <Dropdown> works', 'good');
    else c.log('Error: Invalid hook call. Hooks can only be called inside of the body of a function component.\n  3. You might have more than one copy of React in the same app\n    at Dropdown (packages/ui/src/Dropdown.tsx:12)', 'bad');
  }, [done, fixed, c.log]);

  const copies = installed ? (fixed ? 1 : 2) : 0;

  return (
    <Stack gap={14}>
      <Row gap={10} align="stretch">
        <Panel title="packages/ui/package.json" style={{ flex: '1 1 240px', minWidth: 0 }}>
          <Code>{fixed ? UI_PKG.fix : UI_PKG.bug}</Code>
        </Panel>
        <Panel title="Dependency tree" style={{ flex: '1 1 220px', minWidth: 0 }}>
          {!installed ? <Note>Run pnpm install to see it.</Note> : (
            <Stack gap={6}>
              {tree.map((n) => (
                <div key={n.path} style={{ paddingLeft: n.depth * 14, fontSize: 12.5, fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere' }}>
                  {n.depth ? '└ ' : ''}{n.path} {n.tone && <Badge tone={n.tone}>{n.note ?? n.pkg}</Badge>}
                  {!n.tone && <div style={{ color: 'var(--ink-3)' }}>{n.pkg}</div>}
                </div>
              ))}
            </Stack>
          )}
        </Panel>
      </Row>
      <Row>
        <Button onClick={install}>$ pnpm install</Button>
        <Button tone="primary" onClick={boot} disabled={!installed || player.playing}>$ pnpm dev → open /settings</Button>
      </Row>
      {booted && <Steps steps={steps} active={player.step} />}
      <Browser url="localhost:3000/settings">
        {!done ? <Note>{booted ? 'Compiling…' : 'Dev server not started.'}</Note> : fixed ? (
          <Stack gap={8}>
            <strong>Account settings</strong>
            <Row><span style={{ fontSize: 13 }}>Language</span><select aria-label="Language" className="dk-input" defaultValue="en"><option value="en">English</option><option value="fr">Français</option></select></Row>
          </Stack>
        ) : (
          <Panel tone="bad" title="Unhandled Runtime Error">
            <code style={{ fontSize: 12.5 }}>Invalid hook call. You might have more than one copy of React in the same app.</code>
          </Panel>
        )}
      </Browser>
      <Row gap={8}>
        <Stat label="copies of React installed" value={copies || '–'} tone={copies > 1 ? 'bad' : copies ? 'good' : 'neutral'} />
        <Stat label="React in the bundle" value={installed ? (fixed ? '~60 KB' : '~120 KB') : '–'} tone={installed && !fixed ? 'warn' : 'neutral'} />
      </Row>
      <Console lines={c.lines} height={130} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <Monorepo fixed={false} />;
}

export function Solution() {
  return <Monorepo fixed />;
}
