# توجيه المطورين المبتدئين (Mentoring) وإجراء المقابلات التقنية

**Level:** Senior
**Merged from (original phrasings):**
- كيف تقوم بتوجيه المطورين المبتدئين (Mentoring) وإجراء المقابلات التقنية؟

## The concept (short answer)

**توجيه المطورين (Mentoring)**
- ابدأ بتحديد هدف واضح ونقطة انطلاق محددة: ما يستطيع المطور المبتدئ إنجازه بمفرده اليوم، وما ينبغي أن يمتلكه ويقوده باستقلالية خلال 3 إلى 6 أشهر. وراجع ذلك دورياً في جلسات فردية (1:1s).‏
- **البرمجة الثنائية (Pair Programming)** مع جعل المطور المبتدئ هو من يكتب ويقود لوحة المفاتيح (Driving)؛ بينما يطرح المرشد أسئلة توجيهية ذكية ("ماذا يحدث إذا فشل طلب الشبكة؟") بدلاً من خطف لوحة المفاتيح منه.
- **مهام واضحة ومحددة تتضمن نمواً تدريجياً:** تذاكر واضحة النطاق تُنمي مهارة واحدة في كل مرة (أولاً إصلاح خطأ واجهة بسيط، ثم ميزة تتضمن استدعاء API، ثم ميزة تتطلب قرارات معمارية)، مع وجود تعريف منجز واضح (Definition of Done) وشبكة أمان.
- **مراجعة الكود كأداة للتعليم:** اشرح الأسباب الكامنة وراء الملاحظة، وأرفق روابط التوثيق، وفرّق بين التعديلات الإلزامية والتفضيلات الشخصية، وأشد بالقرارات الموفقة. وانتقل تدريجياً من التلقين المباشر إلى طرح الأسئلة التحفيزية.
- الأمان النفسي (Psychological Safety): الأسئلة مرحب بها دائماً، وطلب المساعدة بعد 30 دقيقة من التعثر هو تصرف احترافي متوقع وليس علامة ضعف.

**إجراء المقابلات التقنية (Interviewing)**
- حدد **الكفاءات والمهارات المطلوبة (Competencies)** للوظيفة أولاً، ثم صمم كل مرحلة لقياس مهارة أو اثنتين منها بدقة.
- اعتمد **نموذج تقييم موحد ومحكم (Rubric)** بسلوكيات وأدلة قابلة للرصد لكل مستوى وظيفي، مع توحيد الأسئلة لكافة المرشحين، وتدوين تقييمات مكتوبة مستقلة قبل جلسة المداولة لتقليص الانحيازات الشخصية.
- فضّل **التمارين العملية الواقعية** (تصحيح خطأ برمجي في تطبيق React صغير، أو بناء مكون يتصل بـ API حقيقي، أو تمرين منزلي قصير محدد الوقت) على أسئلة الحفظ والألغاز؛ مع السماح للمرشحين باستخدام أدواتهم المعتادة ومصادر التوثيق.

## Real-life example: the problem

قام فريق بتعيين مطورين مبتدئين اثنين. واقتصرت خطة الإعداد (Onboarding) على "اقرأ وثائق الويكي واختر تذكرة تناسبك". اختار أحدهما تذكرة فضفاضة بعنوان "تحسين أداء البحث"، فقضى أسبوعين تائهاً، لينتهي به الأمر بتلقي مراجعة محبطة تضم 60 تعليقاً كتب فيها المرشد "كل هذا خاطئ، انظر كيف أكتبه أنا" مع كود معاد كتابته بالكامل! ففقد المطور ثقته تماماً وتوقف عن السؤال. وفي الوقت نفسه، كانت المقابلات عشوائية: يسأل كل مراجع لغزه الرياضي المفضل، وتستند التقييمات إلى "الانطباع الشخصي" أو "التوافق الثقافي"، فرفض الفريق مرشحاً استثنائياً ارتبك أمام لغز شجرة خوارزميات على السبورة البيضاء، بينما عيّنوا شخصاً لبقاً في المقابلة عجز لاحقاً عن تصحيح خطأ بسيط في `useEffect`!‏

```markdown
<!-- Ticket - BROKEN for a junior: no scope, no context, no definition of done -->
Title: Improve search performance
Body: Search is slow, please fix.
```

```markdown
<!-- Interview feedback - BROKEN: no criteria, not comparable, biased -->
Interviewer A: Strong hire. Great energy, reminded me of myself.
Interviewer B: No hire. Couldn't invert a binary tree.
Interviewer C: Lean hire? Seemed fine.
```

## How to fix it

**1. تذكرة واضحة النطاق تركز على النمو المعرفي**
```markdown
Title: Debounce product search input (pairing available Tue/Thu)

Context: Each keystroke in <SearchBox> fires GET /api/search, ~12 requests per query,
and results arrive out of order (see Sentry issue #482).
Goal: one request after the user stops typing for 300 ms; ignore stale responses.
Skills to grow: custom hooks, AbortController, testing async UI.

Done when:
- [ ] useDebouncedValue hook with unit tests (fake timers)
- [ ] in-flight request aborted when the query changes
- [ ] RTL test: typing "shoes" quickly triggers exactly one request
Starting points: src/features/search/SearchBox.tsx, docs/testing.md
Mentor: Sam (30 min kickoff, review within a day)
```

**2. تعليقات مراجعة تُعلّم وتُلهم**
```text
blocking: The fetch isn't cancelled when `query` changes, so a slow response for "sh"
can arrive after "shoes" and overwrite the newer results. Could you return a cleanup
from the effect that calls controller.abort()? MDN has a short example:
https://developer.mozilla.org/en-US/docs/Web/API/AbortController

nit: I'd name this `debouncedQuery` so it's clear it lags behind `query`. Your call.

Nice: extracting the hook made the component much easier to read.
```

**3. مسار مقابلات منظم بنموذج تقييم موضوعي (Rubric)**
```markdown
## Frontend Engineer (Mid) - Practical exercise rubric (score 1-4 each, with evidence)
| Competency            | 1 - Below                     | 3 - Meets                                       | 4 - Exceeds                                  |
|-----------------------|-------------------------------|-------------------------------------------------|----------------------------------------------|
| React fundamentals    | State/effects misused         | Correct state, effects with cleanup and deps    | Explains trade-offs (derived state, memo)    |
| Debugging             | Guesses, random changes       | Forms hypothesis, uses devtools, verifies       | Narrows systematically, explains root cause  |
| Code quality          | Hard to follow                | Clear names, small functions, handles errors    | Tests edge cases unprompted                  |
| Communication         | Silent or unclear             | Explains approach, asks clarifying questions    | Discusses alternatives and trade-offs        |
| Accessibility/UX      | Ignores                       | Semantic HTML, labels, keyboard works           | Considers loading/empty/error states         |
```
- تمرين عملي: جلسة برمجة ثنائية مدتها 90 دقيقة على مستودع صغير (إصلاح خطأ في قائمة، ثم إضافة ميزة تصفية)، أو تمرين منزلي مدفوع الأجر بحد أقصى 3 ساعات، يليه نقاش فني لمدة 30 دقيقة.
- يدون كل مراجع درجاته المستندة إلى الأدلة قبل جلسة التقييم الجماعي؛ وتتم المقارنة وفق معايير الـ Rubric وليس الانطباعات العاطفية. نفس التمرين الموحد لكل المرشحين لنفس المستوى.

لماذا ينجح هذا الحل: تمنح التذاكر المحددة إنجازات مبكرة وتبني مهارة تلو الأخرى؛ وتنمي المراجعات التعليمية حس الحكم الهندسي المستقل؛ ويجعل نموذج التقييم المقابلات عادلة وموضوعية تكشف المهارات الحقيقية للوظيفة وتحد من التحيزات الشخصية.

## How to say it in the interview

- "أوجّه المطورين عبر البرمجة الثنائية مع ترك القيادة للمطور، وتوفير تذاكر محددة النطاق تطور مهارة واحدة في كل مرة، ومراجعات تشرح الأسباب وتطرح الأسئلة بدلاً من إعادة كتابة كودهم."
- "في التوظيف، أحدد الكفاءات أولاً، وأستخدم تمريناً عملياً واقعياً مع نموذج تقييم مكتوب وموحد، وأجمع التقييمات المستقلة المكتوبة قبل أي نقاش جماعي."
- فخ المقابلة: "كيف تتأكد من نجاح التوجيه والإرشاد؟" - تتبع النمو مقابل الأهداف المتفق عليها: سرعة تسليم أول ميزة مستقلة، واتساع نطاق التذاكر الموكلة إليه، وتراجع وتيرة الملاحظات المتكررة في المراجعات، والتغذية الراجعة في الجلسات الفردية 1:1.‏
- المفاضلة (Trade-off): التمارين المنزلية واقعية لكنها تستهلك وقت المرشحين؛ لذا اجعلها قصيرة، أو مدفوعة الأجر، أو وفر بديل البرمجة الثنائية الحية كخيار متاح.
