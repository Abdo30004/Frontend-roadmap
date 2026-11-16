import { useState } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Panel, Row, Stack, Stat, useConsole } from '../../demo-kit';

export const scenario = 'A clinic booking app lists the free slots for a day. About 1% of users say the calendar is empty or shows the wrong day; on our laptops it looks fine.';
export const task = 'Open the booking page on each device in the lab. Which ones show the wrong day or an empty calendar?';
export const solutionNote = 'Same API data, but dates are parsed explicitly into parts and formatted with Intl and an explicit timeZone.';

interface Device { id: string; label: string; engine: 'lenient' | 'webkit15'; tz: string; locale: string }
const DEVICES: Device[] = [
  { id: 'mac', label: 'Chrome · macOS · London', engine: 'lenient', tz: 'Europe/London', locale: 'en-GB' },
  { id: 'iphone', label: 'Safari 15 · iPhone · London', engine: 'webkit15', tz: 'Europe/London', locale: 'en-GB' },
  { id: 'ny', label: 'Firefox · Windows · New York', engine: 'lenient', tz: 'America/New_York', locale: 'en-US' },
  { id: 'sp', label: 'Chrome · Android · São Paulo', engine: 'lenient', tz: 'America/Sao_Paulo', locale: 'pt-BR' },
  { id: 'tokyo', label: 'Chrome · Windows · Tokyo', engine: 'lenient', tz: 'Asia/Tokyo', locale: 'ja-JP' },
];

// GET /api/slots (database-style timestamps, no "T", no offset)
const API = {
  day: '2026-03-29',
  slots: [
    { id: 18, start: '2026-03-29 14:00:00', doctor: 'Dr. Lee' },
    { id: 19, start: '2026-03-29 15:30:00', doctor: 'Dr. Okafor' },
  ],
};

// Safari 15/16 only accept strict ISO 8601 here; anything else is Invalid Date.
// (We emulate that one engine rule; everything else below is your browser's real Date and Intl.)
const STRICT_ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;
function engineDate(raw: string, d: Device) {
  return d.engine === 'webkit15' && !STRICT_ISO.test(raw) ? new Date(NaN) : new Date(raw);
}

type Render = { day: string; rows: string[] } | { error: string };

// BROKEN: new Date(string) + formatting in the device's own time zone.
function renderBroken(d: Device, log: (t: string, tone?: 'bad' | 'info' | 'neutral' | 'good') => void): Render {
  try {
    const dayDate = new Date(API.day); // "2026-03-29" = midnight UTC, not midnight local
    const day = new Intl.DateTimeFormat(d.locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: d.tz }).format(dayDate);
    log(`new Date("${API.day}") → ${dayDate.toISOString()} → in ${d.tz}: "${day}"`, 'info');
    const rows = API.slots.map((s) => {
      const t = engineDate(s.start, d);
      log(`new Date("${s.start}") → ${isNaN(t.getTime()) ? 'Invalid Date' : 'ok'}`, isNaN(t.getTime()) ? 'bad' : 'neutral');
      if (isNaN(t.getTime())) throw new RangeError('Invalid time value'); // what date-fns format() does
      return `${new Intl.DateTimeFormat(d.locale, { hour: '2-digit', minute: '2-digit' }).format(t)} · ${s.doctor}`;
    });
    return { day, rows };
  } catch (e) {
    log(`${(e as Error).name}: ${(e as Error).message}  → error boundary, list empty`, 'bad');
    return { error: (e as Error).message };
  }
}

// FIXED: parse the parts explicitly, treat them as clinic wall-clock time, format in UTC.
function parseParts(raw: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(raw);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0))) : null;
}
function renderFixed(d: Device, log: (t: string, tone?: 'bad' | 'info' | 'neutral' | 'good') => void): Render {
  const fmtDay = new Intl.DateTimeFormat(d.locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const fmtTime = new Intl.DateTimeFormat(d.locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const day = fmtDay.format(parseParts(API.day)!);
  log(`parseParts("${API.day}") + Intl(timeZone: "UTC") → "${day}"`, 'good');
  const rows = API.slots.map((s) => {
    const t = parseParts(s.start);
    return `${t ? fmtTime.format(t) : 'Time unavailable'} · ${s.doctor}`;
  });
  return { day, rows };
}

function DeviceLab({ fixed }: { fixed: boolean }) {
  const [device, setDevice] = useState<Device | null>(null);
  const [view, setView] = useState<Render | null>(null);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const c = useConsole();

  const open = (d: Device) => {
    c.log(`— ${d.label} (${d.tz}, ${d.locale}) —`);
    const r = fixed ? renderFixed(d, c.log) : renderBroken(d, c.log);
    const ok = !('error' in r) && /29/.test(r.day);
    setDevice(d);
    setView(r);
    setResults((prev) => ({ ...prev, [d.id]: ok }));
  };

  const tested = Object.keys(results).length;
  const broken = Object.values(results).filter((ok) => !ok).length;

  return (
    <Stack gap={14}>
      <Panel title="Device lab">
        <Row gap={6}>
          {DEVICES.map((d) => (
            <Button key={d.id} tone={device?.id === d.id ? 'primary' : 'default'} aria-pressed={device?.id === d.id} onClick={() => open(d)}>
              {d.id in results && <span aria-hidden style={{ color: results[d.id] ? 'var(--good)' : 'var(--bad)', marginRight: 4 }}>{results[d.id] ? '✓' : '✗'}</span>}
              {d.label}
            </Button>
          ))}
        </Row>
      </Panel>

      <Browser url="book.clinic.example/slots?day=2026-03-29">
        {!view || !device ? (
          <Note>Pick a device to open the page.</Note>
        ) : 'error' in view ? (
          <Stack gap={6}>
            <strong>Available slots</strong>
            <Note>No slots available for this day.</Note>
          </Stack>
        ) : (
          <Stack gap={6}>
            <Row style={{ justifyContent: 'space-between' }}>
              <strong>{view.day}</strong>
              {!/29/.test(view.day) && <Badge tone="bad">wrong day</Badge>}
            </Row>
            {view.rows.map((r) => <div key={r} style={{ fontSize: 14 }}>{r}</div>)}
          </Stack>
        )}
      </Browser>

      <Row gap={8}>
        <Stat label="devices tested" value={`${tested}/${DEVICES.length}`} />
        <Stat label="devices broken" value={broken} tone={broken ? 'bad' : tested ? 'good' : 'neutral'} />
        <Stat label="expected day" value="Sun 29 Mar" />
      </Row>

      <Code>{fixed
        ? `const [y, m, d, hh, mm] = raw.match(/(\\d+)-(\\d+)-(\\d+)[ T](\\d+):(\\d+)/)...\nconst date = new Date(Date.UTC(y, m - 1, d, hh, mm)); // wall-clock parts\nnew Intl.DateTimeFormat(locale, { ..., timeZone: 'UTC' }).format(date)`
        : `new Date("2026-03-29")            // date-only = UTC midnight\nnew Date("2026-03-29 14:00:00")   // not ISO: engine-specific\nformat(date, 'EEE d MMM, HH:mm')  // throws on Invalid Date`}</Code>
      <Console lines={c.lines} height={140} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <DeviceLab fixed={false} />;
}

export function Solution() {
  return <DeviceLab fixed />;
}
