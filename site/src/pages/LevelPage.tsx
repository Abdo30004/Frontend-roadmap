import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LEVELS, type Level } from '../catalog';
import { QuestionSection } from '../components/QuestionSection';
import { useTranslation } from 'react-i18next';
import { META, questionId, useLabels, useLevel } from '../content';
import { useProgress } from '../progress';
import { CheckIcon } from '../components/Icons';

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
  const { t } = useTranslation();
  const label = useLabels();
  const questions = META[level];
  const full = useLevel(level);
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
      <nav className="sidebar" data-open={menuOpen || undefined} aria-label={t('levelPage.sidebarLabel', { label: label.level(level) })}>
        <h2>{label.level(level)}</h2>
        <p className="sidebar-sub">{t('levelPage.understoodCount', { count: doneCount, total: questions.length })}</p>
        <div className="side-group">
          <ul>
            {questions.map((q) => (
              <li key={q.slug}>
                <a href={`#${q.slug}`} className={active === q.slug ? 'current' : undefined} onClick={closeMenu}>
                  <span className="side-num">{String(q.num).padStart(2, '0')}</span>
                  <span>{label.short(q)}</span>
                  {isDone(questionId(q)) && <span className="side-check"><CheckIcon size={13} label={t('common.understood')} /></span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <main className="docs-main">
        <header className="docs-intro">
          <h1>{label.levelTitle(level)}</h1>
          <p>{t('levelPage.intro', { blurb: label.blurb(level), count: questions.length })}</p>
        </header>

        {full ? full.map((q) => <QuestionSection key={q.slug} q={q} />) : <p className="stage-missing" style={{ marginTop: 32 }}>{t('levelPage.loadingQuestions')}</p>}

        <div className="next-level">
          {next ? (
            <>
              <h3>{t('levelPage.next', { label: label.level(next.id) })}</h3>
              <p>{label.blurb(next.id)}</p>
              <Link className="reveal-btn" to={`/${next.id}`} style={{ textDecoration: 'none' }}>{t('levelPage.goTo', { label: label.level(next.id) })}</Link>
            </>
          ) : (
            <>
              <h3>{t('levelPage.doneTitle')}</h3>
              <p>{t('levelPage.doneText')}</p>
              <Link className="reveal-btn" to="/" style={{ textDecoration: 'none' }}>{t('levelPage.backToMap')}</Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
