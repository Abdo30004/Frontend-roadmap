import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Browser, Button, Code, Row, Stack, Stat } from '../../demo-kit';

export const scenario = 'A real-estate site lists homes as cards next to a filters sidebar. Each card has a photo, address, price and a "Contact agent" button.';
export const task = 'Look at the last row of cards, the "Contact agent" buttons, and scroll sideways. Try 4, 5 and 7 listings.';
export const solutionNote = 'Same markup: Grid for the page and the card gallery, a flex column inside each card.';

const LISTINGS = [
  { address: '12 Oak Lane', price: '$450,000', text: '3 bed · garden' },
  { address: 'Wolfeschlegelsteinhausenbergerdorffstrasse 12', price: '$615,000', text: '4 bed · double garage · solar panels · near schools' },
  { address: '8 Harbour View', price: '$389,000', text: '2 bed' },
  { address: '41 Mill Road, Unit 3', price: '$299,000', text: '1 bed · balcony · lift · gym in the building' },
  { address: '5 Elm Court', price: '$520,000', text: '3 bed · pool' },
  { address: '77 Station St', price: '$410,000', text: '2 bed · renovated kitchen' },
  { address: '2 Cliff Walk', price: '$980,000', text: '5 bed · sea view' },
];

// Real CSS, scoped by class prefix. Only the layout rules differ between the two versions.
const CSS = `
.j12-scroll { overflow-x: auto; }
.j12-filters { padding: 8px; border: 1px solid var(--line); border-radius: 8px; background: var(--paper-2); font-size: 13px; }
.j12-card { border: 1px solid var(--line); border-radius: 8px; padding: 8px; background: var(--surface); font-size: 13px; }
.j12-card h4 { margin: 6px 0 2px; font-size: 14px; }
.j12-card p { margin: 0 0 6px; color: var(--ink-2); }
.j12-img { height: 44px; border-radius: 6px; background: var(--paper-2); }

/* BROKEN */
.j12-page[data-v="broken"] { display: flex; }
.j12-page[data-v="broken"] .j12-filters { width: 96px; }
.j12-page[data-v="broken"] .j12-listings { display: flex; flex-wrap: wrap; }
.j12-page[data-v="broken"] .j12-card { flex: 1 1 30%; margin: 6px; }

/* FIXED */
.j12-page[data-v="fixed"] { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px; }
@media (max-width: 600px) { .j12-page[data-v="fixed"] { grid-template-columns: minmax(0, 1fr); } }
.j12-page[data-v="fixed"] .j12-listings { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }
.j12-page[data-v="fixed"] .j12-card { display: flex; flex-direction: column; min-width: 0; }
.j12-page[data-v="fixed"] .j12-card h4 { overflow-wrap: anywhere; }
.j12-page[data-v="fixed"] .j12-card button { margin-top: auto; }
`;

interface Check { widths: number; misaligned: number; overflow: boolean }

function measure(scroll: HTMLElement): Check {
  const cards = Array.from(scroll.querySelectorAll<HTMLElement>('.j12-card'));
  const widths = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().width)));
  const rows = new Map<number, number[]>();
  for (const card of cards) {
    const top = Math.round(card.getBoundingClientRect().top);
    const btn = card.querySelector('button');
    if (!btn) continue;
    rows.set(top, [...(rows.get(top) ?? []), btn.getBoundingClientRect().top]);
  }
  let misaligned = 0;
  rows.forEach((tops) => { if (Math.max(...tops) - Math.min(...tops) > 1) misaligned++; });
  return { widths: widths.size, misaligned, overflow: scroll.scrollWidth > scroll.clientWidth + 1 };
}

function Listings({ fixed }: { fixed: boolean }) {
  const [count, setCount] = useState(5);
  const [check, setCheck] = useState<Check>({ widths: 1, misaligned: 0, overflow: false });
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (scrollRef.current) setCheck(measure(scrollRef.current));
  }, [count]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCheck(measure(el)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <Stack gap={14}>
      <style>{CSS}</style>
      <Browser url="homes.example/search?city=springfield">
        <div className="j12-scroll" ref={scrollRef}>
          <div className="j12-page" data-v={fixed ? 'fixed' : 'broken'}>
            <aside className="j12-filters">Filters<br />Price · Beds · Type</aside>
            <section className="j12-listings">
              {LISTINGS.slice(0, count).map((l) => (
                <article className="j12-card" key={l.address}>
                  <div className="j12-img" aria-hidden />
                  <h4>{l.address}</h4>
                  <p>{l.price} · {l.text}</p>
                  <button type="button" className="dk-btn" data-tone="primary">Contact agent</button>
                </article>
              ))}
            </section>
          </div>
        </div>
      </Browser>
      <Row>
        {[4, 5, 7].map((n) => (
          <Button key={n} tone={n === count ? 'primary' : 'default'} onClick={() => setCount(n)}>{n} listings</Button>
        ))}
      </Row>
      <Row gap={10}>
        <Stat label="different card widths" value={check.widths} tone={check.widths > 1 ? 'bad' : 'good'} />
        <Stat label="rows with uneven buttons" value={check.misaligned} tone={check.misaligned > 0 ? 'bad' : 'good'} />
        <Stat label="sideways scroll" value={check.overflow ? 'yes' : 'no'} tone={check.overflow ? 'bad' : 'good'} />
      </Row>
      <Code>{fixed
        ? `.page     { display: grid; grid-template-columns: 96px minmax(0, 1fr); }\n.listings { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }\n.card     { display: flex; flex-direction: column; min-width: 0; }\n.card h4  { overflow-wrap: anywhere; }\n.card button { margin-top: auto; }`
        : `.page     { display: flex; }\n.filters  { width: 96px; }\n.listings { display: flex; flex-wrap: wrap; }\n.card     { flex: 1 1 30%; margin: 6px; }`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <Listings fixed={false} />;
}

export function Solution() {
  return <Listings fixed />;
}
