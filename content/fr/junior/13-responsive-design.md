# Qu'est-ce que le responsive design et comment créer des applications web responsives ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Qu'est-ce qu'une UI responsive ? Comment créez-vous des applications responsives ?
- Comment mettez-vous en œuvre le responsive design dans les applications web modernes ?
- Quelle est votre approche pour créer des applications responsives qui fonctionnent sur tous les appareils ?

## The concept (short answer)
- Le responsive design, c'est une seule base de code dont la mise en page s'adapte à l'espace disponible (téléphone, tablette, ordinateur portable, écran 4K), au type de saisie (tactile ou souris) et aux préférences de l'utilisateur (zoom, réduction des animations, mode sombre).
- La base, c'est la balise meta viewport : sans `<meta name="viewport" content="width=device-width, initial-scale=1">`, les navigateurs mobiles affichent une page « desktop » de 980px puis la réduisent.
- Travaillez en **mobile-first** : écrivez les styles de base pour les petits écrans, puis ajoutez des media queries `min-width` pour enrichir l'affichage sur les écrans plus grands. Les petits écrans reçoivent ainsi le moins de CSS et la mise en page la plus simple.
- Préférez les outils **fluides** aux pixels fixes : `%`, `fr`, `rem`, `minmax()`, `clamp()`, `max-width`, `flex-wrap` de Flexbox, `auto-fit` de Grid. Beaucoup de mises en page n'ont alors besoin d'aucune media query.
- Les **container queries** (`@container`) permettent à un composant de réagir à la largeur de son parent plutôt qu'à celle de tout le viewport, ce qui est idéal pour des cartes réutilisables.
- Les médias doivent eux aussi s'adapter : `img { max-width: 100%; height: auto; }`, `srcset`/`sizes` ou le composant `<Image>` de Next.js, pour que les téléphones ne téléchargent pas des images de 3000px.
- Les zones tactiles doivent mesurer au moins ~44x44px, et vous devez tester sur de vrais appareils / avec le mode appareil des DevTools, ainsi qu'avec un zoom à 200 %.

## Real-life example: the problem
La page d'un restaurant sur une application de livraison de repas a été développée et testée uniquement sur un ordinateur portable en 1440px. Sur téléphone, les utilisateurs ont signalé que :
- Ils devaient zoomer avec deux doigts pour lire le menu (balise viewport absente).
- La grille du menu à 3 colonnes provoquait un défilement horizontal, car chaque colonne avait `width: 400px`.
- Le bouton « Ajouter au panier » était un lien de 24px de haut, difficile à atteindre avec le pouce.
- L'image principale était un JPEG de 2,5 Mo : la page mettait 8 s à charger en 4G.

```html
<!-- index.html : pas de balise meta viewport -->
<head>
  <title>Pizza Place</title>
</head>
```

```css
/* Desktop-first, largeurs fixes en pixels */
.menu {
  display: flex;
}
.menu-item {
  width: 400px;            /* 3 x 400px = 1200px, déborde sur un téléphone de 390px */
  margin-right: 20px;
}
.add-btn {
  font-size: 12px;
  padding: 4px 6px;        /* zone tactile minuscule */
}
.hero img {
  width: 1600px;           /* ne rétrécit jamais */
}
@media (max-width: 768px) {
  /* « correctif » ajouté après coup, qui écrase tout */
  .menu-item { width: 300px !important; }
}
```

## How to fix it
```html
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pizza Place</title>
</head>
```

```css
/* Styles de base mobile-first */
*, *::before, *::after { box-sizing: border-box; }

img { max-width: 100%; height: auto; display: block; }

h1 { font-size: clamp(1.5rem, 4vw + 1rem, 3rem); } /* typographie fluide */

.menu {
  display: grid;
  gap: 1rem;
  /* Autant de colonnes que possible, chacune d'au moins 16rem ; 1 colonne sur téléphone */
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  padding-inline: 1rem;
  max-width: 75rem;
  margin-inline: auto;
}

.menu-item { container-type: inline-size; }

/* La carte s'adapte à sa propre largeur, pas à celle du viewport */
@container (min-width: 22rem) {
  .menu-item__body { display: flex; gap: 1rem; }
}

.add-btn {
  min-height: 44px;
  min-width: 44px;
  padding: 0.75rem 1rem;
  font-size: 1rem;
}

/* Enrichissement pour les écrans plus grands */
@media (min-width: 64rem) {
  .layout { display: grid; grid-template-columns: 16rem 1fr; } /* la barre latérale apparaît */
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

```html
<!-- Image responsive : le navigateur choisit le bon fichier -->
<img
  src="/hero-800.jpg"
  srcset="/hero-480.jpg 480w, /hero-800.jpg 800w, /hero-1600.jpg 1600w"
  sizes="(min-width: 64rem) 50vw, 100vw"
  alt="Wood-fired margherita pizza"
  loading="eager"
/>
```

Pourquoi ça fonctionne :
- La balise viewport fait correspondre les pixels CSS à la largeur de l'appareil : la mise en page « voit » réellement 390px sur un iPhone.
- `repeat(auto-fit, minmax(16rem, 1fr))` produit automatiquement 1, 2 ou 3 colonnes, sans breakpoint et sans débordement.
- Les media queries `min-width` en mobile-first ne font qu'ajouter des fonctionnalités ; plus de bataille de `!important` avec les styles desktop.
- `srcset`/`sizes` permet à un téléphone de télécharger l'image en 480w au lieu de celle en 1600w.

Alternatives : un framework utilitaire comme Tailwind (`grid-cols-1 md:grid-cols-3`) offre le même modèle mobile-first ; en JS, n'utilisez `matchMedia` que lorsque le comportement (et pas seulement le style) doit changer, par exemple pour afficher un tiroir (drawer) plutôt qu'une barre latérale.

## How to say it in the interview
- « Je travaille en mobile-first : des styles de base pour le plus petit écran, puis des media queries `min-width`, et je m'appuie sur les unités fluides, Flexbox et Grid pour que la plupart des mises en page s'adaptent sans breakpoint. »
- Mentionnez la balise meta viewport, les images responsives (`srcset` ou `<Image>` de Next.js) et les container queries pour les composants réutilisables : cela montre que vous allez plus loin que « j'ajoute des media queries ».
- Question de relance fréquente : « Comment choisissez-vous vos breakpoints ? » Réponse : en fonction de l'endroit où le contenu « casse », pas de modèles d'appareils précis ; testez avec le mode appareil des DevTools, sur un vrai téléphone et avec un zoom à 200 %.
- Compromis : masquer du contenu avec `display: none` sur mobile ne l'empêche pas d'être téléchargé ; pour les composants lourds, préférez un rendu conditionnel ou le lazy-loading.
