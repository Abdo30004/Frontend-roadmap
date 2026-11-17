// French versions of each demo's scenario / task / solutionNote, keyed by "<level>/<slug>".
export interface DemoText {
  scenario: string;
  task?: string;
  solutionNote?: string;
}

export const DEMO_FR: Record<string, DemoText> = {
  // ---------------------------------------------------------------- junior
  'junior/01-closures': {
    scenario:
      "Le champ de recherche d'une boutique suggère des produits pendant la saisie. Il est censé n'appeler l'API qu'une fois que vous arrêtez de taper pendant 300 ms.",
    task: 'Tapez « laptop » rapidement dans le champ de recherche, puis comparez les frappes avec les requêtes envoyées.',
    solutionNote: 'Même helper debounce, mais timerId vit dans la fonction externe, donc tous les appels le partagent.',
  },
  'junior/02-var-let-const-and-loop-settimeout': {
    scenario: "Un suivi de livraison de repas allume les 3 étapes de la commande à une seconde d'intervalle.",
    task: 'Appuyez sur « Start tracking » et observez les étapes et la console.',
    solutionNote: 'Même boucle, mais avec let : chaque callback de timer reçoit son propre i.',
  },
  'junior/03-settimeout-vs-setinterval': {
    scenario:
      "Un tableau de bord bancaire rafraîchit le solde du compte toutes les secondes. L'API du solde est lente sur mobile (0,3 à 2,6 s par requête).",
    task: 'Ouvrez la page du compte et observez le solde et « in flight » pendant quelques secondes. Puis revenez en arrière, rouvrez-la et observez le journal réseau.',
    solutionNote: "Même carte, mais le polling utilise un setTimeout récursif et l'effet le nettoie.",
  },
  'junior/04-promises-and-async-await': {
    scenario:
      "Une page de paiement de voyage charge votre profil, votre panier et vos moyens de paiement, puis demande le total à l'API de tarification avant d'afficher « Pay ».",
    task: 'Appuyez sur « Load checkout » et vérifiez le temps de chargement et le total. Puis activez « Payments API down » et rechargez.',
    solutionNote: 'Mêmes API : Promise.all pour les appels indépendants, await sur le total, vérification de res.ok et try/catch/finally.',
  },
  'junior/05-array-methods': {
    scenario:
      "Un panier de courses en ligne liste vos articles, affiche le total et, à la demande, l'article le moins cher. Un panneau latéral montre les articles dans l'ordre où vous les avez ajoutés.",
    task: 'Regardez la liste du panier et le total. Puis appuyez sur « Sort by price » et vérifiez « Cheapest » et le panneau « Recently added ».',
    solutionNote: 'Même panier : filter + map pour les lignes, reduce qui démarre à 0, et une copie triée avec un comparateur numérique.',
  },
  'junior/06-event-listeners-and-delegation': {
    scenario:
      "Une boîte de réception webmail (DOM pur, sans React) où chaque ligne d'e-mail a un bouton « Delete ». D'autres e-mails arrivent via « Load more » et « Check new mail ».",
    task: 'Supprimez un e-mail. Appuyez sur « Load more » et supprimez un des nouveaux. Puis appuyez sur « Check new mail » et supprimez un des e-mails plus anciens.',
    solutionNote:
      'Même boîte de réception, mais un seul listener de clic sur la liste gère tous les boutons « Delete », anciens ou nouveaux.',
  },
  'junior/07-props-vs-state': {
    scenario:
      "Une page de réservation d'hôtel : choisissez une chambre ci-dessous, et l'en-tête affiche le prix de votre séjour de 2 nuits. Vous pouvez aussi changer d'hôtel.",
    task: "Choisissez « Suite » et vérifiez le total dans l'en-tête. Puis passez à l'autre hôtel et comparez la chambre mise en surbrillance avec l'en-tête.",
    solutionNote: 'Même page, mais la chambre sélectionnée est un state du parent, transmis en prop avec un callback onSelect.',
  },
  'junior/08-usestate-vs-usereducer': {
    scenario:
      "Un panier de livraison de repas : ajoutez des plats depuis le menu, le badge de l'en-tête les compte, et le panier affiche le nombre d'articles et le total.",
    task: 'Appuyez sur « Add ×3 » pour la pizza, puis sur « Add » pour les ramen. Comparez le badge, les lignes, « Items » et « Total ». Puis supprimez une ligne.',
    solutionNote: 'Même panier, mais un seul reducer possède les articles, et count/total en sont dérivés.',
  },
  'junior/09-class-vs-functional-components': {
    scenario:
      'Une page de sport en direct affiche le score du match sélectionné, poussé par un socket live, avec un bouton « Follow » pour recevoir des alertes.',
    task: 'Ouvrez les scores en direct, attendez un but, puis passez à un autre match et observez les événements. Cliquez sur « Follow ». Fermez et rouvrez la page plusieurs fois.',
    solutionNote: 'Même page en composant fonction : un useEffect par matchId avec cleanup, et plus de `this` à perdre.',
  },
  'junior/10-hooks-and-custom-hooks': {
    scenario:
      "La page article d'un site d'actualités choisit une mise en page mobile ou desktop selon la taille de l'écran. Les lecteurs connectés ont aussi un bouton « Save for later ».",
    task: "Ouvrez l'article, revenez en arrière, répétez deux fois, puis appuyez sur « Fire resize event ». Enfin, ouvrez l'article et appuyez sur « Log in ».",
    solutionNote:
      "Même page, mais la logique d'écran est un hook useMediaQuery avec cleanup, et chaque hook est appelé au niveau supérieur.",
  },
  'junior/11-routing-react-router': {
    scenario:
      "Une petite boutique en ligne : ajoutez des promos à votre panier sur la page d'accueil, parcourez les produits et ouvrez une fiche produit. L'en-tête affiche votre panier.",
    task: "Ajoutez 2 promos au panier, cliquez sur « Products » dans l'en-tête, puis ouvrez n'importe quel produit. Observez le panier et la page.",
    solutionNote: 'Même boutique : une route de layout avec <Outlet />, <NavLink> au lieu de <a href>, et un paramètre :productId.',
  },
  'junior/12-flexbox-vs-grid': {
    scenario:
      "Un site immobilier liste des biens sous forme de cartes à côté d'une barre latérale de filtres. Chaque carte a une photo, une adresse, un prix et un bouton « Contact agent ».",
    task: 'Regardez la dernière rangée de cartes, les boutons « Contact agent », et faites défiler horizontalement. Essayez avec 4, 5 et 7 annonces.',
    solutionNote: 'Même markup : Grid pour la page et la galerie de cartes, une colonne flex dans chaque carte.',
  },
  'junior/13-responsive-design': {
    scenario:
      "La page menu d'une pizzeria a été construite et vérifiée sur un ordinateur portable. Maintenant, les clients l'ouvrent sur leur téléphone.",
    task: "Faites glisser le curseur « Screen width » jusqu'à 320px. Observez le menu, l'indicateur de défilement et la taille du bouton « Add ».",
    solutionNote: 'Même menu, mais une grille fluide en auto-fit, une container query sur chaque carte et une zone tactile de 44px.',
  },
  'junior/14-web-accessibility': {
    scenario:
      "Le formulaire « Transfer money » d'une banque. Un client qui ne peut pas utiliser de souris le parcourt au clavier avec un lecteur d'écran.",
    task: "Cliquez dans « Amount », puis utilisez uniquement Tab, Maj+Tab et Entrée : envoyez un virement vide, puis envoyez 50. Lisez le journal du lecteur d'écran.",
    solutionNote:
      'Même formulaire, mais avec un vrai <form>, des <label>, un <button> avec du texte, une erreur annoncée et un focus ring visible.',
  },
  'junior/15-storybook-and-component-driven-architecture': {
    scenario:
      "L'équipe d'une boutique garde son ProductCard dans un mini Storybook, une story par état, avant de le livrer sur la page catégorie.",
    task: 'Parcourez chaque story de la barre latérale. Regardez le canvas et les vérifications automatiques en dessous.',
    solutionNote:
      'Mêmes stories, mais la carte est conçue pour chaque état : skeleton, titre qui passe à la ligne, valeurs de repli, désactivée en cas de rupture de stock.',
  },
  'junior/16-rest-vs-graphql': {
    scenario:
      "L'écran mobile « My orders » d'une boutique sur une connexion 3G : il affiche votre nom et vos dernières commandes, chacune avec un nom de produit.",
    task: "Appuyez sur « Open My orders » et regardez le panneau réseau se remplir. Comparez les requêtes, les KB et le temps jusqu'à l'affichage.",
    solutionNote: "Même écran, une seule requête GraphQL qui demande exactement les champs qu'il affiche.",
  },
  'junior/17-git-version-control': {
    scenario:
      'Vendredi dans une startup SaaS : Ana et Ben modifient tous les deux Dashboard.tsx dans le même dépôt, et main est déployé automatiquement en production.',
    task: "Exécutez chaque commande dans l'ordre (la suivante s'allume). Puis vérifiez quel travail se retrouve sur main.",
    solutionNote: 'Mêmes deux modifications, mais via des feature branches, des PR, un rebase et une branche main protégée.',
  },
  'junior/18-npm-vs-yarn': {
    scenario:
      "Un tableau de bord commercial se build sans problème sur tous les portables. L'équipe pousse sur la CI, qui le build et le déploie en production.",
    task: 'Lancez le build sur le portable, puis appuyez sur « chart-lib publishes 3.2.0 », puis sur « Push → CI build ». Comparez les versions installées.',
    solutionNote: 'Même projet, mais package-lock.json est commité et la CI exécute npm ci.',
  },
  'junior/19-nextjs-and-advantages-over-react': {
    scenario:
      'Nordic Home vend des meubles en ligne. Le marketing partage la nouvelle page de la table en chêne sur les réseaux sociaux et attend le trafic de Google.',
    task: 'Appuyez sur « Crawl the page » et « Share the link », puis sur « Open on a phone ». Regardez ce que chacun reçoit réellement.',
    solutionNote:
      'Même page migrée vers le Next.js App Router : HTML rendu côté serveur avec métadonnées, ISR et un seul petit composant client.',
  },
  'junior/20-unit-testing-jest-rtl': {
    scenario:
      "Un formulaire d'inscription à une newsletter avec une suite de tests au vert. Un collègue refactore son markup vers CSS Modules ; ce que voient les utilisateurs reste identique.",
    task: 'Appuyez sur « Run tests » (tout est vert). Puis appuyez sur « Refactor component » et à nouveau sur « Run tests ».',
    solutionNote: 'Même composant et même refactor, mais les tests interrogent par label, rôle et texte, comme un utilisateur.',
  },
  'junior/21-e2e-testing-cypress': {
    scenario:
      "Un site de voyage exécute un test end-to-end sur chaque pull request : chercher « Lisbon », s'attendre à des résultats d'hôtels. L'API de recherche prend de 0,25 à 1,25 s.",
    task: "Appuyez sur « Run 5× » (et recommencez si vous voulez). Observez l'historique des exécutions et le journal des commandes.",
    solutionNote: "Même app et même API, mais le test attend une assertion qui se relance au lieu d'un sleep fixe.",
  },
  'junior/22-debugging-js-and-react': {
    scenario:
      'Un tableau de bord de support : les agents cliquent sur un ticket à gauche et lisent ses messages à droite avant de répondre.',
    task: "Cliquez sur le ticket #101, puis rapidement (en moins d'une seconde) sur #102. Comparez l'en-tête avec les messages. Puis lisez la console.",
    solutionNote:
      "Même panneau, mais l'effet annule la requête précédente dans son cleanup. Les logpoints et le panneau Network montrent pourquoi.",
  },
  'junior/23-coding-product-search-component': {
    scenario:
      'Une pharmacie en ligne a un champ de recherche de produits au-dessus de son catalogue. Les clients tapent ce dont ils ont besoin, souvent sur un clavier de téléphone.',
    task: "Tapez (ou touchez) « IBUPROFEN », puis « vitamin » suivi d'une espace, puis « zzz ». Observez les résultats à chaque fois.",
    solutionNote:
      'Même catalogue : seul le texte recherché est un state, la liste est dérivée, insensible à la casse et trimée, avec un label et un état vide.',
  },
  'junior/24-coding-complete-frontend-app': {
    scenario:
      "Une application de catalogue produits, exercice take-home, qui charge les produits depuis l'API d'une boutique et les affiche dans une grille.",
    task: "Appuyez une fois normalement sur « Reload app », puis cochez « Make the API fail » et rechargez. Observez l'écran et la console.",
    solutionNote:
      'Même API : un client API qui vérifie res.ok, un hook avec loading / error / empty / success, et un bouton pour réessayer.',
  },

  // ---------------------------------------------------------------- mid
  'mid/01-event-loop-microtasks-rendering': {
    scenario:
      "Un tableau de bord logistique importe un CSV d'expéditions par lots et affiche une barre de progression pour que l'utilisateur puisse suivre l'import.",
    task: 'Cliquez sur « Import shipments.csv » et observez la barre de progression, le compteur « screen updates » et le gel le plus long.',
    solutionNote:
      'Même import par lots, mais chaque lot cède la main via une vraie tâche (setTimeout), donc le navigateur peint entre les lots.',
  },
  'mid/02-debounce-throttle-high-frequency-events': {
    scenario:
      'Un tableau de bord de trading crypto propose une recherche de symboles qui affiche les résultats pendant la saisie, et un graphique de prix avec un réticule au survol.',
    task: 'Tapez « eth » rapidement dans la recherche, puis attendez. Comparez le compteur de requêtes et la recherche à laquelle correspondent les résultats. Puis survolez le graphique.',
    solutionNote:
      'Même UI : la recherche est debouncée (300 ms) avec AbortController, et le réticule est throttlé à une mise à jour toutes les 100 ms.',
  },
  'mid/03-useeffect-vs-uselayouteffect': {
    scenario:
      "Un graphique d'analytics SaaS affiche un tooltip quand vous survolez un point de données. Près du bord droit, le tooltip doit basculer du côté gauche.",
    task: 'Survolez (ou touchez) plusieurs fois les derniers points à droite du graphique. Observez le tooltip et le compteur « frames painted off-chart ».',
    solutionNote: "Même tooltip et même code de mesure, mais il s'exécute dans useLayoutEffect : avant que le navigateur ne peigne.",
  },
  'mid/04-useeffect-cleanup-and-unmounting': {
    scenario: "Une app de VTC a un écran « Driver on the way » qui interroge la position du chauffeur tant qu'il est ouvert.",
    task: "Ouvrez l'écran de suivi, changez de course, fermez-le, puis rouvrez-le plusieurs fois. Observez « active pollers » et la console.",
    solutionNote: "Même suivi, mais l'effet retourne un cleanup : vider l'interval, annuler la requête, retirer le listener.",
  },
  'mid/05-state-batching-setcount-three-times': {
    scenario:
      "Le checkout d'un service de livraison de courses permet d'ajouter un avocat avec « + », ou un lot de trois avec « +3 bundle ». L'analytics enregistre chaque lot.",
    task: 'Cliquez une ou deux fois sur « +3 bundle ». Comparez la quantité avec ce que vous attendiez, et lisez le journal analytics.',
    solutionNote:
      "Même panier : le setter utilise un updater (q => q + 1), et la nouvelle valeur est calculée une seule fois pour l'analytics.",
  },
  'mid/06-stale-closure-in-useeffect': {
    scenario:
      "Un widget de chat support affiche un compteur de non-lus et joue un ping pour les nouveaux messages de l'agent, sauf si le client coupe le son.",
    task: 'Cliquez 3 fois sur « Agent replies ». Désactivez « Sound » et répondez à nouveau. Puis changez de ticket et répondez. Observez le compteur, les pings et la console.',
    solutionNote:
      'Même widget : un updater pour unread, une « latest ref » pour soundOn (useEffectEvent en React 19.2+), et [ticketId] comme dépendance.',
  },
  'mid/07-array-index-as-key': {
    scenario:
      "Une liste de courses où chaque article a son propre champ de note. Les notes sont saisies par l'utilisateur (inputs non contrôlés).",
    task: 'Supprimez « Milk ». Puis regardez quelle note se trouve à côté de « Bread » et de « Eggs ».',
    solutionNote: "Même liste, avec item.id comme key au lieu de l'index du tableau.",
  },
  'mid/08-unnecessary-rerenders-and-memo': {
    scenario: "La page clients d'un CRM a un champ « Quick note » en haut et un tableau de clients (enveloppé dans memo) en dessous.",
    task: 'Tapez quelques mots dans « Quick note ». Observez les compteurs de rendu clignoter sur le tableau et sur chaque ligne.',
    solutionNote: 'Même page : le state de la note vit dans son propre composant, filter passe par useMemo et onSelect par useCallback.',
  },
  'mid/09-react-performance-optimization-techniques': {
    scenario:
      'Une page de recherche immobilière liste 300 biens et propose en haut un filtre « City » qui affine la liste pendant la saisie.',
    task: 'Tapez « lisbon » rapidement dans le champ « City », puis effacez-le. Observez comment les lettres apparaissent et le temps « keystroke → screen ».',
    solutionNote:
      'Même liste et même coût par carte : le filtre passe par useMemo et la liste est rendue à partir de useDeferredValue(city).',
  },
  'mid/10-context-api-and-rerender-problem': {
    scenario:
      "Une app de livraison de repas affiche le menu d'un restaurant, un badge de panier et l'ETA du livreur en direct. Les données de l'app (utilisateur, panier, ETA) sont partagées via un context.",
    task: "Cliquez sur « Add » pour un plat, puis activez l'ETA en direct pendant quelques secondes. Observez les compteurs de rendu sur chaque élément du menu.",
    solutionNote:
      "Même app, mais l'utilisateur, le state du panier, les actions du panier et l'ETA vivent dans des contexts séparés avec des valeurs mémoïsées.",
  },
  'mid/11-forms-validation-controlled-uncontrolled': {
    scenario:
      "Le formulaire d'inscription d'un SaaS B2B demande un e-mail professionnel, un mot de passe, la taille de l'entreprise et un numéro de TVA optionnel avant de créer le compte.",
    task: 'Commencez à taper un e-mail et observez les erreurs. Puis remplissez le formulaire avec la TVA « FR12 », choisissez une taille, et double-cliquez sur « Create account ».',
    solutionNote:
      'Version faite main de RHF + zod : inputs non contrôlés, un seul jeu de règles, erreurs au blur, liens aria, conversion en nombre, garde contre la double soumission.',
  },
  'mid/12-data-fetching-hook-race-conditions-retries': {
    scenario:
      "Une page de recherche de vols suggère des aéroports de départ pendant que vous tapez une ville. L'API des aéroports est parfois lente et parfois instable.",
    task: "Cliquez sur « Type Paris fast » et regardez les résultats. Puis réglez l'API sur « flaky » et cherchez quelques villes.",
    solutionNote:
      "Même page : chaque exécution de l'effet possède un AbortController + un flag ignore, vérifie res.ok, et relance les 5xx avec backoff.",
  },
  'mid/13-lazy-loading-code-splitting': {
    scenario:
      "Une application de banque en ligne (SPA React) est ouverte sur un téléphone en 4G. Les utilisateurs n'ont d'abord besoin que du formulaire de connexion, puis de leurs comptes.",
    task: 'Cliquez sur « Open bank.example on 4G », connectez-vous, puis survolez et ouvrez « Investments » et « Statements ». Observez la waterfall, les KB et le time to interactive.',
    solutionNote:
      'Même app, découpée par route avec React.lazy : la connexion est livrée seule, les autres pages se chargent à la demande et sont préchargées au survol.',
  },
  'mid/14-large-lists-virtualization': {
    scenario:
      "Un panneau d'administration logistique affiche toutes les expéditions dans un seul tableau défilant, avec un champ de recherche pour filtrer par client.",
    task: 'Cliquez sur « Load shipments », puis tapez « acme » rapidement dans le champ de recherche et faites défiler le tableau. Observez les statistiques.',
    solutionNote: '50 000 expéditions, mais seules les lignes visibles dans le viewport de défilement existent dans le DOM.',
  },
  'mid/15-ssr-csr-hydration': {
    scenario:
      'Un site de voyage affiche ses résultats de recherche de vols. Les visiteurs viennent de nombreux fuseaux horaires et certains ont déjà vu la promo.',
    task: "Lancez le chargement CSR, puis passez en SSR et relancez. Observez la page, l'heure de départ et la console.",
    solutionNote:
      "Même page SSR : l'heure est formatée dans le fuseau horaire de l'aéroport, et localStorage est lu dans un effet après l'hydratation.",
  },
  'mid/16-nextjs-data-fetching-getstaticprops-getserversideprops': {
    scenario:
      "Une boutique d'électronique rend ses fiches produits avec Next.js. L'équipe modifie les prix dans l'admin, les clients rechargent la fiche produit.",
    task: "Saisissez un nouveau prix dans l'admin et enregistrez. Puis cliquez plusieurs fois sur « Customer reloads » (essayez aussi « Wait 5 min »).",
    solutionNote: 'Même page, maintenant avec revalidate: 300 (ISR), ou getServerSideProps pour des données toujours fraîches.',
  },
  'mid/17-bff-backend-for-frontend': {
    scenario:
      "L'écran d'accueil d'une web app de livraison de repas affiche le message de bienvenue, les restaurants à proximité, les promotions et la commande en cours, sur un téléphone milieu de gamme en 4G.",
    task: 'Appuyez sur « Open the app » et observez la waterfall réseau, la taille des payloads et le contenu des réponses.',
    solutionNote:
      "Même écran : un seul appel à /api/home ; le BFF parallélise les appels côté serveur et ne renvoie que ce dont l'écran a besoin.",
  },
  'mid/18-monorepo-and-shared-dependencies': {
    scenario:
      'Un monorepo contient apps/web (React 19) et packages/ui, le design system partagé qui exporte <Dropdown>. Un développeur vient de mettre à jour le package ui.',
    task: "Lancez « pnpm install », regardez l'arbre des dépendances, puis démarrez l'app et ouvrez la page qui utilise <Dropdown>.",
    solutionNote: "React est une peerDependency de @acme/ui et l'app la lie avec workspace:*, donc il n'y a qu'un seul React.",
  },
  'mid/19-slow-api-loading-ux': {
    scenario:
      "Un comparateur d'assurances récupère des devis d'assurance auto auprès d'un agrégateur qui met plusieurs secondes à répondre.",
    task: 'Cliquez sur « Get quotes », puis cliquez à nouveau parce que rien ne semble se passer. Essayez aussi « Server stuck » et « Save » sur un devis.',
    solutionNote:
      'Même page : skeleton + texte de progression, résultats en cache, « Cancel » et un timeout de 8 s, et un « Save » optimiste.',
  },
  'mid/20-double-click-pay-idempotency': {
    scenario:
      "Un site de billetterie vend des places de concert en prévente. L'API de paiement est lente pendant le rush, alors les utilisateurs s'impatientent sur le bouton « Pay ».",
    task: 'Cliquez sur « ⚡ Double-click Pay » (deux clics dans la même frame), puis sur « Reset », cochez « Flaky network » et cliquez une seule fois sur « Pay ».',
    solutionNote:
      'Même bouton : le garde-fou est une ref (synchrone), et chaque tentative porte une Idempotency-Key que le serveur dédoublonne.',
  },
  'mid/21-authentication-authorization': {
    scenario: 'Une app de facturation B2B. Lena se connecte avec le rôle « viewer » ; la page charge aussi un widget de chat tiers.',
    task: 'Connectez-vous, puis exécutez le script du widget de chat. Ensuite, utilisez « Replay request » (comme depuis les DevTools) pour supprimer une facture en tant que viewer.',
    solutionNote: "Même app : la session est un cookie httpOnly, et l'API vérifie le rôle à chaque requête (403).",
  },
  'mid/22-memory-leaks-react': {
    scenario:
      "Un tableau de bord de trading reste ouvert toute la journée. Les traders ouvrent le panneau du graphique de prix et changent d'instrument plusieurs fois par heure.",
    task: "Ouvrez le graphique, changez d'instrument plusieurs fois, puis fermez-le. Observez les statistiques et la console.",
    solutionNote: "Même graphique : l'effet retourne un cleanup qui retire les listeners et vide l'interval.",
  },
  'mid/23-xss-csrf-protection': {
    scenario:
      'Une communauté de recettes permet de publier des avis avec une mise en forme simple (gras, italique). Les membres restent connectés grâce à un cookie de session.',
    task: "Publiez l'avis prérempli et observez le panneau de l'attaquant. Puis cliquez sur « Visit evil-site.example » et observez le solde du compte.",
    solutionNote:
      'Même page : les avis passent par un sanitizer à liste blanche, et le cookie est SameSite=Lax + chaque POST exige un token CSRF.',
  },
  'mid/24-env-config-secrets': {
    scenario:
      "Une app Vite « AI resume writer » améliore votre CV grâce à un fournisseur de LLM. L'équipe vient de la mettre en production.",
    task: 'Cliquez sur « vite build », puis cherchez « sk- » dans le bundle comme le ferait un attaquant, et utilisez ce que vous trouvez.',
    solutionNote: "Même app : la clé vit uniquement dans l'env du serveur ; le bundle se contente d'appeler /api/improve-resume.",
  },
  'mid/25-error-boundary-async-failures': {
    scenario:
      "Le tableau de bord d'un portail patient enveloppe son widget « Lab results » dans une Error Boundary, pour qu'un widget cassé affiche une carte permettant de réessayer.",
    task: "Cliquez sur « Open dashboard » pendant que l'API du labo est en panne. Attendez, puis regardez le widget et la console.",
    solutionNote:
      "Même widget : l'erreur asynchrone est déplacée dans le rendu (setState(() => { throw err })), donc la boundary l'attrape.",
  },
  'mid/26-multi-tab-logout-sync': {
    scenario:
      "Une app de banque en ligne est ouverte dans deux onglets sur un ordinateur familial partagé : « Settings » dans l'onglet A, « Accounts » dans l'onglet B.",
    task: "Cliquez sur « Log out » dans l'onglet A, puis regardez l'onglet B et essayez « Send €200 » depuis celui-ci.",
    solutionNote: 'Mêmes onglets : la déconnexion révoque la session côté serveur et est diffusée sur un vrai BroadcastChannel.',
  },

  // ---------------------------------------------------------------- senior
  'senior/01-virtual-dom-reconciliation-fiber': {
    scenario:
      "Une page de devis d'assurance : le client saisit son nom, son adresse et sa plaque, puis coche « Add premium coverage » et la carte prend un style premium.",
    task: 'Remplissez les trois champs, puis cochez « Add premium coverage ». Observez les champs et le compteur de montages (mounts).',
    solutionNote:
      'Même page, mais un seul composant <Card variant> : même type à la même position, donc React se contente de patcher la classe.',
  },
  'senior/02-setstate-to-pixels-rendering-pipeline': {
    scenario:
      "Un tableau Kanban de 300 cartes garde des hauteurs de cartes égales pendant qu'un tiroir latéral glisse à l'ouverture du tableau.",
    task: "Appuyez sur « Open board » et observez les statistiques de temps par frame et le tiroir pendant les 2 secondes d'exécution.",
    solutionNote:
      'Même tableau : toutes les lectures, puis toutes les écritures (un seul layout par frame), et le tiroir glisse avec transform.',
  },
  'senior/03-react-concurrent-features': {
    scenario:
      "Un catalogue de pièces B2B filtre 8 000 SKU côté client pendant que l'acheteur tape dans le champ de recherche, avec des vues « Grid » et « Table ».",
    task: 'Tapez « brake disc » rapidement dans le champ de recherche, puis basculez entre « Grid » et « Table ». Observez le temps par frappe.',
    solutionNote:
      'Même catalogue : la liste est rendue depuis useDeferredValue, les onglets changent dans startTransition, et la liste est mémoïsée.',
  },
  'senior/04-state-management-architecture': {
    scenario:
      'Un back-office logistique : les dispatchers voient une liste « Orders » à côté de la commande sélectionnée, et marquent les commandes comme expédiées.',
    task: 'Ouvrez ORD-1002, appuyez sur « Mark shipped », puis comparez la liste avec le serveur. Essayez aussi « Colleague ships ORD-1004 » et « Refocus tab ».',
    solutionNote:
      'Mêmes écrans, mais les deux panneaux lisent un seul cache de requêtes ; la mutation invalide ["orders"] donc chaque vue refait son fetch.',
  },
  'senior/05-centralized-error-handling-retries': {
    scenario:
      'Un tableau de bord bancaire charge cinq widgets en parallèle ; les access tokens expirent au bout de 15 minutes et le refresh token change à chaque utilisation (rotation).',
    task: 'Appuyez une fois sur « Transfer €50 ». Puis appuyez sur « Wait 15 min » et « Refresh dashboard ». Observez les virements, les appels de refresh et les toasts.',
    solutionNote:
      'Même client : une seule promesse de refresh partagée, des retries uniquement pour les requêtes idempotentes ou avec clé, avec backoff + jitter, et des toasts dédoublonnés.',
  },
  'senior/06-data-fetching-patterns': {
    scenario:
      "Une app de gestion de projet ouverte sur le Wi-Fi d'un hôtel (~300 ms par aller-retour) : la page projet affiche le projet, ses tâches avec leurs assignés, et l'activité.",
    task: 'Ouvrez « Apollo », regardez la timeline et le temps total, puis ouvrez « Zephyr » et revenez à « Apollo ».',
    solutionNote:
      'Même page : requêtes parallèles (tâches jointes avec les assignés), prefetch au survol/focus, et un cache stale-while-revalidate.',
  },
  'senior/07-bundle-size-explosion': {
    scenario:
      "Un tableau de bord d'analytics SaaS : après deux trimestres de PR, la page de connexion (un formulaire, rien d'autre) livre bien plus de JavaScript qu'avant.",
    task: "Lisez l'analyseur pour la route de connexion, puis appuyez sur « Run CI » pour voir ce que dit le budget de taille.",
    solutionNote: 'Même analyseur : appliquez les quatre correctifs un par un et observez les KB, le temps de chargement et le budget CI.',
  },
  'senior/08-slow-page-and-real-device-performance': {
    scenario:
      "La page de recherche d'une marketplace d'occasion obtient 98 sur Lighthouse sur un portable, mais les utilisateurs Android disent que toucher « Filters » ne fait rien pendant un moment.",
    task: "En 1x, appuyez sur « Load page » puis sur « Filters ». Passez en 6x (Android milieu de gamme) et recommencez. Comparez l'INP en lab et sur le terrain.",
    solutionNote:
      "Même page et même travail, découpé en lots d'environ 50 éléments qui rendent la main au main thread ; le widget de chat attend que le navigateur soit inactif.",
  },
  'senior/09-caching-layers': {
    scenario:
      'Une boutique livre une nouvelle version. Le CDN sert index.html et des fichiers JS hashés. Un client régulier ouvre le site une heure après le déploiement.',
    task: 'Appuyez sur « Deploy v2 », puis sur « Customer opens the site ». Observez chaque requête.',
    solutionNote: 'Le HTML est revalidé à chaque visite ; les assets hashés sont mis en cache pour toujours.',
  },
  'senior/10-server-vs-client-components': {
    scenario:
      'Une fiche produit de marketplace sous Next.js App Router : une description en markdown, des infos vendeur et un bouton « Add to cart » avec un sélecteur de quantité.',
    task: 'Essayez de retirer « use client » de page.tsx, remettez-le, puis appuyez sur « View page source » et vérifiez la statistique JS.',
    solutionNote:
      "Même page : cliquez sur les fichiers pour descendre « use client » jusqu'à AddToCart ; la page passe un DTO, pas la ligne de la base de données.",
  },
  'senior/11-server-actions-vs-api-routes': {
    scenario:
      "Un outil de gestion de projet multi-tenant construit avec Next.js : seul le propriétaire d'un projet voit son bouton « Delete project ». Deux entreprises l'utilisent.",
    task: "En tant que Mallory, mettez l'id d'Apollo (issu d'un lien partagé) dans la requête capturée et appuyez sur « Replay ». Puis regardez les projets d'Alice.",
    solutionNote:
      "Même action, mais elle vérifie la session, valide l'entrée et restreint la suppression par ownerId ; le mobile et les webhooks passent par un Route Handler.",
  },
  'senior/12-realtime-websocket-sse-ordering': {
    scenario:
      'Une app de livraison de repas suit une commande en direct via un WebSocket ; les services restaurant et livreur publient des mises à jour à travers plusieurs instances serveur.',
    task: 'Appuyez sur « Start order » et observez le statut. Relancez et appuyez sur « Enter tunnel » à mi-parcours (2,5 s sans réseau).',
    solutionNote:
      'Même socket, mais les événements portent un seq : doublons ignorés, événements en avance mis en tampon, et un snapshot est rechargé après un trou ou une reconnexion.',
  },
  'senior/13-pwa-offline-sync': {
    scenario:
      'Des commerciaux prennent les commandes des magasins sur une web app mobile, souvent dans des réserves en sous-sol où le signal va et vient.',
    task: "Sélectionnez « No signal », envoyez une commande, appuyez sur « Next shop », puis revenez à « Good signal ». Essayez aussi une commande en « Weak signal » en l'envoyant deux fois.",
    solutionNote:
      "Les commandes vont d'abord dans une outbox IndexedDB (UUID côté client), puis se synchronisent de façon idempotente au retour du signal.",
  },
  'senior/14-micro-frontends': {
    scenario:
      "Un site de vente est composé d'un shell et de deux apps distantes : Catalog (équipe A) et Checkout (équipe B). Chaque équipe déploie à son propre rythme.",
    task: 'Ajoutez un article au panier. Puis appuyez sur « Team B deploys Checkout 1.42.0 » et réessayez. Observez le badge du panier, les boutons et le JS téléchargé.',
    solutionNote:
      "Singleton React partagé, un contrat d'événements au lieu des internals du store, du CSS scopé et un manifeste de remotes versionné.",
  },
  'senior/15-design-system-at-scale': {
    scenario:
      "Trois équipes produit (Marketing, Dashboard, Checkout) livrent chacune leurs propres écrans. L'entreprise change de charte : sa couleur primaire passe du bleu au vert.",
    task: 'Déployez la nouvelle charte sur les trois apps, puis comptez combien de boutons primaires ont réellement changé et combien de bleus restent.',
    solutionNote: 'Mêmes écrans, mais chaque bouton vient de @acme/ui et lit un seul token sémantique.',
  },
  'senior/16-ci-cd-multi-env': {
    scenario:
      'Un tableau de bord bancaire livre la release v2.4 en production en passant par la staging. La QA valide la staging avant la mise en ligne.',
    task: 'Appuyez sur « Release v2.4 » et observez quel bundle tourne dans chaque environnement. Si la production casse, appuyez sur « Roll back ».',
    solutionNote:
      "Builder une seule fois, promouvoir le même artefact avec un config.json par environnement, et revenir en arrière en repointant vers l'artefact précédent.",
  },
  'senior/17-feature-flags-ab-testing': {
    scenario:
      'Une boutique teste en A/B un nouveau checkout sur une seule page contre le checkout actuel en trois étapes. La moitié des utilisateurs doit voir chaque version.',
    task: 'Commencez à taper votre e-mail immédiatement, puis appuyez plusieurs fois sur « Refresh page ». Observez la page et le compteur « variants seen ».',
    solutionNote:
      "La variante est décidée avant le premier rendu à partir d'un hash de l'id utilisateur, donc elle ne bascule jamais et ne change pas au rafraîchissement.",
  },
  'senior/18-monitoring-error-tracking': {
    scenario:
      "Le checkout d'une app de livraison de repas remonte les erreurs navigateur à un outil de suivi d'erreurs. Samedi, le paiement par titre-restaurant commence à échouer.",
    task: 'Appuyez une fois sur « Pay with meal voucher », puis sur « Simulate Saturday traffic ». Pouvez-vous dire ce qui a cassé, où dans le code, depuis quel déploiement, et qui a été alerté ?',
    solutionNote:
      'Source maps cachées + tag de release + contexte utilisateur, bruit filtré, événements regroupés en issues, et une alerte basée sur un taux.',
  },
  'senior/19-reproducing-rare-production-bugs': {
    scenario:
      "Une app de réservation de clinique liste les créneaux libres d'une journée. Environ 1 % des utilisateurs disent que le calendrier est vide ou affiche le mauvais jour ; sur nos portables, tout semble correct.",
    task: 'Ouvrez la page de réservation sur chaque appareil du labo. Lesquels affichent le mauvais jour ou un calendrier vide ?',
    solutionNote:
      "Mêmes données d'API, mais les dates sont parsées explicitement en composants et formatées avec Intl et un timeZone explicite.",
  },
  'senior/20-code-review-and-quality-standards': {
    scenario:
      'Une équipe SaaS relit une pull request qui ajoute un export de facturation. Les reviewers sont occupés et la PR est volumineuse.',
    task: "Cliquez sur les lignes suspectes du diff (ou sur la pastille de taille) pour les signaler, puis approuvez. Ou appuyez simplement sur « LGTM » comme l'équipe le fait d'habitude.",
    solutionNote: "La CI (lint, types, règles a11y) annote les problèmes mécaniques ; la checklist de PR oriente l'humain vers le reste.",
  },
  'senior/21-technical-debt-management': {
    scenario:
      "Une app SaaS React vieille de cinq ans : l'équipe planifie 40 points par sprint, et la zone « reports » dépasse sans cesse ses estimations.",
    task: 'Appuyez cinq ou six fois sur « Run next sprint ». Observez les points de fonctionnalités livrés et les bugs par sprint.',
    solutionNote:
      "Même équipe et même capacité, mais 20 % de chaque sprint rembourse l'élément prioritaire d'un registre de dette, et des règles de lint en cliquet (ratchet) bloquent toute nouvelle dette.",
  },
  'senior/22-mentoring-and-technical-interviews': {
    scenario:
      "Une équipe vient d'embaucher un développeur junior et fait aussi passer des entretiens à deux candidats pour un poste frontend de niveau intermédiaire.",
    task: 'Déroulez les deux premières semaines du junior, puis lancez le débrief de recrutement. Regardez la confiance du junior et qui est embauché.',
    solutionNote:
      'Un ticket bien délimité + du pair programming + des reviews qui font progresser ; un exercice structuré noté selon une grille partagée.',
  },
  'senior/23-legacy-migration': {
    scenario:
      "Le portail client d'un assureur tourne sur AngularJS 1.x, qui ne reçoit plus de correctifs de sécurité. L'équipe doit le migrer vers Next.js.",
    task: "Migrez le portail vers la nouvelle stack. Observez combien de temps rien n'est livré, ce qui casse pour les clients, et ce qu'il advient des connexions et des favoris.",
    solutionNote:
      "Next.js devient la porte d'entrée, les chemins non migrés retombent sur AngularJS, une seule session partagée, une route à la fois.",
  },
};
