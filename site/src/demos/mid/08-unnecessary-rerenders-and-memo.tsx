import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Note, Panel, Row, Stack } from '../../demo-kit';

export const scenario = 'A CRM customers page has a "Quick note" box at the top and a customer table (wrapped in memo) below it.';
export const task = 'Type a few words in the Quick note. Watch the render counters flash on the table and on every row.';
export const solutionNote = "Same page: the note state lives in its own component, filter is useMemo'd and onSelect is useCallback'd.";

type Status = 'active' | 'churned';
interface Customer {
  id: number;
  name: string;
  company: string;
  status: Status;
}
const CUSTOMERS: Customer[] = [
  { id: 1, name: 'Ana Ruiz', company: 'Northwind', status: 'active' },
  { id: 2, name: 'Ben Okafor', company: 'Globex', status: 'active' },
  { id: 3, name: 'Chloé Martin', company: 'Initech', status: 'churned' },
  { id: 4, name: 'Dev Patel', company: 'Umbrella', status: 'active' },
  { id: 5, name: 'Eva Novak', company: 'Hooli', status: 'churned' },
  { id: 6, name: 'Femi Adeyemi', company: 'Stark Ind.', status: 'active' },
];

const FLASH_CSS = '@keyframes m08-flash { from { background-color: var(--warn-soft); } to { background-color: transparent; } }';

/** Render counter that flashes every time the component renders. */
function RenderCount({ n }: { n: number }) {
  return (
    <span
      key={n}
      style={{
        animation: n > 1 ? 'm08-flash 600ms ease-out' : undefined,
        borderRadius: 6,
        padding: '1px 6px',
        font: '600 11px var(--font-mono)',
        color: n > 1 ? 'var(--warn)' : 'var(--ink-3)',
      }}
    >
      renders: {n}
    </span>
  );
}
function useRenders() {
  const r = useRef(0);
  return ++r.current;
}

const CustomerRow = memo(function CustomerRow({ customer, onSelect }: { customer: Customer; onSelect: (id: number) => void }) {
  const n = useRenders();
  return (
    <Row gap={8} wrap={false} style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
      <Button tone="ghost" onClick={() => onSelect(customer.id)} style={{ flex: '1 1 auto', textAlign: 'left', padding: '4px 6px' }}>
        {customer.name} <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>· {customer.company}</span>
      </Button>
      <RenderCount n={n} />
    </Row>
  );
});

const CustomerTable = memo(function CustomerTable({
  customers,
  filter,
  onSelect,
}: {
  customers: Customer[];
  filter: { status: Status };
  onSelect: (id: number) => void;
}) {
  const n = useRenders();
  const visible = customers.filter((c) => c.status === filter.status);
  return (
    <Panel
      title={
        <Row gap={8}>
          <span>CustomerTable (memo)</span>
          <RenderCount n={n} />
        </Row>
      }
    >
      {visible.map((c) => (
        <CustomerRow key={c.id} customer={c} onSelect={onSelect} />
      ))}
    </Panel>
  );
});

function StatusTabs({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  return (
    <Row gap={6}>
      {(['active', 'churned'] as Status[]).map((s) => (
        <Button key={s} tone={value === s ? 'primary' : 'default'} onClick={() => onChange(s)}>
          {s}
        </Button>
      ))}
    </Row>
  );
}

const textareaStyle = {
  font: '14px var(--font-body)',
  padding: 8,
  borderRadius: 8,
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  resize: 'vertical' as const,
  minHeight: 48,
};

function QuickNote() {
  const [note, setNote] = useState('');
  return (
    <textarea
      aria-label="Quick note"
      placeholder="Quick note… (try typing)"
      value={note}
      onChange={(e) => setNote(e.target.value)}
      style={textareaStyle}
    />
  );
}

function Drawer({ id }: { id: number | null }) {
  const c = CUSTOMERS.find((x) => x.id === id);
  return c ? <Badge tone="info">Selected: {c.name}</Badge> : <Note>Click a customer to open it.</Note>;
}

function CustomersPageBuggy() {
  const n = useRenders();
  const [note, setNote] = useState(''); // changes on every keystroke
  const [status, setStatus] = useState<Status>('active');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  return (
    <Stack gap={10}>
      <Row gap={8}>
        <strong>Customers</strong>
        <RenderCount n={n} />
      </Row>
      <textarea
        aria-label="Quick note"
        placeholder="Quick note… (try typing)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={textareaStyle}
      />
      <StatusTabs value={status} onChange={setStatus} />
      <CustomerTable
        customers={CUSTOMERS}
        filter={{ status }} // new object every render
        onSelect={(id) => setSelectedId(id)} // new function every render
      />
      <Drawer id={selectedId} />
    </Stack>
  );
}

function CustomersPageFixed() {
  const n = useRenders();
  const [status, setStatus] = useState<Status>('active');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const filter = useMemo(() => ({ status }), [status]);
  const handleSelect = useCallback((id: number) => setSelectedId(id), []);
  return (
    <Stack gap={10}>
      <Row gap={8}>
        <strong>Customers</strong>
        <RenderCount n={n} />
      </Row>
      <QuickNote />
      <StatusTabs value={status} onChange={setStatus} />
      <CustomerTable customers={CUSTOMERS} filter={filter} onSelect={handleSelect} />
      <Drawer id={selectedId} />
    </Stack>
  );
}

function Demo({ fixed }: { fixed: boolean }) {
  const [key, setKey] = useState(0);
  return (
    <Stack gap={12}>
      <style>{FLASH_CSS}</style>
      <Browser url="crm.example/customers">{fixed ? <CustomersPageFixed key={key} /> : <CustomersPageBuggy key={key} />}</Browser>
      <Row>
        <Button tone="ghost" onClick={() => setKey((k) => k + 1)}>
          Reset counters
        </Button>
      </Row>
      <Code>
        {fixed
          ? `<QuickNote />  // note state lives here now\nconst filter = useMemo(() => ({ status }), [status]);\nconst handleSelect = useCallback((id) => setSelectedId(id), []);\n<CustomerTable filter={filter} onSelect={handleSelect} />`
          : `const [note, setNote] = useState(''); // in CustomersPage\n<CustomerTable\n  filter={{ status }}\n  onSelect={(id) => setSelectedId(id)}\n/>`}
      </Code>
    </Stack>
  );
}

export function Problem() {
  return <Demo fixed={false} />;
}

export function Solution() {
  return <Demo fixed />;
}
