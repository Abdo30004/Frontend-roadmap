# Reproducing a Rendering Bug That Affects Only 1% of Users

**Level:** Senior
**Merged from (original phrasings):**
- A rendering bug affects only 1% of users. How would you reproduce it?

## The concept (short answer)
- "1% of users" means something is **different about those users**. The job is to find the dimension that separates them, not to click around randomly on your laptop.
- **Segment** the affected sessions in your error/RUM tool by browser + version, OS, device, locale/timezone, viewport, feature flags/experiment variant, release, account type, network, and presence of extensions (extension URLs in stack frames). Compare against the unaffected baseline: the dimension where the ratio jumps is your lead.
- Use **session replay** and **breadcrumbs** (clicks, route changes, API calls, console logs before the error) to see the exact sequence and data the user had.
- **Reproduce on the matching environment**: real devices/browsers on BrowserStack or Sauce Labs, Playwright with WebKit/Firefox, emulated locale/timezone (`--lang`, `TZ=`), same flag variant, same user data (a sanitized copy of their record).
- If you still cannot reproduce, **form a hypothesis and add targeted logging** (the raw input value, the code path taken) in a release, then confirm or kill it with data. Once reproduced, write a failing test first, then fix.

## Real-life example: the problem
A typical case: a clinic booking app. Around 1% of users report "the calendar is empty" and the error tracker shows `RangeError: Invalid time value` from the slot list. Developers on Chrome on macOS cannot reproduce it. Segmenting the error in the tracker shows 97% of events come from **iOS Safari 15 and 16** and desktop Safari 15; flags, locale and release are evenly distributed. Breadcrumbs show the error fires right after `GET /api/slots` returns 200. Session replay shows the calendar skeleton, then an error fallback.

The API returns database-style timestamps, and the client parses them with the `Date` constructor:

```json
// GET /api/slots
[{ "id": 18, "start": "2026-03-29 14:00:00", "doctor": "Dr. Lee" }]
```

```tsx
// SlotList.tsx - BROKEN
import { format } from 'date-fns';

export function SlotList({ slots }: { slots: Slot[] }) {
  return (
    <ul>
      {slots.map((s) => (
        <li key={s.id}>
          {/* "YYYY-MM-DD HH:mm:ss" (space, no T) is NOT an ISO-8601 string.
              Chrome/Firefox are lenient and parse it as local time;
              older Safari versions return Invalid Date -> format() throws */}
          {format(new Date(s.start), 'EEE d MMM, HH:mm')} - {s.doctor}
        </li>
      ))}
    </ul>
  );
}
```

## How to fix it
**Step 1: reproduce deterministically.** Open the page on a real iPhone/Safari 15 via BrowserStack, confirm the empty calendar, and capture the failing input. Then lock it in a cross-browser test:

```ts
// slots.spec.ts - Playwright, run for chromium, firefox AND webkit projects
test('renders slots from API timestamps', async ({ page }) => {
  await page.route('**/api/slots', (r) =>
    r.fulfill({ json: [{ id: 18, start: '2026-03-29 14:00:00', doctor: 'Dr. Lee' }] }));
  await page.goto('/book');
  await expect(page.getByText('Sun 29 Mar, 14:00 - Dr. Lee')).toBeVisible();
});
```
```ts
// playwright.config.ts
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'webkit',   use: { ...devices['iPhone 13'], locale: 'en-GB', timezoneId: 'Europe/London' } },
],
```

**Step 2: fix the contract and the parser.**
```ts
// Server: return unambiguous ISO 8601 with an offset: "2026-03-29T14:00:00+01:00"

// Client: never use new Date(string) for non-ISO input; parse explicitly
import { parseISO, isValid, format } from 'date-fns';

export function parseSlotTime(raw: string): Date | null {
  const d = parseISO(raw);                      // date-fns' own parser: accepts "T" or space,
                                                // same result in every browser
  if (!isValid(d)) {
    Sentry.captureMessage('Unparseable slot time', { extra: { raw } });
    return null;
  }
  return d;
}

export function SlotList({ slots }: { slots: Slot[] }) {
  return (
    <ul>
      {slots.map((s) => {
        const start = parseSlotTime(s.start);
        return (
          <li key={s.id}>
            {start ? format(start, 'EEE d MMM, HH:mm') : 'Time unavailable'} - {s.doctor}
          </li>
        );
      })}
    </ul>
  );
}
```

Why it works: `parseISO` parses explicitly instead of relying on each engine's lenient fallback parsing of non-standard strings, so all browsers agree; the offset removes timezone ambiguity; one bad value now degrades a single row instead of crashing the list; the WebKit test project prevents regressions.

**If segmentation had not pointed at a browser**, the same method applies to other usual suspects:
- **Locale/timezone**: `toLocaleString` output parsed back, DST gaps (a slot at 02:30 that does not exist on the change day), `Intl` differences. Test with `timezoneId`/`locale` in Playwright.
- **Feature flag / experiment variant**: compare error rate per variant; reproduce by forcing the flag.
- **Browser extensions** (translation, ad blockers, password managers) mutating the DOM: frames from `chrome-extension://` in stacks, React hydration errors, `removeChild` on a node not a child. Reproduce with the extension installed.
- **Data shape**: one customer with an empty array, a very long name, or a null field. Reproduce with a sanitized copy of their data.

## How to say it in the interview
- "I start from data, not from my machine: segment affected sessions against unaffected ones by browser, OS, locale, timezone, flags, release and extensions until one dimension stands out."
- "Then I use replays and breadcrumbs to get the exact input, reproduce on a real matching device, and freeze it as a failing test before fixing."
- Follow-up trap: "What if you still can't reproduce?" Ship targeted logging of the suspicious inputs (guarded, no PII) and treat it as a hypothesis test; also add a defensive fallback so users are not blocked meanwhile.
- Trade-off: session replay and verbose logging cost money and raise privacy concerns; sample them, mask inputs, and enable them on error rather than for everyone.
