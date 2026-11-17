# Qu'est-ce que les tests end-to-end avec Cypress, Selenium ou Playwright ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Expliquez les tests end-to-end avec Cypress ou Selenium.

## The concept (short answer)
- Les **tests end-to-end (E2E)** pilotent un **vrai navigateur** sur **l'application en cours d'exécution** (frontend + backend ou un mock réaliste) et simulent des parcours utilisateur complets : se connecter, chercher, ajouter au panier, payer. Ils vérifient que toutes les briques fonctionnent ensemble, ce que les tests unitaires avec mocks ne peuvent pas prouver.
- Dans la pyramide des tests, ils se trouvent au sommet : **peu nombreux, lents, mais très fiables** pour les parcours critiques. Beaucoup de tests unitaires, quelques tests d'intégration, une poignée de tests E2E.
- **Selenium** (WebDriver) : le standard le plus ancien, pilote les navigateurs via un protocole de driver, supporte de nombreux langages (Java, Python, C#, JS). Puissant mais plus long à configurer, et les tests instables (flaky) sont fréquents si vous utilisez des pauses manuelles.
- **Cypress** : uniquement en JavaScript, s'exécute dans le navigateur à côté de votre application, avec **attente et nouvelles tentatives automatiques** des assertions, débogage « time-travel », captures d'écran et vidéos, et `cy.intercept()` pour simuler des appels réseau ou les attendre.
- **Playwright** (Microsoft) : l'alternative moderne que choisissent aujourd'hui beaucoup d'équipes. Chromium, Firefox et WebKit (le moteur de Safari), plusieurs onglets/origines, exécution parallèle par défaut, locators avec attente automatique (`getByRole`), trace viewer et exécution rapide en CI.
- Bonnes pratiques : sélectionnez les éléments par rôle/libellé ou `data-testid`, jamais par des chaînes de sélecteurs CSS ; n'utilisez jamais d'attentes fixes (`wait(3000)`) ; créez les données de test via l'API plutôt que via l'interface ; gardez les tests indépendants ; exécutez-les en CI sur chaque PR ou avant chaque déploiement.

## Real-life example: the problem
Un cas typique : un site de réservation de voyages avait une suite E2E qui échouait au hasard environ une fois sur cinq, si bien que l'équipe a commencé à ignorer les builds rouges. Une semaine, un vrai bug est passé à travers : après une modification du design, le bouton « Payer » était recouvert par une bannière de cookies sur les petits écrans, et personne n'a pu finaliser de réservation sur mobile pendant une demi-journée. Le test instable était « connu pour être flaky » et avait été désactivé.

```js
// cypress/e2e/booking.cy.js : instable et fragile
describe("booking", () => {
  it("books a hotel", () => {
    cy.visit("/");
    cy.get("#root > div > div:nth-child(2) > form > input").type("Lisbon"); // sélecteur fragile
    cy.get(".btn-primary").click();
    cy.wait(5000);                                       // en espérant que l'API ait terminé
    cy.get(".result-card").first().click();
    cy.get(".btn-primary").eq(1).click({ force: true }); // force masque le bug de la bannière de cookies
    cy.wait(3000);
    cy.contains("Confirmed");
  });
  // Dépend d'une base de staging partagée ; échoue si quelqu'un d'autre a réservé la dernière chambre.
});
```

## How to fix it
```js
// cypress/e2e/booking.cy.js
describe("Hotel booking", () => {
  beforeEach(() => {
    cy.viewport("iphone-x");                                  // tester aussi la mise en page mobile
    cy.request("POST", "/api/test/seed", { scenario: "lisbon-available" }); // ses propres données
    cy.intercept("GET", "/api/hotels*").as("searchHotels");
    cy.intercept("POST", "/api/bookings").as("createBooking");
  });

  it("lets a guest search, book and see a confirmation", () => {
    cy.visit("/");
    cy.findByRole("button", { name: /accept cookies/i }).click(); // comme un vrai utilisateur

    cy.findByLabelText(/destination/i).type("Lisbon");
    cy.findByRole("button", { name: /search/i }).click();
    cy.wait("@searchHotels").its("response.statusCode").should("eq", 200);

    cy.findAllByTestId("hotel-card").first().click();
    cy.findByRole("button", { name: /pay/i }).should("be.visible").click(); // pas de force

    cy.wait("@createBooking");
    cy.findByRole("heading", { name: /booking confirmed/i }).should("be.visible");
  });
});
```

(`findByRole` et les autres viennent de `@testing-library/cypress` ; les équivalents en Cypress pur sont `cy.get('[data-testid="..."]')` et `cy.contains("button", "Pay")`.)

Le même test avec Playwright, l'alternative moderne :

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
  await page.getByRole("button", { name: /pay/i }).click(); // échoue si le bouton est recouvert par un autre élément
  await expect(page.getByRole("heading", { name: /booking confirmed/i })).toBeVisible();
});
```

Pourquoi ça fonctionne :
- Attendre des alias réseau nommés (`@searchHotels`) ou utiliser des locators avec attente automatique remplace les pauses estimées au hasard, ce qui supprime l'essentiel de l'instabilité et rend les tests plus rapides.
- Les sélecteurs par rôle/libellé résistent aux refactorings du markup et du CSS.
- Retirer `{ force: true }` signifie que le test échoue exactement comme un vrai utilisateur échouerait quand le bouton est recouvert : le bug de la bannière de cookies est donc détecté.
- Créer les données via une API rend chaque test indépendant et reproductible.

Alternative : Selenium WebDriver (ou WebdriverIO) reste un bon choix si vous avez besoin de langages autres que JS ou d'une Selenium Grid existante ; les mêmes principes s'appliquent (attentes explicites, locators stables, données isolées).

## How to say it in the interview
- « Les tests E2E exécutent un vrai navigateur sur l'application en fonctionnement et couvrent des parcours utilisateur complets comme la connexion ou le paiement. J'en écris peu et je les concentre sur les parcours critiques, car ils sont plus lents et plus coûteux que les tests unitaires. »
- Comparez brièvement les outils : Selenium est multilangage et mature ; Cypress offre une excellente DX et des nouvelles tentatives automatiques ; Playwright ajoute un vrai support multinavigateur, WebKit compris, le parallélisme et le tracing, ce qui explique que beaucoup d'équipes le choisissent aujourd'hui.
- Piège : les tests flaky. Les causes : attentes fixes, sélecteurs fragiles, données de test partagées et dépendances à l'ordre des tests ; les remèdes : attente automatique, sélecteurs par rôle/test-id, données créées pour le test et tests isolés.
- Compromis : simuler l'API (`cy.intercept` avec des fixtures) rend les tests rapides et stables, mais ils ne sont plus vraiment end-to-end ; gardez au moins un smoke test sur le vrai backend.
