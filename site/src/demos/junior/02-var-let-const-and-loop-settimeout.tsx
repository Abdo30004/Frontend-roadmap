import { useState } from 'react';
import { Badge, Browser, Button, Code, Console, Row, Stack, useConsole } from '../../demo-kit';

export const scenario = 'A food-delivery tracker lights up the 3 order steps one second apart.';
export const task = 'Press "Start tracking" and watch the steps and the console.';
export const solutionNote = 'Same loop, but with let: every timer callback gets its own i.';

const STEPS = ['Received', 'Cooking', 'On the way'];

function Tracker({ fixed }: { fixed: boolean }) {
  const [lit, setLit] = useState<boolean[]>([false, false, false]);
  const c = useConsole();

  const light = (i: number) => {
    if (STEPS[i] === undefined) {
      c.log(`TypeError: Cannot read properties of undefined (steps[${i}])`, 'bad');
      return;
    }
    c.log(`step ${i} → "${STEPS[i]}" is now active`, 'good');
    setLit((prev) => prev.map((v, idx) => (idx === i ? true : v)));
  };

  const start = () => {
    setLit([false, false, false]);
    c.clear();
    if (fixed) {
      for (let i = 0; i < STEPS.length; i++) {
        setTimeout(() => light(i), (i + 1) * 700);
      }
    } else {
      // The real bug: one shared `var i` for the whole loop.
      // eslint-disable-next-line no-var -- this is the bug the demo shows
      for (var i = 0; i < STEPS.length; i++) {
        setTimeout(() => light(i), (i + 1) * 700);
      }
    }
    c.log('loop finished (timers are still waiting)', 'info');
  };

  return (
    <Stack gap={14}>
      <Browser url="eats.example/orders/4821">
        <Stack gap={12}>
          <Row gap={8}>
            {STEPS.map((s, i) => (
              <Badge key={s} tone={lit[i] ? 'good' : 'neutral'}>
                {lit[i] ? '● ' : '○ '}
                {s}
              </Badge>
            ))}
          </Row>
          <Row>
            <Button tone="primary" onClick={start}>
              Start tracking
            </Button>
          </Row>
        </Stack>
      </Browser>
      <Code>
        {fixed
          ? `for (let i = 0; i < steps.length; i++) {\n  setTimeout(() => light(i), (i + 1) * 700);\n}`
          : `for (var i = 0; i < steps.length; i++) {\n  setTimeout(() => light(i), (i + 1) * 700);\n}`}
      </Code>
      <Console lines={c.lines} height={130} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <Tracker fixed={false} />;
}

export function Solution() {
  return <Tracker fixed />;
}
