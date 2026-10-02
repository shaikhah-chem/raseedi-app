import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLoad } from '../../lib/hooks';
import { supabase, q, rpc, fetchAll } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { downloadCSV, fmtShort, randomPassword } from '../../lib/format';
import { Card, Empty, ErrorBox, PageHeader, Spinner, Tabs, useDialog, useToast } from '../../components/ui';

const ACTIONS = {
  points_add: 'إضافة نقاط', points_deduct: 'خصم نقاط', create_student: 'إضافة طالبة', update_student: 'تعديل طالبة', delete_student: 'حذف طالبة',
  reset_password: 'تغيير كلمة مرور', create_task: 'إنشاء مهمة', update_task: 'تعديل مهمة', delete_task: 'حذف مهمة', task_completion: 'تسجيل إنجاز',
  approve_completion: 'اعتماد إثبات', reject_completion: 'إعادة إثبات', undo_completion: 'إلغاء إنجاز', send_reminder: 'إرسال تذكير',
  approve_redemption: 'اعتماد استبدال', reject_redemption: 'رفض استبدال', insert_reward: 'إضافة مكافأة', update_reward: 'تعديل مكافأة', delete_reward: 'حذف مكافأة',
  create_flipped_template: 'إنشاء درس مقلوب', bootstrap_teacher: 'إعداد النظام', create_teacher: 'إضافة معلمة', delete_demo_students: 'حذف البيانات التجريبية',
};

export default function Settings() {
  const [sp] = useSearchParams();
  const [tab, setTab] = useState('classes');
  return (
    <>
      <PageHeader icon="⚙️" title="الإعدادات" subtitle="الفصول والحسابات وسجل العمليات" />
      {sp.get('welcome') && <div className="alert alert-ok">🎉 تم إنشاء حسابك بنجاح! ابدئي بإضافة الفصول، ثم الطالبات من صفحة «الطالبات».</div>}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'classes', label: '🏫 الفصول' }, { value: 'account', label: '👤 حسابي' }, { value: 'teachers', label: '👩‍🏫 المعلمات' },
        { value: 'site', label: '🎨 الموقع' }, { value: 'log', label: '🧾 سجل العمليات' }, { value: 'demo', label: '🧪 البيانات التجريبية' }]} />
      {tab === 'classes' && <Classes />}
      {tab === 'account' && <Account />}
      {tab === 'teachers' && <Teachers />}
      {tab === 'site' && <Site />}
      {tab === 'log' && <Log />}
      {tab === 'demo' && <Demo />}
    </>
  );
}

function Classes() {
  const toast = useToast(); const dlg = useDialog();
  const { data, loading, error, reload } = useLoad(async () => {
    const [classes, students] = await Promise.all([q(supabase.from('classes').select('*').order('grade').order('name')), q(supabase.from('students').select('class_id'))]);
    return { classes, students };
  });
  const [f, setF] = useState({ grade: 'ثالث ثانوي', name: '' });
  const add = async (e) => {
    e.preventDefault();
    try { await q(supabase.from('classes').insert({ grade: f.grade.trim(), name: f.name.trim() })); setF({ ...f, name: '' }); toast('أُضيف الفصل'); reload(true); } catch (e2) { toast(e2.message, 'err'); }
  };
  const rename = async (c) => {
    const n = await dlg.prompt('تعديل اسم الفصل', 'اسم الفصل', { defaultValue: c.name }); if (!n) return;
    try { await q(supabase.from('classes').update({ name: n }).eq('id', c.id)); reload(true); } catch (e) { toast(e.message, 'err'); }
  };
  const del = async (c) => {
    if (!(await dlg.confirm('حذف الفصل؟', 'ستبقى الطالبات لكن بدون فصل، وتُحذف مهام هذا الفصل.', 'حذف', true))) return;
    try { await q(supabase.from('classes').delete().eq('id', c.id)); reload(true); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Card>
      <ErrorBox error={error} onRetry={reload} />
      <form onSubmit={add} className="filters">
        <label className="field"><span>الصف</span><select value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })}>{['أول ثانوي', 'ثاني ثانوي', 'ثالث ثانوي', 'السنة المشتركة'].map((g) => <option key={g}>{g}</option>)}</select></label>
        <label className="field"><span>الفصل</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="مثال: 3/1" required /></label>
        <button className="btn btn-primary">＋ إضافة فصل</button>
      </form>
      {loading ? <Spinner /> : !data.classes.length ? <Empty icon="🏫" title="لا توجد فصول بعد" /> : (
        <table className="table"><thead><tr><th>الصف</th><th>الفصل</th><th>عدد الطالبات</th><th /></tr></thead>
          <tbody>{data.classes.map((c) => <tr key={c.id}><td>{c.grade}</td><td><b>{c.name}</b></td><td>{data.students.filter((s) => s.class_id === c.id).length}</td>
            <td className="row-actions"><button className="btn btn-sm btn-ghost" onClick={() => rename(c)}>تعديل</button><button className="btn btn-sm btn-ghost danger-txt" onClick={() => del(c)}>حذف</button></td></tr>)}</tbody></table>
      )}
    </Card>
  );
}

export function Account() {
  const toast = useToast(); const { profile } = useAuth();
  const [p, setP] = useState({ a: '', b: '' });
  const submit = async (e) => {
    e.preventDefault();
    if (p.a.length < 6) return toast('كلمة المرور 6 خانات على الأقل', 'err');
    if (p.a !== p.b) return toast('كلمتا المرور غير متطابقتين', 'err');
    const { error } = await supabase.auth.updateUser({ password: p.a });
    if (error) toast(error.message, 'err'); else { toast('تم تغيير كلمة المرور'); setP({ a: '', b: '' }); }
  };
  return (
    <Card style={{ maxWidth: 520 }}>
      <h3>👤 {profile?.full_name}</h3>
      <p className="muted">اسم المستخدم: <code dir="ltr">{profile?.username}</code></p>
      <form onSubmit={submit} className="stack">
        <label className="field"><span>كلمة مرور جديدة</span><input type="password" dir="ltr" value={p.a} onChange={(e) => setP({ ...p, a: e.target.value })} /></label>
        <label className="field"><span>تأكيدها</span><input type="password" dir="ltr" value={p.b} onChange={(e) => setP({ ...p, b: e.target.value })} /></label>
        <button className="btn btn-primary">تغيير كلمة المرور</button>
      </form>
    </Card>
  );
}

function Teachers() {
  const toast = useToast(); const dlg = useDialog();
  const { data, loading, reload } = useLoad(() => q(supabase.from('users').select('*').eq('role', 'teacher').order('created_at')));
  const [f, setF] = useState({ full_name: '', username: '', password: randomPassword() });
  const add = async (e) => {
    e.preventDefault();
    try { await rpc('admin_create_teacher', { p_username: f.username, p_password: f.password, p_full_name: f.full_name }); toast(`أُضيفت المعلمة. كلمة المرور: ${f.password}`); setF({ full_name: '', username: '', password: randomPassword() }); reload(true); }
    catch (e2) { toast(e2.message, 'err'); }
  };
  const reset = async (u) => {
    const pw = await dlg.prompt(`كلمة مرور جديدة لـ ${u.full_name}`, 'كلمة المرور', { defaultValue: randomPassword() }); if (!pw) return;
    try { await rpc('admin_reset_password', { p_user_id: u.id, p_new_password: pw }); toast('تم التغيير'); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <div className="grid-2">
      <Card><h3>المعلمات في النظام</h3>{loading ? <Spinner /> : <ul className="mini-list">{data.map((u) => <li key={u.id}><span>👩‍🏫 {u.full_name} <code dir="ltr">{u.username}</code></span><button className="btn btn-sm btn-ghost" onClick={() => reset(u)}>🔑</button></li>)}</ul>}</Card>
      <Card><h3>إضافة معلمة (صلاحيات كاملة)</h3>
        <form onSubmit={add} className="stack">
          <label className="field"><span>الاسم</span><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></label>
          <label className="field"><span>اسم المستخدم</span><input dir="ltr" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required /></label>
          <label className="field"><span>كلمة المرور</span><input dir="ltr" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={6} /></label>
          <button className="btn btn-primary">إضافة</button>
        </form></Card>
    </div>
  );
}

function Site() {
  const toast = useToast(); const { settings, reloadSettings } = useAuth();
  const [f, setF] = useState({ teacher_credit: settings?.teacher_credit || '', school_name: settings?.school_name || '' });
  const save = async (e) => {
    e.preventDefault();
    try { await q(supabase.from('settings').update({ ...f, updated_at: new Date().toISOString() }).eq('id', 1)); await reloadSettings(); toast('تم الحفظ'); } catch (e2) { toast(e2.message, 'err'); }
  };
  return (
    <Card style={{ maxWidth: 620 }}>
      <form onSubmit={save} className="stack">
        <label className="field"><span>اسم المدرسة</span><input value={f.school_name} onChange={(e) => setF({ ...f, school_name: e.target.value })} /></label>
        <label className="field"><span>سطر التنفيذ (يظهر صغيرًا أسفل الصفحة)</span><input value={f.teacher_credit} onChange={(e) => setF({ ...f, teacher_credit: e.target.value })} /></label>
        <button className="btn btn-primary">حفظ</button>
      </form>
    </Card>
  );
}

function Log() {
  const { data, loading, error, reload } = useLoad(() => fetchAll(() => supabase.from('activity_logs').select('*').order('created_at', { ascending: false }), 1000));
  const [qs, setQs] = useState('');
  const rows = (data || []).filter((l) => !qs || (l.actor_name || '').includes(qs) || (ACTIONS[l.action] || l.action).includes(qs) || JSON.stringify(l.details || {}).includes(qs));
  const detail = (l) => { const d = l.details || {}; return [d.reason, d.title, d.name, d.amount !== undefined ? `${d.amount > 0 ? '+' : ''}${d.amount}` : null, d.count !== undefined ? `العدد ${d.count}` : null, d.note].filter(Boolean).join(' • '); };
  return (
    <Card className="table-card">
      <ErrorBox error={error} onRetry={reload} />
      <div className="card-head"><input placeholder="بحث في السجل..." value={qs} onChange={(e) => setQs(e.target.value)} />
        <button className="btn btn-sm btn-ghost" onClick={() => downloadCSV('سجل_العمليات', ['التاريخ', 'المنفذة', 'العملية', 'التفاصيل'], rows.map((l) => [fmtShort(l.created_at), l.actor_name || '', ACTIONS[l.action] || l.action, detail(l)]))}>⬇️ تصدير</button></div>
      {loading ? <Spinner /> : <div className="table-scroll"><table className="table">
        <thead><tr><th>التاريخ والوقت</th><th>المنفذة</th><th>العملية</th><th>التفاصيل</th></tr></thead>
        <tbody>{rows.slice(0, 500).map((l) => <tr key={l.id}><td className="small nowrap">{fmtShort(l.created_at)}</td><td>{l.actor_name || '—'}</td><td>{ACTIONS[l.action] || l.action}</td><td className="small">{detail(l)}</td></tr>)}</tbody>
      </table></div>}
    </Card>
  );
}

function Demo() {
  const toast = useToast(); const dlg = useDialog();
  const del = async () => {
    if (!(await dlg.confirm('حذف الطالبات التجريبيات؟', 'سيتم حذف كل الطالبات المعلَّمات «تجريبية» مع نقاطهن وإنجازاتهن. المهام والمكافآت تبقى.', 'حذف', true))) return;
    try { const n = await rpc('admin_delete_demo_students'); toast(`حُذفت ${n} طالبة تجريبية`); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Card style={{ maxWidth: 620 }}>
      <h3>🧪 البيانات التجريبية</h3>
      <p>عند الانتقال للاستخدام الفعلي مع طالباتك، احذفي الطالبات التجريبيات (سارة، نورة...). تبقى المهام والمكافآت لتعدّليها أو تحذفيها.</p>
      <button className="btn btn-danger" onClick={del}>حذف الطالبات التجريبيات</button>
    </Card>
  );
}
