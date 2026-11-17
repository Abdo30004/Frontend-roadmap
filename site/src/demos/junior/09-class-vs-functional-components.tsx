import { Component, useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Row, Stack, Stat, useConsole } from '../../demo-kit';

export const scenario =
  'A live sports page shows the score of the selected match, pushed by a live socket, with a "Follow" button to get alerts.';
export const task =
  'Open live scores, wait for a goal, then switch to another match and watch the events. Click "Follow". Close and reopen the page a few times.';
export const solutionNote = 'Same page as a function component: one useEffect per matchId with cleanup, and no `this` to lose.';

interface Match {
  id: string;
  home: string;
  away: string;
}
interface Msg {
  matchId: string;
  home: number;
  away: number;
  text: string;
}
interface MatchSocket {
  onmessage: ((m: Msg) => void) | null;
  close: () => void;
}
interface Hub {
  open: (matchId: string) => MatchSocket;
}

const MATCHES: Match[] = [
  { id: 'ars-che', home: 'Arsenal', away: 'Chelsea' },
  { id: 'rma-bar', home: 'Real Madrid', away: 'Barcelona' },
  { id: 'aja-psv', home: 'Ajax', away: 'PSV' },
];
const MAX_SOCKETS = 4;
const byId = (id: string) => MATCHES.find((m) => m.id === id) ?? MATCHES[0];

/* ---------- BROKEN: class component ---------- */
interface Props {
  matchId: string;
  hub: Hub;
}
interface State {
  score: Msg | null;
  following: boolean;
}

class ScoreBoardClass extends Component<Props, State> {
  socket?: MatchSocket;
  state: State = { score: null, following: false };

  componentDidMount() {
    this.socket = this.props.hub.open(this.props.matchId);
    this.socket.onmessage = (msg) => this.setState({ score: msg });
  }
  // missing componentDidUpdate: a new matchId keeps the old socket
  // missing componentWillUnmount: the socket is never closed

  handleFollow() {
    this.setState({ following: true }); // `this` is undefined here
  }

  render() {
    return (
      <Board match={byId(this.props.matchId)} score={this.state.score} following={this.state.following} onFollow={this.handleFollow} />
    );
  }
}

/* ---------- FIXED: function component ---------- */
function ScoreBoard({ matchId, hub }: Props) {
  const [score, setScore] = useState<Msg | null>(null);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    setScore(null);
    const socket = hub.open(matchId);
    socket.onmessage = (msg) => setScore(msg);
    return () => socket.close(); // on unmount AND before switching match
  }, [matchId, hub]);

  return <Board match={byId(matchId)} score={score} following={following} onFollow={() => setFollowing(true)} />;
}

function Board({ match, score, following, onFollow }: { match: Match; score: Msg | null; following: boolean; onFollow: () => void }) {
  const foreign = score && score.matchId !== match.id;
  return (
    <Stack gap={8}>
      <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
        {match.home} vs {match.away}
      </span>
      <strong style={{ fontSize: 28, color: foreign ? 'var(--bad)' : 'var(--ink)', transition: 'color 200ms ease' }}>
        {score ? `${score.home} - ${score.away}` : 'Loading…'}
      </strong>
      {score && (
        <Row gap={6}>
          <span style={{ fontSize: 14 }}>{score.text}</span>
          {foreign && <Badge tone="bad">not this match!</Badge>}
        </Row>
      )}
      <Row>
        <Button tone={following ? 'primary' : 'default'} onClick={onFollow} disabled={following}>
          {following ? 'Following ✓' : 'Follow'}
        </Button>
      </Row>
    </Stack>
  );
}

function LiveScores({ fixed }: { fixed: boolean }) {
  const c = useConsole();
  const [open, setOpen] = useState(false);
  const [matchId, setMatchId] = useState(MATCHES[0].id);
  const [sockets, setSockets] = useState(0);
  const live = useRef(new Set<ReturnType<typeof setInterval>>());
  const clicked = useRef(false);

  const closeAll = () => {
    live.current.forEach(clearInterval);
    live.current.clear();
    setSockets(0);
  };

  // Simulated server push: each socket emits a goal every 1.6 s for ITS match.
  const [hub] = useState<Hub>(() => ({
    open: (id) => {
      const m = byId(id);
      const score = { home: 0, away: 0 };
      let minute = 0;
      const socket: MatchSocket = { onmessage: null, close: () => {} };
      const timer = setInterval(() => {
        minute += 7 + Math.floor(Math.random() * 6);
        const homeScores = Math.random() < 0.5;
        if (homeScores) score.home++;
        else score.away++;
        socket.onmessage?.({ matchId: id, ...score, text: `⚽ ${homeScores ? m.home : m.away} scored (${minute}')` });
      }, 1600);
      live.current.add(timer);
      setSockets(live.current.size);
      c.log(`socket opened: ${m.home} vs ${m.away}`, 'info');
      socket.close = () => {
        clearInterval(timer);
        if (live.current.delete(timer)) c.log(`socket closed: ${m.home} vs ${m.away}`, 'good');
        setSockets(live.current.size);
      };
      return socket;
    },
  }));

  useEffect(() => {
    // Mirror real uncaught errors thrown by the Follow click into the demo console.
    const onError = (e: ErrorEvent) => {
      if (!clicked.current || !String(e.message).includes('setState')) return;
      clicked.current = false; // log once per click
      c.log(`Uncaught ${String(e.error ?? e.message).replace(/^Uncaught /, '')}`, 'bad');
    };
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('error', onError);
      live.current.forEach(clearInterval);
    };
  }, [c.log]);

  const capped = !open && sockets >= MAX_SOCKETS;

  return (
    <Stack gap={14}>
      <Browser url={open ? `scores.example/live/${matchId}` : 'scores.example/'}>
        <Stack gap={12}>
          <Row gap={6}>
            {MATCHES.map((m) => (
              <Button key={m.id} tone={m.id === matchId ? 'primary' : 'ghost'} onClick={() => setMatchId(m.id)}>
                {m.home.split(' ')[0]}–{m.away.split(' ')[0]}
              </Button>
            ))}
          </Row>
          <div
            onClickCapture={() => {
              clicked.current = true;
              setTimeout(() => {
                clicked.current = false;
              }, 0);
            }}
          >
            {open ? (
              fixed ? (
                <ScoreBoard matchId={matchId} hub={hub} />
              ) : (
                <ScoreBoardClass matchId={matchId} hub={hub} />
              )
            ) : (
              <Note>Live scores are closed.</Note>
            )}
          </div>
          <Row>
            <Button onClick={() => setOpen((o) => !o)} disabled={capped}>
              {open ? 'Close live scores' : 'Open live scores'}
            </Button>
            <Button
              tone="ghost"
              onClick={() => {
                setOpen(false);
                closeAll();
                c.clear();
              }}
            >
              Reset
            </Button>
          </Row>
          {capped && <Note>Demo cap: {MAX_SOCKETS} sockets. Press Reset to close them.</Note>}
        </Stack>
      </Browser>
      <Row gap={10}>
        <Stat label="open sockets" value={sockets} tone={sockets > (open ? 1 : 0) ? 'bad' : 'good'} />
      </Row>
      <Code>
        {fixed
          ? `useEffect(() => {\n  const socket = openMatchSocket(matchId);\n  socket.onmessage = (msg) => setScore(msg);\n  return () => socket.close();\n}, [matchId]);\n<button onClick={() => setFollowing(true)}>Follow</button>`
          : `componentDidMount() {\n  this.socket = openMatchSocket(this.props.matchId);\n  this.socket.onmessage = (msg) => this.setState({ score: msg });\n}\nhandleFollow() { this.setState({ following: true }); }\n<button onClick={this.handleFollow}>Follow</button>`}
      </Code>
      <Console lines={c.lines} height={120} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <LiveScores fixed={false} />;
}

export function Solution() {
  return <LiveScores fixed />;
}
