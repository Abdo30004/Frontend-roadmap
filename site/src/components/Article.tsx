// Shared pieces of the long-form article pages (/skills, /mcp).
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface TocItem {
  id: string;
  title: string;
}

/** "01", "02", … from an item's position in the table of contents. */
export const tocNum = (toc: TocItem[], id: string) => String(toc.findIndex((t) => t.id === id) + 1).padStart(2, '0');

/** Turns `backticks` into <code>. */
export function rich(text: string): ReactNode {
  return text
    .split(/(`[^`]+`)/)
    .map((part, i) =>
      part.startsWith('`') && part.endsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : <Fragment key={i}>{part}</Fragment>,
    );
}

export function Install({ command }: { command: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      return; // clipboard blocked: the command is still selectable by hand
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="install">
      <span className="install-prompt" aria-hidden>
        $
      </span>
      <code>{command}</code>
      <button type="button" onClick={copy} data-copied={copied || undefined} aria-label={t('common.copyLabel', { command })}>
        {copied ? t('common.copied') : t('common.copy')}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? t('common.commandCopied') : ''}
      </span>
    </div>
  );
}

/** Section title. `toc` is accepted for call-site symmetry; numbering lives in the table of contents only. */
export function SectionHead({ id, title }: { toc?: TocItem[]; id: string; title: string }) {
  return <h2 id={`${id}-t`}>{title}</h2>;
}

/** The id of the section currently near the top of the viewport. */
export function useActiveSection(toc: TocItem[]) {
  const [active, setActive] = useState(toc[0].id);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    toc.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [toc]);
  return active;
}

/** On first render: jump to the #hash target if there is one, otherwise to the top. */
export function useScrollToHash() {
  useEffect(() => {
    const target = window.location.hash && document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, []);
}

export function TocLinks({ toc, active }: { toc: TocItem[]; active?: string }) {
  return (
    <ol>
      {toc.map((t) => (
        <li key={t.id}>
          <a href={`#${t.id}`} className={active === t.id ? 'current' : undefined}>
            <span className="n">{tocNum(toc, t.id)}</span>
            <span>{t.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Sticky "On this page" sidebar (desktop). The inline copy for small screens goes in the article header. */
export function TocAside({ toc, active }: { toc: TocItem[]; active: string }) {
  const { t } = useTranslation();
  return (
    <nav className="post-toc" aria-label={t('common.onThisPage')}>
      <p>{t('common.onThisPage')}</p>
      <TocLinks toc={toc} active={active} />
    </nav>
  );
}

export function TocInline({ toc }: { toc: TocItem[] }) {
  const { t } = useTranslation();
  return (
    <details className="post-toc-inline">
      <summary>{t('common.onThisPage')}</summary>
      <TocLinks toc={toc} />
    </details>
  );
}
