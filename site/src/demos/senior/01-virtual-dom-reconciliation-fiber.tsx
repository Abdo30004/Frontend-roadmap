import { useEffect, useState, type ReactNode } from 'react';
import { Badge, Browser, Code, Input, Label, Note, Panel, Resettable, Row, Stack, Stat, Button } from '../../demo-kit';

export const scenario =
  'An insurance quote page: the customer types name, address and plate, then ticks "Add premium coverage" and the card gets a premium look.';
export const task = 'Fill in the three fields, then tick "Add premium coverage". Watch the fields and the mounts counter.';
export const solutionNote = 'Same page, but one <Card variant> component: same type at the same position, so React only patches the class.';

/* ---------- the form: its state lives on its fiber ---------- */
function QuoteForm({ onMount }: { onMount: () => void }) {
  const [values, setValues] = useState({ name: '', address: '', plate: '' });
  // runs once per mount: a second call means React threw the old fiber away
  useEffect(() => { onMount(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const field = (key: keyof typeof values, text: string, placeholder: string) => (
    <Label text={text}>
      <Input
        value={values[key]}
        placeholder={placeholder}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
      />
    </Label>
  );
  return (
    <Stack gap={8}>
      {field('name', 'Full name', 'Ada Lovelace')}
      {field('address', 'Address', '12 Analytical St')}
      {field('plate', 'Licence plate', 'AB-123-CD')}
    </Stack>
  );
}

/* ---------- card styles ---------- */
const cardStyle = (premium: boolean) => ({
  padding: 14,
  borderRadius: 12,
  border: `1px solid ${premium ? 'var(--warn)' : 'var(--line)'}`,
  background: premium ? 'var(--warn-soft)' : 'var(--surface)',
  transition: 'background-color 200ms ease, border-color 200ms ease',
});

// BUG version: two different component types
function BasicCard({ children }: { children: ReactNode }) {
  return <section style={cardStyle(false)}><strong>Basic quote</strong><div style={{ marginTop: 10 }}>{children}</div></section>;
}
function PremiumCard({ children }: { children: ReactNode }) {
  return <section style={cardStyle(true)}><strong>Premium quote ★</strong><div style={{ marginTop: 10 }}>{children}</div></section>;
}

// FIX version: one stable type, the difference is a prop
function Card({ variant, children }: { variant: 'basic' | 'premium'; children: ReactNode }) {
  const premium = variant === 'premium';
  return (
    <section style={cardStyle(premium)}>
      <strong>{premium ? 'Premium quote ★' : 'Basic quote'}</strong>
      <div style={{ marginTop: 10 }}>{children}</div>
    </section>
  );
}

interface Diff { before: string; after: string; same: boolean }

function QuotePage({ fixed, reset }: { fixed: boolean; reset: () => void }) {
  const [premium, setPremium] = useState(false);
  const [mounts, setMounts] = useState(0);
  const [diff, setDiff] = useState<Diff | null>(null);

  const typeName = (p: boolean) => (fixed ? `<Card variant="${p ? 'premium' : 'basic'}">` : p ? '<PremiumCard>' : '<BasicCard>');

  const toggle = (next: boolean) => {
    setDiff({ before: typeName(premium), after: typeName(next), same: fixed });
    setPremium(next);
  };

  const form = <QuoteForm onMount={() => setMounts((m) => m + 1)} />;
  const toggleBox = (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 14 }}>
      <input type="checkbox" checked={premium} onChange={(e) => toggle(e.target.checked)} />
      Add premium coverage (+€9/month)
    </label>
  );

  // BUG: the element type at this position flips between two components.
  const CardType = premium ? PremiumCard : BasicCard;

  return (
    <Stack gap={14}>
      <Browser url="quotes.example-insure.com/car">
        {fixed ? (
          <Card variant={premium ? 'premium' : 'basic'}>{form}{toggleBox}</Card>
        ) : (
          <CardType>{form}{toggleBox}</CardType>
        )}
      </Browser>

      <Row gap={10}>
        <Stat label="QuoteForm mounts" value={mounts} tone={mounts > 1 ? 'bad' : 'good'} />
        <Button tone="ghost" onClick={reset}>Reset</Button>
      </Row>

      <Panel title="What the reconciler compared on the last toggle">
        {diff ? (
          <Stack gap={8}>
            <Row gap={6}>
              <Badge>{diff.before}</Badge>
              <span style={{ color: 'var(--ink-3)' }}>→</span>
              <Badge tone={diff.same ? 'good' : 'bad'}>{diff.after}</Badge>
            </Row>
            <Row gap={6}>
              <Badge tone={diff.same ? 'good' : 'bad'}>
                {diff.same ? 'same type → update props' : 'different type → unmount + mount'}
              </Badge>
              <Note>
                {diff.same
                  ? 'Fibers reused: QuoteForm keeps its useState, only className changes.'
                  : 'Old subtree destroyed (QuoteForm fiber and its useState), a fresh one is created.'}
              </Note>
            </Row>
          </Stack>
        ) : (
          <Note>Toggle the checkbox to see the diff.</Note>
        )}
      </Panel>

      <Code>{fixed
        ? `<Card variant={premium ? 'premium' : 'basic'}>\n  <QuoteForm />\n</Card>`
        : `const Card = premium ? PremiumCard : BasicCard;\n<Card>\n  <QuoteForm />\n</Card>`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <Resettable>{(reset) => <QuotePage fixed={false} reset={reset} />}</Resettable>;
}

export function Solution() {
  return <Resettable>{(reset) => <QuotePage fixed reset={reset} />}</Resettable>;
}
