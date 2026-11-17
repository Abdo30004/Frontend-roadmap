# Comment écrire des tests unitaires en React avec Jest et React Testing Library ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Comment écrivez-vous des tests unitaires en React avec Jest et React Testing Library ?

## The concept (short answer)
- **Jest** (ou Vitest, qui a la même API) est le **test runner et la bibliothèque d'assertions** : il trouve les fichiers `*.test.js`, les exécute dans un navigateur simulé (`jsdom`) et vous fournit `describe`, `test`, `expect`, des mocks (`jest.fn()`, `jest.mock()`) et des fake timers.
- **React Testing Library (RTL)** affiche les composants dans ce DOM et vous permet de les interroger et d'interagir avec eux **comme le ferait un utilisateur**. Son principe directeur : « Plus vos tests ressemblent à la façon dont votre logiciel est utilisé, plus ils vous donnent confiance. »
- Vous testez donc **le comportement, pas l'implémentation** : trouvez les éléments par rôle/libellé/texte (`getByRole("button", { name: /save/i })`), interagissez avec `@testing-library/user-event`, et vérifiez ce que voit l'utilisateur. Ne testez pas le state interne, les appels de hooks ni les noms de classes CSS.
- Types de requêtes : `getBy*` (l'élément doit exister, sinon une erreur est levée), `queryBy*` (renvoie null, sert à vérifier une absence), `findBy*` (asynchrone, attend les éléments qui apparaissent après un fetch ou une mise à jour du state).
- Suivez le schéma **Arrange - Act - Assert** (préparer, agir, vérifier) ; mockez les appels réseau à la frontière (`jest.fn` pour `fetch`, ou MSW pour des mocks d'API réalistes).
- `@testing-library/jest-dom` ajoute des matchers lisibles comme `toBeInTheDocument()`, `toBeDisabled()`, `toHaveValue()`.

## Real-life example: the problem
Un cas typique : une équipe avait 90 % de couverture sur un formulaire d'inscription à une newsletter, et pourtant une mise en production a livré un formulaire dont le bouton d'envoi restait désactivé pour toujours après l'échec d'une requête : les utilisateurs ne pouvaient pas réessayer. Les tests étaient tous au vert parce qu'ils testaient des détails d'implémentation : ils appelaient des méthodes internes, vérifiaient des variables de state, et cassaient à chaque refactoring (si bien que les gens mettaient à jour les snapshots sans les lire).

```jsx
// SignupForm.test.jsx : fragile, teste l'implémentation, passe à côté du vrai bug
import { render, fireEvent } from "@testing-library/react";
import SignupForm from "./SignupForm";

test("signup form", () => {
  const { container } = render(<SignupForm />);
  const input = container.querySelector(".signup__input");   // lié à une classe CSS
  fireEvent.change(input, { target: { value: "a@b.com" } });
  fireEvent.click(container.querySelector("button"));
  expect(container).toMatchSnapshot();                       // énorme snapshot que personne ne relit
  // Pas de await : le fetch ne se résout jamais pendant le test.
  // Le cas d'erreur n'est jamais testé. Vrai appel réseau (ou aucun appel du tout).
});
```

Le composant testé, avec le bug qu'aucun test n'a jamais exercé :

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
      setShowError(true);          // BUG : status reste à "loading" -> bouton désactivé pour toujours
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
D'abord, écrivez des tests de comportement pour chaque chemin (succès, erreur + nouvel essai, chargement). Le test d'erreur ci-dessous échoue avec le composant ci-dessus, et c'est exactement ce que vous voulez. Ensuite, corrigez le composant avec une seule valeur de statut pour qu'il ne puisse plus rester bloqué :

```jsx
// dans SignupForm : status vaut "idle" | "loading" | "success" | "error"
} catch {
  setStatus("error");              // quitte "loading", donc le bouton est à nouveau activé
}
// ...
{status === "error" && <p role="alert">Something went wrong. Please try again.</p>}
```

Les tests injectent la fonction d'API en tant que prop (ou mockent le module) et vérifient ce que voit l'utilisateur.

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
    expect(button).toBeEnabled();                     // aurait détecté le bug

    await user.click(button);
    expect(await screen.findByText(/thanks/i)).toBeInTheDocument();
    expect(subscribe).toHaveBeenCalledTimes(2);
  });

  test("disables the button while the request is pending", async () => {
    const { user } = setup(jest.fn(() => new Promise(() => {}))); // ne se résout jamais
    await user.type(screen.getByLabelText(/email/i), "ana@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(screen.getByRole("button", { name: /subscribe/i })).toBeDisabled();
  });
});
```

Pourquoi ça fonctionne :
- Les requêtes par rôle et par libellé correspondent à ce qu'utilisent les utilisateurs et les lecteurs d'écran : les tests survivent aux refactorings (renommer des classes, remplacer du state par un reducer) et n'échouent que lorsque le comportement casse.
- `userEvent` simule une vraie saisie et de vrais clics (focus, keydown, input), contrairement à `fireEvent` qui déclenche un seul événement synthétique.
- `findBy*` attend les mises à jour asynchrones de l'interface : plus d'avertissements « act », ni de tests qui passent avant que la promesse ne soit résolue.
- Chaque chemin (succès, erreur + nouvel essai, chargement) est un test séparé et lisible.

Alternatives : au lieu de passer `subscribe` en prop, utilisez `jest.mock("./api")` ou MSW pour intercepter `fetch` au niveau du réseau ; Vitest remplace Jest sans modification dans les projets Vite.

## How to say it in the interview
- « Jest est le runner et la bibliothèque d'assertions ; React Testing Library affiche les composants et me permet d'interagir avec eux comme un utilisateur. Je fais mes requêtes par rôle ou par libellé, j'agis avec user-event, et je vérifie ce qui est visible. »
- Mentionnez `getBy` vs `queryBy` vs `findBy` et quand utiliser chacun : c'est une question de relance très fréquente.
- Piège : tester des détails d'implémentation (state, noms de classes, gros snapshots). Le pourcentage de couverture n'est pas un gage de qualité ; testez les chemins importants, en particulier les erreurs et les cas limites.
- Compromis : les tests unitaires avec mocks sont rapides mais peuvent rater des bugs d'intégration ; complétez-les avec quelques tests E2E (Cypress/Playwright) sur les parcours critiques.
