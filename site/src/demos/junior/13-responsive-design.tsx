import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Code, Label, Note, Row, Stack, Stat } from '../../demo-kit';

export const scenario = 'A pizza place menu page was built and checked on a laptop. Now customers open it on their phones.';
export const task = 'Drag the "Screen width" slider down to 320px. Watch the menu, the scroll indicator and the "Add" button size.';
export const solutionNote = 'Same menu, but a fluid auto-fit grid, a container query on each card and a 44px touch target.';

const ITEMS = [
  { name: 'Margherita', desc: 'Tomato, mozzarella, basil', price: '9.50' },
  { name: 'Diavola', desc: 'Spicy salami, chili oil', price: '11.00' },
  { name: 'Quattro Formaggi', desc: 'Four cheeses, honey drizzle', price: '12.50' },
];

// Real CSS. Classes are prefixed so they cannot leak into the rest of the site.
const CSS = `
.rd13-frame { border: 2px solid var(--line-2); border-radius: 14px; background: var(--paper); overflow-x: auto; }
.rd13-head { padding: 10px 12px; font-weight: 700; border-bottom: 1px solid var(--line); }
.rd13-item { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); padding: 10px; }
.rd13-thumb { display: grid; place-items: center; font-size: 28px; background: var(--warn-soft); border-radius: 8px; height: 56px; }
.rd13-body { display: block; }
.rd13-body h4 { margin: 8px 0 2px; font-size: 15px; }
.rd13-body p { margin: 0 0 8px; font-size: 13px; color: var(--ink-3); }

/* ---- the bug: desktop-first, fixed pixel widths ---- */
.rd13-bad .rd13-menu { display: flex; padding: 12px; }
.rd13-bad .rd13-item { width: 190px; flex: none; margin-right: 14px; }
.rd13-bad .rd13-add { font-size: 11px; padding: 2px 6px; border: none; background: none; color: var(--accent); text-decoration: underline; cursor: pointer; }

/* ---- the fix: mobile-first, fluid grid, container query ---- */
.rd13-good .rd13-menu { display: grid; gap: 12px; padding: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr)); }
.rd13-good .rd13-item { container-type: inline-size; }
@container (min-width: 15rem) {
  .rd13-good .rd13-body { display: flex; gap: 12px; align-items: center; }
  .rd13-good .rd13-thumb { flex: 0 0 64px; }
}
.rd13-good .rd13-add { min-height: 44px; min-width: 44px; padding: 10px 16px; font: 600 15px var(--font-body); border-radius: 8px; border: none; background: var(--accent); color: var(--paper); cursor: pointer; }
`;

interface Metrics {
  frame: number;
  overflow: number;
  columns: number;
  btn: number;
}

function MenuPage({ fixed }: { fixed: boolean }) {
  const [pct, setPct] = useState(100); // 0 = 320px, 100 = full width
  const [cart, setCart] = useState(0);
  const [m, setM] = useState<Metrics>({ frame: 0, overflow: 0, columns: 0, btn: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Measure the real layout every time the frame resizes.
  useEffect(() => {
    const frame = frameRef.current;
    const menu = menuRef.current;
    if (!frame || !menu) return;
    const measure = () => {
      const items = Array.from(menu.querySelectorAll<HTMLElement>('.rd13-item'));
      const firstTop = items[0]?.offsetTop ?? 0;
      const btn = menu.querySelector<HTMLElement>('.rd13-add');
      setM({
        frame: Math.round(frame.clientWidth),
        overflow: Math.max(0, Math.round(frame.scrollWidth - frame.clientWidth)),
        columns: items.filter((el) => el.offsetTop === firstTop).length,
        btn: btn ? Math.round(btn.getBoundingClientRect().height) : 0,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    ro.observe(menu);
    return () => ro.disconnect();
  }, []);

  const width = `calc(320px + (100% - 320px) * ${pct / 100})`;

  return (
    <Stack gap={14}>
      <style>{CSS}</style>
      <Label text={`Screen width: ${m.frame}px`}>
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          aria-label="Screen width"
          style={{ width: '100%', maxWidth: 300, accentColor: 'var(--accent)' }}
        />
      </Label>

      <div style={{ overflowX: 'auto' }}>
        <div className={fixed ? 'rd13-good' : 'rd13-bad'} style={{ width, minWidth: 320 }}>
          <Browser url="pizzaplace.example/menu">
            <div className="rd13-frame" ref={frameRef}>
              <div className="rd13-head">
                🍕 Pizza Place · Menu <span style={{ float: 'right', fontWeight: 500 }}>Cart: {cart}</span>
              </div>
              <div className="rd13-menu" ref={menuRef}>
                {ITEMS.map((it) => (
                  <div className="rd13-item" key={it.name}>
                    <div className="rd13-body">
                      <div className="rd13-thumb" aria-hidden>
                        🍕
                      </div>
                      <div>
                        <h4>{it.name}</h4>
                        <p>
                          {it.desc} · €{it.price}
                        </p>
                        <button type="button" className="rd13-add" onClick={() => setCart((c) => c + 1)}>
                          Add to cart
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Browser>
        </div>
      </div>

      <Row gap={8}>
        <Stat label="hidden sideways (px)" value={m.overflow} tone={m.overflow > 0 ? 'bad' : 'good'} />
        <Stat label="columns" value={m.columns} />
        <Stat label="Add button height (px)" value={m.btn} tone={m.btn >= 44 ? 'good' : 'bad'} />
      </Row>
      <Row gap={6}>
        {m.overflow > 0 ? (
          <Badge tone="bad">Horizontal scroll: the user must swipe sideways to see the menu</Badge>
        ) : (
          <Badge tone="good">Everything fits, no sideways scroll</Badge>
        )}
        {m.btn < 44 && <Badge tone="warn">Touch target below 44px</Badge>}
      </Row>
      {!fixed && <Note>Tip: at full width it looks fine. That is the only width it was tested at.</Note>}

      <Code>
        {fixed
          ? `.menu { display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr)); }\n.menu-item { container-type: inline-size; }\n@container (min-width: 15rem) { .body { display: flex; } }\n.add-btn { min-height: 44px; min-width: 44px; }`
          : `.menu { display: flex; }\n.menu-item { width: 190px; margin-right: 14px; } /* x3 = 612px */\n.add-btn { font-size: 11px; padding: 2px 6px; }`}
      </Code>
    </Stack>
  );
}

export function Problem() {
  return <MenuPage fixed={false} />;
}

export function Solution() {
  return <MenuPage fixed />;
}
