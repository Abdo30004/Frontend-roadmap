# What is Storybook and what is component-driven architecture?

**Level:** Junior
**Merged from (original phrasings):**
- What is Storybook? Why is it used in frontend development?
- Explain the concept of component-driven architecture.

## The concept (short answer)
- **Component-driven architecture (CDD)** means building the UI "bottom-up" from small, isolated, reusable components (Button, Input, ProductCard) that are composed into bigger pieces (CheckoutForm) and finally pages. Same idea as Atomic Design: atoms -> molecules -> organisms -> templates -> pages.
- Good components are **presentational and data-agnostic**: they receive data and callbacks through props and do not fetch data or read global state themselves. Containers/pages handle data.
- **Storybook** is a workshop tool that renders each component in isolation, outside your app, in every state ("stories"): default, loading, error, disabled, long text, empty, dark mode.
- Why teams use it: develop UI without needing the backend or navigating to a deep page; living documentation / design system catalog for designers and other devs; visual regression testing (Chromatic), interaction tests (`play` functions) and accessibility checks (a11y addon) per story.
- Stories are written in **CSF** (Component Story Format): a default export with metadata and named exports, each a story with `args` (props).

## Real-life example: the problem
A typical case: an e-commerce team has a `ProductCard` that fetches its own data and reads the cart from global context. The "Out of stock" and "On sale" states can only be seen by finding a real product in that state on staging. A developer changes the price font and nobody notices that the sale badge now overlaps long product names; customers see broken cards on the live category page. The same card is copy-pasted into the wishlist page with slightly different styles, so fixes have to be done twice.

```jsx
// ProductCard.jsx: tightly coupled, impossible to render in isolation
export function ProductCard({ productId }) {
  const [product, setProduct] = useState(null);
  const { addToCart } = useCart();            // needs the whole CartProvider

  useEffect(() => {
    fetch(`/api/products/${productId}`)       // needs a running API
      .then((r) => r.json())
      .then(setProduct);
  }, [productId]);

  if (!product) return null;                  // no loading state
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
Split data from presentation, then document every state in Storybook.

```jsx
// ProductCard.jsx: pure, props in, events out
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

// ProductCardContainer.jsx: the data layer lives here
export function ProductCardContainer({ productId }) {
  const { data, isLoading } = useProduct(productId); // e.g. TanStack Query
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

Why it works:
- `ProductCard` is now reusable on the category, wishlist and search pages; the only difference is the container.
- Every edge case (sale + long name, out of stock, loading) is one click away in Storybook, so the overlap bug is visible during development, and visual regression tests in CI catch it before merge.
- The `play` function is an interaction test that runs in the browser; `fn()` records the callback.
- Storybook's autodocs page becomes the shared catalog designers and devs refer to.

Alternatives: Ladle or Histoire are lighter Storybook-like tools; if you need API data in stories, mock it with MSW (Mock Service Worker) instead of coupling the component to fetch.

## How to say it in the interview
- "Component-driven development means building the UI from small isolated components up to pages. Storybook is where I build and document those components in every state, without running the full app."
- Mention the split between presentational components (props in, callbacks out) and containers that own data, because that is what makes isolation possible.
- Follow-up: "How does Storybook help testing?" Visual regression (Chromatic), interaction tests with `play`, a11y addon, and stories reused in Jest/Vitest via `composeStories`.
- Trade-off: stories need maintenance and Storybook adds build config; it pays off for shared design systems and larger teams, less so for a tiny one-off app.
