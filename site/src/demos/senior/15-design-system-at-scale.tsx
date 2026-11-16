import { useState, type CSSProperties } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Panel, Row, Stack, Stat, useConsole } from '../../demo-kit';

export const scenario = 'Three product teams (Marketing, Dashboard, Checkout) each ship their own screens. The company is rebranding its primary color from blue to green.';
export const task = 'Roll out the rebrand to all three apps, then count how many primary buttons actually changed and how many blues are left.';
export const solutionNote = 'Same screens, but every button comes from @acme/ui and reads one semantic token.';

type Team = 'Marketing' | 'Dashboard' | 'Checkout';
interface El { team: Team; label: string; raw: string; pad: string; radius: number }

// What each team copy-pasted into its own repo over the years.
const ELEMENTS: El[] = [
  { team: 'Marketing', label: 'Start free trial', raw: '#1a73e8', pad: '9px 15px', radius: 3 },
  { team: 'Marketing', label: 'Book a demo', raw: '#1A73E8', pad: '9px 15px', radius: 3 },
  { team: 'Dashboard', label: 'Save report', raw: '#1a73e8', pad: '6px 12px', radius: 6 },
  { team: 'Dashboard', label: 'Export CSV', raw: 'rgb(26,115,232)', pad: '6px 12px', radius: 6 },
  { team: 'Checkout', label: 'Pay €89.00', raw: '#1a73e8', pad: '12px 20px', radius: 4 },
  { team: 'Checkout', label: 'Apply coupon', raw: '#1b74e8', pad: '12px 20px', radius: 4 },
];
const TEAMS: Team[] = ['Marketing', 'Dashboard', 'Checkout'];

// The demo renders "hex" values through theme variables so it works in dark mode.
const OLD_BLUE = 'var(--info)';
const OFF_BLUE = 'color-mix(in srgb, var(--info) 78%, var(--ink))'; // #1b74e8: "close enough"
const BRANDS = [
  { id: 'blue', label: 'Ocean blue (old)', css: 'var(--info)', hex: '#1a73e8' },
  { id: 'green', label: 'Forest green (new)', css: 'var(--accent)', hex: '#1f7a5c' },
  { id: 'amber', label: 'Sunset amber', css: 'var(--warn)', hex: '#c27a12' },
];

function DesignSystem({ fixed }: { fixed: boolean }) {
  const [replaced, setReplaced] = useState<boolean[]>(ELEMENTS.map(() => false));
  const [brand, setBrand] = useState(BRANDS[0]);
  const c = useConsole();

  const rebrandProblem = () => {
    c.log(`each team runs: grep -rl "#1a73e8" src | xargs sed -i "s/#1a73e8/#1f7a5c/g"`, 'info');
    setReplaced(ELEMENTS.map((e) => e.raw === '#1a73e8'));
    ELEMENTS.forEach((e) => {
      if (e.raw === '#1a73e8') c.log(`${e.team}: "${e.label}" updated`, 'good');
      else c.log(`${e.team}: "${e.label}" missed, written as ${e.raw}`, 'bad');
    });
    c.log('3 PRs, 3 reviews, 3 deploys… and the screens still disagree', 'warn');
  };

  const pickBrand = (b: (typeof BRANDS)[number]) => {
    setBrand(b);
    c.log(`tokens/color.json: color.action.primary = ${b.hex} → @acme/ui 3.5.0 published`, 'info');
    c.log('Renovate bumps @acme/ui in all 3 apps; Chromatic diff approved', 'good');
  };

  const colorOf = (e: El, i: number) => {
    if (fixed) return 'var(--color-action-primary)';
    if (replaced[i]) return BRANDS[1].css;
    return e.raw === '#1b74e8' ? OFF_BLUE : OLD_BLUE;
  };

  const btnStyle = (e: El, i: number): CSSProperties => ({
    font: '600 13px var(--font-body)',
    color: 'var(--paper)',
    border: 'none',
    cursor: 'pointer',
    background: colorOf(e, i),
    padding: fixed ? 'var(--space-2) var(--space-4)' : e.pad,
    borderRadius: fixed ? 'var(--radius-md)' : e.radius,
    transition: 'background-color 250ms ease',
  });

  const colors = new Set(ELEMENTS.map(colorOf));
  const sizes = new Set(ELEMENTS.map((e) => (fixed ? 'token' : e.pad)));
  const target = fixed ? brand.css : BRANDS[1].css;
  const onBrand = fixed ? ELEMENTS.length : ELEMENTS.filter((e, i) => colorOf(e, i) === target).length;
  const tokens = { '--color-action-primary': brand.css, '--space-2': '8px', '--space-4': '16px', '--radius-md': '6px' } as CSSProperties;

  return (
    <Stack gap={14}>
      <div style={fixed ? tokens : undefined}>
        <Row gap={10} align="stretch">
          {TEAMS.map((team) => (
            <Browser key={team} url={`${team.toLowerCase()}.acme.example`} style={{ flex: '1 1 180px' }}>
              <Stack gap={10}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 14 }}>{team}</strong>
                  <Badge tone={fixed ? 'good' : 'warn'}>{fixed ? '@acme/ui ^3.4.0' : 'ui/ copied 2023'}</Badge>
                </Row>
                <Row gap={6}>
                  {ELEMENTS.map((e, i) => e.team === team && (
                    <button key={e.label} type="button" style={btnStyle(e, i)}>{e.label}</button>
                  ))}
                </Row>
              </Stack>
            </Browser>
          ))}
        </Row>
      </div>

      {fixed ? (
        <Row gap={6}>
          <Note>Brand token:</Note>
          {BRANDS.map((b) => (
            <Button key={b.id} tone={brand.id === b.id ? 'primary' : 'default'} aria-pressed={brand.id === b.id} onClick={() => pickBrand(b)}>
              <span aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: b.css, marginRight: 6 }} />
              {b.label}
            </Button>
          ))}
        </Row>
      ) : (
        <Row>
          <Button tone="primary" onClick={rebrandProblem} disabled={replaced.some(Boolean)}>Roll out rebrand (find & replace)</Button>
          <Button tone="ghost" onClick={() => { setReplaced(ELEMENTS.map(() => false)); c.clear(); }}>Reset</Button>
        </Row>
      )}

      <Row gap={8}>
        <Stat label={fixed ? `buttons on ${brand.label.split(' (')[0]}` : 'buttons on new green'} value={`${onBrand}/${ELEMENTS.length}`} tone={onBrand === ELEMENTS.length ? 'good' : replaced.some(Boolean) ? 'bad' : 'neutral'} />
        <Stat label="distinct primary colors" value={colors.size} tone={colors.size > 1 ? 'bad' : 'good'} />
        <Stat label="button sizes" value={sizes.size} tone={sizes.size > 1 ? 'warn' : 'good'} />
        <Stat label="files to edit per rebrand" value={fixed ? 1 : ELEMENTS.length} tone={fixed ? 'good' : 'warn'} />
      </Row>

      <Panel title={fixed ? 'tokens.css (generated by Style Dictionary)' : 'Checkout/PayButton.tsx'}>
        <Code>{fixed
          ? `:root { --color-action-primary: ${brand.hex}; --space-2: 8px; --space-4: 16px; }\n.primary { background: var(--color-action-primary);\n           padding: var(--space-2) var(--space-4); }`
          : `const bg = variant === 'primary' ? '#1b74e8' : '#eeeeee'; // "close enough"\n<button style={{ background: bg, padding: '12px 20px', borderRadius: 4 }}>`}</Code>
      </Panel>
      <Console lines={c.lines} height={120} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <DesignSystem fixed={false} />;
}

export function Solution() {
  return <DesignSystem fixed />;
}
