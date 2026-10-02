// اختبار واجهة كامل في متصفح حقيقي (Chromium) للسيناريو 1→13
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://localhost:8080/index.html';
const SHOTS = '/home/claude/tests/shots'; fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function ctx(mobile) {
  const c = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 900 } });
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return p;
}
async function login(p, u, pw) {
  await p.goto(BASE + '#/login');
  await p.fill('input[autocomplete=username]', u);
  await p.fill('input[autocomplete=current-password]', pw);
  await p.click('button:has-text("دخول")');
}
const toastText = async (p) => { await p.waitForSelector('.toast', { timeout: 8000 }); await p.waitForTimeout(1200); return (await p.locator('.toast').allInnerTexts()).join(' | '); };
const shot = (p, n, full = true) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: full });

const T = await ctx(false);
console.log('— المعلمة');
await login(T, 'teacher', 'Gold@2026');
await T.waitForSelector('.stat-value');
ok(await T.locator('text=إجمالي الطالبات').count() === 1, 'لوحة التحكم تظهر');
await T.waitForTimeout(600); await shot(T, '01-teacher-dashboard');

// 1) إضافة طالبة
await T.goto(BASE + '#/t/students'); await T.waitForSelector('table');
await shot(T, '02-students');
await T.click('button:has-text("إضافة طالبة")');
await T.fill('.modal input >> nth=0', 'منيرة القحطاني');
await T.fill('.modal input[placeholder=s0101]', 'mnr01');
await T.fill('.modal input[minlength="6"]', '654321');
await T.click('.modal button:has-text("حفظ")');
await T.waitForSelector('text=تمت إضافة الطالبة ✅');
ok(true, '1) إضافة طالبة من الواجهة');
await T.click('.modal-foot button:has-text("تم")');

// 2-5) إنشاء مهمة
await T.goto(BASE + '#/t/tasks'); await T.waitForSelector('.task-card');
await shot(T, '03-tasks');
await T.click('button:has-text("إنشاء مهمة")');
await T.fill('.modal input[placeholder^="مثال: الاختبار"]', 'الاختبار القبلي — المحاليل');
await T.fill('.modal input[type=number] >> nth=0', '1');
await shot(T, '04-task-form', false);
await T.click('.modal button:has-text("إنشاء المهمة")');
await T.waitForSelector('.qr-img', { timeout: 8000 });
ok(true, '2-4) إنشاء مهمة بنقطة واحدة وموعد + ظهور QR');
await T.waitForTimeout(300); await shot(T, '05-qr', false);

await T.click('.modal-head button');

// إنشاء مهمة QR
await T.click('button:has-text("إنشاء مهمة")');
await T.fill('.modal input[placeholder^="مثال: الاختبار"]', 'نشاط المختبر — QR');
await T.fill('.modal input[type=number] >> nth=0', '2');
await T.click('.verify-opt:has-text("رمز المهمة")');
await T.click('.modal button:has-text("إنشاء المهمة")');
await T.waitForSelector('.qr-img');
const qr2 = (await T.locator('.qr-box .qr-code').textContent()).trim();
await T.click('.modal-head button');

console.log('— الطالبة (جوال)');
const S = await ctx(true);
await login(S, 'mnr01', '654321');
await S.waitForSelector('.hero-card');
ok((await S.locator('.hero-hi').innerText()).includes('منيرة'), 'بطاقة «مرحبًا بكِ يا منيرة»');
await shot(S, '10-student-home-empty');
await S.goto(BASE + '#/s/tasks'); await S.waitForSelector('.stask');
ok(await S.locator('.stask:has-text("الاختبار القبلي — المحاليل")').count() === 1, '5) المهمة تظهر للطالبة');
await shot(S, '11-student-tasks');
// 6-8
await S.locator('.stask:has-text("الاختبار القبلي — المحاليل") button:has-text("أنجزتُ المهمة")').click();
ok((await toastText(S)).includes('نقطة'), '6-8) الطالبة تنجز المهمة وتحصل على النقطة: ' + await S.locator('.toast').last().innerText());
await S.waitForTimeout(600);
ok(await S.locator('.stask:has-text("الاختبار القبلي — المحاليل") .badge-ok').count() === 1, '7) الحالة «مكتمل»');
// QR claim
console.log('    QR code:', JSON.stringify(qr2));
await S.goto(BASE + '#/claim/' + qr2); await S.waitForSelector('.claim-card'); await S.waitForTimeout(1500); if (!(await S.locator('.claim-pts').count())) console.log(await S.locator('.claim-card').innerText());
await S.waitForSelector('.claim-pts');
await shot(S, '12-claim', false);
await S.click('button:has-text("أنجزتُ النشاط")');
await S.waitForSelector('text=أحسنتِ! +2 ⭐');
ok(true, 'مسح QR وتسجيل الإنجاز (+2)');
await shot(S, '13-claim-done', false);
// 9) السجل
await S.goto(BASE + '#/s/history'); await S.waitForSelector('.tl-item');
ok(await S.locator('.tl-item:has-text("الاختبار القبلي — المحاليل")').count() === 1, '9) يظهر في سجل إنجازاتها');
await S.goto(BASE + '#/s/home'); await S.waitForSelector('.hero-bal');
ok((await S.locator('.hero-bal b').innerText()).includes('3'), 'الرصيد = 3');

console.log('— المعلمة: تقرير + نقاط');
await T.goto(BASE + '#/t/tasks'); await T.waitForSelector('.task-card');
await T.locator('.task-card:has-text("الاختبار القبلي — المحاليل") button:has-text("متابعة الإنجاز")').click();
await T.waitForSelector('.modal .table');
ok(await T.locator('.modal tr:has-text("منيرة القحطاني") .badge-ok').count() === 1, '10) تقرير الإنجاز يظهر إنجاز الطالبة');
await shot(T, '06-task-detail', false);
await T.click('.modal-head button');
await T.goto(BASE + '#/t/students'); await T.waitForSelector('table');
await T.locator('tr:has-text("منيرة القحطاني") button:has-text("نقاط")').click();
await T.click('.modal .track-btn:has-text("مبادرة")');
await T.click('.modal .chip:has-text("اقتراح فكرة")');
await T.click('.modal .amount-btn:has-text("3")');
await T.click('.modal button:has-text("منح")');
ok((await toastText(T)).includes('أُضيفت'), 'منح 3 نقاط مبادرة مع السبب');
// خصم بدون سبب يرفض
await T.locator('tr:has-text("منيرة القحطاني") button:has-text("نقاط")').click();
await T.click('.modal .seg button:has-text("خصم")');
await T.click('.modal button.btn-danger');
ok((await toastText(T)).includes('سبب'), 'الخصم بدون سبب مرفوض');
await T.click('.modal-head button');

console.log('— الطالبة: الاستبدال');
await S.goto(BASE + '#/s/rewards'); await S.waitForSelector('.reward-card');
await shot(S, '14-store');
const before = 6;
await S.locator('.reward-card:has-text("+1 درجة في مهمة مؤهلة") button:has-text("استبدال")').click();
await S.click('.modal button:has-text("تأكيد الاستبدال")');
ok((await toastText(S)).includes('طلبك'), '11-12) الاستبدال وتسجيل الطلب');
await S.waitForTimeout(500);
ok((await S.locator('.page-head p').innerText()).includes(String(before - 5)), `13) انخفض الرصيد تلقائيًا إلى ${before - 5}`);
await S.goto(BASE + '#/s/notifications'); await S.waitForSelector('.notif');
ok(await S.locator('.notif:has-text("مبروك! وصلتِ إلى مستوى")').count() >= 1, 'تنبيه المستوى الجديد');
ok(await S.locator('.notif:has-text("لديكِ مهمة جديدة")').count() >= 1, 'تنبيه المهمة الجديدة');
await shot(S, '15-notifications');
await S.goto(BASE + '#/s/balance'); await S.waitForSelector('.levels'); await shot(S, '16-balance');
await S.goto(BASE + '#/s/how'); await S.waitForSelector('.quote-card'); await shot(S, '17-how');
// الطالبة لا تصل إلى لوحة المعلمة
await S.goto(BASE + '#/t/dashboard'); await S.waitForTimeout(800);
ok(S.url().includes('/s/home'), 'منع الطالبة من دخول لوحة المعلمة');

console.log('— المعلمة: اعتماد الطلب والصفحات');
await T.goto(BASE + '#/t/rewards'); await T.waitForSelector('.req-card');
await shot(T, '07-rewards');
await T.locator('.req-card:has-text("منيرة") button:has-text("اعتماد")').click();
ok((await toastText(T)).includes('اعتماد'), 'اعتماد طلب الاستبدال');
await T.goto(BASE + '#/t/flipped'); await T.waitForSelector('.flip-task');
ok(await T.locator('.flip-task').count() === 5, 'لوحة الصف المقلوب: 5 مهام لدرس المخاليط');
await T.locator('.flip-task >> nth=0').locator('button:has-text("لم تُكمل")').click();
ok(await T.locator('.missing-list .chip').count() >= 1, 'أسماء من لم تُكمل');
await shot(T, '08-flipped');
await T.click('button:has-text("جدول الطالبات")'); await shot(T, '08b-flipped-grid');
await T.goto(BASE + '#/t/reports'); await T.waitForSelector('.sum-grid'); await shot(T, '09-reports');
const [dl] = await Promise.all([T.waitForEvent('download'), T.click('button:has-text("تصدير Excel")')]);
const csv = fs.readFileSync(await dl.path(), 'utf8');
ok(csv.charCodeAt(0) === 0xFEFF && csv.includes('منيرة القحطاني'), 'تصدير CSV/Excel بالعربية');
await T.goto(BASE + '#/t/points'); await T.waitForSelector('.table'); await shot(T, '09b-points');
await T.goto(BASE + '#/t/settings'); await T.click('button:has-text("سجل العمليات")'); await T.waitForSelector('.table td');
ok(await T.locator('td:has-text("اعتماد استبدال")').count() >= 1, 'سجل العمليات يسجل كل شيء');
await shot(T, '09c-log');

console.log('— الجوال للمعلمة');
const TM = await ctx(true);
await login(TM, 'teacher', 'Gold@2026'); await TM.waitForSelector('.stat-value'); await TM.waitForTimeout(500);
await shot(TM, '20-teacher-mobile');
const overflow = await TM.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
ok(!overflow, 'لا يوجد تمرير أفقي على الجوال');
await TM.click('.menu-btn'); await TM.waitForTimeout(300); await shot(TM, '21-teacher-mobile-menu', false);

const SO = await ctx(true);
await SO.goto(BASE + '#/login'); await SO.waitForSelector('.auth-card'); await shot(SO, '00-login', false);

console.log('\nأخطاء المتصفح:', errors.length ? errors : 'لا يوجد');
console.log(`النتيجة: ${pass} ناجح / ${fail} فاشل`);
await browser.close();
process.exit(fail ? 1 : 0);
