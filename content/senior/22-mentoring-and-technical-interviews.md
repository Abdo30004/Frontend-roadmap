# Mentoring Junior Developers and Conducting Technical Interviews

**Level:** Senior
**Merged from (original phrasings):**
- How do you mentor junior developers and conduct technical interviews?

## The concept (short answer)
**Mentoring**
- Start with a goal and a baseline: what the junior can do alone today, what they should own in 3-6 months. Revisit in a regular 1:1.
- **Pair programming** with the junior driving; the mentor asks questions ("what happens if the request fails?") instead of grabbing the keyboard.
- **Scoped tasks with growth**: well-defined tickets that stretch one skill at a time (first a UI bug, then a feature with an API call, then a feature with design decisions), with a clear "done" and a safety net.
- **Code review as teaching**: explain the why, link docs, distinguish blocking issues from preferences, and praise good decisions. Gradually move from telling to asking.
- Psychological safety: questions are welcome, and asking after 30 minutes stuck is expected, not a weakness.

**Interviewing**
- Define the **competencies** for the role first, then design each stage to measure one or two of them.
- Use a **structured rubric** with observable behaviors per level, the same questions for every candidate, and independent written feedback before the debrief, to reduce bias.
- Prefer **realistic exercises** (debug a small React app, build a component with a real API, a short time-boxed take-home) over trivia and puzzles; let candidates use their normal tools and docs.

## Real-life example: the problem
A typical case: a team hires two juniors. Onboarding is "read the wiki and pick a ticket". One junior picks a vague "improve search performance" ticket, spends two weeks lost, and gets a 60-comment review that says "this is wrong, see how I'd do it" with a rewritten diff. Confidence collapses; they stop asking questions. Meanwhile, the interview process is unstructured: each interviewer asks their favorite puzzle, feedback is "good vibes" or "not a culture fit", and the team rejects a strong candidate who froze on a whiteboard red-black tree while hiring someone who interviewed well but cannot debug a `useEffect`.

The broken artifacts:

```markdown
<!-- Ticket - BROKEN for a junior: no scope, no context, no definition of done -->
Title: Improve search performance
Body: Search is slow, please fix.
```

```markdown
<!-- Interview feedback - BROKEN: no criteria, not comparable, biased -->
Interviewer A: Strong hire. Great energy, reminded me of myself.
Interviewer B: No hire. Couldn't invert a binary tree.
Interviewer C: Lean hire? Seemed fine.
```

## How to fix it
**1. A scoped, growth-oriented ticket**
```markdown
Title: Debounce product search input (pairing available Tue/Thu)

Context: Each keystroke in <SearchBox> fires GET /api/search, ~12 requests per query,
and results arrive out of order (see Sentry issue #482).
Goal: one request after the user stops typing for 300 ms; ignore stale responses.
Skills to grow: custom hooks, AbortController, testing async UI.

Done when:
- [ ] useDebouncedValue hook with unit tests (fake timers)
- [ ] in-flight request aborted when the query changes
- [ ] RTL test: typing "shoes" quickly triggers exactly one request
Starting points: src/features/search/SearchBox.tsx, docs/testing.md
Mentor: Sam (30 min kickoff, review within a day)
```

**2. Review comments that teach**
```text
blocking: The fetch isn't cancelled when `query` changes, so a slow response for "sh"
can arrive after "shoes" and overwrite the newer results. Could you return a cleanup
from the effect that calls controller.abort()? MDN has a short example:
https://developer.mozilla.org/en-US/docs/Web/API/AbortController

nit: I'd name this `debouncedQuery` so it's clear it lags behind `query`. Your call.

Nice: extracting the hook made the component much easier to read.
```

**3. A structured interview loop with a rubric**
```markdown
## Frontend Engineer (Mid) - Practical exercise rubric (score 1-4 each, with evidence)
| Competency            | 1 - Below                     | 3 - Meets                                       | 4 - Exceeds                                  |
|-----------------------|-------------------------------|-------------------------------------------------|----------------------------------------------|
| React fundamentals    | State/effects misused         | Correct state, effects with cleanup and deps    | Explains trade-offs (derived state, memo)    |
| Debugging             | Guesses, random changes       | Forms hypothesis, uses devtools, verifies       | Narrows systematically, explains root cause  |
| Code quality          | Hard to follow                | Clear names, small functions, handles errors    | Tests edge cases unprompted                  |
| Communication         | Silent or unclear             | Explains approach, asks clarifying questions    | Discusses alternatives and trade-offs        |
| Accessibility/UX      | Ignores                       | Semantic HTML, labels, keyboard works           | Considers loading/empty/error states         |
```
- Exercise: a 90-minute pairing session on a small repo (fix a bug in a list with an effect, then add a filter feature), or a 3-hour max take-home that we pay for or that replaces an onsite round, followed by a 30-minute review conversation.
- Every interviewer writes evidence-based scores before the debrief; the debrief compares evidence against the rubric, not impressions. Same exercise for every candidate at the level.

Why it works: scoped tickets give juniors early wins and stretch one skill at a time; questions-based review builds judgment instead of dependence; the rubric makes interviews comparable, measures job-relevant skills, and makes bias ("reminded me of myself") visible and challengeable.

## How to say it in the interview
- "I mentor through pairing with the junior driving, scoped tickets that stretch one skill at a time, and reviews that explain the why and ask questions instead of rewriting their code."
- "For hiring, I define competencies first, use a realistic exercise and a written rubric, and collect independent feedback before any discussion."
- Follow-up trap: "How do you know mentoring works?" Track growth against the agreed goals: time to first independent feature, scope of tickets owned, review comment trends, and their own feedback in 1:1s.
- Trade-off: take-homes are realistic but cost candidates' time and can disadvantage people with less free time; keep them short, paid, or offer a live pairing alternative.
