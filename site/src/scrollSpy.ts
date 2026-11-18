import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** Where a #hash jump puts the top of a section. Matches `html { scroll-padding-top }` in global.css. */
const TOP = 76;
/** A section becomes the current one once its top passes this line, a little under the top bar. */
const LINE = TOP + 40;
/** Stop holding a jumped-to section in place after this long, even if the reader never touched the page. */
const PIN_MAX_MS = 5000;

/**
 * The id of the section the reader is on, for highlighting it in a sidebar or table of contents.
 *
 * - It is the last section whose top has passed just under the top bar, measured from the real positions
 *   on every scroll and every layout change.
 * - After a jump to `#id` (a sidebar click or a link from the map), that section stays the current one and is
 *   kept at the top while content above it is still loading and changing height (the lazy demos do).
 *   This stops as soon as the reader scrolls, taps, clicks or presses a key.
 */
export function useScrollSpy(ids: string[], ready = true): string {
  const [active, setActive] = useState(ids[0] ?? '');
  const { hash } = useLocation();
  const pinned = useRef<string | null>(null);
  const key = ids.join('|');

  useEffect(() => {
    const list = key ? key.split('|') : [];
    let pinTimer = 0;

    const sections = () => list.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);

    const compute = () => {
      if (pinned.current) return setActive(pinned.current);
      const els = sections();
      if (!els.length) return;
      const doc = document.documentElement;
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= doc.scrollHeight - 2) {
        // At the very bottom the last sections can't reach the top bar, so the last one wins.
        return setActive(els[els.length - 1].id);
      }
      let current = els[0];
      for (const el of els) {
        if (el.getBoundingClientRect().top <= LINE) current = el;
        else break;
      }
      setActive(current.id);
    };
    // Scroll events already arrive at most once per frame, and this only measures ~25 boxes, so it runs directly.
    const schedule = compute;

    // Keep the jumped-to section at the top while the page above it settles.
    const align = () => {
      const el = pinned.current && document.getElementById(pinned.current);
      if (el && Math.abs(el.getBoundingClientRect().top - TOP) > 2) el.scrollIntoView();
    };
    const release = () => {
      if (!pinned.current) return;
      pinned.current = null;
      window.clearTimeout(pinTimer);
      schedule();
    };
    const pin = (id: string) => {
      if (!list.includes(id)) return;
      pinned.current = id;
      setActive(id);
      align();
      window.clearTimeout(pinTimer);
      pinTimer = window.setTimeout(release, PIN_MAX_MS);
    };

    const target = decodeURIComponent(hash.slice(1));
    if (ready && target) pin(target);
    else schedule();

    const onHashChange = () => pin(decodeURIComponent(window.location.hash.slice(1)));
    const onLayout = () => {
      align();
      schedule();
    };
    const resize = new ResizeObserver(onLayout);
    resize.observe(document.body);
    const userInput = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('hashchange', onHashChange);
    userInput.forEach((type) => window.addEventListener(type, release, { passive: true, capture: true }));
    return () => {
      window.clearTimeout(pinTimer);
      resize.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('hashchange', onHashChange);
      userInput.forEach((type) => window.removeEventListener(type, release, { capture: true }));
      pinned.current = null;
    };
  }, [key, ready, hash]);

  return active;
}
