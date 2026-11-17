import { lazy, Suspense, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LEVELS } from './catalog';
import { META } from './content';
import { REPO } from './site';
import { Home } from './pages/Home';
import { MenuIcon, MoonIcon, SunIcon } from './components/Icons';
import { Logo } from './components/Logo';
import { useTranslation } from 'react-i18next';
import { setLang, useLang } from './i18n';
import { useLabels } from './content';

const LevelPage = lazy(() => import('./pages/LevelPage'));
const SkillsPage = lazy(() => import('./pages/SkillsPage'));
const McpPage = lazy(() => import('./pages/McpPage'));

/** "Interview questions" in the top bar: opens on hover (mouse) or click/tap, lists the three levels. */
function QuestionsMenu({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const label = useLabels();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number>();
  const openedByHover = useRef(false);
  const onLevelPage = LEVELS.some((l) => pathname === `/${l.id}`);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return;
    onOpen();
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      ref.current?.querySelector<HTMLButtonElement>('.nav-trigger')?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Hover only for a real mouse; touch taps go through onClick.
  const enter = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    window.clearTimeout(closeTimer.current);
    if (!open) openedByHover.current = true;
    setOpen(true);
  };
  const leave = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    closeTimer.current = window.setTimeout(() => setOpen(false), 160);
  };
  const click = () => {
    // A click right after hover-open keeps the menu open instead of flipping it shut.
    if (openedByHover.current) {
      openedByHover.current = false;
      return;
    }
    setOpen((o) => !o);
  };

  return (
    <div className="nav-menu" ref={ref} data-open={open || undefined} onPointerEnter={enter} onPointerLeave={leave}>
      <button
        type="button"
        className={`nav-trigger${onLevelPage ? ' active' : ''}`}
        aria-expanded={open}
        aria-controls="questions-menu"
        onClick={click}
      >
        <span className="label-long">{t('nav.questions')}</span>
        <span className="label-short">{t('nav.questionsShort')}</span>
        <svg className="chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="nav-dropdown" id="questions-menu">
        {LEVELS.map((l) => (
          <NavLink
            key={l.id}
            to={`/${l.id}`}
            className="nav-level"
            style={{ ['--c' as string]: `var(--${l.id})` }}
            onClick={() => setOpen(false)}
          >
            <span>
              <strong>{label.level(l.id)}</strong>
              <small>
                {t('common.countQuestions', { count: META[l.id].length })} {label.blurb(l.id)}
              </small>
            </span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

type Theme = 'light' | 'dark';

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('ffg:theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* ignore */
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme-switching', '');
    root.setAttribute('data-theme', theme);
    const t = setTimeout(() => root.removeAttribute('data-theme-switching'), 50);
    try {
      localStorage.setItem('ffg:theme', theme);
    } catch {
      /* ignore */
    }
    return () => clearTimeout(t);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))] as const;
}

/** EN / FR switch: shows the language you would switch to. */
function LangSwitch() {
  const { t } = useTranslation();
  const lang = useLang();
  return (
    <button
      className="icon-btn lang-btn"
      type="button"
      onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
      aria-label={t('lang.switchLabel')}
      title={t('lang.switchLabel')}
    >
      {t('lang.switchTo')}
    </button>
  );
}

export function App() {
  const { t } = useTranslation();
  const [theme, toggleTheme] = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const isDocs = LEVELS.some((l) => pathname === `/${l.id}`);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <>
      <header className="topbar">
        {isDocs && (
          <button
            className="icon-btn menu-btn"
            aria-label={t('nav.openList')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MenuIcon size={18} />
          </button>
        )}
        <Link to="/" className="brand">
          <Logo className="brand-mark" size={30} />
          <span className="brand-name">Frontend Field Guide</span>
        </Link>
        <nav className="topnav" aria-label={t('nav.main')}>
          <NavLink to="/" end>
            {t('nav.map')}
          </NavLink>
          <QuestionsMenu onOpen={() => setMenuOpen(false)} />
          <NavLink to="/skills">{t('nav.skills')}</NavLink>
          <NavLink to="/mcp">{t('nav.mcp')}</NavLink>
        </nav>
        <a className="icon-btn" href={REPO.url} target="_blank" rel="noreferrer" aria-label={t('nav.github')} title={t('nav.github')}>
          <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
        <LangSwitch />
        <button className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? t('nav.toLight') : t('nav.toDark')}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      <Suspense
        fallback={
          <p className="stage-missing" style={{ padding: 40 }}>
            {t('common.loading')}
          </p>
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/mcp" element={<McpPage />} />
          {LEVELS.map((l) => (
            <Route
              key={l.id}
              path={`/${l.id}`}
              element={<LevelPage key={l.id} level={l.id} menuOpen={menuOpen} closeMenu={() => setMenuOpen(false)} />}
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
