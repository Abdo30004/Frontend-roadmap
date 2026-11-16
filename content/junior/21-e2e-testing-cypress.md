# What is end-to-end testing with Cypress, Selenium or Playwright?

**Level:** Junior
**Merged from (original phrasings):**
- Explain end-to-end testing using Cypress or Selenium.

## The concept (short answer)
- **End-to-end (E2E) tests** drive a **real browser** against the **running app** (frontend + backend or a realistic mock) and simulate full user journeys: log in, search, add to cart, pay. They check that all the pieces work together, which unit tests with mocks cannot prove.
- In the testing pyramid they sit at the top: **few, slow, high-confidence** tests for critical flows. Many unit tests, some integration tests, a handful of E2E tests.
- **Selenium** (WebDriver): the oldest standard, drives browsers through a driver protocol, supports many languages (Java, Python, C#, JS). Powerful but more setup, and flaky tests are common if you use manual sleeps.
- **Cypress**: JavaScript-only, runs inside the browser next to your app, has **automatic waiting/retrying** of assertions, time-travel debugging, screenshots and videos, and `cy.intercept()` to stub or wait on network calls.
- **Playwright** (Microsoft): the modern alternative many teams now choose. Chromium, Firefox and WebKit (Safari engine), multiple tabs/origins, parallel runs by default, auto-waiting locators (`getByRole`), trace viewer, and fast CI execution.
- Best practices: select elements by role/label or `data-testid`, never by CSS chains; never use fixed waits (`wait(3000)`); seed test data via API instead of the UI; keep tests independent; run them in CI on every PR or before deploy.

## Real-life example: the problem
A typical case: a travel booking site had an E2E suite that failed randomly about 1 in 5 runs, so the team started ignoring red builds. One week a real bug slipped through: after a design change, the "Pay" button was covered by a cookie banner on small screens, and nobody could complete a booking on mobile for half a day. The flaky test was "known flaky" and had been skipped.

```js
// cypress/e2e/booking.cy.js: flaky and fragile
describe("booking", () => {
  it("books a hotel", () => {
    cy.visit("/");
    cy.get("#root > div > div:nth-child(2) > form > input").type("Lisbon"); // brittle selector
    cy.get(".btn-primary").click();
    cy.wait(5000);                                       // hope the API is done
    cy.get(".result-card").first().click();
    cy.get(".btn-primary").eq(1).click({ force: true }); // force hides the cookie banner bug
    cy.wait(3000);
    cy.contains("Confirmed");
  });
  // Depends on a shared staging DB; fails if someone else booked the last room.
});
```

## How to fix it
```js
// cypress/e2e/booking.cy.js
describe("Hotel booking", () => {
  beforeEach(() => {
    cy.viewport("iphone-x");                                  // test the mobile layout too
    cy.request("POST", "/api/test/seed", { scenario: "lisbon-available" }); // own data
    cy.intercept("GET", "/api/hotels*").as("searchHotels");
    cy.intercept("POST", "/api/bookings").as("createBooking");
  });

  it("lets a guest search, book and see a confirmation", () => {
    cy.visit("/");
    cy.findByRole("button", { name: /accept cookies/i }).click(); // like a real user

    cy.findByLabelText(/destination/i).type("Lisbon");
    cy.findByRole("button", { name: /search/i }).click();
    cy.wait("@searchHotels").its("response.statusCode").should("eq", 200);

    cy.findAllByTestId("hotel-card").first().click();
    cy.findByRole("button", { name: /pay/i }).should("be.visible").click(); // no force

    cy.wait("@createBooking");
    cy.findByRole("heading", { name: /booking confirmed/i }).should("be.visible");
  });
});
```

(`findByRole` etc. come from `@testing-library/cypress`; plain Cypress equivalents are `cy.get('[data-testid="..."]')` and `cy.contains("button", "Pay")`.)

The same test in Playwright, the modern alternative:

```ts
// tests/booking.spec.ts
import { test, expect, devices } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });

test("guest can book a hotel", async ({ page, request }) => {
  await request.post("/api/test/seed", { data: { scenario: "lisbon-available" } });

  await page.goto("/");
  await page.getByRole("button", { name: /accept cookies/i }).click();
  await page.getByLabel(/destination/i).fill("Lisbon");
  await page.getByRole("button", { name: /search/i }).click();

  await page.getByTestId("hotel-card").first().click();
  await page.getByRole("button", { name: /pay/i }).click(); // fails if covered by another element
  await expect(page.getByRole("heading", { name: /booking confirmed/i })).toBeVisible();
});
```

Why it works:
- Waiting on named network aliases (`@searchHotels`) or auto-waiting locators replaces guessed sleeps, which removes most flakiness and makes tests faster.
- Role/label selectors survive markup and CSS refactors.
- Removing `{ force: true }` means the test fails exactly like a real user would when the button is covered, so the cookie-banner bug is caught.
- Seeding data through an API makes each test independent and repeatable.

Alternative: Selenium WebDriver (or WebdriverIO) is still a good choice when you need non-JS languages or an existing Selenium Grid; the same principles (explicit waits, stable locators, isolated data) apply.

## How to say it in the interview
- "E2E tests run a real browser against the running app and cover full user journeys like login or checkout. I keep them few and focused on critical flows because they are slower and costlier than unit tests."
- Compare tools briefly: Selenium is multi-language and mature; Cypress has great DX and automatic retries; Playwright adds true multi-browser including WebKit, parallelism and tracing, which is why many teams pick it today.
- Trap: flaky tests. Causes are fixed waits, brittle selectors, shared test data and test order dependencies; fixes are auto-waiting, role/test-id selectors, seeded data and isolated tests.
- Trade-off: stubbing the API (`cy.intercept` with fixtures) makes tests fast and stable but no longer truly end-to-end; keep at least one smoke test against the real backend.
