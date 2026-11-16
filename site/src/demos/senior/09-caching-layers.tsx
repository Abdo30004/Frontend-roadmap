import { useState } from 'react';
import { Badge, Browser, Button, Code, Note, Panel, Row, Stack, Steps, usePlayer, type Tone } from '../../demo-kit';

export const scenario =
  'A store ships a new release. The CDN serves index.html and hashed JS files. A returning customer opens the site an hour after the deploy.';
export const task = 'Press "Deploy v2", then "Customer opens the site". Watch each request.';
export const solutionNote = 'HTML is revalidated on every visit; hashed assets are cached forever.';

type Version = 'v1' | 'v2';
const CHUNK: Record<Version, string> = { v1: 'app.3f9a.js', v2: 'app.8c1d.js' };

function CacheSim({ fixed }: { fixed: boolean }) {
  const [server, setServer] = useState<Version>('v1');
  const [visit, setVisit] = useState<{ steps: { label: string; detail: string; tone?: Tone }[]; ok: boolean } | null>(null);
  const player = usePlayer(visit?.steps.length ?? 0, 850);

  const htmlHeader = fixed ? 'Cache-Control: no-cache' : 'Cache-Control: max-age=86400';

  const open = () => {
    // The customer's browser cached index.html (v1) on yesterday's visit.
    const htmlVersion: Version = fixed ? server : 'v1';
    const chunk = CHUNK[htmlVersion];
    const chunkExists = htmlVersion === server; // old chunks are deleted on deploy
    const steps = [
      fixed
        ? { label: 'GET /index.html', detail: `Revalidated with the CDN → ${server}`, tone: 'info' as Tone }
        : { label: 'GET /index.html', detail: 'Served from browser cache (still "fresh") → v1', tone: 'warn' as Tone },
      { label: `GET /${chunk}`, detail: chunkExists ? '200 · cached for a year (immutable)' : '404 · file no longer exists on the CDN', tone: (chunkExists ? 'good' : 'bad') as Tone },
      chunkExists
        ? { label: 'App boots', detail: `Customer sees ${server}`, tone: 'good' as Tone }
        : { label: 'App crashes', detail: 'ChunkLoadError → blank page', tone: 'bad' as Tone },
    ];
    setVisit({ steps, ok: chunkExists });
    setTimeout(player.play, 0);
  };

  const finished = visit && player.done;

  return (
    <Stack gap={14}>
      <Row gap={10}>
        <Panel title="CDN currently serves" style={{ flex: '1 1 200px' }}>
          <Row gap={6}>
            <Badge tone="info">index.html → {server}</Badge>
            <Badge>{CHUNK[server]}</Badge>
          </Row>
        </Panel>
        <Panel title="index.html header" style={{ flex: '1 1 200px' }}>
          <code style={{ fontSize: 13 }}>{htmlHeader}</code>
        </Panel>
      </Row>

      <Row>
        <Button onClick={() => { setServer('v2'); setVisit(null); player.reset(); }} disabled={server === 'v2'}>
          Deploy v2
        </Button>
        <Button tone="primary" onClick={open} disabled={player.playing}>Customer opens the site</Button>
        <Button tone="ghost" onClick={() => { setServer('v1'); setVisit(null); player.reset(); }}>Reset</Button>
      </Row>

      {visit && <Steps steps={visit.steps} active={player.step} />}

      <Browser url="shop.example.com">
        {!finished ? (
          <Note>{visit ? 'Loading…' : 'Not opened yet.'}</Note>
        ) : visit.ok ? (
          <Stack gap={4}>
            <strong>Spring sale is live 🎉</strong>
            <Note>Running {server}</Note>
          </Stack>
        ) : (
          <div style={{ minHeight: 60, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            (blank white page)
          </div>
        )}
      </Browser>

      {fixed && (
        <Code>{`# HTML: always ask the CDN if there is a newer version
index.html        Cache-Control: no-cache
# Hashed assets: the name changes when the content changes
/assets/*.[hash]  Cache-Control: public, max-age=31536000, immutable`}</Code>
      )}
    </Stack>
  );
}

export function Problem() {
  return <CacheSim fixed={false} />;
}

export function Solution() {
  return <CacheSim fixed />;
}
