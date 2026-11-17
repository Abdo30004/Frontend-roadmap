// L’article « Les serveurs MCP pour les développeurs frontend » sur /mcp.
// Commandes d’installation vérifiées dans la documentation de chaque éditeur (novembre 2026).
// Le texte accepte le `code inline` entre backticks.

export const MCP_AS_OF = 'novembre 2026';

/** essential → à installer en premier ; recommended → la plupart des projets ; optional → les équipes ; situational → seulement avec ce service. */
export type Priority = 'essential' | 'recommended' | 'optional' | 'situational';

export interface Server {
  /** Id d’ancre sur la page. */
  id: string;
  name: string;
  vendor: string;
  priority: Priority;
  /** Affiché dans le badge, par ex. « Essentiel si vous utilisez shadcn/ui ». */
  priorityLabel: string;
  /** URL hébergée à laquelle on se connecte, package qui tourne sur votre machine, ou simple documentation. */
  kind: 'Remote' | 'Local' | 'Docs';
  link: { label: string; url: string };
  lead: string[];
  uses: string[];
  /** Commande pour l’ajouter à Claude Code. Absente pour une simple documentation. */
  install?: string;
  /** Comment il se connecte, ou ce qu’il faut savoir avant de lancer la commande. */
  setup?: string;
}

export interface McpSection {
  id: string;
  title: string;
  intro: string[];
  servers: Server[];
}

/* -------------------------------------------------------------- servers */

const figma: Server = {
  id: 'figma',
  name: 'Figma MCP',
  vendor: 'Figma',
  priority: 'essential',
  priorityLabel: 'Essentiel',
  kind: 'Remote',
  link: { label: 'figma.com', url: 'https://www.figma.com/' },
  lead: [
    'Connecte Claude à vos fichiers Figma, pour qu’il lise directement le design au lieu de le deviner à partir d’une capture d’écran.',
  ],
  uses: [
    'Inspecter les mises en page, les espacements, la typographie et les couleurs',
    'Comprendre les composants et la structure du design',
    'Traduire les maquettes en code frontend',
    'Référencer les assets et les variables du design',
  ],
  install: 'claude mcp add --transport http figma https://mcp.figma.com/mcp',
  setup:
    'Lancez `/mcp` dans Claude Code et connectez-vous à Figma quand on vous le demande. Vous préférez l’application desktop ? Activez son serveur MCP dans le Dev Mode et connectez-vous plutôt à `http://127.0.0.1:3845/mcp`.',
};

const shadcn: Server = {
  id: 'shadcn',
  name: 'shadcn MCP',
  vendor: 'shadcn/ui',
  priority: 'essential',
  priorityLabel: 'Essentiel si vous utilisez shadcn/ui',
  kind: 'Local',
  link: { label: 'ui.shadcn.com', url: 'https://ui.shadcn.com/docs/mcp' },
  lead: [
    'Permet à Claude de parcourir, rechercher et installer des composants depuis shadcn/ui et tout autre registre utilisé par votre projet.',
  ],
  uses: [
    'Trouver des composants réutilisables',
    'Installer des composants depuis des registres',
    'Explorer des exemples de composants et des patterns d’implémentation',
    'Construire des interfaces cohérentes',
  ],
  install: 'npx shadcn@latest mcp init --client claude',
  setup: 'Lancez-la dans le dossier de votre projet. Elle ajoute le serveur au fichier `.mcp.json` du projet.',
};

const context7: Server = {
  id: 'context7',
  name: 'Context7',
  vendor: 'Upstash',
  priority: 'essential',
  priorityLabel: 'Essentiel',
  kind: 'Remote',
  link: { label: 'GitHub', url: 'https://github.com/upstash/context7' },
  lead: [
    'Fournit à Claude une documentation et des exemples de code à jour pour les bibliothèques que vous utilisez. Sans lui, Claude se rabat sur ce qu’il a appris pendant son entraînement, qui peut avoir une ou deux versions de retard.',
  ],
  uses: [
    'React et Next.js',
    'React Native et Expo',
    'TanStack Query et Zustand',
    'Tailwind CSS et les bibliothèques d’animation',
    'NestJS et d’autres bibliothèques backend',
  ],
  install: 'claude mcp add --transport http context7 https://mcp.context7.com/mcp -H "Authorization: Bearer YOUR_API_KEY"',
  setup:
    'Remplacez `YOUR_API_KEY` par une clé gratuite obtenue sur context7.com. Ou lancez `npx ctx7 setup --claude`, qui vous connecte et s’en charge pour vous.',
};

const expoDocs: Server = {
  id: 'expo-docs',
  name: 'Expo documentation',
  vendor: 'Expo',
  priority: 'situational',
  priorityLabel: 'Essentiel pour React Native / Expo',
  kind: 'Docs',
  link: { label: 'docs.expo.dev', url: 'https://docs.expo.dev/' },
  lead: [
    'Ce n’est pas un serveur, mais elle mérite d’être gardée à portée de main : renvoyez Claude vers la documentation Expo à jour dès que vous développez des fonctionnalités propres à une plateforme ou que vous mettez à jour un SDK.',
  ],
  uses: [
    'Les API du SDK Expo',
    'EAS Build et Submit',
    'Les notifications et les permissions',
    'Les modules natifs et les config plugins',
    'La configuration de l’app et les différences entre plateformes',
  ],
};

const playwright: Server = {
  id: 'playwright',
  name: 'Playwright MCP',
  vendor: 'Microsoft',
  priority: 'essential',
  priorityLabel: 'Essentiel',
  kind: 'Local',
  link: { label: 'GitHub', url: 'https://github.com/microsoft/playwright-mcp' },
  lead: ['Donne à Claude un vrai navigateur à piloter : il peut ouvrir votre site, s’y déplacer en cliquant et vérifier le résultat.'],
  uses: [
    'Naviguer entre les pages et tester les parcours utilisateur',
    'Cliquer sur des boutons et remplir des formulaires',
    'Tester la connexion et la navigation',
    'Vérifier le comportement responsive',
    'Reproduire des bugs d’UI et confirmer leur correction',
  ],
  install: 'claude mcp add playwright npx @playwright/mcp@latest',
};

const devtools: Server = {
  id: 'chrome-devtools',
  name: 'Chrome DevTools MCP',
  vendor: 'Google Chrome',
  priority: 'essential',
  priorityLabel: 'Essentiel',
  kind: 'Local',
  link: { label: 'GitHub', url: 'https://github.com/ChromeDevTools/chrome-devtools-mcp' },
  lead: ['Donne à Claude le volet inspection des DevTools. Il est particulièrement utile pour le travail sur la performance.'],
  uses: [
    'Lire les erreurs de la console',
    'Analyser les requêtes réseau',
    'Inspecter le DOM et le CSS',
    'Enregistrer et analyser des traces de performance',
    'Enquêter sur les problèmes de chargement, de rendu et d’exécution',
  ],
  install: 'claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest',
  setup: 'Nécessite que Chrome soit installé. `--scope user` le rend disponible dans tous vos projets.',
};

const github: Server = {
  id: 'github',
  name: 'GitHub MCP',
  vendor: 'GitHub',
  priority: 'essential',
  priorityLabel: 'Essentiel',
  kind: 'Remote',
  link: { label: 'GitHub', url: 'https://github.com/github/github-mcp-server' },
  lead: ['Connecte Claude à vos dépôts et à tout le travail qui les entoure : issues, pull requests et Actions.'],
  uses: [
    'Explorer les dépôts et le code source',
    'Créer et gérer des issues',
    'Relire des pull requests',
    'Inspecter les modifications de code',
    'Enquêter sur les échecs de GitHub Actions',
  ],
  install: 'claude mcp add --transport http github https://api.githubcopilot.com/mcp -H "Authorization: Bearer YOUR_GITHUB_PAT"',
  setup: 'Remplacez `YOUR_GITHUB_PAT` par un fine-grained personal access token qui n’a accès qu’aux dépôts dont vous avez besoin.',
};

const linear: Server = {
  id: 'linear',
  name: 'Linear MCP',
  vendor: 'Linear',
  priority: 'optional',
  priorityLabel: 'Optionnel, idéal pour les équipes',
  kind: 'Remote',
  link: { label: 'linear.app', url: 'https://linear.app/docs/mcp' },
  lead: [
    'Relie les tâches et la planification de votre équipe à Claude, pour qu’il travaille à partir du ticket plutôt que de votre résumé.',
  ],
  uses: [
    'Lire et créer des issues',
    'Mettre à jour le statut des tâches',
    'Comprendre les jalons du projet',
    'Transformer les rapports de bugs en tâches concrètes',
  ],
  install: 'claude mcp add --transport http linear https://mcp.linear.app/mcp',
  setup:
    'Lancez `/mcp` dans Claude Code et connectez-vous à Linear quand on vous le demande. Pour un accès en lecture seule, utilisez plutôt `https://mcp.linear.app/mcp/readonly`.',
};

const sentry: Server = {
  id: 'sentry',
  name: 'Sentry',
  vendor: 'Sentry',
  priority: 'recommended',
  priorityLabel: 'Recommandé',
  kind: 'Remote',
  link: { label: 'mcp.sentry.dev', url: 'https://mcp.sentry.dev/' },
  lead: [
    'Fait entrer dans la conversation les erreurs et les problèmes de performance de votre app en production, stack traces comprises.',
  ],
  uses: [
    'Enquêter sur les erreurs d’exécution React',
    'Examiner les stack traces',
    'Repérer les erreurs récurrentes',
    'Voir quelles releases sont touchées',
    'Enquêter sur les problèmes de performance',
  ],
  install: 'claude mcp add --transport http sentry https://mcp.sentry.dev/mcp',
  setup:
    'Lancez `/mcp` dans Claude Code et connectez-vous à Sentry quand on vous le demande. Sentry recommande de le limiter à un seul projet en ajoutant `/your-org/your-project` à l’URL.',
};

const vercel: Server = {
  id: 'vercel',
  name: 'Vercel',
  vendor: 'Vercel',
  priority: 'recommended',
  priorityLabel: 'Recommandé pour Next.js',
  kind: 'Remote',
  link: { label: 'vercel.com', url: 'https://vercel.com/docs/agent-resources/vercel-mcp' },
  lead: [
    'Permet à Claude de voir vos déploiements : un build en échec peut être lu et corrigé sans copier les logs dans un sens puis dans l’autre.',
  ],
  uses: [
    'Inspecter les déploiements',
    'Examiner les logs de build',
    'Enquêter sur les échecs de déploiement',
    'Gérer les projets et les environnements',
  ],
  install: 'claude mcp add --transport http vercel https://mcp.vercel.com',
  setup: 'Lancez `/mcp` dans Claude Code et connectez-vous à Vercel quand on vous le demande.',
};

const supabase: Server = {
  id: 'supabase',
  name: 'Supabase MCP',
  vendor: 'Supabase',
  priority: 'situational',
  priorityLabel: 'Si vous utilisez Supabase',
  kind: 'Remote',
  link: { label: 'supabase.com', url: 'https://supabase.com/docs/guides/getting-started/mcp' },
  lead: ['Donne à Claude l’accès à votre projet Supabase : la base de données, ses policies et vos Edge Functions.'],
  uses: [
    'Explorer les schémas de base de données',
    'Exécuter des requêtes SQL',
    'Travailler avec les migrations',
    'Inspecter les policies de Row Level Security',
    'Travailler avec les Edge Functions',
  ],
  install:
    'claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF&read_only=true"',
  setup:
    'Remplacez `YOUR_PROJECT_REF` par un projet de développement, puis connectez-vous via `/mcp` dans un terminal classique. `read_only=true` empêche Claude de modifier les données.',
};

const cloudflare: Server = {
  id: 'cloudflare',
  name: 'Cloudflare',
  vendor: 'Cloudflare',
  priority: 'situational',
  priorityLabel: 'Si vous utilisez Cloudflare',
  kind: 'Remote',
  link: {
    label: 'developers.cloudflare.com',
    url: 'https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/',
  },
  lead: [
    'Un seul serveur pour toute l’API Cloudflare, Workers et R2 compris, plus la documentation de Cloudflare. Il remplace les anciens serveurs par produit, désormais dépréciés.',
  ],
  uses: [
    'Gérer les Workers',
    'Travailler avec le stockage objet R2',
    'Inspecter le DNS et les autres ressources Cloudflare',
    'Accompagner les workflows d’infrastructure',
  ],
  install: 'claude mcp add --transport http cloudflare https://mcp.cloudflare.com/mcp',
  setup:
    'Lancez `/mcp` dans Claude Code et connectez-vous à Cloudflare. Vous choisissez les permissions à accorder au moment de la connexion.',
};

const stripe: Server = {
  id: 'stripe',
  name: 'Stripe',
  vendor: 'Stripe',
  priority: 'situational',
  priorityLabel: 'Si vous acceptez des paiements',
  kind: 'Remote',
  link: { label: 'docs.stripe.com', url: 'https://docs.stripe.com/mcp' },
  lead: [
    'Permet à Claude de consulter votre compte Stripe et la documentation de Stripe pendant que vous développez un parcours de paiement.',
  ],
  uses: [
    'Explorer les ressources de l’API Stripe',
    'Comprendre les workflows d’intégration des paiements',
    'Inspecter les objets et les événements de paiement',
  ],
  install: 'claude mcp add --transport http stripe https://mcp.stripe.com/',
  setup:
    'Lancez `/mcp` dans Claude Code et connectez-vous à Stripe, en mode test pendant le développement. Si vous utilisez plutôt une clé : à partir de décembre 2026, Stripe n’accepte plus que les clés d’API pour agents, et elle doit aller dans `.mcp.json`, pas dans la ligne de commande.',
};

/* ------------------------------------------------------------- sections */

export const MCP_SECTIONS: McpSection[] = [
  {
    id: 'design',
    title: 'Design et développement d’UI',
    intro: ['Commencez là où l’interface commence : le fichier de design et la bibliothèque de composants.'],
    servers: [figma, shadcn],
  },
  {
    id: 'docs',
    title: 'Documentation et références d’API',
    intro: [
      'Les bibliothèques évoluent plus vite que les données d’entraînement de n’importe quel modèle. Ces ressources maintiennent Claude à jour sur l’API actuelle.',
    ],
    servers: [context7, expoDocs],
  },
  {
    id: 'browser',
    title: 'Automatisation et débogage dans le navigateur',
    intro: ['Deux serveurs qui permettent à Claude de voir la page qu’il vient de construire, au lieu de supposer qu’elle fonctionne.'],
    servers: [playwright, devtools],
  },
  {
    id: 'codebase',
    title: 'Code et gestion de projet',
    intro: ['Là où vit le code et où se planifie le travail.'],
    servers: [github, linear],
  },
  {
    id: 'monitoring',
    title: 'Monitoring en production',
    intro: ['Ce qui se passe après la mise en production.'],
    servers: [sentry],
  },
  {
    id: 'deploy',
    title: 'Déploiement et backend',
    intro: ['N’ajoutez ceux-ci que si votre projet tourne déjà sur le service en question.'],
    servers: [vercel, supabase, cloudflare, stripe],
  },
];

export const PLAYWRIGHT_VS_DEVTOOLS = {
  playwright: 'Idéal pour interagir avec la page et pour des parcours de test reproductibles.',
  devtools: 'Idéal pour inspecter ce que fait le navigateur : l’activité réseau, la console et la performance.',
};

/** « Ordre d’installation recommandé ». */
export const ORDER: { id: string; purpose: string; priority?: string }[] = [
  { id: 'figma', purpose: 'Contexte de design' },
  { id: 'shadcn', purpose: 'Composants d’UI', priority: 'Essentiel si vous utilisez shadcn' },
  { id: 'context7', purpose: 'Documentation à jour' },
  { id: 'playwright', purpose: 'Interaction avec le navigateur et tests' },
  { id: 'chrome-devtools', purpose: 'Débogage et performance' },
  { id: 'github', purpose: 'Workflows de dépôt et de PR' },
  { id: 'vercel', purpose: 'Diagnostic des déploiements', priority: 'Recommandé' },
  { id: 'sentry', purpose: 'Monitoring en production' },
  { id: 'linear', purpose: 'Gestion des tâches d’équipe', priority: 'Optionnel' },
  { id: 'supabase', purpose: 'Base de données et backend', priority: 'Selon les besoins' },
  { id: 'cloudflare', purpose: 'Infrastructure et stockage', priority: 'Selon les besoins' },
  { id: 'stripe', purpose: 'Paiements', priority: 'Selon les besoins' },
];

/** « Exemple de workflow » : une landing page Next.js, du design à la production. */
export const WORKFLOW: { tool: string; id?: string; does: string }[] = [
  { tool: 'Figma MCP', id: 'figma', does: 'Inspecter le design : typographie, espacements, couleurs et assets.' },
  { tool: 'shadcn MCP', id: 'shadcn', does: 'Trouver les composants adaptés et des patterns d’UI réutilisables.' },
  { tool: 'Context7', id: 'context7', does: 'Récupérer la documentation à jour de React, de Next.js et des bibliothèques.' },
  { tool: 'GitHub MCP', id: 'github', does: 'Comprendre la structure et les conventions du dépôt existant.' },
  { tool: 'Implémentation', does: 'Construire la page en suivant l’architecture et le design system du projet.' },
  {
    tool: 'Playwright MCP',
    id: 'playwright',
    does: 'Tester la navigation, les formulaires, les interactions et le comportement responsive.',
  },
  {
    tool: 'Chrome DevTools MCP',
    id: 'chrome-devtools',
    does: 'Vérifier les erreurs de la console, les requêtes réseau et la performance.',
  },
  { tool: 'Vercel', id: 'vercel', does: 'Inspecter le déploiement et ses logs de build.' },
  { tool: 'Sentry', id: 'sentry', does: 'Enquêter sur les erreurs après la mise en production.' },
];

export const SECURITY: string[] = [
  'Privilégiez les serveurs officiels maintenus par l’éditeur.',
  'Avant d’installer un serveur, vérifiez son code source, les permissions qu’il demande et s’il est toujours maintenu.',
  'Utilisez un accès en lecture seule chaque fois que cela suffit.',
  'Ne donnez pas d’accès en écriture à la production, sauf nécessité.',
  'Quand c’est possible, faites pointer l’accès à la base de données vers un environnement de développement.',
  'Ne collez jamais de clés d’API, de tokens ou d’identifiants dans vos prompts, et ne les committez jamais dans un dépôt.',
  'Ne gardez que les serveurs qui méritent leur place dans votre workflow.',
  'Chaque serveur connecté ajoute des capacités, et sa liste d’outils occupe une partie du contexte de Claude.',
];

export const CORE: string[] = ['figma', 'shadcn', 'context7', 'playwright', 'chrome-devtools', 'github'];

export const ADD_LATER: { id: string; when: string }[] = [
  { id: 'expo-docs', when: 'pour React Native et Expo' },
  { id: 'vercel', when: 'pour les déploiements Next.js' },
  { id: 'sentry', when: 'pour le monitoring en production' },
  { id: 'supabase', when: 'pour les apps qui reposent sur Supabase' },
  { id: 'cloudflare', when: 'pour Workers et R2' },
  { id: 'linear', when: 'pour la planification en équipe' },
  { id: 'stripe', when: 'pour les intégrations de paiement' },
];

export const ALL_SERVERS: Server[] = MCP_SECTIONS.flatMap((s) => s.servers);
export const serverById = (id: string) => ALL_SERVERS.find((s) => s.id === id)!;
