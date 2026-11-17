// The "MCP servers for frontend developers" article on /mcp.
// Install commands checked against each vendor's docs (November 2026).
// Text supports `inline code` with backticks.

export const MCP_AS_OF = 'November 2026';

/** essential → install first; recommended → most projects; optional → teams; situational → only with that service. */
export type Priority = 'essential' | 'recommended' | 'optional' | 'situational';

export interface Server {
  /** Anchor id on the page. */
  id: string;
  name: string;
  vendor: string;
  priority: Priority;
  /** Shown in the badge, e.g. "Essential if you use shadcn/ui". */
  priorityLabel: string;
  /** Hosted URL you connect to, a package that runs on your machine, or plain documentation. */
  kind: 'Remote' | 'Local' | 'Docs';
  link: { label: string; url: string };
  lead: string[];
  uses: string[];
  /** Command to add it to Claude Code. Omitted for plain documentation. */
  install?: string;
  /** How it signs in, or anything to know before running the command. */
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
  priorityLabel: 'Essential',
  kind: 'Remote',
  link: { label: 'figma.com', url: 'https://www.figma.com/' },
  lead: ['Connects Claude to your Figma files, so it can read the design itself instead of guessing from a screenshot.'],
  uses: [
    'Inspecting layouts, spacing, typography and colors',
    'Understanding components and how the design is structured',
    'Translating designs into frontend code',
    'Referencing design assets and variables',
  ],
  install: 'claude mcp add --transport http figma https://mcp.figma.com/mcp',
  setup:
    'Run `/mcp` in Claude Code and sign in to Figma when asked. Prefer the desktop app? Turn on its MCP server in Dev Mode and connect to `http://127.0.0.1:3845/mcp` instead.',
};

const shadcn: Server = {
  id: 'shadcn',
  name: 'shadcn MCP',
  vendor: 'shadcn/ui',
  priority: 'essential',
  priorityLabel: 'Essential if you use shadcn/ui',
  kind: 'Local',
  link: { label: 'ui.shadcn.com', url: 'https://ui.shadcn.com/docs/mcp' },
  lead: ['Lets Claude browse, search and install components from shadcn/ui and any other registry your project uses.'],
  uses: [
    'Finding reusable components',
    'Installing components from registries',
    'Exploring component examples and implementation patterns',
    'Building consistent interfaces',
  ],
  install: 'npx shadcn@latest mcp init --client claude',
  setup: 'Run it in your project folder. It writes the server into the project’s `.mcp.json`.',
};

const context7: Server = {
  id: 'context7',
  name: 'Context7',
  vendor: 'Upstash',
  priority: 'essential',
  priorityLabel: 'Essential',
  kind: 'Remote',
  link: { label: 'GitHub', url: 'https://github.com/upstash/context7' },
  lead: [
    'Gives Claude up-to-date documentation and code examples for the libraries you use. Without it, Claude falls back on what it learned in training, which can be a version or two behind.',
  ],
  uses: [
    'React and Next.js',
    'React Native and Expo',
    'TanStack Query and Zustand',
    'Tailwind CSS and animation libraries',
    'NestJS and other backend libraries',
  ],
  install: 'claude mcp add --transport http context7 https://mcp.context7.com/mcp -H "Authorization: Bearer YOUR_API_KEY"',
  setup:
    'Replace `YOUR_API_KEY` with a free key from context7.com. Or run `npx ctx7 setup --claude`, which signs you in and does it for you.',
};

const expoDocs: Server = {
  id: 'expo-docs',
  name: 'Expo documentation',
  vendor: 'Expo',
  priority: 'situational',
  priorityLabel: 'Essential for React Native / Expo',
  kind: 'Docs',
  link: { label: 'docs.expo.dev', url: 'https://docs.expo.dev/' },
  lead: [
    'Not a server, but worth keeping next to one: point Claude at the current Expo docs whenever you build platform-specific features or upgrade an SDK.',
  ],
  uses: [
    'Expo SDK APIs',
    'EAS Build and Submit',
    'Notifications and permissions',
    'Native modules and config plugins',
    'App configuration and platform differences',
  ],
};

const playwright: Server = {
  id: 'playwright',
  name: 'Playwright MCP',
  vendor: 'Microsoft',
  priority: 'essential',
  priorityLabel: 'Essential',
  kind: 'Local',
  link: { label: 'GitHub', url: 'https://github.com/microsoft/playwright-mcp' },
  lead: ['Gives Claude a real browser to drive: it can open your site, click through it and check the result.'],
  uses: [
    'Navigating pages and testing user flows',
    'Clicking buttons and filling in forms',
    'Testing sign-in and navigation',
    'Checking responsive behavior',
    'Reproducing UI bugs and confirming the fix',
  ],
  install: 'claude mcp add playwright npx @playwright/mcp@latest',
};

const devtools: Server = {
  id: 'chrome-devtools',
  name: 'Chrome DevTools MCP',
  vendor: 'Google Chrome',
  priority: 'essential',
  priorityLabel: 'Essential',
  kind: 'Local',
  link: { label: 'GitHub', url: 'https://github.com/ChromeDevTools/chrome-devtools-mcp' },
  lead: ['Gives Claude the inspection side of DevTools. It is especially useful for performance work.'],
  uses: [
    'Reading console errors',
    'Analyzing network requests',
    'Inspecting the DOM and CSS',
    'Recording and analyzing performance traces',
    'Investigating loading, rendering and runtime issues',
  ],
  install: 'claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest',
  setup: 'Needs Chrome installed. `--scope user` makes it available in every project.',
};

const github: Server = {
  id: 'github',
  name: 'GitHub MCP',
  vendor: 'GitHub',
  priority: 'essential',
  priorityLabel: 'Essential',
  kind: 'Remote',
  link: { label: 'GitHub', url: 'https://github.com/github/github-mcp-server' },
  lead: ['Connects Claude to your repositories and the work around them: issues, pull requests and Actions.'],
  uses: [
    'Exploring repositories and source code',
    'Creating and managing issues',
    'Reviewing pull requests',
    'Inspecting code changes',
    'Investigating GitHub Actions failures',
  ],
  install: 'claude mcp add --transport http github https://api.githubcopilot.com/mcp -H "Authorization: Bearer YOUR_GITHUB_PAT"',
  setup: 'Replace `YOUR_GITHUB_PAT` with a fine-grained personal access token that can only see the repositories you need.',
};

const linear: Server = {
  id: 'linear',
  name: 'Linear MCP',
  vendor: 'Linear',
  priority: 'optional',
  priorityLabel: 'Optional, best for teams',
  kind: 'Remote',
  link: { label: 'linear.app', url: 'https://linear.app/docs/mcp' },
  lead: ['Connects your team’s tasks and planning to Claude, so it can work from the ticket instead of your summary of it.'],
  uses: [
    'Reading and creating issues',
    'Updating task status',
    'Understanding project milestones',
    'Turning bug reports into actionable tasks',
  ],
  install: 'claude mcp add --transport http linear https://mcp.linear.app/mcp',
  setup:
    'Run `/mcp` in Claude Code and sign in to Linear when asked. For read-only access, use `https://mcp.linear.app/mcp/readonly` instead.',
};

const sentry: Server = {
  id: 'sentry',
  name: 'Sentry',
  vendor: 'Sentry',
  priority: 'recommended',
  priorityLabel: 'Recommended',
  kind: 'Remote',
  link: { label: 'mcp.sentry.dev', url: 'https://mcp.sentry.dev/' },
  lead: ['Brings errors and performance problems from your live app into the conversation, stack traces included.'],
  uses: [
    'Investigating React runtime errors',
    'Reviewing stack traces',
    'Finding recurring errors',
    'Seeing which releases are affected',
    'Investigating performance problems',
  ],
  install: 'claude mcp add --transport http sentry https://mcp.sentry.dev/mcp',
  setup:
    'Run `/mcp` in Claude Code and sign in to Sentry when asked. Sentry recommends limiting it to one project by adding `/your-org/your-project` to the URL.',
};

const vercel: Server = {
  id: 'vercel',
  name: 'Vercel',
  vendor: 'Vercel',
  priority: 'recommended',
  priorityLabel: 'Recommended for Next.js',
  kind: 'Remote',
  link: { label: 'vercel.com', url: 'https://vercel.com/docs/agent-resources/vercel-mcp' },
  lead: ['Lets Claude see your deployments, so a failed build can be read and fixed without copying logs back and forth.'],
  uses: ['Inspecting deployments', 'Reviewing build logs', 'Investigating deployment failures', 'Managing projects and environments'],
  install: 'claude mcp add --transport http vercel https://mcp.vercel.com',
  setup: 'Run `/mcp` in Claude Code and sign in to Vercel when asked.',
};

const supabase: Server = {
  id: 'supabase',
  name: 'Supabase MCP',
  vendor: 'Supabase',
  priority: 'situational',
  priorityLabel: 'If you use Supabase',
  kind: 'Remote',
  link: { label: 'supabase.com', url: 'https://supabase.com/docs/guides/getting-started/mcp' },
  lead: ['Gives Claude access to your Supabase project: the database, its policies and your Edge Functions.'],
  uses: [
    'Exploring database schemas',
    'Running SQL queries',
    'Working with migrations',
    'Inspecting Row Level Security policies',
    'Working with Edge Functions',
  ],
  install:
    'claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF&read_only=true"',
  setup:
    'Replace `YOUR_PROJECT_REF` with a development project, then sign in through `/mcp` in a regular terminal. `read_only=true` keeps Claude from changing data.',
};

const cloudflare: Server = {
  id: 'cloudflare',
  name: 'Cloudflare',
  vendor: 'Cloudflare',
  priority: 'situational',
  priorityLabel: 'If you use Cloudflare',
  kind: 'Remote',
  link: {
    label: 'developers.cloudflare.com',
    url: 'https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/',
  },
  lead: [
    'One server for the whole Cloudflare API, Workers and R2 included, plus Cloudflare’s docs. It replaces the older per-product servers, which are now deprecated.',
  ],
  uses: [
    'Managing Workers',
    'Working with R2 object storage',
    'Inspecting DNS and other Cloudflare resources',
    'Supporting infrastructure workflows',
  ],
  install: 'claude mcp add --transport http cloudflare https://mcp.cloudflare.com/mcp',
  setup: 'Run `/mcp` in Claude Code and sign in to Cloudflare. You choose which permissions to grant when you connect.',
};

const stripe: Server = {
  id: 'stripe',
  name: 'Stripe',
  vendor: 'Stripe',
  priority: 'situational',
  priorityLabel: 'If you take payments',
  kind: 'Remote',
  link: { label: 'docs.stripe.com', url: 'https://docs.stripe.com/mcp' },
  lead: ['Lets Claude look things up in your Stripe account and in Stripe’s docs while you build a payment flow.'],
  uses: ['Exploring Stripe API resources', 'Understanding payment integration workflows', 'Inspecting payment objects and events'],
  install: 'claude mcp add --transport http stripe https://mcp.stripe.com/',
  setup:
    'Run `/mcp` in Claude Code and sign in to Stripe, using test mode while you build. If you use a key instead: from December 2026 Stripe only accepts agent API keys, and it should go in `.mcp.json`, not on the command line.',
};

/* ------------------------------------------------------------- sections */

export const MCP_SECTIONS: McpSection[] = [
  {
    id: 'design',
    title: 'Design and UI development',
    intro: ['Start where the interface starts: the design file and the component library.'],
    servers: [figma, shadcn],
  },
  {
    id: 'docs',
    title: 'Documentation and API references',
    intro: ['Libraries move faster than any model’s training data. These keep Claude on the current API.'],
    servers: [context7, expoDocs],
  },
  {
    id: 'browser',
    title: 'Browser automation and debugging',
    intro: ['Two servers that let Claude see the page it just built, instead of assuming it works.'],
    servers: [playwright, devtools],
  },
  {
    id: 'codebase',
    title: 'Codebase and project management',
    intro: ['Where the code lives and where the work is planned.'],
    servers: [github, linear],
  },
  {
    id: 'monitoring',
    title: 'Production monitoring',
    intro: ['What happens after you ship.'],
    servers: [sentry],
  },
  {
    id: 'deploy',
    title: 'Deployment and backend',
    intro: ['Add these only if your project already runs on the service.'],
    servers: [vercel, supabase, cloudflare, stripe],
  },
];

export const PLAYWRIGHT_VS_DEVTOOLS = {
  playwright: 'Best for interacting with the page and for repeatable test flows.',
  devtools: 'Best for inspecting what the browser is doing: network activity, the console and performance.',
};

/** "Recommended installation order". */
export const ORDER: { id: string; purpose: string; priority?: string }[] = [
  { id: 'figma', purpose: 'Design context' },
  { id: 'shadcn', purpose: 'UI components', priority: 'Essential if you use shadcn' },
  { id: 'context7', purpose: 'Current documentation' },
  { id: 'playwright', purpose: 'Browser interaction and testing' },
  { id: 'chrome-devtools', purpose: 'Debugging and performance' },
  { id: 'github', purpose: 'Repository and PR workflows' },
  { id: 'vercel', purpose: 'Deployment diagnostics', priority: 'Recommended' },
  { id: 'sentry', purpose: 'Production monitoring' },
  { id: 'linear', purpose: 'Team task management', priority: 'Optional' },
  { id: 'supabase', purpose: 'Database and backend', priority: 'As needed' },
  { id: 'cloudflare', purpose: 'Infrastructure and storage', priority: 'As needed' },
  { id: 'stripe', purpose: 'Payments', priority: 'As needed' },
];

/** "Example workflow": a Next.js landing page from design to production. */
export const WORKFLOW: { tool: string; id?: string; does: string }[] = [
  { tool: 'Figma MCP', id: 'figma', does: 'Inspect the design: typography, spacing, colors and assets.' },
  { tool: 'shadcn MCP', id: 'shadcn', does: 'Find suitable components and reusable UI patterns.' },
  { tool: 'Context7', id: 'context7', does: 'Pull current React, Next.js and library documentation.' },
  { tool: 'GitHub MCP', id: 'github', does: 'Learn the existing repository structure and conventions.' },
  { tool: 'Implementation', does: 'Build the page with the project’s architecture and design system.' },
  { tool: 'Playwright MCP', id: 'playwright', does: 'Test navigation, forms, interactions and responsive behavior.' },
  { tool: 'Chrome DevTools MCP', id: 'chrome-devtools', does: 'Check console errors, network requests and performance.' },
  { tool: 'Vercel', id: 'vercel', does: 'Inspect the deployment and its build logs.' },
  { tool: 'Sentry', id: 'sentry', does: 'Investigate errors after release.' },
];

export const SECURITY: string[] = [
  'Prefer official servers maintained by the vendor.',
  'Before installing, check each server’s source code, the permissions it asks for, and whether it is still maintained.',
  'Use read-only access whenever that is enough.',
  'Don’t give write access to production unless you have to.',
  'Point database access at a development environment when you can.',
  'Never paste API keys, tokens or credentials into prompts or commit them to a repository.',
  'Keep only the servers that earn their place in your workflow.',
  'Every connected server adds capabilities, and its tool list takes up part of Claude’s context.',
];

export const CORE: string[] = ['figma', 'shadcn', 'context7', 'playwright', 'chrome-devtools', 'github'];

export const ADD_LATER: { id: string; when: string }[] = [
  { id: 'expo-docs', when: 'for React Native and Expo' },
  { id: 'vercel', when: 'for Next.js deployments' },
  { id: 'sentry', when: 'for production monitoring' },
  { id: 'supabase', when: 'for Supabase-backed apps' },
  { id: 'cloudflare', when: 'for Workers and R2' },
  { id: 'linear', when: 'for team planning' },
  { id: 'stripe', when: 'for payment integrations' },
];

export const ALL_SERVERS: Server[] = MCP_SECTIONS.flatMap((s) => s.servers);
export const serverById = (id: string) => ALL_SERVERS.find((s) => s.id === id)!;
