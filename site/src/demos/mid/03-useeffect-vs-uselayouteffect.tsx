import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Note, Row, Stack, Stat } from '../../demo-kit';

export const scenario =
  'A SaaS analytics chart shows a tooltip when you hover a data point. Near the right edge, the tooltip should flip to the left side.';
export const task =
  'Hover (or tap) the last data points on the right of the chart several times. Watch the tooltip and the "frames painted off-chart" counter.';
export const solutionNote = 'Same tooltip and same measuring code, but it runs in useLayoutEffect: before the browser paints.';

const POINTS = [
  { x: 0.06, y: 0.7, v: 1240 },
  { x: 0.2, y: 0.55, v: 1810 },
  { x: 0.34, y: 0.62, v: 1530 },
  { x: 0.48, y: 0.38, v: 2470 },
  { x: 0.62, y: 0.45, v: 2190 },
  { x: 0.76, y: 0.25, v: 3020 },
  { x: 0.88, y: 0.32, v: 2760 },
  { x: 0.96, y: 0.15, v: 3480 },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
const H = 150;

/** Simulates a slower laptop: ~120ms of blocking work before the measurement. Bounded. */
function busy(ms: number) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    /* heavy chart work */
  }
}

interface Anchor {
  i: number;
  x: number;
  y: number;
}

function Tooltip({ anchor, chartW, fixed, onFrames }: { anchor: Anchor; chartW: number; fixed: boolean; onFrames: (bad: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(anchor.x + 10); // first guess: to the right of the point

  const place = () => {
    busy(120);
    const width = ref.current?.offsetWidth ?? 0;
    const fitsRight = anchor.x + 10 + width <= chartW;
    setLeft(fitsRight ? anchor.x + 10 : anchor.x - width - 10);
  };
  // The only difference between the two versions:
  useEffect(() => {
    if (!fixed) place();
  }, [anchor]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (fixed) place();
  }, [anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detector: requestAnimationFrame runs right before each paint. Count painted frames where the tooltip sticks out.
  useLayoutEffect(() => {
    let bad = 0;
    let n = 0;
    let raf = 0;
    const check = () => {
      const el = ref.current;
      if (el && el.offsetLeft + el.offsetWidth > chartW + 1) bad++;
      if (++n < 12) raf = requestAnimationFrame(check);
      else onFrames(bad);
    };
    raf = requestAnimationFrame(check);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const p = POINTS[anchor.i];
  return (
    <div
      ref={ref}
      role="tooltip"
      style={{
        position: 'absolute',
        top: Math.max(4, anchor.y - 28),
        left,
        width: 150,
        padding: '6px 10px',
        borderRadius: 8,
        background: 'var(--ink)',
        color: 'var(--paper)',
        fontSize: 12,
        pointerEvents: 'none',
        boxShadow: '0 4px 12px color-mix(in srgb, var(--ink) 20%, transparent)',
      }}
    >
      <strong>{MONTHS[anchor.i]} 2026</strong>
      <div>Revenue: ${p.v.toLocaleString()}</div>
    </div>
  );
}

function Chart({ fixed }: { fixed: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [hovers, setHovers] = useState(0);
  const [badFrames, setBadFrames] = useState(0);
  const [last, setLast] = useState<number | null>(null);
  const chartW = boxRef.current?.clientWidth ?? 300;

  const show = (i: number) => {
    const w = boxRef.current?.clientWidth ?? 300;
    if (anchor?.i === i) return;
    setAnchor({ i, x: POINTS[i].x * w, y: POINTS[i].y * H });
    setHovers((h) => h + 1);
  };

  return (
    <Stack gap={12}>
      <Browser url="insights.example/reports/revenue">
        <Stack gap={8}>
          <Row gap={8}>
            <strong>Monthly revenue</strong>
            <Badge tone="info">2026</Badge>
          </Row>
          <div
            ref={boxRef}
            onPointerLeave={() => setAnchor(null)}
            style={{
              position: 'relative',
              height: H,
              overflow: 'hidden',
              borderRadius: 8,
              background: 'var(--paper-2)',
              border: '1px dashed var(--line-2)',
            }}
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <polyline
                points={POINTS.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {POINTS.map((p, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${MONTHS[i]}: $${p.v}`}
                onPointerEnter={() => show(i)}
                onFocus={() => show(i)}
                style={{
                  position: 'absolute',
                  left: `${p.x * 100}%`,
                  top: p.y * H,
                  width: 22,
                  height: 22,
                  margin: '-11px 0 0 -11px',
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: anchor?.i === i ? 'var(--ink)' : 'var(--accent)',
                    transition: 'background-color 160ms ease',
                  }}
                />
              </button>
            ))}
            {anchor && (
              <Tooltip
                key={anchor.i}
                anchor={anchor}
                chartW={chartW}
                fixed={fixed}
                onFrames={(bad) => {
                  setLast(bad);
                  setBadFrames((b) => b + bad);
                }}
              />
            )}
          </div>
          <Note>The dashed box is the chart area. A tooltip should never be cut off by its edge.</Note>
        </Stack>
      </Browser>
      <Row gap={8}>
        <Stat label="hovers" value={hovers} />
        <Stat label="frames painted off-chart (total)" value={badFrames} tone={badFrames > 0 ? 'bad' : hovers > 0 ? 'good' : 'neutral'} />
        <Stat label="last hover" value={last === null ? '–' : last} tone={last ? 'bad' : 'neutral'} />
        <Button
          tone="ghost"
          onClick={() => {
            setHovers(0);
            setBadFrames(0);
            setLast(null);
          }}
        >
          Reset
        </Button>
      </Row>
      <Code>{`${fixed ? 'useLayoutEffect' : 'useEffect'}(() => {   // ${fixed ? 'before paint' : 'after paint'}
  const { width } = ref.current.getBoundingClientRect();
  if (anchor.x + 10 + width > chartWidth) setLeft(anchor.x - width - 10);
}, [anchor]);`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <Chart fixed={false} />;
}

export function Solution() {
  return <Chart fixed />;
}
