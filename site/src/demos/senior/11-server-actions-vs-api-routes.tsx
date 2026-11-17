import { useState } from 'react';
import {
  Badge,
  Browser,
  Button,
  Code,
  Input,
  Label,
  Note,
  Panel,
  Resettable,
  Row,
  Stack,
  Steps,
  usePlayer,
  type Tone,
} from '../../demo-kit';

export const scenario =
  'A multi-tenant project tool built with Next.js: only a project\'s owner sees its "Delete project" button. Two companies use it.';
export const task =
  'As Mallory, put Apollo\'s id (from a shared link) into the captured request and press "Replay". Then look at Alice\'s projects.';
export const solutionNote =
  'Same action, but it checks the session, validates input and scopes the delete by ownerId; mobile and webhooks use a Route Handler.';

interface Project {
  id: string;
  name: string;
  owner: 'alice' | 'mallory';
  org: string;
}
const INITIAL: Project[] = [
  { id: 'prj_apollo_42', name: 'Apollo', owner: 'alice', org: 'Acme' },
  { id: 'prj_vega_17', name: 'Vega', owner: 'alice', org: 'Acme' },
  { id: 'prj_zephyr_88', name: 'Zephyr', owner: 'mallory', org: 'Globex' },
];
type Step = { label: string; detail: string; tone?: Tone };

const CONSUMERS = {
  ui: {
    label: 'Our Next.js UI form',
    bug: { ok: true, text: 'Server Action: typed call, progressive enhancement' },
    fix: { ok: true, text: 'Server Action (with auth inside)' },
  },
  mobile: {
    label: 'iOS / Android app',
    bug: { ok: false, text: 'calls action ID 7f3a… → after next deploy: "Server action not found"' },
    fix: { ok: true, text: 'DELETE /api/v1/projects/:id with Bearer token, versioned' },
  },
  webhook: {
    label: 'Stripe webhook',
    bug: { ok: false, text: 'action has no stable URL and no raw body: signature cannot be verified' },
    fix: { ok: true, text: 'POST /api/webhooks/stripe: raw body + signature check' },
  },
} as const;
type ConsumerId = keyof typeof CONSUMERS;

function Tool({ fixed, reset }: { fixed: boolean; reset: () => void }) {
  const [projects, setProjects] = useState(INITIAL);
  const [target, setTarget] = useState('prj_zephyr_88');
  const [run, setRun] = useState<Step[]>([]);
  const [consumer, setConsumer] = useState<ConsumerId | null>(null);
  const player = usePlayer(run.length, 700);

  // the server action body, executed with Mallory's session cookie
  const deleteProject = (projectId: string, session: { userId: 'mallory' }) => {
    const steps: Step[] = [{ label: 'POST /projects/zephyr', detail: 'Next-Action: 7f3a… → deleteProject()' }];
    if (!fixed) {
      const hit = projects.find((p) => p.id === projectId);
      steps.push({ label: 'db.project.delete', detail: `where { id: "${projectId}" }`, tone: 'warn' });
      if (hit) setProjects((ps) => ps.filter((p) => p.id !== projectId));
      steps.push(
        hit
          ? { label: '200 OK', detail: `deleted "${hit.name}" (owner: ${hit.owner})`, tone: hit.owner === session.userId ? 'good' : 'bad' }
          : { label: '500', detail: 'record not found', tone: 'warn' },
      );
      return steps;
    }
    steps.push({ label: 'auth()', detail: `session.user = ${session.userId}`, tone: 'info' });
    if (!/^prj_[a-z]+_\d+$/.test(projectId)) {
      steps.push({ label: 'zod', detail: 'Invalid request', tone: 'bad' });
      return steps;
    }
    steps.push({ label: 'zod', detail: 'projectId valid', tone: 'good' });
    const hit = projects.find((p) => p.id === projectId && p.owner === session.userId);
    steps.push({
      label: 'deleteMany',
      detail: `where { id, ownerId: "${session.userId}" } → count ${hit ? 1 : 0}`,
      tone: hit ? 'good' : 'info',
    });
    if (hit) setProjects((ps) => ps.filter((p) => p.id !== projectId));
    steps.push(
      hit
        ? { label: 'revalidatePath', detail: `deleted "${hit.name}"`, tone: 'good' }
        : { label: '{ error }', detail: '"Project not found" (same answer for not yours / missing)', tone: 'good' },
    );
    return steps;
  };

  const replay = () => {
    setRun(deleteProject(target.trim(), { userId: 'mallory' }));
    setTimeout(player.play, 0);
  };

  const alice = projects.filter((p) => p.owner === 'alice');
  const lost = INITIAL.filter((p) => p.owner === 'alice' && !alice.some((a) => a.id === p.id));

  return (
    <Stack gap={12}>
      <Row gap={10} align="stretch">
        <Browser url="projects.example.com (Alice · Acme)" style={{ flex: '1 1 200px' }}>
          <Stack gap={6}>
            {alice.map((p) => (
              <Row key={p.id} gap={6}>
                <strong>{p.name}</strong>
                <Badge>owner: you</Badge>
              </Row>
            ))}
            {lost.map((p) => (
              <Badge key={p.id} tone="bad">
                "{p.name}" was deleted by someone else
              </Badge>
            ))}
          </Stack>
        </Browser>
        <Panel title="Mallory (Globex) · DevTools → Network → Replay" style={{ flex: '1 1 220px' }}>
          <Stack gap={8}>
            <Code>{`POST /projects/prj_zephyr_88\nNext-Action: 7f3a9c…\nCookie: session=mallory…\nBody: ["${target}"]`}</Code>
            <Label text="projectId in the body">
              <Input value={target} onChange={(e) => setTarget(e.target.value)} />
            </Label>
            <Note>Seen in a shared link: prj_apollo_42</Note>
            <Row gap={6}>
              <Button tone="danger" onClick={replay} disabled={player.playing}>
                Replay
              </Button>
              <Button tone="ghost" onClick={reset}>
                Reset
              </Button>
            </Row>
          </Stack>
        </Panel>
      </Row>

      {run.length > 0 && <Steps steps={run} active={player.step} />}

      <Code>
        {fixed
          ? `const session = await auth();\nif (!session?.user) return { error: 'Not signed in' };\nconst { projectId } = Input.parse(formData);\nawait db.project.deleteMany({\n  where: { id: projectId, ownerId: session.user.id } });`
          : `'use server';\nexport async function deleteProject(projectId) {\n  await db.project.delete({ where: { id: projectId } }); // no auth\n}\n// "security": the button is only rendered for owners`}
      </Code>

      <Panel title="Who else needs to delete projects?">
        <Stack gap={8}>
          <Row gap={6}>
            {(Object.keys(CONSUMERS) as ConsumerId[]).map((id) => (
              <Button key={id} tone={consumer === id ? 'primary' : 'default'} onClick={() => setConsumer(id)}>
                {CONSUMERS[id].label}
              </Button>
            ))}
          </Row>
          {consumer ? (
            (() => {
              const r = fixed ? CONSUMERS[consumer].fix : CONSUMERS[consumer].bug;
              return (
                <Badge tone={r.ok ? 'good' : 'bad'}>
                  {r.ok ? '✓ ' : '✕ '}
                  {r.text}
                </Badge>
              );
            })()
          ) : (
            <Note>Pick a consumer.</Note>
          )}
        </Stack>
      </Panel>
    </Stack>
  );
}

export function Problem() {
  return <Resettable>{(reset) => <Tool fixed={false} reset={reset} />}</Resettable>;
}

export function Solution() {
  return <Resettable>{(reset) => <Tool fixed reset={reset} />}</Resettable>;
}
