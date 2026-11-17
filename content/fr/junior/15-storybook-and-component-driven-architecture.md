# Qu'est-ce que Storybook et qu'est-ce que l'architecture orientée composants ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Qu'est-ce que Storybook ? Pourquoi l'utilise-t-on en développement frontend ?
- Expliquez le concept d'architecture orientée composants (component-driven architecture).

## The concept (short answer)
- L'**architecture orientée composants (CDD, component-driven development)** consiste à construire l'interface « de bas en haut » à partir de petits composants isolés et réutilisables (Button, Input, ProductCard), que l'on assemble en éléments plus grands (CheckoutForm), puis en pages. C'est la même idée que l'Atomic Design : atomes -> molécules -> organismes -> templates -> pages.
- Les bons composants sont **présentationnels et indépendants des données** : ils reçoivent les données et les callbacks via les props, et ne récupèrent pas eux-mêmes de données ni ne lisent le state global. Ce sont les conteneurs (containers) et les pages qui gèrent les données.
- **Storybook** est un outil d'atelier qui affiche chaque composant de façon isolée, en dehors de votre application, dans chacun de ses états (les « stories ») : par défaut, chargement, erreur, désactivé, texte long, vide, mode sombre.
- Pourquoi les équipes l'utilisent : développer l'interface sans avoir besoin du backend ni naviguer jusqu'à une page profonde ; disposer d'une documentation vivante / d'un catalogue du design system pour les designers et les autres développeurs ; faire, story par story, des tests de régression visuelle (Chromatic), des tests d'interaction (fonctions `play`) et des contrôles d'accessibilité (addon a11y).
- Les stories s'écrivent au format **CSF** (Component Story Format) : un export par défaut avec les métadonnées, et des exports nommés, chacun étant une story avec ses `args` (props).

## Real-life example: the problem
Un cas typique : une équipe e-commerce a un `ProductCard` qui récupère lui-même ses données et lit le panier depuis un contexte global. Les états « Rupture de stock » et « En promotion » ne sont visibles qu'en trouvant, sur l'environnement de staging, un vrai produit dans cet état. Un développeur modifie la police du prix et personne ne remarque que le badge promo chevauche désormais les noms de produits longs ; les clients voient des cartes cassées sur la page catégorie en production. La même carte est copiée-collée dans la page liste d'envies avec des styles légèrement différents, si bien que chaque correction doit être faite deux fois.

```jsx
// ProductCard.jsx : fortement couplé, impossible à afficher de façon isolée
export function ProductCard({ productId }) {
  const [product, setProduct] = useState(null);
  const { addToCart } = useCart();            // nécessite tout le CartProvider

  useEffect(() => {
    fetch(`/api/products/${productId}`)       // nécessite une API qui tourne
      .then((r) => r.json())
      .then(setProduct);
  }, [productId]);

  if (!product) return null;                  // pas d'état de chargement
  return (
    <div className="card">
      <img src={product.image} />
      <h3>{product.name}</h3>
      {product.salePrice && <span className="badge">SALE</span>}
      <p>{product.salePrice ?? product.price} EUR</p>
      <button onClick={() => addToCart(product.id)}>Add</button>
    </div>
  );
}
```

## How to fix it
Séparez les données de la présentation, puis documentez chaque état dans Storybook.

```jsx
// ProductCard.jsx : pur, des props en entrée, des événements en sortie
export function ProductCard({ product, onAddToCart, isLoading = false }) {
  if (isLoading) return <div className="card card--skeleton" aria-busy="true" />;

  const { name, image, price, salePrice, inStock } = product;
  return (
    <article className="card">
      <img src={image} alt={name} />
      <h3 className="card__title">{name}</h3>
      {salePrice != null && <span className="badge">Sale</span>}
      <p>{(salePrice ?? price).toFixed(2)} EUR</p>
      <button disabled={!inStock} onClick={() => onAddToCart(product.id)}>
        {inStock ? "Add to cart" : "Out of stock"}
      </button>
    </article>
  );
}

// ProductCardContainer.jsx : la couche de données vit ici
export function ProductCardContainer({ productId }) {
  const { data, isLoading } = useProduct(productId); // par ex. TanStack Query
  const { addToCart } = useCart();
  return <ProductCard product={data} isLoading={isLoading} onAddToCart={addToCart} />;
}
```

```jsx
// ProductCard.stories.jsx (CSF 3)
import { fn, expect, userEvent, within } from "@storybook/test";
import { ProductCard } from "./ProductCard";

const base = {
  id: "p1", name: "Wireless Headphones", image: "/headphones.jpg",
  price: 89.99, salePrice: null, inStock: true,
};

export default {
  title: "Shop/ProductCard",
  component: ProductCard,
  args: { product: base, onAddToCart: fn() },
  tags: ["autodocs"],
};

export const Default = {};
export const OnSale = { args: { product: { ...base, salePrice: 59.99 } } };
export const OutOfStock = { args: { product: { ...base, inStock: false } } };
export const LongName = {
  args: { product: { ...base, salePrice: 59.99,
    name: "Noise-Cancelling Over-Ear Wireless Headphones with 40h Battery" } },
};
export const Loading = { args: { isLoading: true } };

export const AddsToCart = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /add to cart/i }));
    await expect(args.onAddToCart).toHaveBeenCalledWith("p1");
  },
};
```

Pourquoi ça fonctionne :
- `ProductCard` est désormais réutilisable sur les pages catégorie, liste d'envies et recherche ; seul le conteneur change.
- Chaque cas limite (promo + nom long, rupture de stock, chargement) est à un clic dans Storybook : le bug de chevauchement est visible pendant le développement, et les tests de régression visuelle en CI le détectent avant le merge.
- La fonction `play` est un test d'interaction qui s'exécute dans le navigateur ; `fn()` enregistre les appels du callback.
- La page autodocs de Storybook devient le catalogue partagé auquel se réfèrent designers et développeurs.

Alternatives : Ladle ou Histoire sont des outils plus légers, proches de Storybook ; si vous avez besoin de données d'API dans vos stories, simulez-les avec MSW (Mock Service Worker) au lieu de coupler le composant au fetch.

## How to say it in the interview
- « Le développement orienté composants consiste à construire l'interface à partir de petits composants isolés, jusqu'aux pages. Storybook est l'endroit où je développe et documente ces composants dans tous leurs états, sans lancer l'application complète. »
- Mentionnez la séparation entre composants présentationnels (props en entrée, callbacks en sortie) et conteneurs qui possèdent les données : c'est ce qui rend l'isolation possible.
- Relance : « Comment Storybook aide-t-il pour les tests ? » Régression visuelle (Chromatic), tests d'interaction avec `play`, addon a11y, et stories réutilisées dans Jest/Vitest grâce à `composeStories`.
- Compromis : les stories demandent de la maintenance et Storybook ajoute de la configuration de build ; c'est rentable pour des design systems partagés et des équipes plus grandes, moins pour une petite application ponctuelle.
