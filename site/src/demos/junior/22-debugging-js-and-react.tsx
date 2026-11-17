import { useEffect, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Panel, Row, Stack, Stat, Steps, fakeRequest, useConsole, type Tone } from '../../demo-kit';

export const scenario = 'A support dashboard: agents click a ticket on the left and read its messages on the right before replying.';
export const task = 'Click ticket #101, then quickly (within a second) #102. Compare the header with the messages. Then read the console.';
export const solutionNote =
  'Same panel, but the effect aborts the previous request in its cleanup. Logpoints and the Network panel show why.';

interface Msg {
  id: string;
  ticketId: number;
  from: string;
  text: string;
}
const TICKETS = [
  { id: 101, customer: 'Lena', subject: 'Parcel arrived damaged', delay: 1500 },
  { id: 102, customer: 'Omar', subject: 'Refund not received', delay: 350 },
  { id: 103, customer: 'Priya', subject: 'Change delivery address', delay: 700 },
];
const MESSAGES: Record<number, Msg[]> = {
  101: [
    { id: 'm1', ticketId: 101, from: 'Lena', text: 'The box was crushed and the lamp is broken.' },
    { id: 'm2', ticketId: 101, from: 'Lena', text: 'Photos attached.' },
  ],
  102: [{ id: 'm3', ticketId: 102, from: 'Omar', text: 'I returned the jacket 3 weeks ago, still no refund.' }],
  103: [{ id: 'm4', ticketId: 103, from: 'Priya', text: 'Please deliver to my office instead.' }],
};
const fetchMessages = (id: number, signal?: AbortSignal) =>
  fakeRequest(MESSAGES[id], { delay: TICKETS.find((t) => t.id === id)!.delay, signal });

type Net = { id: number; status: 'pending' | 'done' | 'aborted' };

function TicketPanel({
  ticketId,
  fixed,
  log,
  onNet,
}: {
  ticketId: number;
  fixed: boolean;
  log: (t: string, tone?: Tone) => void;
  onNet: (n: Net) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);

  useEffect(() => {
    onNet({ id: ticketId, status: 'pending' });
    if (!fixed) {
      // The original code, plus the "debugging" a junior added:
      log(`loading ${ticketId}`);
      fetchMessages(ticketId).then((data) => {
        log('got data');
        onNet({ id: ticketId, status: 'done' });
        setMessages(data); // whichever response arrives LAST wins
      });
      return;
    }
    const controller = new AbortController();
    fetchMessages(ticketId, controller.signal)
      .then((data) => {
        onNet({ id: ticketId, status: 'done' });
        log(`logpoint setMessages → ticketId=${ticketId}, data[0].ticketId=${data[0]?.ticketId}`, 'good');
        setMessages(data);
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') throw err;
        onNet({ id: ticketId, status: 'aborted' });
        log(`logpoint cleanup → request for #${ticketId} aborted, its response is ignored`, 'info');
      });
    return () => controller.abort(); // runs when ticketId changes or on unmount
  }, [ticketId, fixed, log, onNet]);

  const t = TICKETS.find((x) => x.id === ticketId)!;
  const wrong = messages.length > 0 && messages[0].ticketId !== ticketId;
  return (
    <Stack gap={8}>
      <strong>
        Ticket #{ticketId} · {t.customer}
      </strong>
      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t.subject}</div>
      {messages.map((m) => (
        <div key={m.id} style={{ fontSize: 13, padding: '6px 10px', borderRadius: 8, background: 'var(--paper-2)' }}>
          <b>{m.from}:</b> {m.text}
        </div>
      ))}
      <Row gap={8}>
        <Stat
          label="messages belong to"
          value={messages.length ? `#${messages[0].ticketId}` : '-'}
          tone={!messages.length ? 'neutral' : wrong ? 'bad' : 'good'}
        />
        {wrong && (
          <Badge tone="bad">
            Reply would go to {messages[0].from}, not {t.customer}
          </Badge>
        )}
      </Row>
    </Stack>
  );
}

function SupportDesk({ fixed }: { fixed: boolean }) {
  const [ticketId, setTicketId] = useState(103);
  const [net, setNet] = useState<Net[]>([]);
  const c = useConsole();
  const [onNet] = useState(
    () => (n: Net) =>
      setNet((prev) => {
        const rest = prev.filter((p) => !(p.id === n.id && p.status === 'pending'));
        return [...rest, n].slice(-6);
      }),
  );

  return (
    <Stack gap={14}>
      <Browser url="support.example/inbox">
        <Row gap={12} align="flex-start">
          <Stack gap={6} style={{ flex: '0 1 130px' }}>
            {TICKETS.map((t) => (
              <Button
                key={t.id}
                tone={t.id === ticketId ? 'primary' : 'default'}
                onClick={() => setTicketId(t.id)}
                style={{ textAlign: 'left' }}
              >
                #{t.id} {t.customer}
              </Button>
            ))}
          </Stack>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <TicketPanel ticketId={ticketId} fixed={fixed} log={c.log} onNet={onNet} />
          </div>
        </Row>
      </Browser>

      {fixed && (
        <Panel title="DevTools · Network (Slow 4G)">
          <Row gap={6}>
            {net.map((n, i) => (
              <Badge key={i} tone={n.status === 'done' ? 'good' : n.status === 'aborted' ? 'warn' : 'info'}>
                GET /tickets/{n.id}/messages · {n.status === 'aborted' ? '(canceled)' : n.status}
              </Badge>
            ))}
          </Row>
        </Panel>
      )}
      <Console title={fixed ? 'Console (logpoints)' : 'Console'} lines={c.lines} height={130} onClear={c.clear} />

      {fixed ? (
        <>
          <Steps
            active={3}
            steps={[
              { label: 'Reproduce', detail: 'Throttle to Slow 4G, click #101 then #102' },
              { label: 'Observe', detail: 'Network: #101 finishes after #102' },
              { label: 'Verify', detail: 'Logpoint on setMessages printed "102, 101"', tone: 'warn' },
              { label: 'Fix', detail: 'Abort the old request in the cleanup', tone: 'good' },
            ]}
          />
          <Code>{`useEffect(() => {\n  const controller = new AbortController();\n  fetchMessages(ticketId, { signal: controller.signal })\n    .then(setMessages)\n    .catch((e) => { if (e.name !== "AbortError") setError(e); });\n  return () => controller.abort(); // stale request can't win\n}, [ticketId]);`}</Code>
        </>
      ) : (
        <Code>{`useEffect(() => {\n  console.log("loading", ticketId);\n  fetchMessages(ticketId).then((data) => {\n    console.log("got data");\n    setMessages(data);\n  });\n}, [ticketId]);`}</Code>
      )}
    </Stack>
  );
}

export function Problem() {
  return <SupportDesk fixed={false} />;
}

export function Solution() {
  return <SupportDesk fixed />;
}
