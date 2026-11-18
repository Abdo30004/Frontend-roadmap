// مقال «خوادم MCP لمطوري واجهات المستخدم (Frontend)» على /mcp.
// أوامر التثبيت تم التحقق منها في توثيق كل جهة مطورة (نوفمبر 2026).
// يدعم النص التنسيق البرمجي المضمّن `inline code` باستخدام علامات الاقتباس المائلة (backticks).

export const MCP_AS_OF = 'نوفمبر 2026';

/** essential → ثبّته أولاً؛ recommended → لمعظم المشاريع؛ optional → لفرق العمل؛ situational → فقط مع هذه الخدمة. */
export type Priority = 'essential' | 'recommended' | 'optional' | 'situational';

export interface Server {
  /** معرف الإرساء (Anchor id) في الصفحة. */
  id: string;
  name: string;
  vendor: string;
  priority: Priority;
  /** يظهر في الشارة، على سبيل المثال: «ضروري إذا كنت تستخدم shadcn/ui». */
  priorityLabel: string;
  /** عنوان URL مستضاف تتصل به، أو حزمة تعمل على جهازك، أو مجرد توثيق. */
  kind: 'Remote' | 'Local' | 'Docs';
  link: { label: string; url: string };
  lead: string[];
  uses: string[];
  /** أمر إضافته إلى Claude Code. يُحذف في حالة التوثيق فقط. */
  install?: string;
  /** كيفية تسجيل الدخول، أو ما يجب معرفته قبل تشغيل الأمر. */
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
  priorityLabel: 'ضروري',
  kind: 'Remote',
  link: { label: 'figma.com', url: 'https://www.figma.com/' },
  lead: ['يربط Claude بملفات Figma الخاصة بك، ليتمكن من قراءة التصميم نفسه مباشرة بدلاً من التخمين من لقطة شاشة.'],
  uses: [
    'فحص التخطيطات (Layouts)، والمسافات الهامشية، والطباعة (Typography)، والألوان',
    'فهم المكونات وكيفية هيكلة التصميم',
    'ترجمة التصاميم إلى كود واجهة أمامية (Frontend code)',
    'الرجوع إلى أصول التصميم (Design assets) ومتغيراته',
  ],
  install: 'claude mcp add --transport http figma https://mcp.figma.com/mcp',
  setup:
    'قم بتشغيل `/mcp` في Claude Code وسجّل الدخول إلى Figma عندما يُطلب منك ذلك. هل تفضل تطبيق سطح المكتب؟ قم بتفعيل خادم MCP الخاص به في وضع التطوير (Dev Mode) واتصل بـ `http://127.0.0.1:3845/mcp` بدلاً من ذلك.',
};

const shadcn: Server = {
  id: 'shadcn',
  name: 'shadcn MCP',
  vendor: 'shadcn/ui',
  priority: 'essential',
  priorityLabel: 'ضروري إذا كنت تستخدم shadcn/ui',
  kind: 'Local',
  link: { label: 'ui.shadcn.com', url: 'https://ui.shadcn.com/docs/mcp' },
  lead: ['يتيح لـ Claude تصفح مكونات shadcn/ui والبحث فيها وتثبيتها، بالإضافة إلى أي سجل مكونات (Registry) آخر يستخدمه مشروعك.'],
  uses: [
    'العثور على المكونات القابلة لإعادة الاستخدام',
    'تثبيت المكونات من سجلات المكونات (Registries)',
    'استكشاف أمثلة المكونات وأنماط التنفيذ البرمجي',
    'بناء واجهات متناسقة ومتناغمة',
  ],
  install: 'npx shadcn@latest mcp init --client claude',
  setup: 'قم بتشغيله داخل مجلد مشروعك. سيقوم بإضافة الخادم إلى ملف `.mcp.json` الخاص بالمشروع.',
};

const context7: Server = {
  id: 'context7',
  name: 'Context7',
  vendor: 'Upstash',
  priority: 'essential',
  priorityLabel: 'ضروري',
  kind: 'Remote',
  link: { label: 'GitHub', url: 'https://github.com/upstash/context7' },
  lead: [
    'يمد Claude بأحدث التوثيقات وأمثلة الأكواد للمكتبات التي تستخدمها. بدونه، يعتمد Claude على ما تعلمه أثناء التدريب، والذي قد يتأخر بإصدار أو إصدارين.',
  ],
  uses: [
    'React و Next.js',
    'React Native و Expo',
    'TanStack Query و Zustand',
    'Tailwind CSS ومكتبات التحريك (Animation)',
    'NestJS والمكتبات البرمجية الخلفية (Backend) الأخرى',
  ],
  install: 'claude mcp add --transport http context7 https://mcp.context7.com/mcp -H "Authorization: Bearer YOUR_API_KEY"',
  setup:
    'استبدل `YOUR_API_KEY` بمفتاح مجاني من context7.com. أو شغّل `npx ctx7 setup --claude`، الذي يسجل دخولك ويقوم بذلك نيابة عنك تلقائياً.',
};

const expoDocs: Server = {
  id: 'expo-docs',
  name: 'Expo documentation',
  vendor: 'Expo',
  priority: 'situational',
  priorityLabel: 'ضروري لمطوري React Native / Expo',
  kind: 'Docs',
  link: { label: 'docs.expo.dev', url: 'https://docs.expo.dev/' },
  lead: [
    'ليس خادماً برمجياً، لكنه جدير بالاحتفاظ به بجانبها: وجّه Claude إلى توثيق Expo الحالي كلما قمت ببناء ميزات خاصة بمنصة معينة أو ترقية SDK.‏',
  ],
  uses: [
    'واجهات برمجة تطبيقات Expo SDK APIs',
    'EAS Build و Submit',
    'الإشعارات والأذونات (Permissions)',
    'الوحدات الأصلية (Native modules) وإضافات التكوين (Config plugins)',
    'إعدادات التطبيق واختلافات المنصات',
  ],
};

const playwright: Server = {
  id: 'playwright',
  name: 'Playwright MCP',
  vendor: 'Microsoft',
  priority: 'essential',
  priorityLabel: 'ضروري',
  kind: 'Local',
  link: { label: 'GitHub', url: 'https://github.com/microsoft/playwright-mcp' },
  lead: ['يمنح Claude متصفحاً حقيقياً للتحكم به: يمكنه فتح موقعك، وتصفحه بالنقر، والتحقق من النتيجة.'],
  uses: [
    'التنقل بين الصفحات واختبار تدفقات المستخدم (User flows)',
    'النقر على الأزرار وتعبئة النماذج',
    'اختبار تسجيل الدخول والتنقل',
    'فحص التجاوب والتوافق مع الشاشات (Responsive behavior)',
    'إعادة إنتاج أخطاء واجهة المستخدم وتأكيد إصلاحها',
  ],
  install: 'claude mcp add playwright npx @playwright/mcp@latest',
};

const devtools: Server = {
  id: 'chrome-devtools',
  name: 'Chrome DevTools MCP',
  vendor: 'Google Chrome',
  priority: 'essential',
  priorityLabel: 'ضروري',
  kind: 'Local',
  link: { label: 'GitHub', url: 'https://github.com/ChromeDevTools/chrome-devtools-mcp' },
  lead: ['يمنح Claude إمكانات الفحص المتوفرة في DevTools. وهو مفيد للغاية في مهام تحسين الأداء.'],
  uses: [
    'قراءة أخطاء وحدة التحكم (Console errors)',
    'تحليل طلبات الشبكة (Network requests)',
    'فحص الـ DOM وشفرات CSS',
    'تسجيل وتحليل تتبعات الأداء (Performance traces)',
    'التحقيق في مشاكل التحميل، والعرض (Rendering)، ووقت التشغيل (Runtime)',
  ],
  install: 'claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest',
  setup: 'يتطلب تثبيت متصفح Chrome. خيار `--scope user` يجعله متاحاً في كل المشاريع.',
};

const github: Server = {
  id: 'github',
  name: 'GitHub MCP',
  vendor: 'GitHub',
  priority: 'essential',
  priorityLabel: 'ضروري',
  kind: 'Remote',
  link: { label: 'GitHub', url: 'https://github.com/github/github-mcp-server' },
  lead: ['يربط Claude بمستودعاتك والعمل المحيط بها: المشاكل (Issues)، وطلبات السحب (Pull Requests)، ومهام Actions.'],
  uses: [
    'استكشاف المستودعات والكود المصدري',
    'إنشاء المشاكل (Issues) وإدارتها',
    'مراجعة طلبات السحب (Pull Requests)',
    'فحص تغييرات الكود',
    'التحقيق في إخفاقات GitHub Actions',
  ],
  install: 'claude mcp add --transport http github https://api.githubcopilot.com/mcp -H "Authorization: Bearer YOUR_GITHUB_PAT"',
  setup: 'استبدل `YOUR_GITHUB_PAT` برمز وصول شخصي دقيق الصلاحيات (Fine-grained PAT) يقتصر على المستودعات التي تحتاجها فقط.',
};

const linear: Server = {
  id: 'linear',
  name: 'Linear MCP',
  vendor: 'Linear',
  priority: 'optional',
  priorityLabel: 'اختياري، الأفضل لفرق العمل',
  kind: 'Remote',
  link: { label: 'linear.app', url: 'https://linear.app/docs/mcp' },
  lead: ['يربط مهام فريقك وتخطيطه بـ Claude، حتى يتمكن من العمل انطلاقاً من التذكرة مباشرة بدلاً من ملخصك لها.'],
  uses: [
    'قراءة المشاكل وإنشائها',
    'تحديث حالة المهام',
    'فهم مراحل المشروع ومعالمه (Milestones)',
    'تحويل تقارير الأخطاء إلى مهام قابلة للتنفيذ',
  ],
  install: 'claude mcp add --transport http linear https://mcp.linear.app/mcp',
  setup:
    'قم بتشغيل `/mcp` في Claude Code وسجّل الدخول إلى Linear عندما يُطلب منك ذلك. للوصول للقراءة فقط، استخدم `https://mcp.linear.app/mcp/readonly` بدلاً من ذلك.',
};

const sentry: Server = {
  id: 'sentry',
  name: 'Sentry',
  vendor: 'Sentry',
  priority: 'recommended',
  priorityLabel: 'موصى به',
  kind: 'Remote',
  link: { label: 'mcp.sentry.dev', url: 'https://mcp.sentry.dev/' },
  lead: ['يجلب الأخطاء ومشاكل الأداء من تطبيقك الفعلي إلى المحادثة مباشرة، بما في ذلك تتبعات المكدس (Stack traces).'],
  uses: [
    'التحقيق في أخطاء وقت التشغيل في React',
    'مراجعة تتبعات المكدس (Stack traces)',
    'العثور على الأخطاء المتكررة',
    'معرفة الإصدارات المتأثرة بالمشكلة',
    'التحقيق في مشاكل الأداء',
  ],
  install: 'claude mcp add --transport http sentry https://mcp.sentry.dev/mcp',
  setup:
    'قم بتشغيل `/mcp` في Claude Code وسجّل الدخول إلى Sentry عند الطلب. توصي Sentry بحصر الوصول في مشروع واحد عبر إضافة `/your-org/your-project` إلى نهاية الرابط.',
};

const vercel: Server = {
  id: 'vercel',
  name: 'Vercel',
  vendor: 'Vercel',
  priority: 'recommended',
  priorityLabel: 'موصى به لـ Next.js',
  kind: 'Remote',
  link: { label: 'vercel.com', url: 'https://vercel.com/docs/agent-resources/vercel-mcp' },
  lead: ['يتيح لـ Claude الاطلاع على عمليات النشر الخاصة بك، بحيث يمكن قراءة البناء الفاشل وإصلاحه دون الحاجة لنسخ السجلات ذهاباً وإياباً.'],
  uses: ['فحص عمليات النشر (Deployments)', 'مراجعة سجلات البناء (Build logs)', 'التحقيق في إخفاقات النشر', 'إدارة المشاريع وبيئات العمل'],
  install: 'claude mcp add --transport http vercel https://mcp.vercel.com',
  setup: 'قم بتشغيل `/mcp` في Claude Code وسجّل الدخول إلى Vercel عندما يُطلب منك ذلك.',
};

const supabase: Server = {
  id: 'supabase',
  name: 'Supabase MCP',
  vendor: 'Supabase',
  priority: 'situational',
  priorityLabel: 'إذا كنت تستخدم Supabase',
  kind: 'Remote',
  link: { label: 'supabase.com', url: 'https://supabase.com/docs/guides/getting-started/mcp' },
  lead: ['يمنح Claude إمكانية الوصول إلى مشروع Supabase الخاص بك: قاعدة البيانات، وسياسات الأمان، ودوال Edge Functions.'],
  uses: [
    'استكشاف مخططات قواعد البيانات (Database schemas)',
    'تشغيل استعلامات SQL',
    'التعامل مع ملفات الترحيل (Migrations)',
    'فحص سياسات أمان مستوى الصف (Row Level Security)',
    'العمل مع دوال Edge Functions',
  ],
  install:
    'claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF&read_only=true"',
  setup:
    'استبدل `YOUR_PROJECT_REF` بمشروع بيئة تطوير، ثم سجّل الدخول عبر `/mcp` في موجه أوامر عادي. إعداد `read_only=true` يمنع Claude من تعديل البيانات.',
};

const cloudflare: Server = {
  id: 'cloudflare',
  name: 'Cloudflare',
  vendor: 'Cloudflare',
  priority: 'situational',
  priorityLabel: 'إذا كنت تستخدم Cloudflare',
  kind: 'Remote',
  link: {
    label: 'developers.cloudflare.com',
    url: 'https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/',
  },
  lead: [
    'خادم واحد لكامل واجهة برمجة تطبيقات Cloudflare، بما في ذلك Workers و R2، بالإضافة إلى توثيقات Cloudflare. يحل محل الخوادم القديمة المنفصلة لكل منتج، والتي أصبحت مهملة الآن.',
  ],
  uses: [
    'إدارة دوال Workers',
    'التعامل مع التخزين الكائني R2',
    'فحص نظام أسماء النطاقات (DNS) وموارد Cloudflare الأخرى',
    'دعم تدفقات عمل البنية التحتية',
  ],
  install: 'claude mcp add --transport http cloudflare https://mcp.cloudflare.com/mcp',
  setup: 'قم بتشغيل `/mcp` في Claude Code وسجّل الدخول إلى Cloudflare. يمكنك اختيار الصلاحيات التي تمنحها عند الاتصال.',
};

const stripe: Server = {
  id: 'stripe',
  name: 'Stripe',
  vendor: 'Stripe',
  priority: 'situational',
  priorityLabel: 'إذا كنت تقبل المدفوعات',
  kind: 'Remote',
  link: { label: 'docs.stripe.com', url: 'https://docs.stripe.com/mcp' },
  lead: ['يتيح لـ Claude البحث في حساب Stripe الخاص بك وفي توثيقات Stripe أثناء بناء مسار الدفع.'],
  uses: ['استكشاف موارد واجهة برمجة تطبيقات Stripe', 'فهم تدفقات عمل تكامل المدفوعات', 'فحص كائنات وأحداث الدفع'],
  install: 'claude mcp add --transport http stripe https://mcp.stripe.com/',
  setup:
    'قم بتشغيل `/mcp` في Claude Code وسجّل الدخول إلى Stripe، باستخدام الوضع التجريبي (Test mode) أثناء التطوير. إذا كنت تستخدم مفتاحاً بدلاً من ذلك: بدءاً من ديسمبر 2026، لا تقبل Stripe سوى مفاتيح API المخصصة للوكلاء، ويجب وضعها في ملف `.mcp.json` وليس في سطر الأوامر.',
};

/* ------------------------------------------------------------- sections */

export const MCP_SECTIONS: McpSection[] = [
  {
    id: 'design',
    title: 'التصميم وتطوير واجهات المستخدم',
    intro: ['ابدأ من حيث تبدأ الواجهة: ملف التصميم ومكتبة المكونات.'],
    servers: [figma, shadcn],
  },
  {
    id: 'docs',
    title: 'التوثيق ومراجع واجهات البرمجة (APIs)',
    intro: [
      'تتطور المكتبات البرمجية بوتيرة أسرع من بيانات تدريب أي نموذج ذكاء اصطناعي. تحافظ هذه الأدوات على اطلاع Claude الدائم على واجهة البرمجة الحالية.',
    ],
    servers: [context7, expoDocs],
  },
  {
    id: 'browser',
    title: 'أتمتة المتصفح واستكشاف الأخطاء',
    intro: ['خادمان يتيحان لـ Claude رؤية الصفحة التي أنشأها للتو والتأكد منها، بدلاً من افتراض أنها تعمل بشكل صحيح.'],
    servers: [playwright, devtools],
  },
  {
    id: 'codebase',
    title: 'الكود وإدارة المشاريع',
    intro: ['حيث يقيم الكود البرمجي ويتم التخطيط للعمل.'],
    servers: [github, linear],
  },
  {
    id: 'monitoring',
    title: 'المراقبة في بيئة الإنتاج',
    intro: ['ما يحدث بعد إطلاق المشروع في الإنتاج.'],
    servers: [sentry],
  },
  {
    id: 'deploy',
    title: 'النشر والواجهة الخلفية (Backend)',
    intro: ['لا تضف هذه الخوادم إلا إذا كان مشروعك يعمل بالفعل على الخدمة المعنية.'],
    servers: [vercel, supabase, cloudflare, stripe],
  },
];

export const PLAYWRIGHT_VS_DEVTOOLS = {
  playwright: 'الأفضل للتفاعل مع الصفحة وإجراء مسارات اختبار قابلة للتكرار.',
  devtools: 'الأفضل لفحص ما يقوم به المتصفح: نشاط الشبكة، ووحدة التحكم، والأداء.',
};

/** «ترتيب التثبيت الموصى به». */
export const ORDER: { id: string; purpose: string; priority?: string }[] = [
  { id: 'figma', purpose: 'سياق التصميم' },
  { id: 'shadcn', purpose: 'مكونات واجهة المستخدم', priority: 'ضروري إذا كنت تستخدم shadcn' },
  { id: 'context7', purpose: 'توثيق محدث' },
  { id: 'playwright', purpose: 'التفاعل مع المتصفح والاختبار' },
  { id: 'chrome-devtools', purpose: 'استكشاف الأخطاء وتحسين الأداء' },
  { id: 'github', purpose: 'تدفقات عمل المستودع وطلبات السحب' },
  { id: 'vercel', purpose: 'تشخيص عمليات النشر', priority: 'موصى به' },
  { id: 'sentry', purpose: 'المراقبة في بيئة الإنتاج' },
  { id: 'linear', purpose: 'إدارة مهام الفريق', priority: 'اختياري' },
  { id: 'supabase', purpose: 'قاعدة البيانات والواجهة الخلفية', priority: 'حسب الحاجة' },
  { id: 'cloudflare', purpose: 'البنية التحتية والتخزين', priority: 'حسب الحاجة' },
  { id: 'stripe', purpose: 'المدفوعات', priority: 'حسب الحاجة' },
];

/** «مثال لمسار عمل»: صفحة هبوط Next.js من التصميم إلى الإنتاج. */
export const WORKFLOW: { tool: string; id?: string; does: string }[] = [
  { tool: 'Figma MCP', id: 'figma', does: 'فحص التصميم: الطباعة، والمسافات، والألوان، والأصول.' },
  { tool: 'shadcn MCP', id: 'shadcn', does: 'العثور على المكونات المناسبة وأنماط الواجهة القابلة لإعادة الاستخدام.' },
  { tool: 'Context7', id: 'context7', does: 'جلب التوثيقات المحدثة لـ React و Next.js والمكتبات الأخرى.' },
  { tool: 'GitHub MCP', id: 'github', does: 'استيعاب هيكلية المستودع الحالية والاصطلاحات المتبعة فيه.' },
  { tool: 'التنفيذ البرمجي', does: 'بناء الصفحة وفقاً لبنية المشروع ونظام التصميم الخاص به.' },
  { tool: 'Playwright MCP', id: 'playwright', does: 'اختبار التنقل، والنماذج، والتفاعلات، والتجاوب مع مختلف الشاشات.' },
  { tool: 'Chrome DevTools MCP', id: 'chrome-devtools', does: 'فحص أخطاء وحدة التحكم، وطلبات الشبكة، ومستويات الأداء.' },
  { tool: 'Vercel', id: 'vercel', does: 'فحص عملية النشر وسجلات البناء الخاصة بها.' },
  { tool: 'Sentry', id: 'sentry', does: 'التحقيق في الأخطاء التي تظهر بعد إطلاق المشروع في الإنتاج.' },
];

export const SECURITY: string[] = [
  'فضّل دائماً الخوادم الرسمية التي تطورها وتصونها الجهة المالكة للأداة.',
  'قبل تثبيت أي خادم، تفحص كوده المصدري، والأذونات التي يطلبها، وما إذا كان لا يزال قيد الصيانة النشطة.',
  'استخدم صلاحية القراءة فقط متى ما كانت كافية لأداء الغرض.',
  'تجنب منح صلاحيات الكتابة لبيئة الإنتاج إلا في حالات الضرورة القصوى.',
  'وجّه الاتصال بقواعد البيانات نحو بيئات التطوير التجريبية كلما أمكن ذلك.',
  'إياك ولصق مفاتيح API أو الرموز السرية أو بيانات الاعتماد في المحادثات، ولا تقم بحفظها في مستودعات الأكواد.',
  'احتفظ فقط بالخوادم التي تثبت فائدتها الفعلية في تدفق عملك اليومي.',
  'كل خادم متصل يضيف قدرات جديدة، وقائمة أدواته تستهلك جزءاً من نافذة السياق (Context Window) لدى Claude.‏',
];

export const CORE: string[] = ['figma', 'shadcn', 'context7', 'playwright', 'chrome-devtools', 'github'];

export const ADD_LATER: { id: string; when: string }[] = [
  { id: 'expo-docs', when: 'لتطوير React Native و Expo' },
  { id: 'vercel', when: 'لعمليات نشر Next.js' },
  { id: 'sentry', when: 'للمراقبة في بيئة الإنتاج' },
  { id: 'supabase', when: 'للتطبيقات المعتمدة على Supabase' },
  { id: 'cloudflare', when: 'لـ Workers و R2' },
  { id: 'linear', when: 'للتخطيط مع فريق العمل' },
  { id: 'stripe', when: 'لتكامل أنظمة المدفوعات' },
];

export const ALL_SERVERS: Server[] = MCP_SECTIONS.flatMap((s) => s.servers);
export const serverById = (id: string) => ALL_SERVERS.find((s) => s.id === id)!;
