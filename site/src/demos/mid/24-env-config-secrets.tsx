import { useState } from 'react';
import { Badge, Browser, Button, Code, Console, Input, Note, Panel, Row, Stack, Stat, useConsole } from '../../demo-kit';

export const scenario = 'An "AI resume writer" Vite app improves your resume with an LLM provider. The team just shipped it to production.';
export const task = 'Click "vite build", then search the bundle for "sk-" like an attacker would, and use what you find.';
export const solutionNote = 'Same app: the key lives only in the server env; the bundle just calls /api/improve-resume.';

const KEY = 'sk-proj-7Hc2xQ9vLmA41fZ0';

const FILES = {
  bug: {
    env: `# .env
VITE_OPENAI_KEY=${KEY}
VITE_API_URL=https://api.resumeai.example`,
    bundle: `// dist/assets/index-3f9a.js (minified, public)
const Bt="https://api.resumeai.example";
async function Qe(t){return(await fetch("https://api.openai.com/v1/chat/completions",
{method:"POST",headers:{Authorization:"Bearer ${KEY}",
"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini",
messages:[{role:"user",content:t}]})})).json()}`,
  },
  fix: {
    env: `# .env.local (gitignored) / hosting secret store
OPENAI_API_KEY=${KEY}        # no prefix → server only
VITE_API_URL=https://api.resumeai.example`,
    bundle: `// dist/assets/index-8c1d.js (minified, public)
const Bt="https://api.resumeai.example";
async function Qe(t){return(await fetch("/api/improve-resume",{method:"POST",
headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t})})).json()}`,
  },
};

function highlight(src: string, q: string) {
  if (!q) return src;
  const parts = src.split(q);
  return parts.flatMap((p, i) =>
    i === 0
      ? [p]
      : [
          <mark key={i} style={{ background: 'var(--bad-soft)', color: 'var(--bad)', borderRadius: 3 }}>
            {q}
          </mark>,
          p,
        ],
  );
}

function ResumeApp({ fixed }: { fixed: boolean }) {
  const files = fixed ? FILES.fix : FILES.bug;
  const [built, setBuilt] = useState(false);
  const [query, setQuery] = useState('sk-');
  const [found, setFound] = useState<string | null>(null);
  const [abuse, setAbuse] = useState({ calls: 0, cost: 0 });
  const [improved, setImproved] = useState(false);
  const c = useConsole();

  const build = () => {
    setBuilt(true);
    setFound(null);
    setAbuse({ calls: 0, cost: 0 });
    c.log('$ vite build', 'info');
    c.log(
      fixed
        ? 'import.meta.env: only VITE_API_URL inlined (OPENAI_API_KEY has no prefix)'
        : 'import.meta.env.VITE_OPENAI_KEY → replaced by its literal value',
      fixed ? 'good' : 'warn',
    );
  };

  const search = () => {
    const match = files.bundle.match(new RegExp(`${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\w-]*`));
    setFound(match ? match[0] : null);
    c.log(match ? `attacker: found "${match[0]}" in index.js` : `attacker: no "${query}" in the bundle`, match ? 'bad' : 'good');
  };

  const abuseKey = () => {
    if (fixed) {
      c.log('attacker: no key to steal; POST /api/improve-resume without a session → 401 (and 20 req/h per user)', 'good');
      return;
    }
    if (!found?.startsWith('sk-')) {
      c.log('attacker: nothing found yet, search the bundle first');
      return;
    }
    setAbuse((a) => ({ calls: a.calls + 10_000, cost: a.cost + 1_840 }));
    c.log('attacker: 10,000 requests to api.openai.com with YOUR key → 200 OK, billed to you', 'bad');
  };

  return (
    <Stack gap={14}>
      <Browser url="resumeai.example/editor">
        <Stack gap={8}>
          <strong>Improve my resume</strong>
          <Note>“Managed a team of 5 engineers and shipped the billing system.”</Note>
          <Row>
            <Button
              tone="primary"
              onClick={() => {
                setImproved(true);
                c.log(
                  fixed
                    ? 'browser → POST /api/improve-resume → server adds the key → LLM'
                    : 'browser → POST api.openai.com with Authorization: Bearer sk-proj-…',
                  fixed ? 'info' : 'warn',
                );
              }}
            >
              ✨ Improve
            </Button>
            {improved && <Badge tone="good">“Led 5 engineers to launch billing, cutting churn 12%.”</Badge>}
          </Row>
        </Stack>
      </Browser>
      <Row gap={10} align="stretch">
        <Panel title="Repo" style={{ flex: '1 1 240px', minWidth: 0 }}>
          <Stack gap={8}>
            <Code>{files.env}</Code>
            <Row>
              <Button onClick={build}>$ vite build</Button>
            </Row>
          </Stack>
        </Panel>
        <Panel title="DevTools → Sources (anyone)" tone={found && !fixed ? 'bad' : undefined} style={{ flex: '1 1 240px', minWidth: 0 }}>
          {!built ? (
            <Note>Not deployed yet.</Note>
          ) : (
            <Stack gap={8}>
              <pre className="dk-code" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                <code>{highlight(files.bundle, query)}</code>
              </pre>
              <Row>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search the bundle"
                  style={{ flex: '1 1 80px' }}
                />
                <Button onClick={search} disabled={!query}>
                  Search
                </Button>
                <Button tone="danger" onClick={abuseKey}>
                  Use it
                </Button>
              </Row>
            </Stack>
          )}
        </Panel>
      </Row>
      <Row gap={8}>
        <Stat label="secrets in the bundle" value={built ? (fixed ? 0 : 1) : '–'} tone={!built ? 'neutral' : fixed ? 'good' : 'bad'} />
        <Stat label="requests on your key" value={abuse.calls.toLocaleString('en-US')} tone={abuse.calls ? 'bad' : 'neutral'} />
        <Stat label="your LLM bill" value={`$${abuse.cost.toLocaleString('en-US')}`} tone={abuse.cost ? 'bad' : 'neutral'} />
      </Row>
      <Code>
        {fixed
          ? `// app/api/improve-resume/route.ts (server only)
headers: { Authorization: \`Bearer \${process.env.OPENAI_API_KEY}\` }
// client
fetch('/api/improve-resume', { method: 'POST', body: JSON.stringify({ text }) });`
          : `// src/lib/ai.ts (runs in the browser)
headers: { Authorization: \`Bearer \${import.meta.env.VITE_OPENAI_KEY}\` }`}
      </Code>
      <Console lines={c.lines} height={120} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <ResumeApp fixed={false} />;
}

export function Solution() {
  return <ResumeApp fixed />;
}
