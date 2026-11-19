// مقال «مهارات Claude لمطوري واجهات المستخدم (Frontend)» على /skills.
// أسماء التثبيت وعدد مرات التثبيت مأخوذة من سجل skills.sh (`npx skills find <name>`).
// يدعم النص التنسيق البرمجي المضمّن `inline code` باستخدام علامات الاقتباس المائلة (backticks).

export const INSTALLS_AS_OF = 'نوفمبر 2026';

export interface Skill {
  /** معرف الإرساء (Anchor id) في الصفحة. */
  id: string;
  name: string;
  author: string;
  /** الحزمة التي يتم تمريرها إلى `npx skills add`. */
  pkg: string;
  /** عدد مرات التثبيت في السجل؛ قيمة null إذا كانت مجموعة من عدة مهارات. */
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
  platforms: 'جميع الوكلاء الرئيسيين',
  lead: [
    'هذه المهارة هي الأساس، وهي مهارة React الأكثر تثبيتاً بفارق كبير. تغطي خطافات React (Hooks)، وأنماط التركيب (Composition patterns)، والأداء، والاصطلاحات الحديثة في React.‏',
    'بدونها، يكتب Claude كود React يعمل فقط. ومعها، يكتب كود React يوافق عليه مطور أول (Senior) في مراجعة الكود. قم بتثبيتها أولاً: فكل شيء آخر يُبنى فوقها.',
  ],
  list: {
    title: 'ما تغطيه المهارة',
    items: [
      'أنماط الخطافات الحديثة: `useCallback` و `useMemo` والخطافات المخصصة (Custom hooks)',
      'هيكلية المكونات واصطلاحات التسمية',
      'أساليب إدارة الحالة (State management)',
      'الأداء: `memo` والتحميل الكسول (Lazy loading) و Suspense',
      'حدود الأخطاء (Error boundaries) ومعالجة الاستثناءات',
    ],
  },
  when: 'دائماً. قم بتثبيتها واتركها مفعلة دائماً: فهي تحسّن تقريباً كل مهمة تخص React.‏',
});

const compositionPatterns = skill({
  id: 'composition-patterns',
  name: 'composition-patterns',
  author: 'Vercel Labs',
  pkg: 'vercel-labs/agent-skills@vercel-composition-patterns',
  installs: 456_000,
  platforms: 'جميع الوكلاء الرئيسيين',
  lead: [
    'تعالج هذه المهارة مشكلة تتفاقم مع نمو المشروع: تمرير الخصائص المتكرر (Prop drilling) وتراكم الخصائص المنطقية (Boolean props).‏',
    'بدونها، يميل Claude إلى بناء مكونات تحتوي على الكثير من الأعلام المنطقية (Boolean flags): مثل `isLarge` و `isDisabled` و `showIcon` و `hasBorder`. يعمل هذا الأسلوب في المشاريع الصغيرة ولكنه سرعان ما يتحول إلى كابوس صيانة. ومعها، يلجأ Claude إلى المكونات المركبة (Compound components) ودوال العرض (Render props) وأنماط التركيب القابلة للتوسع. إنها تكمل ما بدأته مهارة react-best-practices.‏',
  ],
  list: {
    title: 'ما تغطيه المهارة',
    items: [
      'أنماط المكونات المركبة (Compound component patterns)',
      'أنماط واجهات المستخدم المجردة (Headless UI patterns)',
      'التركيب المعتمد على السياق (Context-based composition)',
      'تجنب تراكم وتكدس الخصائص المنطقية',
      'واجهات برمجة مكونات مرنة تعتمد على الفتحات (Slot-based APIs)',
    ],
  },
  when: 'مكتبات المكونات، أو أنظمة التصميم، أو أي مشروع يحتوي على مكونات واجهة قابلة لإعادة الاستخدام. إذا كنت تبني أي شيء يتجاوز مجرد صفحة هبوط بسيطة، فأنت بحاجة إليها.',
});

const remotion = skill({
  id: 'remotion-best-practices',
  name: 'remotion-best-practices',
  author: 'Remotion',
  pkg: 'remotion-dev/skills@remotion-best-practices',
  installs: 829_900,
  platforms: 'جميع الوكلاء الرئيسيين',
  lead: [
    'مفاجأة بالقرب من قمة مخططات التثبيت. تتيح لك Remotion إنشاء مقاطع الفيديو باستخدام كود React، وتعلّم هذه المهارة Claude أسلوب Remotion الصحيح في إنشاء المشاهد المتسلسلة (Sequences)، والانتقالات، ومزامنة الصوت، وعملية التصيير (Rendering).‏',
  ],
  when: 'أدوات إنشاء الفيديو، والمحتوى المؤتمت لمنصات التواصل الاجتماعي، أو أي منتج يحوّل البيانات إلى مقاطع فيديو.',
});

const vercelDeploy = skill({
  id: 'vercel-deploy',
  name: 'vercel-deploy',
  author: 'Vercel Labs',
  pkg: 'vercel-labs/agent-skills@vercel-deploy',
  installs: 581,
  platforms: 'جميع الوكلاء الرئيسيين',
  lead: [
    'ليست مهارة واجهة أمامية بالمعنى التقليدي، ولكن بمجرد أن تبني باستخدام Next.js، يصبح النشر على Vercel هو الخطوة الطبيعية التالية.',
    'تتعرف المهارة تلقائياً على إطار العمل الخاص بك (أكثر من 40 إطار عمل مدعوم)، وتجهّز إعدادات النشر وتُرجع لك رابط معاينة (Preview URL). ينتقل وكيلك الذكي من كتابة الكود إلى شحنه وإطلاقه مباشرة.',
  ],
  when: 'ادمجها مع قواعد الوكلاء المضمنة داخل Next.js للحصول على مسار عمل كامل يبدأ من البناء وحتى النشر.',
});

const frontendDesign = skill({
  id: 'frontend-design',
  name: 'frontend-design',
  author: 'Anthropic',
  pkg: 'anthropics/skills@frontend-design',
  installs: 1_100_000,
  platforms: 'جميع الوكلاء الرئيسيين',
  lead: [
    'إليك مشكلة ربما لاحظتها: تميل الواجهات التي يُنشئها الذكاء الاصطناعي إلى التشابه؛ نفس تخطيطات البطاقات، نفس الأزرار الزرقاء، نفس الأقسام الرئيسية العامة. يسميها البعض «رداءة الذكاء الاصطناعي» (AI slop).‏',
    'تعالج هذه المهارة تلك المشكلة مباشرة. إنها توجّه Claude لاتخاذ قرارات تصميمية جريئة ومدروسة: ألوان مميزة، وتخطيطات غير تقليدية، وأنماط واجهة تبدو وكأنها صُممت بعناية واحترافية بدلاً من أن تكون مولّدة عشوائياً. تعمل بكفاءة مع React و Tailwind CSS، وتبلغ أقصى فاعليتها عندما تحدد لـ Claude توجهاً تصميمياً واضحاً.',
  ],
  tip: 'ادمج مهارة frontend-design مع web-design-guidelines؛ تتولى الأولى التوجيه الإبداعي بينما تتولى الثانية الالتزام بالمعايير. معاً، ستحصل على واجهات مميزة وأنيقة وعالية الجودة.',
});

const webDesignGuidelines = skill({
  id: 'web-design-guidelines',
  name: 'web-design-guidelines',
  author: 'Vercel Labs',
  pkg: 'vercel-labs/agent-skills@web-design-guidelines',
  installs: 865_500,
  platforms: 'جميع الوكلاء الرئيسيين',
  lead: [
    'بينما تدفع frontend-design نحو خيارات جريئة، تضمن هذه المهارة توافق كل شيء مع معايير تصميم الويب الاحترافية. فكّر فيها كقائمة فحص الجودة التي تعمل جنباً إلى جنب مع كل قرار إبداعي.',
    'إنها تصنع الفارق بين «هذا يبدو جيداً على شاشتي» و«هذا يبدو متقناً ورائعاً في كل مكان وعلى جميع الأجهزة».',
  ],
  list: {
    title: 'ما تغطيه المهارة',
    items: [
      'الطباعة والخطوط (Typography)',
      'المسافات وتناسق الهوامش (Spacing)',
      'أنظمة الألوان المتناسقة',
      'التجاوب مع مختلف الشاشات (Responsive behavior)',
      'أساسيات إمكانية الوصول وسهولة الاستخدام (Accessibility fundamentals)',
    ],
  },
});

const uiUxProMax = skill({
  id: 'ui-ux-pro-max',
  name: 'ui-ux-pro-max',
  author: 'nextlevelbuilder',
  pkg: 'nextlevelbuilder/ui-ux-pro-max-skill@ui-ux-pro-max',
  installs: 453_300,
  lead: [
    'مكتبة ضخمة من أنماط واجهة وتجربة المستخدم (UI/UX)، والأنماط البصرية، وإرشادات إمكانية الوصول. مفيدة للغاية عندما تريد أن يختار Claude من بين العديد من الخيارات المجربة بدلاً من ابتكار نمط من الصفر.',
  ],
});

const platformDesign = skill({
  id: 'platform-design-skills',
  name: 'platform-design-skills',
  author: 'ehmo',
  pkg: 'ehmo/platform-design-skills@web-design-guidelines',
  installs: 1_600,
  platforms: 'جميع الوكلاء الرئيسيين',
  lead: [
    'المهارة المرجعية: أكثر من 300 قاعدة تصميمية مستمدة من إرشادات Apple للواجهة البشرية (HIG)، و Material Design 3، ومعايير WCAG 2.2.‏',
    'إنها لا تتخذ قرارات إبداعية نيابة عنك؛ بل تفرض معايير صارمة: أهداف اللمس (Touch targets)، ونسب التباين (Contrast ratios)، وتدرجات أحجام الخطوط، وأنظمة المسافات، ومتطلبات إمكانية الوصول. تأتي كمجموعة تحتوي على مهارة لكل منصة، والأمر أدناه يثبّت مهارة الويب.',
  ],
  when: 'عندما يتوجب على مخرجات Claude الامتثال لإرشادات منصة محددة، كما في تطبيقات المؤسسات الكبرى.',
});

const uiSkills = skill({
  id: 'ui-skills',
  name: 'ui-skills',
  author: 'ibelick',
  pkg: 'ibelick/ui-skills',
  installs: null,
  platforms: 'جميع الوكلاء الرئيسيين',
  lead: [
    'هذه المجموعة مختلفة؛ فبدلاً من تعليم أنماط محددة، تمنح Claude قيوداً صارمة وموجهة تدفعه نحو اتخاذ قرارات أفضل في تصميم واجهات المستخدم. يبدو الأمر كأن لديك قائد تقني مهتم بالتصميم يراجع كل مكون بدقة.',
    'إنها مجموعة مهارات صغيرة تتضمن `baseline-ui` و `improve-ui` و `fixing-accessibility`.‏',
  ],
});

const tailwindDesignSystem = skill({
  id: 'tailwind-design-system',
  name: 'tailwind-design-system',
  author: 'wshobson',
  pkg: 'wshobson/agents@tailwind-design-system',
  installs: 73_600,
  platforms: 'جميع الوكلاء الرئيسيين',
  lead: ['لبناء نظام تصميم قابل للتوسع باستخدام Tailwind CSS، بدلاً من تكديس فئات مساعدة عشوائية وغير منظمة.'],
  list: {
    title: 'ما تغطيه المهارة',
    items: [
      'أنظمة الألوان والمسافات المعتمدة على رموز التصميم (Tokens)',
      'تنويعات المكونات (Component variants) باستخدام `class-variance-authority` أو ما شابهها',
      'فئات التجاوب المنظمة للشاشات المختلفة',
      'الوضع الداكن (Dark mode)',
      'أنماط تحريك وحركة متناسقة (Consistent animation patterns)',
    ],
  },
  when: 'عندما تريد كود Tailwind يتبع نظاماً هيكلياً مدروساً بدلاً من استخدام فئات عشوائية بحسب الموقف.',
});

const shadcn = skill({
  id: 'shadcn-ui',
  name: 'shadcn-ui',
  author: 'Google Labs (Stitch)',
  pkg: 'google-labs-code/stitch-skills@shadcn-ui',
  installs: 54_700,
  platforms: 'جميع الوكلاء الرئيسيين',
  lead: [
    'أصبحت shadcn/ui مكتبة المكونات الأكثر شيوعاً لمشاريع React و Tailwind. تعلّم هذه المهارة Claude كيفية استخدامها بالطريقة الصحيحة المقصودة. فبدونها، قد يكتب Claude مسارات استيراد خاطئة أو يتعارض مع فلسفة عمل shadcn الأصلية.',
  ],
  list: {
    title: 'ما تغطيه المهارة',
    items: [
      'نموذج مكونات النسخ واللصق (فهو ليس تثبيت npm تقليدياً)',
      'تخصيص المكونات بالطريقة الصحيحة المصممة لها',
      'إمكانية الوصول (Accessibility) المدمجة في كل مكون',
      'النماذج (Forms)، ومربعات الحوار (Dialogs)، والتفاعلات المعقدة',
    ],
  },
  when: 'أي مشروع يعتمد على shadcn/ui.‏',
});

const figmaImplement = skill({
  id: 'figma-implement-design',
  name: 'figma-implement-design',
  author: 'OpenAI',
  pkg: 'openai/skills@figma-implement-design',
  installs: 7_100,
  lead: [
    'تحوّل تصاميم Figma إلى كود جاهز لبيئة الإنتاج. الهدف هو دقة متناهية مطابقة للبكسل (Pixel-perfect): مطابقة المسافات، والألوان، والطباعة، والتخطيط بدقة بالغة. تقرأ تصاميمك عبر خادم Figma MCP.‏',
  ],
  when: 'عندما يكون لديك تصميم مكتمل في Figma وتريد بناءه ككود.',
});

const stitchLoop = skill({
  id: 'stitch-loop',
  name: 'stitch-loop',
  author: 'Google Labs',
  pkg: 'google-labs-code/stitch-skills@stitch-loop',
  installs: 57_600,
  lead: ['بدلاً من تحويل التصميم إلى كود بضربة واحدة، فإنها تنشئ حلقة تغذية راجعة متكررة:'],
  list: {
    ordered: true,
    items: [
      'يكتب Claude الكود بناءً على مرجع التصميم.',
      'تقوم بمراجعته وتقديم ملاحظاتك وتوجيهاتك.',
      'يقوم Claude بتحسين وتعديل التنفيذ البرمجي.',
      'تكرار الخطوات حتى يصبح الناتج مثالياً.',
    ],
  },
  after: ['تستغرق وقتاً أطول من التحويل الفوري في محاولة واحدة، لكن نتائجها أفضل بكثير للواجهات المعقدة.'],
});

const enhancePrompt = skill({
  id: 'enhance-prompt',
  name: 'enhance-prompt',
  author: 'Google Labs',
  pkg: 'google-labs-code/stitch-skills@enhance-prompt',
  installs: 59_800,
  lead: [
    'تحسّن مطالباتك وتوجيهاتك بإضافة مواصفات التصميم ومصطلحات UI/UX الدقيقة. تساعدك على التعبير عما تريده بدقة أكبر، مما يعني الحصول على نتائج أفضل من جميع مهارات التصميم الأخرى.',
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
    'تعتبر Three.js من التقنيات المعروفة بصعوبة كتابتها بجودة عالية. تغطي هذه المجموعة الأساسيات التي يسهل الوقوع في أخطاء بشأنها: إعداد المشهد (Scene setup)، والإضاءة، وأدوات التحكم في الكاميرا، والمواد (Materials)، وحلقات التحريك (Animation loops).‏',
  ],
  when: 'أي مشروع يتضمن رسومات ثلاثية الأبعاد (3D) في المتصفح: أدوات تخصيص المنتجات، والتمثيل البصري للبيانات، والتجارب التفاعلية.',
});

const frontendSlides = skill({
  id: 'frontend-slides',
  name: 'frontend-slides',
  author: 'zarazhangrui',
  pkg: 'zarazhangrui/frontend-slides@frontend-slides',
  installs: 1_200,
  platforms: 'Claude Code',
  lead: [
    'تُنشئ عروضاً تقديمية بصيغة HTML غنية بالحركات والتأثيرات، مع إمكانية معاينة أنماط بصرية متعددة. بديل رائع لبرنامج PowerPoint للمطورين الذين يريدون تحكماً كاملاً في شرائحهم.',
  ],
});

const canvasDesign = skill({
  id: 'canvas-design',
  name: 'canvas-design',
  author: 'Anthropic',
  pkg: 'anthropics/skills@canvas-design',
  installs: 133_000,
  lead: [
    'تُنشئ أعمالاً فنية بصرية بصيغتي PNG أو PDF، مسترشدة بفلسفة تصميم مكتوبة. مريحة ومفيدة للغاية في تصميم الملصقات، والأغلفة، والرسومات الثابتة الأخرى.',
  ],
});

const algorithmicArt = skill({
  id: 'algorithmic-art',
  name: 'algorithmic-art',
  author: 'Anthropic',
  pkg: 'anthropics/skills@algorithmic-art',
  installs: 96_000,
  lead: [
    'الفن التوليدي باستخدام مكتبة p5.js: حقول التدفق (Flow fields)، والجزيئات (Particles)، والعشوائية المبنية على بذور ثابتة (Seeded randomness)، بحيث ترسم نفس البذرة دائماً نفس العمل الفني.',
  ],
});

const wordpress = skill({
  id: 'wordpress',
  name: 'WordPress block skills',
  author: 'Automattic',
  pkg: 'automattic/agent-skills',
  installs: null,
  platforms: 'جميع الوكلاء الرئيسيين',
  lead: ['مهارتان رسميتان لمنظومة WordPress، تدعمهما وتصونهما شركة Automattic:'],
  list: {
    items: [
      '`wp-block-development`: تطوير كتل Gutenberg مع `block.json`، والخصائص، ودعم الإصدارات السابقة',
      '`wp-block-themes`: قوالب الكتل باستخدام `theme.json`، والنماذج، وتنويعات الأنماط',
    ],
  },
  after: ['إذا كنت تطور لمنصة WordPress، فهذه هي المهارات الرسمية الموصى باستخدامها.'],
});

/* ---------------------------------------------------------------- article */

export const SECTIONS: Section[] = [
  {
    id: 'react',
    title: 'React',
    intro: ['مهارات React هي العمود الفقري لفئة الواجهات الأمامية. ابدأ بالمهارة الأولى وأضف البقية بحسب احتياجات مشروعك.'],
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
    title: 'جودة التصميم',
    intro: [
      'يوجد نوعان من المهارات هنا: تلك التي تدفع Claude نحو تصميم أكثر جرأة وأصالة، وتلك التي تُلزمه بالمعايير المهنية والاحترافية. ستحتاج إلى كليهما.',
    ],
    skills: [frontendDesign, webDesignGuidelines, uiUxProMax, platformDesign, uiSkills],
  },
  {
    id: 'tailwind',
    title: 'Tailwind ومكتبات المكونات',
    intro: ['للمشاريع المبنية على Tailwind CSS و shadcn/ui، بحيث يتبع Claude النظام المحدد بدلاً من الارتجال.'],
    skills: [tailwindDesignSystem, shadcn],
  },
  {
    id: 'design-to-code',
    title: 'من التصميم إلى الكود',
    intro: ['تسد هذه المهارات الفجوة بين أدوات التصميم وكود بيئة الإنتاج الفعلي.'],
    skills: [figmaImplement, stitchLoop, enhancePrompt],
  },
  {
    id: 'specialty',
    title: 'مهارات تخصصية',
    intro: ['لمهمات واحتياجات محددة تتجاوز تطوير الويب القياسي المعتاد.'],
    skills: [threejs, frontendSlides, canvasDesign, algorithmicArt, wordpress],
  },
];

export const NEXTJS_NOTE = {
  title: 'لم تعد Next.js مهارة تحتاج إلى تثبيتها',
  body: [
    'أحالت Vercel مهارة `next-best-practices` إلى التقاعد في عام 2026 ودمجت إرشاداتها مباشرة داخل إطار العمل، لتبقى متوافقة تماماً مع إصدار Next.js الذي تستخدمه بدلاً من تباعدها في مستودع مستقل. بدءاً من Next.js 16.3 فصاعداً، يقوم أمر `next dev` بكتابة قواعد `AGENTS.md` و `CLAUDE.md` تلقائياً من التوثيق المدمج.',
    'الفارق العملي: لا يوجد شيء لتثبيته، ولا مجال لأن يتبع وكيلك نصائح قديمة حول App Router كُتبت لإصدار لا تستخدمه.',
  ],
  covers: [
    'مكونات الخادم (Server Components)، ومتى تضيف `"use client"`',
    'مجموعات المسارات (Route groups) وتخطيطات الصفحات (Layouts)',
    'واجهات التحميل والبث الحي للبيانات عبر Suspense',
    'جلب البيانات من جانب الخادم وإعادة التحقق الدوري (Revalidation)',
    'أنماط البرمجيات الوسيطة (Middleware patterns)',
    'تحسين الصور والخطوط',
  ],
  commands: [
    { label: 'في الإصدارات الأقدم، يمكنك جلب نفس التوثيق يدوياً:', cmd: 'npx @next/codemod@canary agents-md' },
    {
      label: 'مهارات مسار العمل المتبقية (مكونات التخزين المؤقت، والجلب المسبق الجزئي) توجد داخل مستودع Next.js:‏',
      cmd: 'npx skills add vercel/next.js',
    },
  ],
};

/** مسار العمل من التصميم إلى الكود: أربع أدوات، مسار عمل واحد. */
export const PIPELINE = [
  { name: 'خادم Figma MCP', does: 'يمنح Claude إمكانية الوصول إلى تصاميمك' },
  { name: 'figma-implement-design', does: 'يترجم التصاميم إلى كود برمجي', id: 'figma-implement-design' },
  { name: 'stitch-loop', does: 'يصقل الكود ويحسنه خطوة بخطوة', id: 'stitch-loop' },
  { name: 'frontend-design', does: 'يمنع الكود من أن يبدو كأنه مولّد بالذكاء الاصطناعي', id: 'frontend-design' },
];

/** «مجموعات الأدوات الموصى بها»: المهارات التي يُنصح بالجمع بينها بحسب نوع المشروع. */
export const STACKS: { title: string; rows: { name: string; id?: string; why: string }[] }[] = [
  {
    title: 'صفحة هبوط لخدمة برمجية (SaaS)',
    rows: [
      { name: 'frontend-design', id: 'frontend-design', why: 'توجيه تصميمي إبداعي بعيد عن القوالب المكررة' },
      { name: 'web-design-guidelines', id: 'web-design-guidelines', why: 'معايير جودة احترافية وتجاوب ممتاز مع الشاشات' },
      { name: 'tailwind-design-system', id: 'tailwind-design-system', why: 'تنفيذ منهجي منظم لكود Tailwind' },
      { name: 'Next.js bundled docs', id: 'nextjs', why: 'إرشادات App Router، مدمجة مباشرة في Next.js 16.3+ (لا تتطلب أي تثبيت)' },
    ],
  },
  {
    title: 'مكتبة مكونات أو نظام تصميم',
    rows: [
      { name: 'react-best-practices', id: 'react-best-practices', why: 'أنماط React الأساسية والممارسات المثلى' },
      { name: 'composition-patterns', id: 'composition-patterns', why: 'أنماط المكونات المركبة والمجردة (Headless)' },
      { name: 'shadcn-ui', id: 'shadcn-ui', why: 'أنماط دمج واستخدام مكتبة shadcn/ui' },
      { name: 'platform-design-skills', id: 'platform-design-skills', why: 'إمكانية الوصول والامتثال لمعايير المنصات' },
    ],
  },
  {
    title: 'مسار عمل من التصميم إلى الكود',
    rows: [
      {
        name: 'figma-implement-design',
        id: 'figma-implement-design',
        why: 'مع خادم Figma MCP: يقرأ تصاميمك ويحولها بدقة إلى كود',
      },
      { name: 'stitch-loop', id: 'stitch-loop', why: 'التحسين والصقل التكراري' },
      { name: 'frontend-design', id: 'frontend-design', why: 'مخرجات مميزة وغير مكررة' },
      { name: 'web-design-guidelines', id: 'web-design-guidelines', why: 'معايير جودة وتصميم احترافية' },
    ],
  },
];
