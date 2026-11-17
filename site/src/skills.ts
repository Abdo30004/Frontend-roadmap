// The "Claude skills for frontend developers" article on /skills.
// Install names and counts come from the skills.sh registry (`npx skills find <name>`).
// Text supports `inline code` with backticks.

export const INSTALLS_AS_OF = 'November 2026';

export interface Skill {
  /** Anchor id on the page. */
  id: string;
  name: string;
  author: string;
  /** What you pass to `npx skills add`. */
  pkg: string;
  /** Registry installs; null for a set of several skills. */
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
  platforms: 'All major agents',
  lead: [
    'This is the foundation, and the most-installed React skill by a wide margin. It covers React hooks, composition patterns, performance and modern React conventions.',
    'Without it, Claude writes React code that works. With it, Claude writes React code that a senior developer would approve in a code review. Install it first: everything else builds on top of it.',
  ],
  list: {
    title: 'What it covers',
    items: [
      'Modern hook patterns: `useCallback`, `useMemo` and custom hooks',
      'Component structure and naming conventions',
      'State management approaches',
      'Performance: `memo`, lazy loading and Suspense',
      'Error boundaries and error handling',
    ],
  },
  when: 'Always. Install it and leave it on: it improves almost every React task.',
});

const compositionPatterns = skill({
  id: 'composition-patterns',
  name: 'composition-patterns',
  author: 'Vercel Labs',
  pkg: 'vercel-labs/agent-skills@vercel-composition-patterns',
  installs: 456_000,
  platforms: 'All major agents',
  lead: [
    'This one solves a problem that gets worse as a project grows: prop drilling and a pile-up of boolean props.',
    'Without it, Claude tends to build components with lots of boolean flags: `isLarge`, `isDisabled`, `showIcon`, `hasBorder`. That works in a small project and becomes unmaintainable fast. With it, Claude reaches for compound components, render props and composition patterns that scale. It picks up where react-best-practices leaves off.',
  ],
  list: {
    title: 'What it covers',
    items: [
      'Compound component patterns',
      'Headless UI patterns',
      'Context-based composition',
      'Avoiding a pile-up of boolean props',
      'Flexible, slot-based component APIs',
    ],
  },
  when: 'Component libraries, design systems, or any project with reusable UI components. If you are building anything beyond a simple landing page, you need this.',
});

const remotion = skill({
  id: 'remotion-best-practices',
  name: 'remotion-best-practices',
  author: 'Remotion',
  pkg: 'remotion-dev/skills@remotion-best-practices',
  installs: 829_900,
  platforms: 'All major agents',
  lead: [
    'A surprise near the top of the install charts. Remotion lets you create videos with React code, and this skill teaches Claude the Remotion way of doing sequences, transitions, audio sync and rendering.',
  ],
  when: 'Video creation tools, automated social media content, or any product that turns data into video.',
});

const vercelDeploy = skill({
  id: 'vercel-deploy',
  name: 'vercel-deploy',
  author: 'Vercel Labs',
  pkg: 'vercel-labs/agent-skills@vercel-deploy',
  installs: 581,
  platforms: 'All major agents',
  lead: [
    'Not a frontend skill in the usual sense, but once you build with Next.js, deploying to Vercel is the natural next step.',
    'It detects your framework (more than 40 are supported), sets up the deployment and returns a preview URL. Your agent goes from writing the code to shipping it.',
  ],
  when: 'Pair it with the agent rules that ship inside Next.js for a full build-to-deploy workflow.',
});

const frontendDesign = skill({
  id: 'frontend-design',
  name: 'frontend-design',
  author: 'Anthropic',
  pkg: 'anthropics/skills@frontend-design',
  installs: 1_100_000,
  platforms: 'All major agents',
  lead: [
    'Here is a problem you have probably noticed: AI-made interfaces tend to look the same. The same card layouts, the same blue buttons, the same generic hero sections. People call it "AI slop".',
    'This skill tackles that directly. It tells Claude to make bold, deliberate design choices: distinctive colors, unusual layouts and UI patterns that feel crafted rather than generated. It works with React and Tailwind CSS, and it works best when you give Claude a clear design direction.',
  ],
  tip: 'Pair frontend-design with web-design-guidelines. The first handles creative direction, the second handles standards. Together you get interfaces that are both distinctive and polished.',
});

const webDesignGuidelines = skill({
  id: 'web-design-guidelines',
  name: 'web-design-guidelines',
  author: 'Vercel Labs',
  pkg: 'vercel-labs/agent-skills@web-design-guidelines',
  installs: 865_500,
  platforms: 'All major agents',
  lead: [
    'Where frontend-design pushes for bold choices, this skill makes sure everything meets professional web design standards. Think of it as the quality checklist that runs alongside every creative decision.',
    'It is the difference between "this looks good on my screen" and "this looks good everywhere".',
  ],
  list: {
    title: 'What it covers',
    items: ['Typography', 'Spacing', 'Color systems', 'Responsive behavior', 'Accessibility fundamentals'],
  },
});

const uiUxProMax = skill({
  id: 'ui-ux-pro-max',
  name: 'ui-ux-pro-max',
  author: 'nextlevelbuilder',
  pkg: 'nextlevelbuilder/ui-ux-pro-max-skill@ui-ux-pro-max',
  installs: 453_300,
  lead: [
    'A large library of UI and UX patterns, visual styles and accessibility guidance. Useful when you want Claude to pick from many proven options instead of inventing a style from scratch.',
  ],
});

const platformDesign = skill({
  id: 'platform-design-skills',
  name: 'platform-design-skills',
  author: 'ehmo',
  pkg: 'ehmo/platform-design-skills@web-design-guidelines',
  installs: 1_600,
  platforms: 'All major agents',
  lead: [
    "The reference skill: more than 300 design rules taken from Apple's Human Interface Guidelines, Material Design 3 and WCAG 2.2.",
    'It does not make creative decisions for you; it enforces standards: touch targets, contrast ratios, type scales, spacing systems and accessibility requirements. It is a set with one skill per platform, and the command below installs the web one.',
  ],
  when: "When Claude's output has to meet specific platform guidelines, for example in enterprise applications.",
});

const uiSkills = skill({
  id: 'ui-skills',
  name: 'ui-skills',
  author: 'ibelick',
  pkg: 'ibelick/ui-skills',
  installs: null,
  platforms: 'All major agents',
  lead: [
    'This one is different. Instead of teaching specific patterns, it gives Claude opinionated constraints that steer it toward better UI decisions. It is like having a design-minded tech lead review every component.',
    'It is a small set of skills, including `baseline-ui`, `improve-ui` and `fixing-accessibility`.',
  ],
});

const tailwindDesignSystem = skill({
  id: 'tailwind-design-system',
  name: 'tailwind-design-system',
  author: 'wshobson',
  pkg: 'wshobson/agents@tailwind-design-system',
  installs: 73_600,
  platforms: 'All major agents',
  lead: ['For building a scalable design system with Tailwind CSS, instead of a pile of one-off utility classes.'],
  list: {
    title: 'What it covers',
    items: [
      'Token-based color and spacing systems',
      'Component variants with `class-variance-authority` or similar',
      'Organized responsive utilities',
      'Dark mode',
      'Consistent animation patterns',
    ],
  },
  when: 'When you want Tailwind code that follows a system rather than ad-hoc classes.',
});

const shadcn = skill({
  id: 'shadcn-ui',
  name: 'shadcn-ui',
  author: 'Google Labs (Stitch)',
  pkg: 'google-labs-code/stitch-skills@shadcn-ui',
  installs: 54_700,
  platforms: 'All major agents',
  lead: [
    'shadcn/ui has become the go-to component library for React and Tailwind projects. This skill teaches Claude to use it the intended way. Without it, Claude sometimes writes wrong import paths or fights against how shadcn is meant to work.',
  ],
  list: {
    title: 'What it covers',
    items: [
      'The copy-paste component model (it is not a normal npm install)',
      'Customizing components the intended way',
      'The accessibility built into every component',
      'Forms, dialogs and complex interactions',
    ],
  },
  when: 'Any project that uses shadcn/ui.',
});

const figmaImplement = skill({
  id: 'figma-implement-design',
  name: 'figma-implement-design',
  author: 'OpenAI',
  pkg: 'openai/skills@figma-implement-design',
  installs: 7_100,
  lead: [
    'Turns Figma designs into production-ready code. The goal is pixel-perfect accuracy: spacing, colors, typography and layout matched exactly. It reads your designs through the Figma MCP server.',
  ],
  when: 'When you have a finished Figma design to build.',
});

const stitchLoop = skill({
  id: 'stitch-loop',
  name: 'stitch-loop',
  author: 'Google Labs',
  pkg: 'google-labs-code/stitch-skills@stitch-loop',
  installs: 57_600,
  lead: ['Instead of turning a design into code in one shot, it sets up a feedback loop:'],
  list: {
    ordered: true,
    items: [
      'Claude writes code from a design reference.',
      'You review it and give feedback.',
      'Claude refines the implementation.',
      'Repeat until it is right.',
    ],
  },
  after: ['It is slower than a one-shot translation, but the results are consistently better for complex interfaces.'],
});

const enhancePrompt = skill({
  id: 'enhance-prompt',
  name: 'enhance-prompt',
  author: 'Google Labs',
  pkg: 'google-labs-code/stitch-skills@enhance-prompt',
  installs: 59_800,
  lead: [
    'Improves your prompts by adding design specifications and UI/UX vocabulary. It helps you say what you want more precisely, which means better results from every other design skill.',
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
    'Three.js is notoriously hard to write well. This set covers the fundamentals that are easy to get wrong: scene setup, lighting, camera controls, materials and animation loops.',
  ],
  when: 'Any project with 3D in the browser: product configurators, data visualization, interactive experiences.',
});

const frontendSlides = skill({
  id: 'frontend-slides',
  name: 'frontend-slides',
  author: 'zarazhangrui',
  pkg: 'zarazhangrui/frontend-slides@frontend-slides',
  installs: 1_200,
  platforms: 'Claude Code',
  lead: [
    'Generates animation-rich HTML presentations, with previews of different visual styles. An alternative to PowerPoint for developers who want full control over their slides.',
  ],
});

const canvasDesign = skill({
  id: 'canvas-design',
  name: 'canvas-design',
  author: 'Anthropic',
  pkg: 'anthropics/skills@canvas-design',
  installs: 133_000,
  lead: [
    'Creates visual art as PNG or PDF files, guided by a written design philosophy. Handy for posters, covers and other static graphics.',
  ],
});

const algorithmicArt = skill({
  id: 'algorithmic-art',
  name: 'algorithmic-art',
  author: 'Anthropic',
  pkg: 'anthropics/skills@algorithmic-art',
  installs: 96_000,
  lead: ['Generative art with p5.js: flow fields, particles and seeded randomness, so the same seed always draws the same piece.'],
});

const wordpress = skill({
  id: 'wordpress',
  name: 'WordPress block skills',
  author: 'Automattic',
  pkg: 'automattic/agent-skills',
  installs: null,
  platforms: 'All major agents',
  lead: ['Two official skills for the WordPress ecosystem, maintained by Automattic:'],
  list: {
    items: [
      '`wp-block-development`: Gutenberg blocks with `block.json`, attributes and deprecations',
      '`wp-block-themes`: block themes with `theme.json`, templates and style variations',
    ],
  },
  after: ['If you build for WordPress, these are the official skills to use.'],
});

/* ---------------------------------------------------------------- article */

export const SECTIONS: Section[] = [
  {
    id: 'react',
    title: 'React',
    intro: [
      'React skills are the backbone of the frontend category. Start with the first one and add the others as your project needs them.',
    ],
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
    title: 'Design quality',
    intro: [
      'Two kinds of skill live here: ones that push Claude toward bolder, more original design, and ones that hold it to professional standards. You want both.',
    ],
    skills: [frontendDesign, webDesignGuidelines, uiUxProMax, platformDesign, uiSkills],
  },
  {
    id: 'tailwind',
    title: 'Tailwind & component libraries',
    intro: ['For projects built on Tailwind CSS and shadcn/ui, so Claude follows the system instead of improvising.'],
    skills: [tailwindDesignSystem, shadcn],
  },
  {
    id: 'design-to-code',
    title: 'Design to code',
    intro: ['These skills bridge the gap between design tools and production code.'],
    skills: [figmaImplement, stitchLoop, enhancePrompt],
  },
  {
    id: 'specialty',
    title: 'Specialty skills',
    intro: ['For specific jobs beyond standard web development.'],
    skills: [threejs, frontendSlides, canvasDesign, algorithmicArt, wordpress],
  },
];

export const NEXTJS_NOTE = {
  title: 'Next.js is no longer a skill you install',
  body: [
    'Vercel retired the `next-best-practices` skill in 2026 and moved its guidance into the framework, so it stays matched to your Next.js version instead of drifting in a separate repo. On Next.js 16.3 and later, `next dev` writes `AGENTS.md` and `CLAUDE.md` rules from the bundled docs.',
    'The practical difference: nothing to install, and no chance of your agent following App Router advice written for a version you are not running.',
  ],
  covers: [
    'Server Components, and when to add `"use client"`',
    'Route groups and layouts',
    'Loading UI and streaming with Suspense',
    'Server-side data fetching and revalidation',
    'Middleware patterns',
    'Image and font optimization',
  ],
  commands: [
    { label: 'On earlier versions, pull in the same docs by hand:', cmd: 'npx @next/codemod@canary agents-md' },
    {
      label: 'The workflow skills that remain (cache components, partial prefetching) live in the Next.js repo:',
      cmd: 'npx skills add vercel/next.js',
    },
  ],
};

/** The design-to-code pipeline: four tools, one workflow. */
export const PIPELINE = [
  { name: 'Figma MCP server', does: 'Gives Claude access to your designs' },
  { name: 'figma-implement-design', does: 'Translates them to code', id: 'figma-implement-design' },
  { name: 'stitch-loop', does: 'Refines it step by step', id: 'stitch-loop' },
  { name: 'frontend-design', does: 'Keeps it from looking generated', id: 'frontend-design' },
];

/** "Recommended stacks": which skills to combine for a type of project. */
export const STACKS: { title: string; rows: { name: string; id?: string; why: string }[] }[] = [
  {
    title: 'A SaaS landing page',
    rows: [
      { name: 'frontend-design', id: 'frontend-design', why: 'Creative, non-generic design direction' },
      { name: 'web-design-guidelines', id: 'web-design-guidelines', why: 'Professional standards and responsive behavior' },
      { name: 'tailwind-design-system', id: 'tailwind-design-system', why: 'Systematic Tailwind implementation' },
      { name: 'Next.js bundled docs', id: 'nextjs', why: 'App Router guidance, built into Next.js 16.3+ (nothing to install)' },
    ],
  },
  {
    title: 'A component library or design system',
    rows: [
      { name: 'react-best-practices', id: 'react-best-practices', why: 'The foundation React patterns' },
      { name: 'composition-patterns', id: 'composition-patterns', why: 'Compound component and headless patterns' },
      { name: 'shadcn-ui', id: 'shadcn-ui', why: 'shadcn/ui integration patterns' },
      { name: 'platform-design-skills', id: 'platform-design-skills', why: 'Accessibility and platform compliance' },
    ],
  },
  {
    title: 'A design-to-code workflow',
    rows: [
      {
        name: 'figma-implement-design',
        id: 'figma-implement-design',
        why: 'With the Figma MCP server: reads your designs and translates them to code',
      },
      { name: 'stitch-loop', id: 'stitch-loop', why: 'Iterative refinement' },
      { name: 'frontend-design', id: 'frontend-design', why: 'Distinctive, non-generic output' },
      { name: 'web-design-guidelines', id: 'web-design-guidelines', why: 'Professional quality standards' },
    ],
  },
];
