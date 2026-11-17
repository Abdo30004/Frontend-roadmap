# Exercice de code : créer un composant de recherche de produits en React

**Niveau :** Junior
**Merged from (original phrasings):**
- Créez un composant de recherche de produits avec React. Exigences : afficher une liste de produits. Proposer un champ de saisie pour rechercher des produits. Afficher les noms des produits correspondant au mot-clé recherché. Afficher tous les produits quand le champ de recherche est vide. Gérer une recherche insensible à la casse.

## The concept (short answer)
- Cet exercice teste les compétences React de base : **champs contrôlés** (controlled inputs), **state**, **données dérivées**, **rendu de listes avec des keys**, et un rendu conditionnel propre.
- L'idée clé : ne stockez dans le state que la **requête de recherche**. La liste filtrée est **dérivée** de `products` + `query` pendant le rendu. Ne copiez **pas** la liste filtrée dans un second `useState` synchronisé avec `useEffect` : cela ajoute des rendus et c'est une source de bugs.
- Insensible à la casse : normalisez les deux côtés avec `.toLowerCase()` (ou `toLocaleLowerCase()`), et appliquez `.trim()` à la requête pour que « shoe » entouré d'espaces corresponde quand même.
- Requête vide : `"".includes` correspond à tout, mais il est plus clair de renvoyer explicitement la liste complète.
- Les finitions « production » qu'un recruteur aime entendre : un message quand il n'y a aucun résultat, un libellé accessible, un nombre de résultats annoncé aux lecteurs d'écran, `useMemo` pour un filtrage coûteux, et `useDeferredValue` pour que la saisie reste fluide avec des listes énormes.

## Real-life example: the problem
Un cas typique : une pharmacie en ligne a mis en production un champ de recherche naïf. Les utilisateurs ont signalé que :
- Taper « Vitamin » suivi d'une espace (fréquent sur les claviers mobiles avec saisie automatique) n'affichait aucun résultat.
- Rechercher « IBUPROFEN » ne trouvait rien, car les données contenaient « Ibuprofen ».
- Une recherche sans résultat affichait une zone vide, si bien que les utilisateurs pensaient que la page était cassée.
- Avec 20 000 produits, chaque frappe bloquait le champ pendant ~150 ms sur les téléphones d'entrée de gamme.
- Les utilisateurs de lecteurs d'écran n'entendaient que « champ de texte », sans libellé.

```jsx
// Version naïve
function ProductSearch({ products }) {
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState(products);

  useEffect(() => {
    // Un rendu supplémentaire à chaque frappe, sensible à la casse, pas de trim
    setFiltered(products.filter((p) => p.name.includes(query)));
  }, [query]);                                   // dépendance `products` manquante : liste périmée

  return (
    <div>
      <input placeholder="Search" onChange={(e) => setQuery(e.target.value)} />
      <ul>
        {filtered.map((p, i) => <li key={i}>{p.name}</li>)}  {/* index utilisé comme key */}
      </ul>
    </div>
  );
}
```

## How to fix it
Une solution propre qui répond à toutes les exigences (c'est ce qu'il faut écrire en premier pendant l'entretien) :

```jsx
import { useState } from "react";

const PRODUCTS = [
  { id: 1, name: "Ibuprofen 400mg" },
  { id: 2, name: "Vitamin C 1000mg" },
  { id: 3, name: "Vitamin D3 Drops" },
  { id: 4, name: "Paracetamol 500mg" },
  { id: 5, name: "Hand Sanitizer Gel" },
];

export default function ProductSearch({ products = PRODUCTS }) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const visibleProducts = normalizedQuery === ""
    ? products
    : products.filter((p) => p.name.toLowerCase().includes(normalizedQuery));

  return (
    <section>
      <label htmlFor="product-search">Search products</label>
      <input
        id="product-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. vitamin"
        autoComplete="off"
      />

      {visibleProducts.length === 0 ? (
        <p>No products match "{query.trim()}".</p>
      ) : (
        <ul>
          {visibleProducts.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

Version adaptée aux grands catalogues (à mentionner ou à écrire en réponse à une question de relance) :

```jsx
import { useDeferredValue, useMemo, useState } from "react";

export default function ProductSearch({ products }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);   // le champ se met à jour d'abord, la liste suit
  const isStale = query !== deferredQuery;

  // Précalculer les noms en minuscules une fois par tableau products, pas à chaque frappe
  const indexed = useMemo(
    () => products.map((p) => ({ ...p, search: p.name.toLowerCase() })),
    [products]
  );

  const visibleProducts = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return q ? indexed.filter((p) => p.search.includes(q)) : indexed;
  }, [indexed, deferredQuery]);

  return (
    <section>
      <label htmlFor="product-search">Search products</label>
      <input id="product-search" type="search" value={query}
             onChange={(e) => setQuery(e.target.value)} />

      <p aria-live="polite">{visibleProducts.length} products found</p>

      <ul style={{ opacity: isStale ? 0.6 : 1 }}>
        {visibleProducts.slice(0, 100).map((p) => <li key={p.id}>{p.name}</li>)}
      </ul>
    </section>
  );
}
```

Pourquoi ça fonctionne :
- **State dérivé** : une seule source de vérité (`query`), pas de synchronisation avec `useEffect`, pas de bug de `products` périmé, un seul rendu par frappe.
- **Insensible à la casse + trim** : les deux côtés sont mis en minuscules et la requête est nettoyée de ses espaces, donc « IBUPROFEN » entouré d'espaces correspond à « Ibuprofen 400mg ».
- Une **requête vide** renvoie la liste complète ; un **état vide** indique à l'utilisateur qu'aucun produit ne correspond, au lieu d'une zone blanche.
- Des **keys stables** (`p.id`) gardent les éléments de la liste corrects quand elle change ; utiliser l'index comme key provoque une mauvaise réutilisation du DOM.
- **Accessibilité** : un vrai `<label>`, `type="search"`, et un nombre de résultats annoncé via `aria-live`.
- **Performance** : `useMemo` évite de recalculer quand un state sans rapport change ; `useDeferredValue` garde le champ réactif en affichant la grande liste avec une priorité plus basse ; n'afficher que les 100 premiers éléments (ou virtualiser avec `react-window`/TanStack Virtual) garde un DOM léger.

Alternatives : appliquez un debounce à la requête (200-300 ms) quand chaque recherche déclenche un appel d'API ; pour une recherche tolérante aux fautes de frappe ou approximative (fuzzy), utilisez une bibliothèque comme Fuse.js, ou une recherche côté serveur pour les très grands catalogues.

## How to say it in the interview
- « Je ne garde que la requête dans le state et je dérive la liste filtrée pendant le rendu ; les deux côtés sont mis en minuscules, la requête est trimée, et une requête vide affiche tout. »
- Évoquez les cas limites de vous-même : espaces, message en l'absence de résultats, keys stables, libellé accessible. Les recruteurs les évaluent autant que le code qui fonctionne.
- Relance : « Et si la liste contient 50 000 éléments ? » `useMemo`, `useDeferredValue`, virtualisation, ou recherche côté serveur avec debounce et annulation des requêtes.
- Piège : stocker `filteredProducts` dans le state et le synchroniser avec `useEffect` ; cela ajoute un rendu, et oublier une dépendance affiche des résultats périmés.
