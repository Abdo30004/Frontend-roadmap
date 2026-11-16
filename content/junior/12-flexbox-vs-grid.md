# Explain CSS Flexbox, and when to use Grid vs Flexbox

**Level:** Junior
**Merged from (original phrasings):**
- Explain CSS Flexbox.
- Explain CSS Grid vs Flexbox and when to use each.

## The concept (short answer)
- **Flexbox** is a **one-dimensional** layout: it arranges items in a **row or a column**. It is **content-first**: item sizes come from their content, and Flexbox distributes the remaining space.
  - Container: `display: flex`, `flex-direction`, `justify-content` (main axis), `align-items` (cross axis), `flex-wrap`, `gap`.
  - Items: `flex: <grow> <shrink> <basis>` (e.g. `flex: 1` = take equal free space), `align-self`, `order`.
  - Important default: `min-width: auto` on flex items, so long content (URLs, tables) can **refuse to shrink** and overflow. Fix with `min-width: 0`.
- **Grid** is a **two-dimensional** layout: rows **and** columns at the same time. It is **layout-first**: you define tracks, and items are placed into them, so things line up across rows.
  - `display: grid`, `grid-template-columns`, `grid-template-rows`, `grid-template-areas`, `gap`, units like `fr`, and `repeat(auto-fill, minmax(200px, 1fr))` for responsive grids without media queries.
- **When to use which:**
  - Flexbox: navbars, button groups, centering, a row of tags, aligning an icon with text, components where items have different sizes.
  - Grid: page layouts (header/sidebar/main/footer), card galleries, dashboards, forms with aligned labels, anything that must line up in both directions.
- They combine well: Grid for the page, Flexbox inside each component.

```css
.center { display: flex; justify-content: center; align-items: center; }
.cards  { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
```

## Real-life example: the problem
Imagine a real-estate listing page. The product cards were built with Flexbox and percentage widths. Users saw: on a tablet the **last row had 2 huge stretched cards** while the rows above had 3, cards in the same row had **different heights with the "Contact agent" buttons not aligned**, and a long address **pushed the sidebar off-screen** on mobile, causing horizontal scrolling.

```html
<div class="page">
  <aside class="filters">...</aside>
  <section class="listings">
    <article class="card">
      <img src="house.jpg" alt="3-bedroom house" />
      <h3>Very-long-street-name-without-spaces-12345-Springfield</h3>
      <p>$450,000</p>
      <button>Contact agent</button>
    </article>
    <!-- more cards -->
  </section>
</div>
```

```css
/* BROKEN */
.page { display: flex; }
.filters { width: 250px; }               /* can shrink when space is tight */
.listings { display: flex; flex-wrap: wrap; }   /* no min-width: 0 -> long text overflows */

.card {
  flex: 1 1 30%;                         /* last row: leftover cards grow to fill the row */
  margin: 8px;                           /* margins + 30% -> wrong count per row */
}
/* buttons sit right after the text, so they are at different heights */
```

## How to fix it
Use Grid for the two-dimensional parts (page and card gallery) and Flexbox inside each card to push the button to the bottom.

```css
/* FIXED */
.page {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr); /* sidebar fixed, main can shrink */
  gap: 24px;
}

@media (max-width: 768px) {
  .page { grid-template-columns: 1fr; }        /* stack on mobile */
}

.listings {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); /* as many as fit */
  gap: 16px;                                   /* gap instead of margins */
}

.card {
  display: flex;
  flex-direction: column;                      /* one-dimensional: a column */
  min-width: 0;                                /* allow shrinking below content size */
}

.card h3 {
  overflow-wrap: anywhere;                     /* break very long words */
}

.card button {
  margin-top: auto;                            /* push button to the bottom of the card */
}
```

Why it works:
- `repeat(auto-fill, minmax(240px, 1fr))` makes as many equal columns as fit. Every card in the last row keeps the same width as the others, because Grid columns are defined by the container, not by the items.
- Grid items in the same row stretch to the same height by default, and the inner flex column with `margin-top: auto` pins every button to the bottom, so they line up.
- `minmax(0, 1fr)`, `min-width: 0` and `overflow-wrap` stop long content from forcing the layout wider than the screen.
- `gap` replaces margins, so there is no math with percentages.

Alternative: `auto-fit` instead of `auto-fill` stretches the cards to fill the row when there are only a few; `subgrid` (`grid-template-rows: subgrid`) can also align title/price/button rows across cards.

## How to say it in the interview
- "Flexbox is one-dimensional and content-driven: great for aligning items in a row or column. Grid is two-dimensional and layout-driven: great when things must line up in rows and columns."
- "I usually use Grid for page layout and card galleries, and Flexbox inside components like navbars, buttons and card contents."
- Trap: a flex item's default `min-width: auto` causes overflow with long text; `min-width: 0` (or `minmax(0, 1fr)` in Grid) fixes it.
- Trade-off: Flexbox with wrapping cannot align items across rows; Grid can. But Grid needs more up-front structure, so for a simple row of variable-size items Flexbox is simpler. Both support `gap`.
