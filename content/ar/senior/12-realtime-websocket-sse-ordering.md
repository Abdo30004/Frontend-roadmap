# الميزات اللحظية: WebSockets مقابل SSE وإعادة الاتصال وترتيب الرسائل

**Level:** Senior
**Merged from (original phrasings):**
- اشرح استراتيجيتك لتنفيذ الميزات اللحظية (WebSockets و Server-Sent Events).
- وصلت رسائل WebSocket بترتيب خاطئ ومختلط (out of order). ماذا ينبغي على العميل فعله؟

## The concept (short answer)

**اختيار وسيلة النقل المناسبة (Transport):**
- **الاستطلاع الدوري / الطويل (Polling / Long Polling):** للتحديثات منخفضة الوتيرة (كل 30 ثانية أو أكثر)، أبسط بنية تحتية، وتعمل في كل مكان. وهي كافية في حالات أكثر بكثير مما يقر به المطورون.
- **Server-Sent Events (SSE):** اتصال أحادي الاتجاه من الخادم إلى العميل عبر بروتوكول HTTP العادي (`EventSource`). يدعم تلقائياً إعادة الاتصال واستئناف الاستماع عبر `Last-Event-ID`، ويتوافق بسلاسة مع HTTP/2 وبروكسيات الشبكة وكوكيز المصادقة. خيار مثالي للإشعارات، وموجزات الأخبار المباشرة، ولوحات التحكم، وتدفق رموز الذكاء الاصطناعي (LLM token streaming). وتمر طلبات العميل إلى الخادم عبر طلبات HTTP عادية.
- **WebSockets:** اتصال ثنائي الاتجاه بالكامل (Full-duplex)، بزمن انتقال منخفض للغاية، مع دعم البيانات الثنائية (Binary). ضروري لغرف المحادثة التي تتضمن مؤشرات الكتابة، وأدوات التحرير التشاركي، والألعاب، ومنصات التداول المالي. وتتطلب منك إدارة إعادة الاتصال، ونبضات القلب (heartbeats)، والمصادقة، وبنية تحتية تحتفظ بالحالة (stateful infrastructure).

**استراتيجية الموثوقية (لكلا البروتوكولين):**
- **إعادة الاتصال مع تراجع أسي وتذبذب عشوائي (Exponential backoff + jitter)**، مع نبضات قلب (ping/pong) لاكتشاف الاتصالات الميتة؛ والإيقاف المؤقت عند انقطاع الشبكة أو خمول الصفحة، والاستئناف عند حدث `online` أو `visibilitychange`.
- **ترتيب الرسائل (Ordering):** يضمن بروتوكول TCP الترتيب *داخل الاتصال الواحد*، لكن الرسائل تصل غير مرتبة عملياً لأسباب معمارية: خوادم خلفية متعددة تنشر عبر نظام pub/sub، أو إعادة الاتصال بعقدة خادم مختلفة، أو سباق زمني بين لقطة REST والأحداث اللحظية، أو المعالجات غير المتزامنة. والحل الجذري هو إرفاق **رقم تسلسلي تزايدي صارم (Monotonic sequence number)** لكل دفق من الخادم.
- **خوارزمية العميل:** يحتفظ العميل بـ `lastSeq`. إذا كان `seq <= lastSeq` -> رسالة مكررة، تجاهلها فوراً. إذا كان `seq === lastSeq + 1` -> طبق الرسالة، ثم فرّغ الرسائل المخزنة مؤقتاً في الـ buffer التي تليها بالترتيب. إذا كان `seq > lastSeq + 1` -> **خزنها في الـ buffer** وانتظر فترة قصيرة؛ وإذا لم تسد الفجوة في الوقت المحدد، **أعد جلب لقطة حالة كاملة (Snapshot)** (تحمل رقمها التسلسلي) واستأنف من عندها. وعند إعادة الاتصال، اطلب من الخادم الاستئناف بدءاً من `lastSeq`.
- **المعالجات محايدة التأثير (Idempotent handlers):** تطبيق نفس الحدث مرتين يجب ألا يُكرر أي بيانات (دمج بالمعرف upsert by id، أو فوز التعديل الأخير last-write-wins بالإصدار) - حيث يُعد ضمان التسليم لمرة واحدة على الأقل (at-least-once) هو الضمان الواقعي الممكن.

## Real-life example: the problem

نظام تتبع حي للطلبات في تطبيق توصيل طعام. يشتكي المستخدمون من ارتداد حالة الطلب للخلف: تتحول الحالة من "Courier picked up" إلى "Preparing" فجأة، وتقفز أيقونة المندوب للخلف على الخريطة. وبعد عبور نفق المترو (انقطاع الشبكة)، يتجمد التتبع تماماً حتى يُعاد فتح التطبيق؛ وفي محادثة الدعم تتكرر بعض الرسائل مرتين. يعود السبب إلى تشغيل الخادم عبر 3 نسخ تنشر الأحداث عبر Redis pub/sub؛ فتسبق تحديثات خدمة المطعم تحديثات خدمة المندوب.

```js
// Naive client: last message wins, no reconnect, no dedup
function useOrderTracking(orderId) {
  const [order, setOrder] = useState(null);
  useEffect(() => {
    fetch(`/api/orders/${orderId}`).then((r) => r.json()).then(setOrder);   // races with the socket
    const ws = new WebSocket(`wss://rt.example.com/orders/${orderId}`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      setOrder((o) => ({ ...o, ...msg.patch }));      // older event can overwrite newer state
      if (msg.type === 'chat') appendChat(msg.message); // duplicates after server retry
    };
    return () => ws.close();                            // and onclose? nothing: stays dead
  }, [orderId]);
  return order;
}
```

## How to fix it

عقد الخادم: يحمل كل حدث في دفق `order:{id}` رقماً تسلسلياً `seq`، وتحمل لقطات الحالة الـ `seq` الذي تُمثله، ويقبل الـ socket بارامتر `?since=<seq>` لإعادة إرسال الأحداث الفائتة.

```js
class OrderStream {
  constructor(orderId, onState) {
    Object.assign(this, { orderId, onState, state: null, lastSeq: -1, buffer: new Map(), attempt: 0 });
    this.connect();
  }

  async loadSnapshot() {
    const res = await fetch(`/api/orders/${this.orderId}`);       // { seq, order, chat: [...] }
    const snap = await res.json();
    this.state = snap;
    this.lastSeq = snap.seq;
    for (const s of [...this.buffer.keys()]) if (s <= this.lastSeq) this.buffer.delete(s);
    this.drain();
    this.onState(this.state);
  }

  connect() {
    const since = this.lastSeq >= 0 ? `?since=${this.lastSeq}` : '';
    this.ws = new WebSocket(`wss://rt.example.com/orders/${this.orderId}${since}`);
    this.ws.onopen = () => { this.attempt = 0; if (this.lastSeq < 0) this.loadSnapshot(); };
    this.ws.onmessage = (e) => this.receive(JSON.parse(e.data));
    this.ws.onclose = () => { if (!this.closed) this.reconnect(); };
  }

  reconnect() {
    const delay = Math.random() * Math.min(30_000, 500 * 2 ** this.attempt++); // backoff + full jitter
    this.timer = setTimeout(() => this.connect(), delay);
  }

  receive(event) {
    if (event.seq <= this.lastSeq || this.buffer.has(event.seq)) return;      // duplicate
    this.buffer.set(event.seq, event);
    if (this.lastSeq < 0) return;                                             // snapshot pending
    this.drain();
    if (this.buffer.size > 0 && !this.gapTimer) {                             // gap detected
      this.gapTimer = setTimeout(() => { this.gapTimer = null; this.loadSnapshot(); }, 2000);
    }
  }

  drain() {
    let next;
    while ((next = this.buffer.get(this.lastSeq + 1))) {
      this.buffer.delete(next.seq);
      this.state = applyEvent(this.state, next);                              // pure + idempotent
      this.lastSeq = next.seq;
    }
    if (this.buffer.size === 0 && this.gapTimer) { clearTimeout(this.gapTimer); this.gapTimer = null; }
    this.onState(this.state);
  }

  close() { this.closed = true; clearTimeout(this.timer); clearTimeout(this.gapTimer); this.ws.close(); }
}

function applyEvent(state, e) {
  switch (e.type) {
    case 'status': return { ...state, order: { ...state.order, status: e.status } };
    case 'courier_location': return { ...state, order: { ...state.order, courier: e.position } };
    case 'chat':  // upsert by message id: a redelivered message cannot duplicate
      return state.chat.some((m) => m.id === e.message.id) ? state : { ...state, chat: [...state.chat, e.message] };
    default: return state;
  }
}

function useOrderTracking(orderId) {
  const [state, setState] = useState(null);
  useEffect(() => {
    const stream = new OrderStream(orderId, setState);
    return () => stream.close();
  }, [orderId]);
  return state;
}
```

لماذا ينجح هذا الحل: يمنح الرقم التسلسلي العميل ترتيباً كلياً مستقلاً عن نسخة الخادم المرسلة. يتم إسقاط المكرر، وتنتظر الأحداث المبكرة في الـ buffer، وتعالج لقطة الحالة أي فجوة مستمرة بأمان لأنها تحمل رقمها الخاص. وتستأنف إعادة الاتصال من `lastSeq` بتراجع متذبذب يمنع التدافع الجماعي (thundering herd). والمعالجات محايدة التأثير فلا ضرر من إعادة التسليم. وبالنسبة للبيانات سريعة التغير كإحداثيات المندوب فيكفي اعتماد قاعدة آخر قيمة تسجل (last-value-wins) وتجاهل ما هو أقدم. وإذا كان التتبع أحادي الاتجاه فقط، فإن SSE يمنحك إعادة الاتصال واستئناف `Last-Event-ID` مجاناً:

```js
const es = new EventSource(`/api/orders/${orderId}/events`); // server sets `id: <seq>` on each event
es.addEventListener('status', (e) => stream.receive(JSON.parse(e.data)));
```

## How to say it in the interview

- "أعتمد SSE كخيار افتراضي للتدفقات أحادية الاتجاه من الخادم للعميل، وألجأ لـ WebSockets حصرياً عند الحاجة لاتصال ثنائي تفاعلي فائق السرعة، والـ polling للتحديثات متباعدة الوقت."
- "يُحل الترتيب عبر أرقام تسلسلية يحددها الخادم لكل دفق: تجاهل المكرر، وتخزين الأحداث السابقة لأوانها في buffer، وإعادة جلب لقطة حالة مرقمة عند وجود فجوة، والاستئناف من آخر رقم تسلسلي عند إعادة الاتصال."
- فخ المقابلة: الادعاء بأن "TCP يضمن الترتيب فلا تحدث المشكلة" - فالترتيب ينهار عبر نسخ الخوادم وإعادات الاتصال والسباق بين اللقطات والأحداث الحية. سؤال متابعة: توسيع نطاق WebSockets - الجلسات المثبتة (sticky sessions) أو قنوات pub/sub (مثل Redis و NATS)، وحدود الاتصال لكل خادم، وانتهاء صلاحية التوكن في الاتصالات طويلة الأمد.
- المفاضلة (Trade-off): الترتيب الصارم مع الـ buffer يضيف تأخيراً واستهلاكاً للذاكرة؛ وفي البيانات التي تعتمد آخر قيمة فقط (مثل المواقع والأسعار) استخدم أرقام الإصدارات وأسقط التحديثات القديمة بدلاً من إعادة ترتيبها.
