import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LEVELS, type Level } from '../catalog';
import { QuestionSection } from '../components/QuestionSection';
import { META, questionId, useLevel } from '../content';
import { useProgress } from '../progress';

function useActiveSection(ids: string[], ready: boolean) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-70px 0px -65% 0px' },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [ids, ready]);
  return active;
}

export default function LevelPage({ level, menuOpen, closeMenu }: { level: Level; menuOpen: boolean; closeMenu: () => void }) {
  const questions = META[level];
  const full = useLevel(level);
  const meta = LEVELS.find((l) => l.id === level)!;
  const next = LEVELS[LEVELS.findIndex((l) => l.id === level) + 1];
  const { isDone } = useProgress();
  const { hash } = useLocation();
  const [ids] = useState(() => questions.map((q) => q.slug));
  const active = useActiveSection(ids, !!full);
  const doneCount = questions.filter((q) => isDone(questionId(q))).length;

  // Jump to #slug once the questions are on the page.
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    if (!full) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [level, hash, full]);

  return (
    <div className="docs" style={{ ['--c' as string]: `var(--${level})` }}>
      <div className="sidebar-backdrop" data-open={menuOpen || undefined} onClick={closeMenu} />
      <nav className="sidebar" data-open={menuOpen || undefined} aria-label={`${meta.label} questions`}>
        <h2><i className="lvl-dot" />{meta.label}</h2>
        <p className="sidebar-sub">{doneCount} / {questions.length} understood</p>
        <div className="side-group">
          <ul>
            {questions.map((q) => (
              <li key={q.slug}>
                <a href={`#${q.slug}`} className={active === q.slug ? 'current' : undefined} onClick={closeMenu}>
                  <span className="side-num">{String(q.num).padStart(2, '0')}</span>
                  <span>{q.short}</span>
                  {isDone(questionId(q)) && <span className="side-check" aria-label="understood">✓</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <main className="docs-main">
        <header className="docs-intro">
          <p className="eyebrow">Level</p>
          <h1><i className="lvl-dot" style={{ width: 14, height: 14 }} />{meta.label} questions</h1>
          <p>{meta.blurb} {questions.length} questions. Each one has a live bug, a hidden answer and a live fix.</p>
        </header>

        {full ? full.map((q) => <QuestionSection key={q.slug} q={q} />) : <p className="stage-missing" style={{ marginTop: 32 }}>Loading questions…</p>}

        <div className="next-level">
          {next ? (
            <>
              <h3>Next: {next.label}</h3>
              <p>{next.blurb}</p>
              <Link className="reveal-btn" to={`/${next.id}`} style={{ textDecoration: 'none' }}>Go to {next.label} →</Link>
            </>
          ) : (
            <>
              <h3>That is the whole map.</h3>
              <p>Go back to the map and pick anything you have not marked as understood yet.</p>
              <Link className="reveal-btn" to="/" style={{ textDecoration: 'none' }}>Back to the map →</Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
