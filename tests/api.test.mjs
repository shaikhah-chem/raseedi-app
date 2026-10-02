// اختبارات الخادم: الصلاحيات + السيناريو الكامل عبر supabase-js الحقيقي
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const keys = Object.fromEntries(fs.readFileSync('/home/claude/stack/keys.env','utf8').trim().split('\n').map(l=>l.split('=')));
const URL = 'http://localhost:54321';
const mk = () => createClient(URL, keys.ANON, { auth: { persistSession: false, autoRefreshToken: false } });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const login = async (u, p) => { const c = mk(); const { error } = await c.auth.signInWithPassword({ email: `${u}@raseedi.app`, password: p }); if (error) throw new Error(u + ': ' + error.message); return c; };

console.log('— الدخول');
const anon = mk();
const T = await login('teacher', 'Gold@2026');
const S = await login('sara', '123456');
ok(true, 'دخول المعلمة والطالبة');
const bad = await mk().auth.signInWithPassword({ email: 'sara@raseedi.app', password: 'wrong' });
ok(!!bad.error, 'رفض كلمة مرور خاطئة');

console.log('— حماية الزوار');
ok((await anon.from('students').select('*')).data?.length === 0 || (await anon.from('students').select('*')).error, 'الزائر لا يرى الطالبات');
ok(!!(await anon.rpc('bootstrap_teacher', { p_username: 'hacker', p_password: '123456', p_full_name: 'x' })).error, 'لا يمكن إنشاء معلمة ثانية من شاشة الإعداد');
ok((await anon.rpc('needs_setup')).data === false, 'needs_setup = false');

console.log('— خصوصية الطالبة');
const sStudents = await S.from('students').select('*');
ok(sStudents.data.length === 1 && sStudents.data[0].username === 'sara', 'الطالبة ترى نفسها فقط');
const sSum = await S.from('student_summary').select('*');
ok(sSum.data.length === 1, 'الطالبة ترى ملخصها فقط (لا ترتيب)');
const sTx = await S.from('points_transactions').select('student_id');
ok(new Set(sTx.data.map(r => r.student_id)).size === 1, 'سجل نقاط الطالبة لها فقط');
ok((await S.from('task_codes').select('*')).data.length === 0, 'الطالبة لا ترى رموز المهام');
ok((await S.from('activity_logs').select('*')).data.length === 0, 'الطالبة لا ترى سجل العمليات');

console.log('— منع التلاعب بالنقاط');
const myId = sStudents.data[0].id;
const ins = await S.from('points_transactions').insert({ student_id: myId, amount: 100, kind: 'manual_add', reason: 'hack' });
ok(!!ins.error, 'الطالبة لا تستطيع إدراج نقاط مباشرة');
const upd = await S.from('points_transactions').update({ amount: 100 }).eq('student_id', myId).select();
ok(!!upd.error || upd.data.length === 0, 'الطالبة لا تستطيع تعديل نقاطها');
ok(!!(await S.rpc('admin_adjust_points', { p_student_ids: [myId], p_amount: 10, p_track: null, p_reason: 'x' })).error, 'الطالبة لا تستطيع استدعاء دوال المعلمة');
ok(!!(await S.rpc('_add_points', { p_student: myId, p_amount: 10, p_kind: 'manual_add', p_track: null, p_reason: 'x' })).error, 'الدوال الداخلية مغلقة');
const tIns = await S.from('tasks').insert({ title: 'x', points: 50, due_at: new Date(Date.now()+1e7).toISOString() });
ok(!!tIns.error, 'الطالبة لا تستطيع إنشاء مهام');
ok(!!(await S.from('task_completions').insert({ task_id: myId, student_id: myId, method: 'self', status: 'approved' })).error, 'الطالبة لا تستطيع إدراج إنجاز مباشرة');

console.log('— السيناريو الكامل للمعلمة (25)');
// 1) إضافة طالبة
const { data: cls } = await T.from('classes').select('*');
const classId = cls[0].id;
const uname = 'test' + Date.now().toString().slice(-6);
const add = await T.rpc('admin_create_student', { p_full_name: 'طالبة اختبار', p_username: uname, p_password: 'pass1234', p_class_id: classId, p_is_demo: true });
ok(!add.error, '1) إضافة طالبة ' + (add.error?.message || ''));
const dup = await T.rpc('admin_create_student', { p_full_name: 'مكرر', p_username: uname, p_password: 'pass1234', p_class_id: classId });
ok(!!dup.error && /مستخدم مسبقًا/.test(dup.error.message), 'منع اسم مستخدم مكرر');
// 2-4) مهمة الاختبار القبلي 1 نقطة مع موعد
const due = new Date(Date.now() + 2 * 864e5).toISOString();
const task = await T.from('tasks').insert({ title: 'الاختبار القبلي', task_type: 'اختبار قبلي', track: 'commitment', points: 1, due_at: due, class_id: classId, verification: 'self' }).select().single();
ok(!task.error, '2-4) إنشاء مهمة الاختبار القبلي = 1 نقطة ' + (task.error?.message || ''));
const codeRow = await T.from('task_codes').select('code').eq('task_id', task.data.id).single();
ok(/^[A-Z0-9]{6}$/.test(codeRow.data.code), 'تولّد رمز/QR للمهمة: ' + codeRow.data.code);
// 5) تظهر للطالبة
const N = await login(uname, 'pass1234');
const vis = await N.from('tasks').select('*').eq('id', task.data.id);
ok(vis.data.length === 1, '5) المهمة تظهر للطالبة');
const notif = await N.from('notifications').select('*');
ok(notif.data.some(n => n.title === 'لديكِ مهمة جديدة'), 'تنبيه «لديكِ مهمة جديدة»');
// 6-8) الطالبة تنجز ← تُسجل ← تُضاف النقطة
const before = (await N.from('student_summary').select('balance').single()).data.balance;
const sub = await N.rpc('student_submit_task', { p_task_id: task.data.id });
ok(!sub.error && sub.data.points === 1, '6-7) الطالبة تنجز المهمة ويُسجل الإنجاز');
const after = (await N.from('student_summary').select('balance').single()).data.balance;
ok(after === before + 1, `8) أُضيفت النقطة إلى الرصيد (${before} → ${after})`);
ok(!!(await N.rpc('student_submit_task', { p_task_id: task.data.id })).error, 'منع تسجيل المهمة نفسها مرتين');
// 9) يظهر في سجلها
const hist = await N.from('points_transactions').select('*').eq('task_id', task.data.id);
ok(hist.data.length === 1 && hist.data[0].reason.includes('الاختبار القبلي'), '9) يظهر في سجل إنجازاتها');
ok((await N.from('notifications').select('*')).data.some(n => n.title.includes('نقطة ذهبية')), 'تنبيه «حصلتِ على نقطة ذهبية»');
// 10) تقرير الإنجاز
const rep = await T.from('task_completions').select('*, students(full_name)').eq('task_id', task.data.id);
ok(rep.data.length === 1 && rep.data[0].students.full_name === 'طالبة اختبار', '10) المعلمة ترى تقرير الإنجاز');
// منح نقاط يدوية لتصل لمكافأة
const adj = await T.rpc('admin_adjust_points', { p_student_ids: [add.data], p_amount: 5, p_track: 'initiative', p_reason: 'مبادرة تعليمية' });
ok(!adj.error, 'المعلمة تضيف نقاط مبادرة مع السبب');
ok(!!(await T.rpc('admin_adjust_points', { p_student_ids: [add.data], p_amount: -1, p_track: null, p_reason: '' })).error, 'الخصم يتطلب سببًا');
ok(!!(await T.rpc('admin_adjust_points', { p_student_ids: [add.data], p_amount: -100, p_track: null, p_reason: 'x' })).error, 'لا يمكن أن يصبح الرصيد سالبًا');
const txs = await T.from('points_transactions').select('created_by, reason').eq('student_id', add.data);
const { data: tUser } = await T.auth.getUser();
ok(txs.data.some(t => t.created_by === tUser.user.id && t.reason === 'مبادرة تعليمية'), 'كل عملية تسجل المعلمة المنفذة');
// 11-13) الاستبدال
const { data: rewards } = await N.from('rewards').select('*').order('sort_order');
const r = rewards.find(x => x.cost === 5 && x.max_per_student === 2);
const bal1 = (await N.from('student_summary').select('balance').single()).data.balance;
const red = await N.rpc('student_redeem', { p_reward_id: r.id });
ok(!red.error, '11-12) الطالبة تستبدل مكافأة ويُسجل الطلب ' + (red.error?.message || ''));
const bal2 = (await N.from('student_summary').select('balance').single()).data.balance;
ok(bal2 === bal1 - r.cost, `13) انخفض الرصيد تلقائيًا (${bal1} → ${bal2})`);
const red2 = await N.rpc('student_redeem', { p_reward_id: r.id });
ok(!!red2.error, 'رفض الاستبدال عند عدم كفاية الرصيد: ' + red2.error?.message);
// رفض الطلب يعيد النقاط
await T.rpc('teacher_decide_redemption', { p_redemption_id: red.data.redemption_id, p_approve: false, p_note: 'تجربة' });
const bal3 = (await N.from('student_summary').select('balance').single()).data.balance;
ok(bal3 === bal1, 'رفض الطلب يعيد النقاط تلقائيًا');
// الحد الأعلى
await T.rpc('admin_adjust_points', { p_student_ids: [add.data], p_amount: 20, p_track: 'excellence', p_reason: 'مشروع متميز' });
const a1 = await N.rpc('student_redeem', { p_reward_id: r.id });
const a2 = await N.rpc('student_redeem', { p_reward_id: r.id });
const a3 = await N.rpc('student_redeem', { p_reward_id: r.id });
ok(!a1.error && !a2.error && !!a3.error, 'الحد الأعلى للمكافأة (مرتان) مطبق: ' + a3.error?.message);
ok((await N.from('notifications').select('*')).data.some(n => n.title.startsWith('مبروك! وصلتِ إلى مستوى')), 'تنبيه الوصول إلى مستوى جديد');

console.log('— المسارعة: الموعد النهائي');
const past = await T.from('tasks').insert({ title: 'مهمة منتهية', points: 2, start_at: new Date(Date.now()-3*864e5).toISOString(), due_at: new Date(Date.now()-864e5).toISOString(), class_id: classId, verification: 'self' }).select().single();
const late = await N.rpc('student_submit_task', { p_task_id: past.data.id });
ok(!late.error && late.data.on_time === false && late.data.points === 0, 'الإنجاز بعد الموعد يُسجل بدون نقاط (عدالة)');

console.log('— QR / الرمز');
const qrTask = await T.from('tasks').insert({ title: 'نشاط QR', points: 2, due_at: due, class_id: classId, verification: 'code' }).select().single();
const qrCode = (await T.from('task_codes').select('code').eq('task_id', qrTask.data.id).single()).data.code;
ok(!!(await N.rpc('student_submit_task', { p_task_id: qrTask.data.id })).error, 'مهمة الرمز لا تُسجل بدون الرمز');
ok(!!(await N.rpc('student_claim_code', { p_code: 'ZZZZZZ' })).error, 'رفض رمز خاطئ');
const prev = await N.rpc('task_by_code', { p_code: qrCode.toLowerCase() });
ok(!prev.error && prev.data.title === 'نشاط QR', 'معاينة المهمة من رابط QR');
const cl = await N.rpc('student_claim_code', { p_code: qrCode });
ok(!cl.error && cl.data.points === 2, 'تسجيل الإنجاز بالرمز + نقطتان');

console.log('— الإثبات والاعتماد');
const pTask = await T.from('tasks').insert({ title: 'إثبات', points: 3, due_at: due, class_id: classId, verification: 'proof', track: 'excellence' }).select().single();
ok(!!(await N.rpc('student_submit_task', { p_task_id: pTask.data.id })).error, 'الإثبات مطلوب');
const ps = await N.rpc('student_submit_task', { p_task_id: pTask.data.id, p_proof_text: 'أنجزت', p_proof_image: 'data:image/jpeg;base64,AAAA' });
ok(!ps.error && ps.data.status === 'pending' && ps.data.points === 0, 'الإثبات بانتظار الاعتماد (بدون نقاط بعد)');
const b4 = (await N.from('student_summary').select('balance').single()).data.balance;
await T.rpc('teacher_review_completion', { p_completion_id: ps.data.completion_id, p_approve: true });
const b5 = (await N.from('student_summary').select('balance').single()).data.balance;
ok(b5 === b4 + 3, 'اعتماد المعلمة يمنح النقاط');
ok(!!(await N.rpc('teacher_review_completion', { p_completion_id: ps.data.completion_id, p_approve: true })).error, 'الطالبة لا تعتمد إنجازها');

console.log('— الرصد اليدوي والتذكير والإلغاء');
const mTask = await T.from('tasks').insert({ title: 'يدوي', points: 1, due_at: due, class_id: classId, verification: 'teacher' }).select().single();
const rem = await T.rpc('teacher_send_reminder', { p_task_id: mTask.data.id });
ok(!rem.error && rem.data >= 10, 'إرسال تذكير لمن لم تكمل: ' + rem.data);
const mk2 = await T.rpc('teacher_mark_completed', { p_task_id: mTask.data.id, p_student_ids: [add.data, myId], p_count_on_time: true });
ok(mk2.data === 2, 'رصد يدوي لطالبتين');
const comp = (await T.from('task_completions').select('id').eq('task_id', mTask.data.id).eq('student_id', add.data).single()).data;
const b6 = (await N.from('student_summary').select('balance').single()).data.balance;
await T.rpc('teacher_undo_completion', { p_completion_id: comp.id, p_reason: 'خطأ في الرصد' });
const b7 = (await N.from('student_summary').select('balance').single()).data.balance;
ok(b7 === b6 - 1, 'إلغاء الإنجاز يعكس النقاط');
const logs = await T.from('activity_logs').select('action').order('created_at', { ascending: false }).limit(200);
ok(['points_add','undo_completion','send_reminder','reject_redemption','create_task'].every(a => logs.data.some(l => l.action === a)), 'كل العمليات مسجلة في سجل العمليات');

console.log('— قالب المخاليط وتذكير اليوم الأخير');
const tpl = await T.rpc('create_flipped_template', { p_class_id: classId, p_due_at: new Date(Date.now() + 5 * 3600e3).toISOString(), p_title: 'المخاليط (2)' });
ok(!tpl.error, 'إنشاء قالب الصف المقلوب');
const dr = await N.rpc('generate_my_due_reminders');
ok(dr.data >= 5, 'تنبيهات «تبقى أقل من يوم»: ' + dr.data);
ok((await N.rpc('generate_my_due_reminders')).data === 0, 'لا تتكرر التنبيهات');

console.log('— إدارة الحسابات');
ok(!(await T.rpc('admin_reset_password', { p_user_id: (await N.auth.getUser()).data.user.id, p_new_password: 'newpass99' })).error, 'إعادة تعيين كلمة المرور');
ok(!!(await login(uname, 'newpass99')), 'الدخول بكلمة المرور الجديدة');
const del = await T.rpc('admin_delete_student', { p_student_id: add.data });
ok(!del.error, 'حذف طالبة مع سجلاتها');

console.log(`\nالنتيجة: ${pass} ناجح / ${fail} فاشل`);
process.exit(fail ? 1 : 0);
