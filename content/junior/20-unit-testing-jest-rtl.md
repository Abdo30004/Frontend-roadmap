# How do you write unit tests in React with Jest and React Testing Library?

**Level:** Junior
**Merged from (original phrasings):**
- How do you write unit tests in React using Jest and React Testing Library?

## The concept (short answer)
- **Jest** (or Vitest, which has the same API) is the **test runner and assertion library**: it finds `*.test.js` files, runs them in a simulated browser (`jsdom`), and gives you `describe`, `test`, `expect`, mocks (`jest.fn()`, `jest.mock()`) and fake timers.
- **React Testing Library (RTL)** renders components into that DOM and lets you query and interact with them **the way a user does**. Its guiding principle: "The more your tests resemble the way your software is used, the more confidence they give you."
- So you test **behavior, not implementation**: find elements by role/label/text (`getByRole("button", { name: /save/i })`), interact with `@testing-library/user-event`, and assert on what the user sees. Do not test internal state, hook calls or CSS class names.
- Query types: `getBy*` (must exist, throws), `queryBy*` (returns null, used to assert absence), `findBy*` (async, waits for elements that appear after fetches/state updates).
- Use the **Arrange - Act - Assert** pattern; mock network calls at the boundary (`jest.fn` for `fetch`, or MSW for realistic API mocks).
- `@testing-library/jest-dom` adds readable matchers like `toBeInTheDocument()`, `toBeDisabled()`, `toHaveValue()`.

## Real-life example: the problem
A typical case: a team had 90% coverage on a newsletter sign-up form, yet a production release shipped a form where the submit button stayed disabled forever after a failed request, and users could not retry. The tests were all green because they tested implementation details: they called internal methods, checked state variables, and broke every time someone refactored (so people just updated snapshots without reading them).

```jsx
// SignupForm.test.jsx: brittle, tests implementation, misses the real bug
import { render, fireEvent } from "@testing-library/react";
import SignupForm from "./SignupForm";

test("signup form", () => {
  const { container } = render(<SignupForm />);
  const input = container.querySelector(".signup__input");   // tied to CSS class
  fireEvent.change(input, { target: { value: "a@b.com" } });
  fireEvent.click(container.querySelector("button"));
  expect(container).toMatchSnapshot();                       // huge snapshot nobody reviews
  // No await: the fetch never resolves inside the test.
  // Error path never tested. Real network call (or none at all).
});
```

The component under test, with the bug nobody's tests exercised:

```jsx
// SignupForm.jsx
export default function SignupForm({ subscribe }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success
  const [showError, setShowError] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setShowError(false);
    setStatus("loading");
    try {
      await subscribe(email);
      setStatus("success");
    } catch {
      setShowError(true);          // BUG: status stays "loading" -> button disabled forever
    }
  }

  if (status === "success") return <p>Thanks! Check your inbox.</p>;
  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit" disabled={status === "loading"}>Subscribe</button>
      {showError && <p role="alert">Something went wrong. Please try again.</p>}
    </form>
  );
}
```

## How to fix it
First, write behavior tests for every path (success, error + retry, loading). The error test below fails against the component above, which is exactly what you want. Then fix the component with a single status value so it cannot get stuck:

```jsx
// in SignupForm: status is "idle" | "loading" | "success" | "error"
} catch {
  setStatus("error");              // leaves "loading", so the button is enabled again
}
// ...
{status === "error" && <p role="alert">Something went wrong. Please try again.</p>}
```

The tests inject the API function as a prop (or mock the module) and check what the user sees.

```jsx
// SignupForm.test.jsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import SignupForm from "./SignupForm";

function setup(subscribe = jest.fn().mockResolvedValue({})) {
  const user = userEvent.setup();
  render(<SignupForm subscribe={subscribe} />);
  return { user, subscribe };
}

describe("SignupForm", () => {
  test("subscribes the user and shows a confirmation", async () => {
    const { user, subscribe } = setup();

    await user.type(screen.getByLabelText(/email/i), "ana@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    expect(subscribe).toHaveBeenCalledWith("ana@example.com");
    expect(await screen.findByText(/thanks! check your inbox/i)).toBeInTheDocument();
  });

  test("shows an error and lets the user retry when the request fails", async () => {
    const subscribe = jest.fn()
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValueOnce({});
    const { user } = setup(subscribe);

    await user.type(screen.getByLabelText(/email/i), "ana@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/try again/i);
    const button = screen.getByRole("button", { name: /subscribe/i });
    expect(button).toBeEnabled();                     // would have caught the bug

    await user.click(button);
    expect(await screen.findByText(/thanks/i)).toBeInTheDocument();
    expect(subscribe).toHaveBeenCalledTimes(2);
  });

  test("disables the button while the request is pending", async () => {
    const { user } = setup(jest.fn(() => new Promise(() => {}))); // never resolves
    await user.type(screen.getByLabelText(/email/i), "ana@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(screen.getByRole("button", { name: /subscribe/i })).toBeDisabled();
  });
});
```

Why it works:
- Queries by role and label are what users and screen readers use, so tests survive refactors (rename classes, swap state for a reducer) and fail only when behavior breaks.
- `userEvent` simulates real typing and clicking (focus, keydown, input), unlike `fireEvent` which dispatches a single synthetic event.
- `findBy*` waits for async UI updates, so there are no "act" warnings and no tests that pass before the promise resolves.
- Each path (success, error + retry, loading) is a separate, readable test.

Alternatives: instead of passing `subscribe` as a prop, use `jest.mock("./api")` or MSW to intercept `fetch` at the network level; Vitest is a drop-in replacement for Jest in Vite projects.

## How to say it in the interview
- "Jest is the runner and assertion library; React Testing Library renders components and lets me interact with them like a user. I query by role or label, act with user-event, and assert on what is visible."
- Mention `getBy` vs `queryBy` vs `findBy` and when to use each; this is a very common follow-up.
- Trap: testing implementation details (state, class names, big snapshots). Coverage percentage is not quality; test the important paths, especially errors and edge cases.
- Trade-off: unit tests with mocks are fast but can miss integration bugs; complement them with a few E2E tests (Cypress/Playwright) on critical flows.
