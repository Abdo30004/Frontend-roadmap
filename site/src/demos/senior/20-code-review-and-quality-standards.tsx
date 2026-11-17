import { useState } from 'react';
import { Badge, Browser, Button, Note, Panel, Row, Stack, Stat, type Tone } from '../../demo-kit';

export const scenario = 'A SaaS team reviews a pull request that adds a billing export. Reviewers are busy and the PR is big.';
export const task =
  'Click suspicious diff lines (or the size chip) to flag them, then approve. Or just press "LGTM" like the team usually does.';
export const solutionNote = 'CI (lint, types, a11y rules) annotates the mechanical issues; the PR checklist points the human at the rest.';

type IssueId = 'deps' | 'any' | 'a11y' | 'errors' | 'magic' | 'size';
interface Issue {
  id: IssueId;
  auto: boolean;
  label: string;
  prod: string;
}
const ISSUES: Issue[] = [
  {
    id: 'deps',
    auto: true,
    label: 'react-hooks/exhaustive-deps: missing "accountId"',
    prod: "Billing shows the PREVIOUS account's invoices after switching accounts",
  },
  {
    id: 'any',
    auto: true,
    label: '@typescript-eslint/no-explicit-any',
    prod: 'API renamed "invoices" → crash: Cannot read properties of undefined',
  },
  { id: 'a11y', auto: true, label: 'jsx-a11y: <div onClick> is not keyboard accessible', prod: 'Keyboard users cannot export at all' },
  {
    id: 'errors',
    auto: false,
    label: 'blocking: no res.ok check, no error state',
    prod: 'A 500 from the API shows an empty table, no error',
  },
  {
    id: 'magic',
    auto: false,
    label: 'suggestion: name 5000 (MAX_EXPORT_ROWS) and say why',
    prod: 'Big customers silently get a truncated export',
  },
  {
    id: 'size',
    auto: false,
    label: 'blocking: 2,140 lines: split into focused PRs (< ~400)',
    prod: 'Nobody really read it; review latency 3 days',
  },
];
const DIFF: { text: string; issue?: IssueId }[] = [
  { text: 'export function BillingExport({ accountId }: Props) {' },
  { text: '  const [rows, setRows] = useState([]);' },
  { text: '  useEffect(() => {' },
  { text: '    load(accountId);' },
  { text: '  }, []);', issue: 'deps' },
  { text: '  async function load(id: string) {' },
  { text: '    const res = await fetch(`/api/billing/${id}`);', issue: 'errors' },
  { text: '    const data: any = await res.json();', issue: 'any' },
  { text: '    setRows(data.invoices.slice(0, 5000));', issue: 'magic' },
  { text: '  }' },
  { text: '  return <div onClick={exportCsv}>Export CSV</div>;', issue: 'a11y' },
  { text: '}' },
];
const CHECKLIST: { id: IssueId; text: string }[] = [
  { id: 'size', text: 'PR is focused and under ~400 lines' },
  { id: 'errors', text: 'Loading, empty and error states handled' },
  { id: 'magic', text: 'No unexplained constants; limits are named' },
];

function Review({ fixed }: { fixed: boolean }) {
  const [flags, setFlags] = useState<IssueId[]>(fixed ? ISSUES.filter((i) => i.auto).map((i) => i.id) : []);
  const [state, setState] = useState<'open' | 'changes' | 'merged'>('open');
  const [shipped, setShipped] = useState<Issue[]>([]);

  const flag = (id?: IssueId) => {
    if (!id || state !== 'open' || flags.includes(id)) return;
    setFlags((f) => [...f, id]);
  };
  const merge = () => {
    setShipped(state === 'changes' ? [] : ISSUES.filter((i) => !flags.includes(i.id)));
    setState('merged');
  };
  const reset = () => {
    setFlags(fixed ? ISSUES.filter((i) => i.auto).map((i) => i.id) : []);
    setState('open');
    setShipped([]);
  };

  const ciFailing = fixed && state === 'open';
  const allFlagged = flags.length === ISSUES.length;
  const commentFor = (id?: IssueId) => (id && flags.includes(id) ? ISSUES.find((i) => i.id === id) : undefined);

  return (
    <Stack gap={14}>
      <Browser url="git.acme.example/web/pull/1287">
        <Stack gap={10}>
          <Row style={{ justifyContent: 'space-between' }}>
            <strong>#1287 Add billing export</strong>
            <button
              type="button"
              onClick={() => flag('size')}
              style={{ all: 'unset', cursor: state === 'open' ? 'pointer' : 'default' }}
              aria-label="Flag PR size"
            >
              <Badge tone={flags.includes('size') ? 'bad' : 'warn'}>38 files · +2,140 −312</Badge>
            </button>
          </Row>
          <Row gap={6}>
            {fixed ? (
              <>
                <Badge tone={state === 'open' ? 'bad' : 'good'}>{state === 'open' ? '✗ lint (3 errors)' : '✓ lint'}</Badge>
                <Badge tone="good">✓ typecheck</Badge>
                <Badge tone="good">✓ tests</Badge>
              </>
            ) : (
              <Badge>No checks configured</Badge>
            )}
          </Row>
          <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflowX: 'auto', background: 'var(--code-bg)' }}>
            {DIFF.map((line, i) => {
              const c = commentFor(line.issue);
              return (
                <div key={i}>
                  <button
                    type="button"
                    onClick={() => flag(line.issue)}
                    style={{
                      all: 'unset',
                      display: 'block',
                      boxSizing: 'border-box',
                      width: '100%',
                      cursor: state === 'open' ? 'pointer' : 'default',
                      padding: '1px 10px',
                      font: '12px var(--font-mono)',
                      whiteSpace: 'pre',
                      color: 'var(--good)',
                      background: c ? 'var(--bad-soft)' : 'transparent',
                      transition: 'background-color 200ms ease',
                    }}
                  >
                    + {line.text}
                  </button>
                  {c && line.issue !== 'size' && (
                    <div
                      style={{
                        padding: '4px 10px 6px 24px',
                        fontSize: 12,
                        color: c.auto && fixed ? 'var(--info)' : 'var(--bad)',
                        whiteSpace: 'normal',
                      }}
                    >
                      {c.auto && fixed ? '🤖 ci: ' : '💬 you: '}
                      {c.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {flags.includes('size') && <Note>💬 {ISSUES[5].label}</Note>}
          {fixed && (
            <Panel title="PR template checklist (reviewer)">
              <Stack gap={4}>
                {CHECKLIST.map((item) => (
                  <label key={item.id} style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
                    <input type="checkbox" checked={flags.includes(item.id)} disabled={state !== 'open'} onChange={() => flag(item.id)} />
                    {item.text}
                    {flags.includes(item.id) && <Badge tone="bad">fails → comment added</Badge>}
                  </label>
                ))}
              </Stack>
            </Panel>
          )}
          <Row>
            {!fixed && (
              <Button tone="primary" onClick={merge} disabled={state === 'merged'}>
                LGTM 👍 approve & merge
              </Button>
            )}
            {fixed && (
              <Button onClick={() => setState('changes')} disabled={state !== 'open' || !allFlagged}>
                Request changes
              </Button>
            )}
            {fixed && (
              <Button
                tone="primary"
                onClick={merge}
                disabled={state !== 'changes'}
                title={ciFailing ? 'Required checks are failing' : undefined}
              >
                {state === 'changes' ? 'Merge (author fixed + split, checks green)' : 'Merge (blocked by required checks)'}
              </Button>
            )}
            <Button tone="ghost" onClick={reset}>
              Reset
            </Button>
          </Row>
        </Stack>
      </Browser>

      <Row gap={8}>
        <Stat
          label="issues caught before merge"
          value={`${flags.length}/${ISSUES.length}`}
          tone={allFlagged ? 'good' : flags.length ? 'warn' : 'neutral'}
        />
        {fixed && <Stat label="caught by CI, not humans" value={3} tone="info" />}
        <Stat
          label="bugs shipped to prod"
          value={state === 'merged' ? shipped.length : '-'}
          tone={state !== 'merged' ? 'neutral' : shipped.length ? 'bad' : 'good'}
        />
      </Row>

      {state === 'merged' && (
        <Panel title="Production, the next morning" tone={(shipped.length ? 'bad' : 'good') as Tone}>
          {shipped.length === 0 ? (
            <Note>Quiet. The export shipped as 3 small PRs, all reviewed and green.</Note>
          ) : (
            <Stack gap={4}>
              {shipped.map((i) => (
                <div key={i.id} style={{ fontSize: 13 }}>
                  ✗ {i.prod}
                </div>
              ))}
            </Stack>
          )}
        </Panel>
      )}
    </Stack>
  );
}

export function Problem() {
  return <Review fixed={false} />;
}

export function Solution() {
  return <Review fixed />;
}
