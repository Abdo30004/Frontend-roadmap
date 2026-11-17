import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Row, Stack, Stat, useConsole } from '../../demo-kit';

export const scenario =
  'A news site article page picks a mobile or desktop layout from the screen size. Logged-in readers also get a "Save for later" button.';
export const task = 'Open the article, go back, repeat twice, then press "Fire resize event". Finally open the article and press "Log in".';
export const solutionNote = 'Same page, but the screen logic is a useMediaQuery hook with cleanup, and every hook runs at the top level.';

type Track = (label: string, add: () => void, remove: () => void) => () => void;
const MAX_LISTENERS = 5;
const ARTICLE = 'City opens 40 km of new bike lanes';

const HOOK_ERRORS: Record<string, string> = {
  '310': 'Rendered more hooks than during the previous render.',
  '300': 'Rendered fewer hooks than expected.',
};
const explain = (msg: string) => {
  const code = /#(\d+)/.exec(msg)?.[1];
  return code && HOOK_ERRORS[code] ? HOOK_ERRORS[code] : msg;
};

class CrashBoundary extends Component<{ children: ReactNode; onCrash: (msg: string) => void }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { error: explain(e.message) };
  }
  componentDidCatch(e: Error) {
    this.props.onCrash(explain(e.message));
  }
  render() {
    if (this.state.error) {
      return (
        <Stack gap={6}>
          <Badge tone="bad">💥 This page crashed</Badge>
          <Note>{this.state.error}</Note>
        </Stack>
      );
    }
    return this.props.children;
  }
}

function Article({ isMobile, save }: { isMobile: boolean; save: ReactNode }) {
  return (
    <Stack gap={8}>
      <strong style={{ fontSize: 18 }}>{ARTICLE}</strong>
      <Row gap={6}>
        <Badge tone="info">{isMobile ? 'mobile layout' : 'desktop layout'}</Badge>
        {save}
      </Row>
      <Note>The new lanes connect the river front with the university district…</Note>
    </Stack>
  );
}

/* ---------- BROKEN ---------- */
function BrokenArticlePage({ user, track, visit, log }: { user: boolean; track: Track; visit: number; log: (s: string) => void }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
      log(`resize handler from visit #${visit} ran`);
    };
    track(
      `resize · visit #${visit}`,
      () => window.addEventListener('resize', onResize),
      () => window.removeEventListener('resize', onResize),
    );
    // no cleanup -> listener stays after unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let save: ReactNode = null;
  if (user) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- this is the bug the demo shows
    const [saved, setSaved] = useState(false); // hook inside a condition
    save = (
      <Button onClick={() => setSaved(true)} disabled={saved}>
        {saved ? 'Saved' : 'Save for later'}
      </Button>
    );
  }
  return <Article isMobile={isMobile} save={save} />;
}

/* ---------- FIXED ---------- */
function useMediaQuery(query: string, track: Track) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    // track() returns the remover, so this is just: add listener + return cleanup
    return track(
      `matchMedia ${query}`,
      () => mql.addEventListener('change', onChange),
      () => mql.removeEventListener('change', onChange),
    );
  }, [query, track]);
  return matches;
}

function ArticlePage({ user, track }: { user: boolean; track: Track }) {
  const isMobile = useMediaQuery('(max-width: 767px)', track); // top level
  const [saved, setSaved] = useState(false); // top level, always called
  const save = user ? (
    <Button onClick={() => setSaved(true)} disabled={saved}>
      {saved ? 'Saved' : 'Save for later'}
    </Button>
  ) : null;
  return <Article isMobile={isMobile} save={save} />;
}

function NewsSite({ fixed }: { fixed: boolean }) {
  const c = useConsole();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(false);
  const [crashKey, setCrashKey] = useState(0);
  const [listeners, setListeners] = useState<string[]>([]);
  const registry = useRef(new Map<number, { label: string; remove: () => void }>());
  const nextId = useRef(0);
  const visits = useRef(0);

  const sync = () => setListeners(Array.from(registry.current.values(), (v) => v.label));
  const [track] = useState<Track>(() => (label: string, add: () => void, remove: () => void) => {
    add();
    const id = ++nextId.current;
    registry.current.set(id, { label, remove });
    sync();
    return () => {
      if (!registry.current.delete(id)) return;
      remove();
      sync();
    };
  });
  const removeAll = () => {
    registry.current.forEach((v) => v.remove());
    registry.current.clear();
    sync();
  };
  useEffect(() => () => registry.current.forEach((v) => v.remove()), []);

  const openArticle = () => {
    visits.current++;
    setOpen(true);
  };
  const reset = () => {
    removeAll();
    setOpen(false);
    setUser(false);
    setCrashKey((k) => k + 1);
    visits.current = 0;
    c.clear();
  };
  const capped = !fixed && !open && listeners.length >= MAX_LISTENERS;

  return (
    <Stack gap={14}>
      <Browser url={open ? 'news.example/city/bike-lanes' : 'news.example/'}>
        <Stack gap={12}>
          <Row style={{ justifyContent: 'space-between' }}>
            <strong>The Daily Example</strong>
            <Button tone="ghost" onClick={() => setUser((u) => !u)}>
              {user ? 'Log out' : 'Log in'}
            </Button>
          </Row>
          <CrashBoundary key={crashKey} onCrash={(m) => c.log(`Error: ${m}`, 'bad')}>
            {open ? (
              fixed ? (
                <ArticlePage user={user} track={track} />
              ) : (
                <BrokenArticlePage user={user} track={track} visit={visits.current} log={(s) => c.log(s, 'warn')} />
              )
            ) : (
              <Note>Front page · Top story: “{ARTICLE}”</Note>
            )}
          </CrashBoundary>
          <Row>
            {open ? (
              <Button
                onClick={() => {
                  setOpen(false);
                  setCrashKey((k) => k + 1);
                }}
              >
                ← Back to front page
              </Button>
            ) : (
              <Button tone="primary" onClick={openArticle} disabled={capped}>
                Open article
              </Button>
            )}
            <Button
              onClick={() => {
                c.log('window resize event fired', 'info');
                window.dispatchEvent(new Event('resize'));
              }}
            >
              Fire resize event
            </Button>
            <Button tone="ghost" onClick={reset}>
              Reset
            </Button>
          </Row>
          {capped && <Note>Demo cap: {MAX_LISTENERS} listeners. Press Reset to remove them.</Note>}
        </Stack>
      </Browser>
      <Row gap={10}>
        <Stat label="article pages open" value={open ? 1 : 0} />
        <Stat label="window/media listeners" value={listeners.length} tone={listeners.length > (open ? 1 : 0) ? 'bad' : 'good'} />
      </Row>
      <Code>
        {fixed
          ? `function useMediaQuery(query) {  // mql = matchMedia(query)\n  useEffect(() => {\n    mql.addEventListener('change', onChange);\n    return () => mql.removeEventListener('change', onChange);\n  }, [query]);\n}\nconst isMobile = useMediaQuery('(max-width: 767px)'); // top level\nconst [saved, setSaved] = useState(false);             // always called`
          : `useEffect(() => {\n  window.addEventListener('resize', onResize); // no cleanup\n}, []);\nif (user) {\n  const [saved, setSaved] = useState(false);\n}`}
      </Code>
      <Console lines={c.lines} height={120} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <NewsSite fixed={false} />;
}

export function Solution() {
  return <NewsSite fixed />;
}
