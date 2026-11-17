# Expliquez Flexbox en CSS, et quand utiliser Grid ou Flexbox

**Niveau :** Junior
**Merged from (original phrasings):**
- Expliquez Flexbox en CSS.
- Expliquez CSS Grid et Flexbox, et quand utiliser chacun.

## The concept (short answer)
- **Flexbox** est un système de mise en page **à une dimension** : il dispose les éléments **en ligne ou en colonne**. Il part **du contenu** : la taille des éléments découle de leur contenu, et Flexbox répartit l'espace restant.
  - Conteneur : `display: flex`, `flex-direction`, `justify-content` (axe principal), `align-items` (axe secondaire), `flex-wrap`, `gap`.
  - Éléments : `flex: <grow> <shrink> <basis>` (par exemple `flex: 1` = prendre une part égale de l'espace libre), `align-self`, `order`.
  - Valeur par défaut importante : `min-width: auto` sur les éléments flex, donc un contenu long (URL, tableaux) peut **refuser de rétrécir** et déborder. La correction : `min-width: 0`.
- **Grid** est un système de mise en page **à deux dimensions** : lignes **et** colonnes en même temps. Il part **de la structure** : vous définissez des pistes (tracks), et les éléments y sont placés, ce qui les aligne d'une ligne à l'autre.
  - `display: grid`, `grid-template-columns`, `grid-template-rows`, `grid-template-areas`, `gap`, des unités comme `fr`, et `repeat(auto-fill, minmax(200px, 1fr))` pour des grilles responsives sans media queries.
- **Quand utiliser l'un ou l'autre :**
  - Flexbox : barres de navigation, groupes de boutons, centrage, une rangée de tags, aligner une icône avec du texte, des composants dont les éléments ont des tailles différentes.
  - Grid : mises en page de pages (header/sidebar/main/footer), galeries de cartes, tableaux de bord, formulaires avec des labels alignés, tout ce qui doit s'aligner dans les deux directions.
- Ils se combinent bien : Grid pour la page, Flexbox à l'intérieur de chaque composant.

```css
.center { display: flex; justify-content: center; align-items: center; }
.cards  { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
```

## Real-life example: the problem
Imaginez une page d'annonces immobilières. Les cartes de biens étaient construites avec Flexbox et des largeurs en pourcentage. Les utilisateurs constataient que : sur tablette, la **dernière ligne contenait 2 cartes énormes et étirées** alors que les lignes du dessus en avaient 3 ; les cartes d'une même ligne avaient **des hauteurs différentes, avec des boutons « Contacter l'agent » mal alignés** ; et une adresse longue **poussait la barre latérale hors de l'écran** sur mobile, provoquant un scroll horizontal.

```html
<div class="page">
  <aside class="filters">...</aside>
  <section class="listings">
    <article class="card">
      <img src="house.jpg" alt="3-bedroom house" />
      <h3>Very-long-street-name-without-spaces-12345-Springfield</h3>
      <p>$450,000</p>
      <button>Contact agent</button>
    </article>
    <!-- autres cartes -->
  </section>
</div>
```

```css
/* BUGUÉ */
.page { display: flex; }
.filters { width: 250px; }               /* peut rétrécir quand l'espace manque */
.listings { display: flex; flex-wrap: wrap; }   /* pas de min-width: 0 -> le texte long déborde */

.card {
  flex: 1 1 30%;                         /* dernière ligne : les cartes restantes s'agrandissent pour remplir la ligne */
  margin: 8px;                           /* marges + 30 % -> mauvais nombre de cartes par ligne */
}
/* les boutons sont placés juste après le texte, donc à des hauteurs différentes */
```

## How to fix it
Utilisez Grid pour les parties à deux dimensions (la page et la galerie de cartes), et Flexbox à l'intérieur de chaque carte pour pousser le bouton tout en bas.

```css
/* CORRIGÉ */
.page {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr); /* barre latérale fixe, le contenu principal peut rétrécir */
  gap: 24px;
}

@media (max-width: 768px) {
  .page { grid-template-columns: 1fr; }        /* empilement sur mobile */
}

.listings {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); /* autant de colonnes que possible */
  gap: 16px;                                   /* gap au lieu de marges */
}

.card {
  display: flex;
  flex-direction: column;                      /* une dimension : une colonne */
  min-width: 0;                                /* autorise à rétrécir sous la taille du contenu */
}

.card h3 {
  overflow-wrap: anywhere;                     /* coupe les mots très longs */
}

.card button {
  margin-top: auto;                            /* pousse le bouton en bas de la carte */
}
```

Pourquoi ça marche :
- `repeat(auto-fill, minmax(240px, 1fr))` crée autant de colonnes égales que l'espace le permet. Chaque carte de la dernière ligne garde la même largeur que les autres, car les colonnes de Grid sont définies par le conteneur, pas par les éléments.
- Par défaut, les éléments Grid d'une même ligne s'étirent à la même hauteur, et la colonne flex interne avec `margin-top: auto` fixe chaque bouton en bas : ils sont donc alignés.
- `minmax(0, 1fr)`, `min-width: 0` et `overflow-wrap` empêchent un contenu long d'élargir la mise en page au-delà de l'écran.
- `gap` remplace les marges, donc plus besoin de calculs avec des pourcentages.

Alternative : `auto-fit` au lieu de `auto-fill` étire les cartes pour remplir la ligne quand il n'y en a que quelques-unes ; `subgrid` (`grid-template-rows: subgrid`) permet aussi d'aligner les lignes titre/prix/bouton d'une carte à l'autre.

## How to say it in the interview
- « Flexbox est à une dimension et piloté par le contenu : idéal pour aligner des éléments en ligne ou en colonne. Grid est à deux dimensions et piloté par la structure : idéal quand les éléments doivent s'aligner en lignes et en colonnes. »
- « J'utilise généralement Grid pour la mise en page globale et les galeries de cartes, et Flexbox à l'intérieur des composants comme les barres de navigation, les boutons et le contenu des cartes. »
- Piège : le `min-width: auto` par défaut d'un élément flex provoque un débordement avec un texte long ; `min-width: 0` (ou `minmax(0, 1fr)` avec Grid) corrige le problème.
- Compromis : Flexbox avec retour à la ligne ne peut pas aligner les éléments d'une ligne à l'autre ; Grid le peut. Mais Grid demande plus de structure en amont, donc pour une simple rangée d'éléments de tailles variables, Flexbox est plus simple. Les deux prennent en charge `gap`.
