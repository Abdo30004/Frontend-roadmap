import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Row, Stack, Stat, useConsole } from '../../demo-kit';

export const scenario =
  'A support chat widget shows an unread counter and plays a ping for new agent messages, unless the customer turns the sound off.';
export const task =
  'Click "Agent replies" 3 times. Turn Sound off and reply again. Then switch ticket and reply. Watch the counter, pings and console.';
export const solutionNote =
  'Same widget: updater for unread, a "latest ref" for soundOn (useEffectEvent in React 19.2+), and [ticketId] as dependency.';

type Handler = (msg: string) => void;

/** Fake WebSocket server: one channel per ticket. */
function useFakeSocketServer() {
  const channels = useRef(new Map<string, Set<Handler>>());
  return useMemo(
    () => ({
      connect(ticket: string) {
        const set = channels.current.get(ticket) ?? new Set<Handler>();
        channels.current.set(ticket, set);
        let handler: Handler | null = null;
        return {
          on: (h: Handler) => {
            handler = h;
            set.add(h);
          },
          disconnect: () => {
            if (handler) set.delete(handler);
          },
        };
      },
      send(ticket: string, msg: string) {
        const set = channels.current.get(ticket);
        set?.forEach((h) => h(msg));
        return set?.size ?? 0;
      },
    }),
    [],
  );
}

const REPLIES = [
  'Hi! Looking into your order now.',
  'Could you share the order number?',
  'Thanks, refund is on its way.',
  'Anything else I can help with?',
];

function SupportChat({ fixed }: { fixed: boolean }) {
  const server = useFakeSocketServer();
  const c = useConsole();
  const [ticketId, setTicketId] = useState('1042');
  const [soundOn, setSoundOn] = useState(true);
  const [unread, setUnread] = useState(0);
  const [sent, setSent] = useState(0);
  const [sinceRead, setSinceRead] = useState(0);
  const [mutedPings, setMutedPings] = useState(0);
  const [ring, setRing] = useState(0);

  // Referee for the demo (not part of the app): what the toggle really says right now.
  const truthRef = useRef(soundOn);
  truthRef.current = soundOn;
  const playPing = () => {
    setRing((r) => r + 1);
    if (!truthRef.current) setMutedPings((n) => n + 1);
    c.log(truthRef.current ? 'playPing() 🔔' : 'playPing() 🔔 but sound is OFF', truthRef.current ? 'good' : 'bad');
  };

  // Fix helper: a ref that always holds the latest soundOn
  const soundOnRef = useRef(soundOn);
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    if (fixed) return;
    const socket = server.connect(ticketId);
    socket.on(() => {
      if (soundOn) playPing(); // always the initial value: true
      setUnread(unread + 1); // always 0 + 1 = 1
    });
    return () => socket.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!fixed) return;
    const socket = server.connect(ticketId);
    socket.on(() => {
      setUnread((n) => n + 1);
      if (soundOnRef.current) playPing();
    });
    return () => socket.disconnect();
  }, [fixed, ticketId]); // eslint-disable-line react-hooks/exhaustive-deps

  const agentReplies = () => {
    const msg = REPLIES[sent % REPLIES.length];
    setSent((n) => n + 1);
    setSinceRead((n) => n + 1);
    c.log(`agent → #${ticketId}: "${msg}"`, 'info');
    if (server.send(ticketId, msg) === 0) c.log(`nobody is listening on #${ticketId}: message lost`, 'bad');
  };

  const switchTicket = () => {
    setTicketId((t) => (t === '1042' ? '1043' : '1042'));
    setUnread(0);
    setSinceRead(0);
  };

  return (
    <Stack gap={12}>
      <Browser url="help.shopwave.example/tickets">
        <Stack gap={10}>
          <Row gap={8}>
            <strong>Ticket #{ticketId}</strong>
            <span key={ring} style={{ display: 'inline-flex', animation: ring ? 'dk-line-in 220ms ease' : undefined }}>
              <Badge tone={unread > 0 ? 'info' : 'neutral'}>{unread} unread</Badge>
            </span>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 14, marginLeft: 'auto' }}>
              <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
              Sound {soundOn ? 'on' : 'off'}
            </label>
          </Row>
          <Row gap={8}>
            <Button tone="primary" onClick={agentReplies}>
              Agent replies
            </Button>
            <Button
              onClick={() => {
                setUnread(0);
                setSinceRead(0);
              }}
            >
              Mark as read
            </Button>
            <Button tone="ghost" onClick={switchTicket}>
              Switch to #{ticketId === '1042' ? '1043' : '1042'}
            </Button>
          </Row>
        </Stack>
      </Browser>
      <Row gap={8}>
        <Stat label="new messages since read" value={sinceRead} />
        <Stat label="unread badge" value={unread} tone={unread === sinceRead ? 'good' : 'bad'} />
        <Stat label="pings while muted" value={mutedPings} tone={mutedPings > 0 ? 'bad' : 'good'} />
      </Row>
      <Code>
        {fixed
          ? `useEffect(() => {\n  const socket = connectToTicket(ticketId);\n  socket.on('message', () => {\n    setUnread((n) => n + 1);\n    if (soundOnRef.current) playPing();\n  });\n  return () => socket.disconnect();\n}, [ticketId]);`
          : `useEffect(() => {\n  const socket = connectToTicket(ticketId);\n  socket.on('message', () => {\n    if (soundOn) playPing();\n    setUnread(unread + 1);\n  });\n  return () => socket.disconnect();\n}, []);`}
      </Code>
      <Console lines={c.lines} height={120} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <SupportChat fixed={false} />;
}

export function Solution() {
  return <SupportChat fixed />;
}
