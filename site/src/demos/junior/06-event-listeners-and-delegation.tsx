import { useEffect, useRef, useState } from 'react';
import { Browser, Button, Code, Console, Row, Stack, Stat, useConsole } from '../../demo-kit';

export const scenario = 'A webmail inbox (plain DOM code, no React) where every email row has a Delete button. More emails arrive via "Load more" and "Check new mail".';
export const task = 'Delete one email. Press "Load more" and delete a new one. Then press "Check new mail" and delete one of the older emails.';
export const solutionNote = 'Same inbox, but one click listener on the list handles every Delete button, old or new.';

const SUBJECTS = [
  'Your invoice #2291', 'Team lunch on Friday?', 'Flight check-in is open', 'Weekly report', 'Password changed',
  'New comment on your PR', 'Order shipped', 'Webinar reminder', 'Rent receipt', 'Holiday photos',
];
const MAX_ROWS = 24;

function makeRow(id: number): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'email-row';
  li.dataset.id = String(id);
  li.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid var(--line);font-size:14px;';
  const subject = document.createElement('span');
  subject.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  subject.textContent = `#${id} · ${SUBJECTS[id % SUBJECTS.length]}`;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dk-btn delete-btn';
  btn.dataset.tone = 'ghost';
  btn.dataset.id = String(id);
  btn.textContent = 'Delete';
  li.append(subject, btn);
  return li;
}

function Inbox({ fixed }: { fixed: boolean }) {
  const listRef = useRef<HTMLUListElement>(null);
  const c = useConsole();
  const [run, setRun] = useState(0);
  const [stats, setStats] = useState({ rows: 0, listeners: 0, requests: 0, dead: 0 });
  const api = useRef<{ loadMore: () => void; refresh: () => void } | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const controller = new AbortController(); // demo cleanup on Reset / unmount
    const { signal } = controller;
    const attached = new WeakMap<Element, number>();
    const deleted = new Set<string>();
    let nextId = 1;
    let requests = 0;
    let dead = 0;
    let callsThisClick = 0;

    const update = () => {
      const buttons = Array.from(list.querySelectorAll('.delete-btn'));
      const listeners = fixed ? 1 : buttons.reduce((n, b) => n + (attached.get(b) ?? 0), 0);
      setStats({ rows: buttons.length, listeners, requests, dead });
    };

    const deleteEmail = (id: string) => {
      callsThisClick++;
      requests++;
      if (deleted.has(id)) {
        c.log(`DELETE /api/emails/${id} → 404 (already deleted)`, 'bad');
      } else {
        deleted.add(id);
        c.log(`DELETE /api/emails/${id} → 204`, 'good');
        list.querySelector(`.email-row[data-id="${id}"]`)?.remove();
      }
      update();
    };

    // Instrumentation only: notices clicks on Delete that reached no handler.
    list.addEventListener('click', (e) => {
      if (!(e.target as Element).closest('.delete-btn')) return;
      callsThisClick = 0;
      setTimeout(() => {
        if (signal.aborted || callsThisClick > 0) return;
        dead++;
        c.log('click on Delete… nothing happened', 'warn');
        update();
      }, 0);
    }, { capture: true, signal });

    const appendEmails = (n: number, atTop = false) => {
      for (let i = 0; i < n && list.children.length < MAX_ROWS; i++) {
        const row = makeRow(nextId++);
        if (atTop) list.prepend(row); else list.append(row);
      }
    };

    // BROKEN: a listener per button, attached to whatever buttons exist right now
    const attachDeleteHandlers = () => {
      list.querySelectorAll<HTMLButtonElement>('.delete-btn').forEach((btn) => {
        btn.addEventListener('click', () => deleteEmail(btn.dataset.id ?? ''), { signal });
        attached.set(btn, (attached.get(btn) ?? 0) + 1);
      });
    };

    // FIXED: one listener on the list, for current and future rows
    if (fixed) {
      list.addEventListener('click', (event) => {
        const deleteBtn = (event.target as Element).closest<HTMLElement>('.delete-btn');
        if (deleteBtn) deleteEmail(deleteBtn.dataset.id ?? '');
      }, { signal });
    }

    list.textContent = '';
    appendEmails(3);
    if (!fixed) attachDeleteHandlers();
    update();

    api.current = {
      loadMore: () => {
        appendEmails(3); // new buttons get no listener in the broken version
        c.log('loaded 3 older emails', 'info');
        update();
      },
      refresh: () => {
        appendEmails(1, true);
        if (!fixed) attachDeleteHandlers(); // buttons already in the list get ANOTHER listener
        c.log('1 new email arrived', 'info');
        update();
      },
    };

    return () => {
      controller.abort();
      list.textContent = '';
    };
  }, [fixed, run, c.log]);

  const reset = () => { c.clear(); setRun((r) => r + 1); };
  const full = stats.rows >= MAX_ROWS;

  return (
    <Stack gap={14}>
      <Browser url="mail.example/inbox">
        <Stack gap={10}>
          <ul ref={listRef} style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 220, overflowY: 'auto' }} />
          <Row>
            <Button onClick={() => api.current?.loadMore()} disabled={full}>Load more</Button>
            <Button onClick={() => api.current?.refresh()} disabled={full}>Check new mail</Button>
            <Button tone="ghost" onClick={reset}>Reset</Button>
          </Row>
        </Stack>
      </Browser>
      <Row gap={10}>
        <Stat label="emails in list" value={stats.rows} />
        <Stat label="click listeners" value={stats.listeners} tone={stats.listeners === 1 ? 'good' : stats.listeners !== stats.rows ? 'bad' : 'neutral'} />
        <Stat label="dead clicks" value={stats.dead} tone={stats.dead > 0 ? 'bad' : 'good'} />
        <Stat label="DELETE requests" value={stats.requests} />
      </Row>
      <Code>{fixed
        ? `list.addEventListener('click', (event) => {\n  const btn = event.target.closest('.delete-btn');\n  if (btn) deleteEmail(btn.dataset.id);\n});`
        : `function attachDeleteHandlers() {\n  list.querySelectorAll('.delete-btn').forEach((btn) => {\n    btn.addEventListener('click', () => deleteEmail(btn.dataset.id));\n  });\n}\n// called on first render and after "Check new mail"`}</Code>
      <Console lines={c.lines} height={130} title="Network" onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <Inbox fixed={false} />;
}

export function Solution() {
  return <Inbox fixed />;
}
