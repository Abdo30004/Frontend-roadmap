// L’article « Les skills Claude pour les développeurs frontend » sur /skills.
// Les noms d’installation et les compteurs viennent du registre skills.sh (`npx skills find <name>`).
// Le texte accepte le `code inline` entre backticks.

export const INSTALLS_AS_OF = 'novembre 2026';

export interface Skill {
  /** Id d’ancre sur la page. */
  id: string;
  name: string;
  author: string;
  /** Ce que l’on passe à `npx skills add`. */
  pkg: string;
  /** Installations dans le registre ; null pour un ensemble de plusieurs skills. */
  installs: number | null;
  url: string;
  platforms?: string;
  lead: string[];
  list?: { title?: string; ordered?: boolean; items: string[] };
  after?: string[];
  when?: string;
  tip?: string;
}

export interface Section {
  id: string;
  title: string;
  intro: string[];
  skills: Skill[];
}

const registry = (pkg: string) => {
  const [repo, skill] = pkg.split('@');
  return skill ? `https://skills.sh/${repo}/${skill}` : `https://github.com/${repo}`;
};

const skill = (s: Omit<Skill, 'url'> & { url?: string }): Skill => ({ ...s, url: s.url ?? registry(s.pkg) });

/* ---------------------------------------------------------------- skills */

const reactBestPractices = skill({
  id: 'react-best-practices',
  name: 'react-best-practices',
  author: 'Vercel Labs',
  pkg: 'vercel-labs/agent-skills@vercel-react-best-practices',
  installs: 901_800,
  platforms: 'Tous les principaux agents',
  lead: [
    'C’est la base, et de loin le skill React le plus installé. Il couvre les hooks React, les patterns de composition, la performance et les conventions modernes de React.',
    'Sans lui, Claude écrit du code React qui fonctionne. Avec lui, Claude écrit du code React qu’un développeur senior validerait en code review. Installez-le en premier : tout le reste s’appuie dessus.',
  ],
  list: {
    title: 'Ce qu’il couvre',
    items: [
      'Les patterns de hooks modernes : `useCallback`, `useMemo` et les hooks personnalisés',
      'La structure des composants et les conventions de nommage',
      'Les approches de gestion d’état',
      'La performance : `memo`, le lazy loading et Suspense',
      'Les error boundaries et la gestion des erreurs',
    ],
  },
  when: 'Toujours. Installez-le et laissez-le activé : il améliore presque toutes les tâches React.',
});

const compositionPatterns = skill({
  id: 'composition-patterns',
  name: 'composition-patterns',
  author: 'Vercel Labs',
  pkg: 'vercel-labs/agent-skills@vercel-composition-patterns',
  installs: 456_000,
  platforms: 'Tous les principaux agents',
  lead: [
    'Celui-ci règle un problème qui s’aggrave à mesure que le projet grandit : le prop drilling et l’accumulation de props booléennes.',
    'Sans lui, Claude a tendance à créer des composants bardés de flags booléens : `isLarge`, `isDisabled`, `showIcon`, `hasBorder`. Ça marche dans un petit projet, et ça devient vite impossible à maintenir. Avec lui, Claude se tourne vers les compound components, les render props et des patterns de composition qui passent à l’échelle. Il prend le relais là où react-best-practices s’arrête.',
  ],
  list: {
    title: 'Ce qu’il couvre',
    items: [
      'Les patterns de compound components',
      'Les patterns headless UI',
      'La composition basée sur le contexte',
      'Éviter l’accumulation de props booléennes',
      'Des API de composants flexibles, à base de slots',
    ],
  },
  when: 'Les bibliothèques de composants, les design systems, ou tout projet avec des composants d’UI réutilisables. Dès que vous construisez autre chose qu’une simple landing page, il vous le faut.',
});

const remotion = skill({
  id: 'remotion-best-practices',
  name: 'remotion-best-practices',
  author: 'Remotion',
  pkg: 'remotion-dev/skills@remotion-best-practices',
  installs: 829_900,
  platforms: 'Tous les principaux agents',
  lead: [
    'Une surprise en haut du classement des installations. Remotion permet de créer des vidéos avec du code React, et ce skill apprend à Claude la manière Remotion de gérer les séquences, les transitions, la synchronisation audio et le rendu.',
  ],
  when: 'Les outils de création vidéo, le contenu automatisé pour les réseaux sociaux, ou tout produit qui transforme des données en vidéo.',
});

const vercelDeploy = skill({
  id: 'vercel-deploy',
  name: 'vercel-deploy',
  author: 'Vercel Labs',
  pkg: 'vercel-labs/agent-skills@vercel-deploy',
  installs: 581,
  platforms: 'Tous les principaux agents',
  lead: [
    'Ce n’est pas un skill frontend au sens habituel, mais dès que vous développez avec Next.js, déployer sur Vercel est l’étape suivante naturelle.',
    'Il détecte votre framework (plus de 40 sont pris en charge), configure le déploiement et renvoie une URL de preview. Votre agent passe de l’écriture du code à sa mise en production.',
  ],
  when: 'Associez-le aux règles pour agents fournies avec Next.js pour obtenir un workflow complet, du build au déploiement.',
});

const frontendDesign = skill({
  id: 'frontend-design',
  name: 'frontend-design',
  author: 'Anthropic',
  pkg: 'anthropics/skills@frontend-design',
  installs: 1_100_000,
  platforms: 'Tous les principaux agents',
  lead: [
    'Voici un problème que vous avez sans doute remarqué : les interfaces faites par l’IA se ressemblent toutes. Les mêmes mises en page en cartes, les mêmes boutons bleus, les mêmes sections hero génériques. On appelle ça l’« AI slop ».',
    'Ce skill s’attaque directement au problème. Il pousse Claude à faire des choix de design audacieux et assumés : des couleurs singulières, des mises en page inattendues et des patterns d’UI qui semblent pensés plutôt que générés. Il fonctionne avec React et Tailwind CSS, et donne le meilleur de lui-même quand vous fournissez à Claude une direction de design claire.',
  ],
  tip: 'Associez frontend-design à web-design-guidelines. Le premier s’occupe de la direction créative, le second des standards. Ensemble, ils donnent des interfaces à la fois singulières et soignées.',
});

const webDesignGuidelines = skill({
  id: 'web-design-guidelines',
  name: 'web-design-guidelines',
  author: 'Vercel Labs',
  pkg: 'vercel-labs/agent-skills@web-design-guidelines',
  installs: 865_500,
  platforms: 'Tous les principaux agents',
  lead: [
    'Là où frontend-design pousse vers des choix audacieux, ce skill s’assure que tout respecte les standards professionnels du design web. Voyez-le comme la checklist qualité qui accompagne chaque décision créative.',
    'C’est toute la différence entre « ça rend bien sur mon écran » et « ça rend bien partout ».',
  ],
  list: {
    title: 'Ce qu’il couvre',
    items: ['La typographie', 'Les espacements', 'Les systèmes de couleurs', 'Le comportement responsive', 'Les fondamentaux de l’accessibilité'],
  },
});

const uiUxProMax = skill({
  id: 'ui-ux-pro-max',
  name: 'ui-ux-pro-max',
  author: 'nextlevelbuilder',
  pkg: 'nextlevelbuilder/ui-ux-pro-max-skill@ui-ux-pro-max',
  installs: 453_300,
  lead: [
    'Une vaste bibliothèque de patterns UI et UX, de styles visuels et de recommandations d’accessibilité. Utile quand vous voulez que Claude choisisse parmi de nombreuses options éprouvées plutôt que d’inventer un style de zéro.',
  ],
});

const platformDesign = skill({
  id: 'platform-design-skills',
  name: 'platform-design-skills',
  author: 'ehmo',
  pkg: 'ehmo/platform-design-skills@web-design-guidelines',
  installs: 1_600,
  platforms: 'Tous les principaux agents',
  lead: [
    'Le skill de référence : plus de 300 règles de design tirées des Human Interface Guidelines d’Apple, de Material Design 3 et des WCAG 2.2.',
    'Il ne prend pas de décisions créatives à votre place ; il fait respecter les standards : zones tactiles, ratios de contraste, échelles typographiques, systèmes d’espacement et exigences d’accessibilité. C’est un ensemble avec un skill par plateforme, et la commande ci-dessous installe celui pour le web.',
  ],
  when: 'Quand ce que produit Claude doit respecter les guidelines d’une plateforme précise, par exemple dans des applications d’entreprise.',
});

const uiSkills = skill({
  id: 'ui-skills',
  name: 'ui-skills',
  author: 'ibelick',
  pkg: 'ibelick/ui-skills',
  installs: null,
  platforms: 'Tous les principaux agents',
  lead: [
    'Celui-ci est différent. Au lieu d’enseigner des patterns précis, il donne à Claude des contraintes bien tranchées qui l’orientent vers de meilleures décisions d’UI. C’est comme avoir un tech lead sensible au design qui relit chaque composant.',
    'C’est un petit ensemble de skills, dont `baseline-ui`, `improve-ui` et `fixing-accessibility`.',
  ],
});

const tailwindDesignSystem = skill({
  id: 'tailwind-design-system',
  name: 'tailwind-design-system',
  author: 'wshobson',
  pkg: 'wshobson/agents@tailwind-design-system',
  installs: 73_600,
  platforms: 'Tous les principaux agents',
  lead: ['Pour construire un design system évolutif avec Tailwind CSS, plutôt qu’un empilement de classes utilitaires ponctuelles.'],
  list: {
    title: 'Ce qu’il couvre',
    items: [
      'Des systèmes de couleurs et d’espacement basés sur des tokens',
      'Des variantes de composants avec `class-variance-authority` ou équivalent',
      'Des utilitaires responsive bien organisés',
      'Le dark mode',
      'Des patterns d’animation cohérents',
    ],
  },
  when: 'Quand vous voulez du code Tailwind qui suit un système plutôt que des classes improvisées.',
});

const shadcn = skill({
  id: 'shadcn-ui',
  name: 'shadcn-ui',
  author: 'Google Labs (Stitch)',
  pkg: 'google-labs-code/stitch-skills@shadcn-ui',
  installs: 54_700,
  platforms: 'Tous les principaux agents',
  lead: [
    'shadcn/ui est devenu la bibliothèque de composants de référence pour les projets React et Tailwind. Ce skill apprend à Claude à l’utiliser comme prévu. Sans lui, Claude écrit parfois de mauvais chemins d’import ou va à l’encontre du fonctionnement de shadcn.',
  ],
  list: {
    title: 'Ce qu’il couvre',
    items: [
      'Le modèle de composants à copier-coller (ce n’est pas une installation npm classique)',
      'La personnalisation des composants comme prévu',
      'L’accessibilité intégrée à chaque composant',
      'Les formulaires, les dialogues et les interactions complexes',
    ],
  },
  when: 'Tout projet qui utilise shadcn/ui.',
});

const figmaImplement = skill({
  id: 'figma-implement-design',
  name: 'figma-implement-design',
  author: 'OpenAI',
  pkg: 'openai/skills@figma-implement-design',
  installs: 7_100,
  lead: [
    'Transforme les maquettes Figma en code prêt pour la production. L’objectif est une précision au pixel près : espacements, couleurs, typographie et mise en page reproduits à l’identique. Il lit vos maquettes via le serveur MCP Figma.',
  ],
  when: 'Quand vous avez une maquette Figma finalisée à intégrer.',
});

const stitchLoop = skill({
  id: 'stitch-loop',
  name: 'stitch-loop',
  author: 'Google Labs',
  pkg: 'google-labs-code/stitch-skills@stitch-loop',
  installs: 57_600,
  lead: ['Au lieu de transformer une maquette en code d’un seul coup, il met en place une boucle de feedback :'],
  list: {
    ordered: true,
    items: [
      'Claude écrit le code à partir d’une référence de design.',
      'Vous le relisez et donnez votre feedback.',
      'Claude affine l’implémentation.',
      'On recommence jusqu’à ce que ce soit juste.',
    ],
  },
  after: ['C’est plus lent qu’une traduction en une seule passe, mais les résultats sont systématiquement meilleurs pour les interfaces complexes.'],
});

const enhancePrompt = skill({
  id: 'enhance-prompt',
  name: 'enhance-prompt',
  author: 'Google Labs',
  pkg: 'google-labs-code/stitch-skills@enhance-prompt',
  installs: 59_800,
  lead: [
    'Améliore vos prompts en y ajoutant des spécifications de design et du vocabulaire UI/UX. Il vous aide à formuler plus précisément ce que vous voulez, ce qui améliore les résultats de tous les autres skills de design.',
  ],
});

const threejs = skill({
  id: 'threejs-skills',
  name: 'threejs-skills',
  author: 'CloudAI-X',
  pkg: 'cloudai-x/threejs-skills',
  installs: null,
  platforms: 'Claude Code',
  lead: [
    'Three.js est réputé difficile à bien maîtriser. Cet ensemble couvre les fondamentaux sur lesquels on se trompe facilement : la mise en place de la scène, l’éclairage, les contrôles de caméra, les matériaux et les boucles d’animation.',
  ],
  when: 'Tout projet avec de la 3D dans le navigateur : configurateurs de produits, visualisation de données, expériences interactives.',
});

const frontendSlides = skill({
  id: 'frontend-slides',
  name: 'frontend-slides',
  author: 'zarazhangrui',
  pkg: 'zarazhangrui/frontend-slides@frontend-slides',
  installs: 1_200,
  platforms: 'Claude Code',
  lead: [
    'Génère des présentations HTML riches en animations, avec des aperçus de différents styles visuels. Une alternative à PowerPoint pour les développeurs qui veulent garder la main sur leurs slides.',
  ],
});

const canvasDesign = skill({
  id: 'canvas-design',
  name: 'canvas-design',
  author: 'Anthropic',
  pkg: 'anthropics/skills@canvas-design',
  installs: 133_000,
  lead: ['Crée des visuels en PNG ou en PDF, guidé par une philosophie de design rédigée. Pratique pour les affiches, les couvertures et autres visuels statiques.'],
});

const algorithmicArt = skill({
  id: 'algorithmic-art',
  name: 'algorithmic-art',
  author: 'Anthropic',
  pkg: 'anthropics/skills@algorithmic-art',
  installs: 96_000,
  lead: ['De l’art génératif avec p5.js : flow fields, particules et aléatoire à graine, pour qu’une même graine dessine toujours la même œuvre.'],
});

const wordpress = skill({
  id: 'wordpress',
  name: 'WordPress block skills',
  author: 'Automattic',
  pkg: 'automattic/agent-skills',
  installs: null,
  platforms: 'Tous les principaux agents',
  lead: ['Deux skills officiels pour l’écosystème WordPress, maintenus par Automattic :'],
  list: {
    items: [
      '`wp-block-development` : les blocs Gutenberg avec `block.json`, les attributs et les dépréciations',
      '`wp-block-themes` : les thèmes de blocs avec `theme.json`, les templates et les variations de style',
    ],
  },
  after: ['Si vous développez pour WordPress, ce sont les skills officiels à utiliser.'],
});

/* ---------------------------------------------------------------- article */

export const SECTIONS: Section[] = [
  {
    id: 'react',
    title: 'React',
    intro: ['Les skills React sont la colonne vertébrale de la catégorie frontend. Commencez par le premier et ajoutez les autres selon les besoins de votre projet.'],
    skills: [reactBestPractices, compositionPatterns, remotion],
  },
  {
    id: 'nextjs',
    title: 'Next.js',
    intro: [],
    skills: [vercelDeploy],
  },
  {
    id: 'design',
    title: 'Qualité du design',
    intro: ['On trouve ici deux types de skills : ceux qui poussent Claude vers un design plus audacieux et plus original, et ceux qui le maintiennent au niveau des standards professionnels. Il vous faut les deux.'],
    skills: [frontendDesign, webDesignGuidelines, uiUxProMax, platformDesign, uiSkills],
  },
  {
    id: 'tailwind',
    title: 'Tailwind et bibliothèques de composants',
    intro: ['Pour les projets construits sur Tailwind CSS et shadcn/ui, afin que Claude suive le système au lieu d’improviser.'],
    skills: [tailwindDesignSystem, shadcn],
  },
  {
    id: 'design-to-code',
    title: 'Du design au code',
    intro: ['Ces skills font le pont entre les outils de design et le code de production.'],
    skills: [figmaImplement, stitchLoop, enhancePrompt],
  },
  {
    id: 'specialty',
    title: 'Skills spécialisés',
    intro: ['Pour des besoins précis, au-delà du développement web classique.'],
    skills: [threejs, frontendSlides, canvasDesign, algorithmicArt, wordpress],
  },
];

export const NEXTJS_NOTE = {
  title: 'Next.js n’est plus un skill à installer',
  body: [
    'Vercel a retiré le skill `next-best-practices` en 2026 et en a intégré les recommandations au framework : elles restent ainsi alignées sur votre version de Next.js au lieu de dériver dans un dépôt séparé. À partir de Next.js 16.3, `next dev` écrit des règles `AGENTS.md` et `CLAUDE.md` à partir de la documentation embarquée.',
    'Concrètement : rien à installer, et aucun risque que votre agent suive des conseils sur l’App Router écrits pour une version que vous n’utilisez pas.',
  ],
  covers: [
    'Les Server Components, et quand ajouter `"use client"`',
    'Les route groups et les layouts',
    'L’UI de chargement et le streaming avec Suspense',
    'La récupération de données côté serveur et la revalidation',
    'Les patterns de middleware',
    'L’optimisation des images et des polices',
  ],
  commands: [
    { label: 'Sur les versions antérieures, récupérez la même documentation à la main :', cmd: 'npx @next/codemod@canary agents-md' },
    { label: 'Les skills de workflow restants (cache components, partial prefetching) se trouvent dans le dépôt Next.js :', cmd: 'npx skills add vercel/next.js' },
  ],
};

/** Le pipeline du design au code : quatre outils, un seul workflow. */
export const PIPELINE = [
  { name: 'Serveur MCP Figma', does: 'Donne à Claude l’accès à vos maquettes' },
  { name: 'figma-implement-design', does: 'Les traduit en code', id: 'figma-implement-design' },
  { name: 'stitch-loop', does: 'L’affine étape par étape', id: 'stitch-loop' },
  { name: 'frontend-design', does: 'Lui évite d’avoir l’air généré', id: 'frontend-design' },
];

/** « Stacks recommandées » : quels skills combiner selon le type de projet. */
export const STACKS: { title: string; rows: { name: string; id?: string; why: string }[] }[] = [
  {
    title: 'Une landing page SaaS',
    rows: [
      { name: 'frontend-design', id: 'frontend-design', why: 'Une direction de design créative, loin du générique' },
      { name: 'web-design-guidelines', id: 'web-design-guidelines', why: 'Standards professionnels et comportement responsive' },
      { name: 'tailwind-design-system', id: 'tailwind-design-system', why: 'Une implémentation Tailwind méthodique' },
      { name: 'Documentation intégrée à Next.js', id: 'nextjs', why: 'Recommandations sur l’App Router, intégrées à Next.js 16.3+ (rien à installer)' },
    ],
  },
  {
    title: 'Une bibliothèque de composants ou un design system',
    rows: [
      { name: 'react-best-practices', id: 'react-best-practices', why: 'Les patterns React fondamentaux' },
      { name: 'composition-patterns', id: 'composition-patterns', why: 'Patterns de compound components et headless' },
      { name: 'shadcn-ui', id: 'shadcn-ui', why: 'Patterns d’intégration de shadcn/ui' },
      { name: 'platform-design-skills', id: 'platform-design-skills', why: 'Accessibilité et conformité aux plateformes' },
    ],
  },
  {
    title: 'Un workflow du design au code',
    rows: [
      { name: 'figma-implement-design', id: 'figma-implement-design', why: 'Avec le serveur MCP Figma : lit vos maquettes et les traduit en code' },
      { name: 'stitch-loop', id: 'stitch-loop', why: 'Affinage itératif' },
      { name: 'frontend-design', id: 'frontend-design', why: 'Un rendu singulier, loin du générique' },
      { name: 'web-design-guidelines', id: 'web-design-guidelines', why: 'Standards de qualité professionnels' },
    ],
  },
];
