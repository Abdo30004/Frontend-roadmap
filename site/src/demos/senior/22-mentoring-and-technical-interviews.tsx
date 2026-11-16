import { useState } from 'react';
import { Badge, Browser, Button, Meter, Note, Panel, Row, Stack, Stat, Steps, usePlayer, type Tone } from '../../demo-kit';

export const scenario = 'A team just hired a junior developer and is also interviewing two candidates for a mid-level frontend role.';
export const task = 'Run the junior\'s first two weeks, then run the hiring debrief. Look at the junior\'s confidence and at who gets hired.';
export const solutionNote = 'A scoped ticket + pairing + reviews that teach; a structured exercise scored against a shared rubric.';

interface Beat { label: string; detail: string; tone: Tone; confidence: number; skills: number; seniorHours: number }

const ONBOARD_BAD: Beat[] = [
  { label: 'Ticket', detail: '"Improve search performance. Search is slow, please fix."', tone: 'warn', confidence: 60, skills: 0, seniorHours: 0 },
  { label: 'Week 1', detail: 'Lost in the codebase, afraid to ask', tone: 'warn', confidence: 45, skills: 0, seniorHours: 0 },
  { label: 'Week 2', detail: '1,200-line PR touching 19 files', tone: 'warn', confidence: 40, skills: 1, seniorHours: 2 },
  { label: 'Review', detail: '60 comments: "this is wrong, see how I\'d do it" + rewritten diff', tone: 'bad', confidence: 15, skills: 1, seniorHours: 12 },
];
const ONBOARD_GOOD: Beat[] = [
  { label: 'Ticket', detail: '"Debounce search input": context, goal, done-when, starting files', tone: 'info', confidence: 65, skills: 0, seniorHours: 0 },
  { label: 'Kickoff', detail: '30-min pairing: where things live, how to test', tone: 'info', confidence: 75, skills: 1, seniorHours: 1 },
  { label: 'PR', detail: '140 lines: useDebouncedValue hook + tests', tone: 'good', confidence: 80, skills: 2, seniorHours: 1 },
  { label: 'Review', detail: '"blocking: abort stale fetch (MDN link)" · one nit · "Nice: extracting the hook"', tone: 'good', confidence: 88, skills: 3, seniorHours: 3 },
];

const COMPETENCIES = ['React fundamentals', 'Debugging', 'Code quality', 'Communication', 'Accessibility/UX'];
const CANDIDATES = [
  { name: 'Jordan', gut: ['Strong hire. Great energy, reminded me of myself.', 'Lean hire? Seemed fine.'], scores: [2, 1, 2, 4, 2],
    later: 'Hired. 6 months later: cannot debug a useEffect loop, 3 regressions.' },
  { name: 'Priya', gut: ['No hire. Froze on the red-black tree question.', 'Not sure. Quiet.'], scores: [3, 4, 3, 3, 3],
    later: 'Rejected. Now a strong engineer at a competitor.' },
];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function Mentoring({ fixed }: { fixed: boolean }) {
  const beats = fixed ? ONBOARD_GOOD : ONBOARD_BAD;
  const player = usePlayer(beats.length, 800);
  const [debrief, setDebrief] = useState(false);
  const cur = player.step >= 0 ? beats[player.step] : null;

  // Problem: gut feel picks the best talker. Fix: rubric average, evidence first.
  const hired = fixed
    ? CANDIDATES.reduce((a, b) => (avg(b.scores) > avg(a.scores) ? b : a))
    : CANDIDATES[0];

  return (
    <Stack gap={14}>
      <Panel title="1 · The junior's first two weeks">
        <Stack gap={10}>
          <Row>
            <Button tone="primary" onClick={player.play} disabled={player.playing}>Run 2 weeks</Button>
            <Badge tone={fixed ? 'good' : 'warn'}>{fixed ? 'scoped task + pairing + teaching review' : 'deep end + rewrite their PR'}</Badge>
          </Row>
          <Steps steps={beats.map((b) => ({ label: b.label, detail: b.detail, tone: b.tone }))} active={player.step} />
          <Stack gap={6}>
            <Row style={{ justifyContent: 'space-between', fontSize: 13 }}><span>Junior's confidence</span><strong>{cur ? cur.confidence : '-'}%</strong></Row>
            <Meter value={cur?.confidence ?? 0} tone={!cur ? 'info' : cur.confidence >= 60 ? 'good' : cur.confidence >= 35 ? 'warn' : 'bad'} />
          </Stack>
          <Row gap={8}>
            <Stat label="skills learned" value={cur ? cur.skills : '-'} tone={cur && player.done ? (cur.skills >= 3 ? 'good' : 'bad') : 'neutral'} />
            <Stat label="senior hours spent" value={cur ? cur.seniorHours : '-'} tone={cur && player.done ? (cur.seniorHours > 6 ? 'bad' : 'good') : 'neutral'} />
            <Stat label="questions asked / day" value={!cur ? '-' : fixed ? 4 : player.done ? 0 : 1} tone={player.done ? (fixed ? 'good' : 'bad') : 'neutral'} />
          </Row>
        </Stack>
      </Panel>

      <Panel title="2 · Hiring debrief for a mid-level role">
        <Stack gap={10}>
          <Row>
            <Button tone="primary" onClick={() => setDebrief(true)} disabled={debrief}>Run debrief</Button>
            <Button tone="ghost" onClick={() => { setDebrief(false); player.reset(); }}>Reset</Button>
            <Badge tone={fixed ? 'good' : 'warn'}>{fixed ? 'same 90-min pairing exercise + rubric' : 'favorite puzzles + gut feel'}</Badge>
          </Row>
          <Row gap={10} align="stretch">
            {CANDIDATES.map((c) => (
              <Browser key={c.name} url={`hiring.acme.example/scorecard/${c.name.toLowerCase()}`} style={{ flex: '1 1 220px' }}>
                <Stack gap={8}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <strong>{c.name}</strong>
                    {debrief && <Badge tone={hired === c ? 'good' : 'neutral'}>{hired === c ? 'Hire' : 'No hire'}</Badge>}
                  </Row>
                  {fixed ? (
                    COMPETENCIES.map((comp, i) => (
                      <Stack key={comp} gap={2}>
                        <Row style={{ justifyContent: 'space-between', fontSize: 12 }}><span>{comp}</span><span>{debrief ? `${c.scores[i]}/4` : '?'}</span></Row>
                        <Meter value={debrief ? c.scores[i] : 0} max={4} tone={c.scores[i] >= 3 ? 'good' : c.scores[i] === 2 ? 'warn' : 'bad'} />
                      </Stack>
                    ))
                  ) : (
                    c.gut.map((g, i) => <Note key={i}>Interviewer {i === 0 ? 'A' : 'B'}: "{g}"</Note>)
                  )}
                  {debrief && fixed && <Note>Average {avg(c.scores).toFixed(1)} / 4, every score backed by notes from the exercise.</Note>}
                  {debrief && !fixed && <Badge tone={hired === c ? 'warn' : 'bad'}>{c.later}</Badge>}
                </Stack>
              </Browser>
            ))}
          </Row>
          {debrief && fixed && <Note>Priya froze on trivia but debugged the effect bug systematically. Jordan explained well but guessed. The rubric makes that visible.</Note>}
        </Stack>
      </Panel>
    </Stack>
  );
}

export function Problem() {
  return <Mentoring fixed={false} />;
}

export function Solution() {
  return <Mentoring fixed />;
}
