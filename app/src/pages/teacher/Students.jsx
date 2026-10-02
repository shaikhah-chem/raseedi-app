import { useMemo, useState } from 'react';
import { useLoad } from '../../lib/hooks';
import { supabase, q, rpc } from '../../lib/supabase';
import { loadClasses, loadStudents, classLabel } from '../../lib/teacherData';
import { levelFor, TRACKS, TX_KIND } from '../../lib/constants';
import { downloadCSV, fmtShort, randomPassword, relTime } from '../../lib/format';
import { Card, Empty, ErrorBox, Modal, PageHeader, Spinner, Tabs, TrackBadge, useDialog, useToast, Badge } from '../../components/ui';
import { AdjustPointsForm } from './Points';

export default function Students() {
  const toast = useToast(); const dlg = useDialog();
  const { data, loading, error, reload } = useLoad(async () => {
    const [classes, students] = await Promise.all([loadClasses(), loadStudents()]);
    return { classes, students };
  });
  const [cls, setCls] = useState('');
  const [qs, setQs] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState(null); // {type, student}

  const list = useMemo(() => (data?.students || []).filter((s) =>
    (showInactive || s.active) && (!cls || s.class_id === cls) && (!qs || s.full_name.includes(qs) || s.username.includes(qs.toLowerCase()))), [data, cls, qs, showInactive]);

  const resetPw = async (s) => {
    const pw = await dlg.prompt(`كلمة مرور جديدة لـ ${s.full_name}`, 'كلمة المرور (6 خانات على الأقل)', { defaultValue: randomPassword() });
    if (!pw) return;
    try { await rpc('admin_reset_password', { p_user_id: s.user_id, p_new_password: pw }); toast(`تم التغيير. كلمة المرور الجديدة: ${pw}`); }
    catch (e) { toast(e.message, 'err'); }
  };
  const del = async (s) => {
    if (!(await dlg.confirm('حذف الطالبة نهائيًا؟', `سيتم حذف ${s.full_name} مع كل سجلاتها ونقاطها. يمكنكِ بدلًا من ذلك تعطيل الحساب من «تعديل».`, 'حذف نهائي', true))) return;
    try { await rpc('admin_delete_student', { p_student_id: s.id }); toast('تم الحذف'); reload(true); } catch (e) { toast(e.message, 'err'); }
  };
  const exportCSV = () => downloadCSV('الطالبات', ['الاسم', 'اسم المستخدم', 'الفصل', 'الرصيد', 'النقاط المكتسبة', 'المستوى', 'المهام المنجزة', 'المبادرات', 'آخر نشاط', 'الحالة'],
    list.map((s) => [s.full_name, s.username, classLabel(data.classes, s.class_id), s.balance, s.earned, levelFor(s.earned).name, s.tasks_done, s.initiatives, s.last_activity ? fmtShort(s.last_activity) : '', s.active ? 'نشطة' : 'معطلة']));

  return (
    <>
      <PageHeader icon="👩‍🎓" title="الطالبات" subtitle="إضافة الطالبات وإدارة حساباتهن ومتابعة أرصدتهن"
        actions={<>
          <button className="btn btn-ghost" onClick={exportCSV} disabled={!list.length}>⬇️ تصدير</button>
          <button className="btn btn-ghost" onClick={() => setModal({ type: 'bulk' })}>📋 إضافة مجموعة</button>
          <button className="btn btn-primary" onClick={() => setModal({ type: 'add' })}>＋ إضافة طالبة</button>
        </>} />
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Spinner /> : (
        <>
          {!data.classes.length && <div className="alert alert-info">ابدئي بإضافة فصل من <a href="#/t/settings">الإعدادات ← الفصول</a> ثم أضيفي الطالبات.</div>}
          <div className="filters">
            <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="الفصل"><option value="">كل الفصول</option>
              {data.classes.map((c) => <option key={c.id} value={c.id}>{c.grade} — {c.name}</option>)}</select>
            <input placeholder="🔍 بحث بالاسم أو اسم المستخدم" value={qs} onChange={(e) => setQs(e.target.value)} />
            <label className="inline-check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> إظهار المعطّلات</label>
            <span className="muted small">العدد: {list.length}</span>
          </div>
          {!list.length ? <Empty icon="👩‍🎓" title="لا توجد طالبات">أضيفي الطالبات من الزر «إضافة طالبة» أو «إضافة مجموعة».</Empty> : (
            <Card className="table-card">
              <div className="table-scroll">
                <table className="table">
                  <thead><tr><th>الطالبة</th><th>الفصل</th><th>الرصيد</th><th>المستوى</th><th>المهام</th><th>المبادرات</th><th>آخر نشاط</th><th /></tr></thead>
                  <tbody>{list.map((s) => {
                    const lv = levelFor(s.earned);
                    return (
                      <tr key={s.id} className={s.active ? '' : 'row-muted'}>
                        <td><button className="link-btn" onClick={() => setModal({ type: 'detail', student: s })}><b>{s.full_name}</b></button>
                          <div className="muted small" dir="ltr" style={{ textAlign: 'right' }}>{s.username}</div>
                          {s.is_demo && <Badge cls="badge-muted">تجريبية</Badge>}{!s.active && <Badge cls="badge-muted">معطلة</Badge>}</td>
                        <td>{classLabel(data.classes, s.class_id)}</td>
                        <td><b className="gold-num">⭐ {s.balance}</b></td>
                        <td><span className="nowrap">{lv.icon} {lv.name}</span></td>
                        <td>{s.tasks_done}</td>
                        <td>{s.initiatives}</td>
                        <td className="muted small">{s.last_activity ? relTime(s.last_activity) : '—'}</td>
                        <td className="row-actions">
                          <button className="btn btn-sm btn-gold" onClick={() => setModal({ type: 'points', student: s })}>⭐ نقاط</button>
                          <button className="btn btn-sm btn-ghost" onClick={() => setModal({ type: 'edit', student: s })}>تعديل</button>
                          <button className="btn btn-sm btn-ghost" onClick={() => resetPw(s)} title="إعادة تعيين كلمة المرور">🔑</button>
                          <button className="btn btn-sm btn-ghost danger-txt" onClick={() => del(s)} title="حذف">🗑</button>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {modal?.type === 'add' && <StudentForm classes={data.classes} defaultClass={cls} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(true); }} />}
      {modal?.type === 'edit' && <StudentForm classes={data.classes} student={modal.student} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(true); }} />}
      {modal?.type === 'bulk' && <BulkAdd classes={data.classes} existing={data.students} defaultClass={cls} onClose={() => { setModal(null); reload(true); }} />}
      {modal?.type === 'points' && (
        <Modal open title={`نقاط: ${modal.student.full_name}`} onClose={() => setModal(null)}>
          <AdjustPointsForm fixedIds={[modal.student.id]} onDone={() => { setModal(null); reload(true); }} />
        </Modal>
      )}
      {modal?.type === 'detail' && <StudentDetail student={modal.student} classes={data.classes} onClose={() => { setModal(null); reload(true); }} />}
    </>
  );
}

function StudentForm({ classes, student, defaultClass, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState(student
    ? { full_name: student.full_name, class_id: student.class_id || '', active: student.active, notes: student.notes || '' }
    : { full_name: '', username: '', password: randomPassword(), class_id: defaultClass || classes[0]?.id || '' });
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (student) {
        await rpc('admin_update_student', { p_student_id: student.id, p_full_name: f.full_name, p_class_id: f.class_id || null, p_active: f.active, p_notes: f.notes || null });
        toast('تم حفظ التعديلات'); onDone();
      } else {
        await rpc('admin_create_student', { p_full_name: f.full_name, p_username: f.username, p_password: f.password, p_class_id: f.class_id || null, p_is_demo: false });
        toast('تمت إضافة الطالبة'); setCreated({ ...f });
      }
    } catch (e2) { toast(e2.message, 'err'); } finally { setBusy(false); }
  };
  if (created) return (
    <Modal open title="تمت إضافة الطالبة ✅" onClose={onDone} footer={<button className="btn btn-primary" onClick={onDone}>تم</button>}>
      <div className="cred-card"><b>{created.full_name}</b><div>اسم المستخدم: <code dir="ltr">{created.username.toLowerCase()}</code></div><div>كلمة المرور: <code dir="ltr">{created.password}</code></div></div>
      <p className="muted small">أعطي الطالبة هذه البيانات للدخول. يمكنكِ إعادة تعيين كلمة المرور لاحقًا من زر 🔑.</p>
    </Modal>
  );
  return (
    <Modal open title={student ? 'تعديل بيانات الطالبة' : 'إضافة طالبة'} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label className="field"><span>اسم الطالبة</span><input value={f.full_name} onChange={set('full_name')} required autoFocus /></label>
        {!student && <div className="grid-2 tight">
          <label className="field"><span>اسم المستخدم (إنجليزي/أرقام)</span><input dir="ltr" value={f.username} onChange={set('username')} placeholder="s0101" required pattern="[A-Za-z0-9._\-]{3,30}" /></label>
          <label className="field"><span>كلمة المرور</span><input dir="ltr" value={f.password} onChange={set('password')} required minLength={6} /></label>
        </div>}
        <label className="field"><span>الفصل</span><select value={f.class_id} onChange={set('class_id')}>
          <option value="">— بدون فصل —</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.grade} — {c.name}</option>)}</select></label>
        {student && <>
          <label className="field"><span>ملاحظات (تظهر لكِ فقط)</span><input value={f.notes} onChange={set('notes')} /></label>
          <label className="inline-check"><input type="checkbox" checked={f.active} onChange={set('active')} /> الحساب نشط</label>
        </>}
        <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'حفظ'}</button></div>
      </form>
    </Modal>
  );
}

function BulkAdd({ classes, existing, defaultClass, onClose }) {
  const toast = useToast();
  const [classId, setClassId] = useState(defaultClass || classes[0]?.id || '');
  const c = classes.find((x) => x.id === classId);
  const [prefix, setPrefix] = useState(() => 's' + ((c?.name || '').replace(/\D/g, '') || ''));
  const [names, setNames] = useState('');
  const [samePw, setSamePw] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(0);

  const run = async () => {
    const list = names.split('\n').map((x) => x.trim()).filter(Boolean);
    if (!list.length) return toast('اكتبي أسماء الطالبات (اسم في كل سطر)', 'err');
    const taken = new Set(existing.map((s) => s.username));
    let n = 1; const out = [];
    setBusy(true); setProgress(0);
    for (const name of list) {
      let u; do { u = `${prefix.toLowerCase()}${String(n).padStart(2, '0')}`; n++; } while (taken.has(u));
      taken.add(u);
      const pw = samePw || randomPassword();
      try { await rpc('admin_create_student', { p_full_name: name, p_username: u, p_password: pw, p_class_id: classId || null, p_is_demo: false }); out.push({ name, u, pw, ok: true }); }
      catch (e) { out.push({ name, u, pw, ok: false, err: e.message }); }
      setProgress(out.length / list.length);
    }
    setBusy(false); setResults(out);
    toast(`تمت إضافة ${out.filter((r) => r.ok).length} طالبة`);
  };

  if (results) return (
    <Modal open wide title="بطاقات دخول الطالبات" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={() => downloadCSV('بيانات_دخول_الطالبات', ['الاسم', 'اسم المستخدم', 'كلمة المرور', 'الفصل'], results.filter((r) => r.ok).map((r) => [r.name, r.u, r.pw, c ? `${c.grade} ${c.name}` : '']))}>⬇️ تصدير Excel</button>
        <button className="btn btn-ghost" onClick={() => window.print()}>🖨 طباعة البطاقات</button>
        <button className="btn btn-primary" onClick={onClose}>تم</button></>}>
      <p className="muted no-print">احتفظي بهذه البيانات أو اطبعيها وقصّيها لتوزيعها على الطالبات.</p>
      <div className="cred-grid print-area">
        {results.map((r) => (
          <div key={r.u} className={`cred-card ${r.ok ? '' : 'cred-err'}`}>
            <div className="cred-brand">✨ رصيدي الذهبي</div>
            <b>{r.name}</b>
            {r.ok ? <><div>المستخدم: <code dir="ltr">{r.u}</code></div><div>كلمة المرور: <code dir="ltr">{r.pw}</code></div></> : <div className="danger-txt small">{r.err}</div>}
          </div>
        ))}
      </div>
    </Modal>
  );

  return (
    <Modal open wide title="إضافة مجموعة طالبات" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose} disabled={busy}>إلغاء</button>
        <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? `جارٍ الإضافة ${Math.round(progress * 100)}%` : 'إضافة الطالبات'}</button></>}>
      <div className="grid-3 tight">
        <label className="field"><span>الفصل</span><select value={classId} onChange={(e) => { setClassId(e.target.value); const cc = classes.find((x) => x.id === e.target.value); setPrefix('s' + ((cc?.name || '').replace(/\D/g, ''))); }}>
          <option value="">— بدون فصل —</option>{classes.map((x) => <option key={x.id} value={x.id}>{x.grade} — {x.name}</option>)}</select></label>
        <label className="field"><span>بادئة اسم المستخدم</span><input dir="ltr" value={prefix} onChange={(e) => setPrefix(e.target.value.replace(/[^A-Za-z0-9._-]/g, ''))} /></label>
        <label className="field"><span>كلمة مرور موحدة (اختياري)</span><input dir="ltr" value={samePw} onChange={(e) => setSamePw(e.target.value)} placeholder="فارغ = كلمة عشوائية لكل طالبة" /></label>
      </div>
      <label className="field"><span>أسماء الطالبات — اسم في كل سطر (يمكن النسخ من Excel أو نور)</span>
        <textarea rows={10} value={names} onChange={(e) => setNames(e.target.value)} placeholder={'سارة العتيبي\nنورة الحربي\nريم المطيري'} /></label>
      <p className="muted small">ستُنشأ أسماء مستخدمين تلقائيًا مثل: <code dir="ltr">{prefix}01</code>، <code dir="ltr">{prefix}02</code>...</p>
      {busy && <div className="progress"><div className="progress-fill" style={{ width: `${progress * 100}%` }} /></div>}
    </Modal>
  );
}

function StudentDetail({ student, classes, onClose }) {
  const [tab, setTab] = useState('tx');
  const [adding, setAdding] = useState(false);
  const { data, loading, reload } = useLoad(async () => {
    const [s, txs, comps, reds] = await Promise.all([
      q(supabase.from('student_summary').select('*').eq('id', student.id).single()),
      q(supabase.from('points_transactions').select('*, users:created_by(full_name)').eq('student_id', student.id).order('created_at', { ascending: false })),
      q(supabase.from('task_completions').select('*, tasks(title, points, due_at)').eq('student_id', student.id).order('submitted_at', { ascending: false })),
      q(supabase.from('redemptions').select('*, rewards(title)').eq('student_id', student.id).order('created_at', { ascending: false })),
    ]);
    return { s, txs, comps, reds };
  });
  const s = data?.s || student; const lv = levelFor(s.earned);
  const byTrack = Object.values(TRACKS).map((t) => ({ t, v: (data?.txs || []).filter((x) => x.track === t.key && x.amount > 0).reduce((a, x) => a + x.amount, 0) }));
  return (
    <Modal open wide title={`ملف الطالبة: ${student.full_name}`} onClose={onClose}>
      {loading ? <Spinner /> : <>
        <div className="detail-top">
          <div className="detail-bal"><small>الرصيد الحالي</small><b>⭐ {s.balance}</b><span>{lv.icon} {lv.name}</span></div>
          <div className="detail-stats">
            <div><b>{s.earned}</b><small>إجمالي المكتسب</small></div>
            <div><b>{s.tasks_done}</b><small>مهام منجزة</small></div>
            <div><b>{s.initiatives}</b><small>مبادرات</small></div>
            <div><b>{s.last_activity ? relTime(s.last_activity) : '—'}</b><small>آخر نشاط</small></div>
          </div>
        </div>
        <div className="track-mini">{byTrack.map(({ t, v }) => <span key={t.key}><i className="dot" style={{ background: t.color }} />{t.short}: <b>{v}</b></span>)}</div>
        <div className="muted small">{classLabel(classes, s.class_id)} • <span dir="ltr">{s.username}</span></div>
        {adding ? <Card className="inner-card"><AdjustPointsForm fixedIds={[student.id]} onDone={() => { setAdding(false); reload(true); }} /></Card>
          : <button className="btn btn-gold btn-sm" onClick={() => setAdding(true)}>⭐ إضافة / خصم نقاط</button>}
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'tx', label: 'سجل النقاط', count: data.txs.length }, { value: 'tasks', label: 'المهام', count: data.comps.length }, { value: 'red', label: 'الاستبدالات', count: data.reds.length }]} />
        {tab === 'tx' && (data.txs.length ? <ul className="tx-list">{data.txs.map((t) => (
          <li key={t.id}><b className={t.amount > 0 ? 'pos' : 'neg'}>{t.amount > 0 ? '+' : ''}{t.amount} ⭐</b>
            <div><div>{t.reason}</div><small className="muted">{TX_KIND[t.kind]} {t.track && <TrackBadge track={t.track} />} • {fmtShort(t.created_at)} • {t.users?.full_name || '—'}</small></div></li>))}</ul>
          : <Empty title="لا توجد عمليات" />)}
        {tab === 'tasks' && (data.comps.length ? <ul className="tx-list">{data.comps.map((c) => (
          <li key={c.id}><b>{c.status === 'approved' ? '✅' : c.status === 'pending' ? '⏳' : '✖️'}</b>
            <div><div>{c.tasks?.title}</div><small className="muted">{fmtShort(c.submitted_at)} • {c.on_time ? 'في الموعد' : 'بعد الموعد'} • +{c.points_awarded} ⭐</small></div></li>))}</ul>
          : <Empty title="لم تُنجز مهامًا بعد" />)}
        {tab === 'red' && (data.reds.length ? <ul className="tx-list">{data.reds.map((r) => (
          <li key={r.id}><b className="neg">-{r.cost} ⭐</b><div><div>{r.rewards?.title}</div><small className="muted">{fmtShort(r.created_at)} • {r.status === 'approved' ? 'معتمد' : r.status === 'pending' ? 'بانتظار الاعتماد' : 'مرفوض'}</small></div></li>))}</ul>
          : <Empty title="لا توجد استبدالات" />)}
      </>}
    </Modal>
  );
}
