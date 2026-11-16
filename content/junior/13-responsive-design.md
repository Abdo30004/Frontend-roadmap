# What is responsive design and how do you build responsive web apps?

**Level:** Junior
**Merged from (original phrasings):**
- What is Responsive UI? How do you build responsive applications?
- How do you implement responsive design in modern web apps?
- What's your approach to building responsive applications that work across all devices?

## The concept (short answer)
- Responsive design means one codebase whose layout adapts to the available space (phone, tablet, laptop, 4K), input type (touch vs mouse) and user settings (zoom, reduced motion, dark mode).
- The foundation is the viewport meta tag: without `<meta name="viewport" content="width=device-width, initial-scale=1">` mobile browsers render a 980px "desktop" page and shrink it.
- Build **mobile-first**: write the base styles for small screens, then add `min-width` media queries to enhance for bigger screens. Small screens get the least CSS and the simplest layout.
- Prefer **fluid** tools over fixed pixels: `%`, `fr`, `rem`, `minmax()`, `clamp()`, `max-width`, Flexbox `flex-wrap`, Grid `auto-fit`. Many layouts then need zero media queries.
- **Container queries** (`@container`) let a component respond to the width of its parent instead of the whole viewport, which is ideal for reusable cards.
- Media must scale too: `img { max-width: 100%; height: auto; }`, `srcset`/`sizes` or Next.js `<Image>` so phones don't download 3000px images.
- Touch targets need to be at least ~44x44px, and you must test on real devices / DevTools device mode, plus 200% zoom.

## Real-life example: the problem
A food-delivery restaurant page was built and tested only on a 1440px laptop. On phones users reported:
- They had to pinch-zoom to read the menu (missing viewport tag).
- The 3-column menu grid caused horizontal scrolling because each column had `width: 400px`.
- The "Add to cart" button was a 24px-tall link, easy to miss with a thumb.
- The hero image was a 2.5 MB JPEG, so the page took 8 s on 4G.

```html
<!-- index.html: no viewport meta tag -->
<head>
  <title>Pizza Place</title>
</head>
```

```css
/* Desktop-first, fixed pixel widths */
.menu {
  display: flex;
}
.menu-item {
  width: 400px;            /* 3 x 400px = 1200px, overflows a 390px phone */
  margin-right: 20px;
}
.add-btn {
  font-size: 12px;
  padding: 4px 6px;        /* tiny touch target */
}
.hero img {
  width: 1600px;           /* never shrinks */
}
@media (max-width: 768px) {
  /* "fix" added later, overriding everything */
  .menu-item { width: 300px !important; }
}
```

## How to fix it
```html
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pizza Place</title>
</head>
```

```css
/* Mobile-first base styles */
*, *::before, *::after { box-sizing: border-box; }

img { max-width: 100%; height: auto; display: block; }

h1 { font-size: clamp(1.5rem, 4vw + 1rem, 3rem); } /* fluid type */

.menu {
  display: grid;
  gap: 1rem;
  /* As many columns as fit, each at least 16rem; 1 column on phones */
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  padding-inline: 1rem;
  max-width: 75rem;
  margin-inline: auto;
}

.menu-item { container-type: inline-size; }

/* The card adapts to its own width, not the viewport */
@container (min-width: 22rem) {
  .menu-item__body { display: flex; gap: 1rem; }
}

.add-btn {
  min-height: 44px;
  min-width: 44px;
  padding: 0.75rem 1rem;
  font-size: 1rem;
}

/* Enhance for larger screens */
@media (min-width: 64rem) {
  .layout { display: grid; grid-template-columns: 16rem 1fr; } /* sidebar appears */
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

```html
<!-- Responsive image: browser picks the right file -->
<img
  src="/hero-800.jpg"
  srcset="/hero-480.jpg 480w, /hero-800.jpg 800w, /hero-1600.jpg 1600w"
  sizes="(min-width: 64rem) 50vw, 100vw"
  alt="Wood-fired margherita pizza"
  loading="eager"
/>
```

Why it works:
- The viewport tag makes CSS pixels match the device width, so the layout actually sees 390px on an iPhone.
- `repeat(auto-fit, minmax(16rem, 1fr))` produces 1, 2 or 3 columns automatically, with no breakpoints and no overflow.
- Mobile-first `min-width` queries only add features; there is no `!important` fight with desktop styles.
- `srcset`/`sizes` lets a phone download the 480w image instead of the 1600w one.

Alternatives: a utility framework like Tailwind (`grid-cols-1 md:grid-cols-3`) gives the same mobile-first model; in JS, use `matchMedia` only when behavior (not just styling) must change, e.g. rendering a drawer vs a sidebar.

## How to say it in the interview
- "I build mobile-first: base styles for the smallest screen, then `min-width` media queries, and I lean on fluid units, Flexbox and Grid so most layouts adapt without breakpoints."
- Mention the viewport meta tag, responsive images (`srcset` or Next.js `<Image>`), and container queries for reusable components; these show you go beyond "I add media queries".
- Common follow-up: "How do you pick breakpoints?" Answer: based on where the content breaks, not on specific device models; test in DevTools device mode, on a real phone, and at 200% zoom.
- Trade-off: hiding content with `display: none` on mobile still downloads it; for heavy components, render conditionally or lazy-load instead.
