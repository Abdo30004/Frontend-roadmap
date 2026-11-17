# Qu'est-ce que l'accessibilité web (a11y) et comment appliquer les WCAG ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Qu'est-ce que l'accessibilité web (a11y) ?
- Que sont les normes d'accessibilité web (WCAG) et comment les mettez-vous en œuvre ?

## The concept (short answer)
- L'accessibilité, c'est faire en sorte que les personnes en situation de handicap (aveugles ou malvoyantes, sourdes, avec un handicap moteur ou cognitif) puissent percevoir, utiliser et comprendre votre application, souvent grâce à des technologies d'assistance : lecteurs d'écran, navigation uniquement au clavier, commande vocale ou zoom.
- Les **WCAG** (Web Content Accessibility Guidelines, version actuelle 2.2) sont la référence. Elles s'organisent autour de **POUR** : Perceivable (perceptible), Operable (utilisable), Understandable (compréhensible), Robust (robuste). Le niveau **AA** est la cible légale ou contractuelle habituelle (l'ADA aux États-Unis, l'European Accessibility Act dans l'UE).
- Les plus gros gains viennent du **HTML sémantique** : `<button>`, `<a href>`, `<label>`, `<nav>`, `<main>`, des titres dans l'ordre. Les éléments natifs vous donnent gratuitement la prise en charge du clavier, le focus et les rôles pour les lecteurs d'écran.
- Points de contrôle clés : alternatives textuelles (`alt`), contraste des couleurs (4.5:1 pour du texte normal), focus visible, tout utilisable au clavier, libellés de formulaire et messages d'erreur annoncés, aucune information transmise uniquement par la couleur.
- **ARIA** comble les manques (par exemple `aria-live`, `aria-expanded`), mais la première règle d'ARIA est : n'utilisez pas ARIA si un élément natif fait l'affaire. Un mauvais ARIA est pire que pas d'ARIA du tout.
- Testez avec des outils automatiques (axe DevTools, Lighthouse, eslint-plugin-jsx-a11y) et manuellement, au clavier et avec un lecteur d'écran ; l'automatisation ne détecte qu'environ un tiers des problèmes.

## Real-life example: the problem
Un cas typique : le formulaire « Virement » d'une banque passe la revue de design, mais un client aveugle qui utilise un lecteur d'écran et un client qui navigue au clavier à cause d'un handicap moteur ne parviennent ni l'un ni l'autre à effectuer un virement.
- Le « bouton » d'envoi est une `div` : la touche Tab la saute et Entrée ne fait rien.
- Les champs n'ont que des placeholders, donc le lecteur d'écran annonce « champ de texte, vide ».
- L'erreur s'affiche en texte rouge mais n'est jamais annoncée.
- Le design a supprimé les contours de focus parce qu'ils étaient « moches ».

```jsx
function TransferForm({ onSubmit }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="form">
      <input placeholder="Amount" value={amount}
             onChange={(e) => setAmount(e.target.value)} />
      <input placeholder="IBAN" />
      {error && <span style={{ color: "red" }}>{error}</span>}
      <div className="btn" onClick={() => {
        if (!amount) setError("Required");
        else onSubmit(amount);
      }}>
        <img src="/icons/send.svg" />
      </div>
    </div>
  );
}
```

```css
*:focus { outline: none; }
.form input::placeholder { color: #c8c8c8; } /* contraste d'environ 1.6:1 */
```

## How to fix it
```jsx
import { useId, useState } from "react";

function TransferForm({ onSubmit }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const amountId = useId();
  const errorId = useId();

  function handleSubmit(e) {
    e.preventDefault();                       // formulaire natif : la touche Entrée fonctionne
    if (!amount) {
      setError("Enter an amount to transfer.");
      return;
    }
    setError("");
    onSubmit(amount);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2>Transfer money</h2>

      <label htmlFor={amountId}>Amount (EUR)</label>
      <input
        id={amountId}
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      <p id={errorId} role="alert">{error}</p>

      <label htmlFor="iban">Recipient IBAN</label>
      <input id="iban" name="iban" autoComplete="off" />

      <button type="submit">
        <img src="/icons/send.svg" alt="" /> Send transfer
      </button>
    </form>
  );
}
```

```css
/* Garder le focus visible, mais seulement pour les utilisateurs du clavier */
:focus-visible {
  outline: 3px solid #1a5fb4;
  outline-offset: 2px;
}
.error { color: #b00020; } /* 4.5:1 ou plus sur fond blanc, avec une icône/un texte, pas seulement la couleur */
```

Pourquoi ça fonctionne :
- `<form>` + `<button type="submit">` donnent le focus avec Tab, l'activation avec Entrée/Espace et le bon rôle « button », sans code supplémentaire.
- `<label htmlFor>` fait annoncer « Amount (EUR), champ de texte » par le lecteur d'écran, et un clic sur le libellé donne le focus au champ.
- `role="alert"` annonce l'erreur dès qu'elle apparaît ; `aria-describedby` la relit quand le champ reçoit le focus ; `aria-invalid` marque le champ comme invalide.
- L'icône décorative a `alt=""`, elle est donc ignorée ; le bouton a un texte visible qui lui sert de nom accessible.
- `:focus-visible` conserve un contour de focus net pour les utilisateurs du clavier, sans l'afficher lors d'un clic à la souris.

Alternative : pour les widgets complexes (modales, combobox, onglets), utilisez une bibliothèque headless éprouvée comme Radix UI ou React Aria plutôt que de coder vous-même les pièges à focus (focus traps) et l'ARIA.

## How to say it in the interview
- « L'accessibilité, c'est rendre l'application utilisable par tout le monde, y compris les personnes qui naviguent au clavier ou avec un lecteur d'écran. Je vise WCAG 2.2 AA et je commence par du HTML sémantique, parce que les éléments natifs apportent gratuitement la prise en charge du clavier et des lecteurs d'écran. »
- Citez des vérifications concrètes : libellés, texte alternatif, contraste de 4.5:1, focus visible, parcours entièrement au clavier, erreurs annoncées, et tests avec axe/Lighthouse ainsi qu'avec un vrai lecteur d'écran (VoiceOver ou NVDA).
- Piège : « J'ajoute `role="button"` à une div. » Relance : il faut alors aussi `tabIndex={0}` et des gestionnaires pour Entrée/Espace, et c'est exactement pour cela qu'il vaut mieux utiliser `<button>`.
- Compromis : les widgets personnalisés sont plus jolis mais demandent beaucoup de travail sur l'ARIA et le focus ; les bibliothèques de composants accessibles font gagner du temps et réduisent le risque juridique.
