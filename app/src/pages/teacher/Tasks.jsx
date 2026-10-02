import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLoad } from '../../lib/hooks';
import { supabase, q, rpc } from '../../lib/supabase';
import { loadClasses, loadStudents, loadTasks, loadLessons, loadCompletions, classLabel, eligibleFor, codeOf } from '../../lib/teacherData';
import { TASK_TYPES, TRACK_LIST, VERIFICATION } from '../../lib/constants';
import { fmtDateTime, fmtShort, fromLocalInput, toLocalInput, timeLeft, downloadCSV } from '../../lib/format';
import { Badge, Card, Empty, ErrorBox, Modal, PageHeader, Progress, Spinner, Tabs, TrackBadge, useDialog, useToast } from '../../components/ui';
import QRModal from '../../components/QRModal';

export default function Tasks() {
  const [sp, setSp] = useSearchParams();
  const toast = useToast(); const dlg = useDialog();
  const { data, loading, error, reload } = useLoad(async () => {
    const [classes, students, tasks, lessons, comps] = await Promise.all([loadClasses(), loadStudents(), loadTasks(), loadLessons(), loadCompletions()]);
    return { classes, students, tasks, lessons, comps };
  });
  const [tab, setTab] = useState(sp.get('pending') ? 'pending' : 'active');
  const [cls, setCls] = useState('');
  const [form, setForm] = useState(sp.get('new') ? { task: null } : null);
  const [qr, setQr] = useState(null);
  const [detail, setDetail] = useState(null);

  const view = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    return data.tasks.filter((t) => {
      if (cls && t.class_id && t.class_id !== cls) return false;
      if (tab === 'active') return t.status === 'active' && new Date(t.due_at).getTime() > now;
      if (tab === 'ended') return t.status === 'active' && new Date(t.due_at).getTime() <= now;
      if (tab === 'archived') return t.status === 'archived';
      if (tab === 'pending') return data.comps.some((c) => c.task_id === t.id && c.status === 'pending');
      return true;
    }).sort((a, b) => tab === 'active' ? new Date(a.due_at) - new Date(b.due_at) : new Date(b.due_at) - new Date(a.due_at));
  }, [data, tab, cls]);

  const counts = useMemo(() => {
    if (!data) return {};
    const now = Date.now();
    return {
      active: data.tasks.filter((t) => t.status === 'active' && new Date(t.due_at) > now).length,
      ended: data.tasks.filter((t) => t.status === 'active' && new Date(t.due_at) <= now).length,
      archived: data.tasks.filter((t) => t.status === 'archived').length,
      pending: new Set(data.comps.filter((c) => c.status === 'pending').map((c) => c.task_id)).size,
    };
  }, [data]);

  const archive = async (t) => {
    try { await q(supabase.from('tasks').update({ status: t.status === 'active' ? 'archived' : 'active' }).eq('id', t.id)); toast(t.status === 'active' ? 'تمت الأرشفة' : 'أُعيدت المهمة'); reload(true); }
    catch (e) { toast(e.message, 'err'); }
  };
  const remove = async (t) => {
    if (!(await dlg.confirm('حذف المهمة؟', 'ستُحذف المهمة وسجلات إنجازها. النقاط الممنوحة سابقًا تبقى في سجل الطالبات. يُفضّل «الأرشفة» بدلًا من الحذف.', 'حذف', true))) return;
    try { await q(supabase.from('tasks').delete().eq('id', t.id)); toast('تم الحذف'); reload(true); } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <>
      <PageHeader icon="📚" title="المهام" subtitle="إنشاء المهام وتحديد نقاطها ومواعيدها ومتابعة إنجازها"
        actions={<button className="btn btn-primary" onClick={() => setForm({ task: null })}>＋ إنشاء مهمة</button>} />
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Spinner /> : (
        <>
          <div className="filters">
            <Tabs value={tab} onChange={(v) => { setTab(v); setSp({}); }} tabs={[
              { value: 'active', label: 'نشطة', count: counts.active }, { value: 'pending', label: 'بانتظار الاعتماد', count: counts.pending },
              { value: 'ended', label: 'انتهى موعدها', count: counts.ended }, { value: 'archived', label: 'مؤرشفة', count: counts.archived }]} />
            <select value={cls} onChange={(e) => setCls(e.target.value)}><option value="">كل الفصول</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.grade} — {c.name}</option>)}</select>
          </div>
          {!view.length ? <Empty icon="📚" title="لا توجد مهام هنا">{tab === 'active' && <button className="btn btn-primary btn-sm" onClick={() => setForm({ task: null })}>إنشاء مهمة</button>}</Empty> : (
            <div className="task-grid">
              {view.map((t) => {
                const el = eligibleFor(t, data.students); const cs = data.comps.filter((c) => c.task_id === t.id);
                const done = cs.filter((c) => c.status === 'approved').length; const pend = cs.filter((c) => c.status === 'pending').length;
                const tl = timeLeft(t.due_at);
                return (
                  <Card key={t.id} className="task-card">
                    <div className="task-top">
                      <div className="task-pts">⭐ {t.points}</div>
                      <div className="task-meta"><TrackBadge track={t.track} /><Badge>{t.task_type}</Badge>{t.is_optional && <Badge cls="badge-gold">اختيارية</Badge>}{t.lessons?.title && <Badge cls="badge-purple">📖 {t.lessons.title}</Badge>}</div>
                    </div>
                    <h3 className="task-title">{t.title}</h3>
                    {t.description && <p className="muted small clamp">{t.description}</p>}
                    <div className="task-info small">
                      <span>🗓 {fmtDateTime(t.due_at)}</span>
                      <span className={tl.over ? 'muted' : tl.urgent ? 'warn-txt' : ''}>⏱ {tl.text}</span>
                      <span>👥 {classLabel(data.classes, t.class_id)}</span>
                      <span>{VERIFICATION[t.verification].icon} {VERIFICATION[t.verification].label}</span>
                    </div>
                    <Progress label="الإنجاز" value={done} max={el.length} color="var(--purple-2)" height={8} />
                    {pend > 0 && <div className="alert alert-warn small">⏳ {pend} إثبات بانتظار اعتمادك</div>}
                    <div className="task-actions">
                      <button className="btn btn-sm btn-primary" onClick={() => setDetail(t)}>متابعة الإنجاز</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setQr(t)}>🔳 QR</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setForm({ task: t })}>تعديل</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => archive(t)}>{t.status === 'active' ? 'أرشفة' : 'استعادة'}</button>
                      <button className="btn btn-sm btn-ghost danger-txt" onClick={() => remove(t)} aria-label="حذف">🗑</button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
      {form && <TaskForm task={form.task} classes={data.classes} lessons={data.lessons} onClose={() => { setForm(null); setSp({}); }}
        onSaved={(t) => { setForm(null); setSp({}); reload(true); if (t) setQr(t); }} />}
      {qr && <QRModal task={qr} code={codeOf(qr) || qr._code} onClose={() => setQr(null)} />}
      {detail && <TaskDetail task={detail} students={data.students} classes={data.classes} onClose={() => { setDetail(null); reload(true); }} />}
    </>
  );
}

export function TaskForm({ task, classes, lessons, onClose, onSaved, presetLesson }) {
  const toast = useToast();
  const now = new Date(); const due = new Date(); due.setDate(due.getDate() + 2); due.setHours(22, 0, 0, 0);
  const [f, setF] = useState(task ? {
    title: task.title, description: task.description || '', task_type: task.task_type, track: task.track, points: task.points,
    start_at: toLocalInput(task.start_at), due_at: toLocalInput(task.due_at), class_id: task.class_id || '', lesson_id: task.lesson_id || '',
    is_optional: task.is_optional, verification: task.verification, external_url: task.external_url || '', sort_order: task.sort_order,
  } : { title: '', description: '', task_type: 'اختبار قبلي', track: 'commitment', points: 1, start_at: toLocalInput(now), due_at: toLocalInput(due),
    class_id: classes[0]?.id || '', lesson_id: presetLesson || '', is_optional: false, verification: 'self', external_url: '', sort_order: 0 });
  const [newLesson, setNewLesson] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (new Date(f.due_at) <= new Date(f.start_at)) return toast('تاريخ النهاية يجب أن يكون بعد تاريخ البداية', 'err');
    setBusy(true);
    try {
      let lesson_id = f.lesson_id || null;
      if (f.lesson_id === '__new') {
        if (!newLesson.trim()) throw new Error('اكتبي اسم الدرس');
        const l = await q(supabase.from('lessons').insert({ title: newLesson.trim(), class_id: f.class_id || null, is_flipped: true }).select().single());
        lesson_id = l.id;
      }
      const row = { title: f.title.trim(), description: f.description.trim() || null, task_type: f.task_type, track: f.track, points: Number(f.points),
        start_at: fromLocalInput(f.start_at), due_at: fromLocalInput(f.due_at), class_id: f.class_id || null, lesson_id,
        is_optional: f.is_optional, verification: f.verification, external_url: f.external_url.trim() || null, sort_order: Number(f.sort_order) || 0 };
      if (task) { await q(supabase.from('tasks').update(row).eq('id', task.id)); toast('تم حفظ التعديلات'); onSaved(null); }
      else {
        const t = await q(supabase.from('tasks').insert(row).select('*').single());
        // الرمز يُولَّد على الخادم بعد الإدراج — نجلبه في طلب مستقل
        t.task_codes = await q(supabase.from('task_codes').select('code').eq('task_id', t.id).single());
        toast('تم إنشاء المهمة وظهرت للطالبات 🎉'); onSaved(t);
      }
    } catch (e2) { toast(e2.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <Modal open wide title={task ? 'تعديل المهمة' : 'إنشاء مهمة جديدة'} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label className="field"><span>اسم المهمة *</span><input value={f.title} onChange={set('title')} required autoFocus placeholder="مثال: الاختبار القبلي — المخاليط" /></label>
        <label className="field"><span>وصف المهمة</span><textarea rows={2} value={f.description} onChange={set('description')} placeholder="ماذا تفعل الطالبة بالضبط؟" /></label>
        <div className="grid-3 tight">
          <label className="field"><span>نوع المهمة</span><select value={f.task_type} onChange={set('task_type')}>{TASK_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="field"><span>عدد النقاط ⭐</span><input type="number" min={0} max={50} value={f.points} onChange={set('points')} required /></label>
          <label className="field"><span>المسار</span><select value={f.track} onChange={set('track')}>{TRACK_LIST.map((t) => <option key={t.key} value={t.key}>{t.dot} {t.short}</option>)}</select></label>
        </div>
        <div className="grid-2 tight">
          <label className="field"><span>تاريخ البداية</span><input type="datetime-local" value={f.start_at} onChange={set('start_at')} required /></label>
          <label className="field"><span>الموعد النهائي *</span><input type="datetime-local" value={f.due_at} onChange={set('due_at')} required /></label>
        </div>
        <div className="grid-2 tight">
          <label className="field"><span>الصف والفصل</span><select value={f.class_id} onChange={set('class_id')}>
            <option value="">كل الفصول</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.grade} — {c.name}</option>)}</select></label>
          <label className="field"><span>الدرس (لمهام «قبل الحصة»)</span><select value={f.lesson_id} onChange={set('lesson_id')}>
            <option value="">— بدون درس —</option>{lessons.map((l) => <option key={l.id} value={l.id}>📖 {l.title}{l.class_id ? ` (${classLabel(classes, l.class_id)})` : ''}</option>)}
            <option value="__new">＋ درس جديد...</option></select></label>
        </div>
        {f.lesson_id === '__new' && <label className="field"><span>اسم الدرس الجديد</span><input value={newLesson} onChange={(e) => setNewLesson(e.target.value)} placeholder="مثال: المحاليل" /></label>}
        <div className="field"><span>طريقة التحقق من الإنجاز</span>
          <div className="verify-grid">{Object.entries(VERIFICATION).map(([k, v]) => (
            <label key={k} className={`verify-opt ${f.verification === k ? 'on' : ''}`}>
              <input type="radio" name="verification" value={k} checked={f.verification === k} onChange={set('verification')} />
              <b>{v.icon} {v.label}</b><small>{v.hint}</small></label>))}</div>
        </div>
        <div className="grid-2 tight">
          <label className="field"><span>رابط النشاط (اختياري)</span><input dir="ltr" type="url" value={f.external_url} onChange={set('external_url')} placeholder="https://..." /></label>
          <label className="field"><span>الترتيب ضمن الدرس</span><input type="number" value={f.sort_order} onChange={set('sort_order')} /></label>
        </div>
        <label className="inline-check"><input type="checkbox" checked={f.is_optional} onChange={set('is_optional')} /> مهمة اختيارية / إثرائية (نقاط إضافية للمبادرة، لا تدخل في نسبة الإنجاز)</label>
        <div className="alert alert-info small">⏰ <b>قاعدة المسارعة العادلة:</b> كل طالبة تنجز المهمة قبل الموعد النهائي تحصل على النقاط كاملة — لا يعتمد النظام على «أول من تدخل».</div>
        <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'جارٍ الحفظ...' : task ? 'حفظ التعديلات' : 'إنشاء المهمة'}</button></div>
      </form>
    </Modal>
  );
}

export function TaskDetail({ task, students, classes, onClose }) {
  const toast = useToast(); const dlg = useDialog();
  const { data: comps, loading, reload } = useLoad(() => q(supabase.from('task_completions').select('*').eq('task_id', task.id)));
  const [sel, setSel] = useState([]);
  const [onTime, setOnTime] = useState(true);
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState(null);
  const el = eligibleFor(task, students);
  const map = Object.fromEntries((comps || []).map((c) => [c.student_id, c]));
  const notDone = el.filter((s) => !map[s.id]);

  const mark = async () => {
    if (!sel.length) return;
    setBusy(true);
    try { const n = await rpc('teacher_mark_completed', { p_task_id: task.id, p_student_ids: sel, p_count_on_time: onTime }); toast(`تم رصد ${n} طالبة`); setSel([]); reload(true); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const review = async (c, ok) => {
    let note = null;
    if (!ok) { note = await dlg.prompt('سبب عدم الاعتماد', 'ستصل الملاحظة للطالبة ويمكنها إعادة الإرسال'); if (note === null) return; }
    try { await rpc('teacher_review_completion', { p_completion_id: c.id, p_approve: ok, p_note: note }); toast(ok ? 'تم الاعتماد ومنح النقاط' : 'أُعيد الإثبات للطالبة'); reload(true); }
    catch (e) { toast(e.message, 'err'); }
  };
  const undo = async (c, s) => {
    const r = await dlg.prompt(`إلغاء إنجاز ${s.full_name}`, 'سبب الإلغاء (ستُخصم النقاط الممنوحة لهذه المهمة)');
    if (!r) return;
    try { await rpc('teacher_undo_completion', { p_completion_id: c.id, p_reason: r }); toast('تم الإلغاء'); reload(true); } catch (e) { toast(e.message, 'err'); }
  };
  const remind = async () => {
    try { const n = await rpc('teacher_send_reminder', { p_task_id: task.id, p_message: null }); toast(`أُرسل تذكير إلى ${n} طالبة 🔔`); } catch (e) { toast(e.message, 'err'); }
  };
  const exportCSV = () => downloadCSV(`إنجاز_${task.title}`, ['الطالبة', 'الحالة', 'وقت التسجيل', 'في الموعد', 'النقاط', 'الطريقة'],
    el.map((s) => { const c = map[s.id]; return [s.full_name, c ? (c.status === 'approved' ? 'مكتمل' : 'بانتظار الاعتماد') : 'لم يُنجز', c ? fmtShort(c.submitted_at) : '', c ? (c.on_time ? 'نعم' : 'لا') : '', c?.points_awarded || 0, c ? VERIFICATION[c.method].label : '']; }));

  const done = (comps || []).filter((c) => c.status === 'approved').length;
  return (
    <Modal open wide title={`متابعة: ${task.title}`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={exportCSV}>⬇️ تصدير</button>
        <button className="btn btn-gold" onClick={remind} disabled={!notDone.length}>🔔 تذكير من لم تُكمل ({notDone.length})</button></>}>
      {loading ? <Spinner /> : <>
        <Progress label={`المكتمل — ${classLabel(classes, task.class_id)} • ⭐ ${task.points} • حتى ${fmtShort(task.due_at)}`} value={done} max={el.length} color="var(--green)" />
        {notDone.length > 0 && (
          <Card className="inner-card">
            <b>👩‍🏫 رصد يدوي — حددي الطالبات اللاتي أنجزن:</b>
            <div className="picker-list">{notDone.map((s) => (
              <label key={s.id} className={`chip-check ${sel.includes(s.id) ? 'on' : ''}`}><input type="checkbox" checked={sel.includes(s.id)}
                onChange={() => setSel(sel.includes(s.id) ? sel.filter((x) => x !== s.id) : [...sel, s.id])} />{s.full_name}</label>))}</div>
            <div className="row-wrap">
              <button className="btn btn-sm btn-ghost" onClick={() => setSel(sel.length === notDone.length ? [] : notDone.map((s) => s.id))}>{sel.length === notDone.length ? 'إلغاء الكل' : 'تحديد الكل'}</button>
              <label className="inline-check small"><input type="checkbox" checked={onTime} onChange={(e) => setOnTime(e.target.checked)} /> احتساب الإنجاز في الموعد (تُمنح النقاط)</label>
              <button className="btn btn-sm btn-primary" disabled={!sel.length || busy} onClick={mark}>رصد الإنجاز ({sel.length})</button>
            </div>
          </Card>
        )}
        <div className="table-scroll"><table className="table">
          <thead><tr><th>الطالبة</th><th>الحالة</th><th>الوقت</th><th>النقاط</th><th>الإثبات</th><th /></tr></thead>
          <tbody>{el.map((s) => {
            const c = map[s.id];
            return (
              <tr key={s.id}>
                <td>{s.full_name}</td>
                <td>{!c ? <Badge cls="badge-muted">❌ لم تُكمل</Badge> : c.status === 'approved' ? <Badge cls="badge-ok">✅ مكتمل</Badge> : <Badge cls="badge-warn">⏳ بانتظار الاعتماد</Badge>}
                  {c && !c.on_time && <Badge cls="badge-muted">بعد الموعد</Badge>}</td>
                <td className="small nowrap">{c ? fmtShort(c.submitted_at) : '—'}</td>
                <td>{c ? `+${c.points_awarded}` : '—'}</td>
                <td className="small">{c?.proof_text && <div>{c.proof_text}</div>}{c?.proof_url && <a href={c.proof_url} target="_blank" rel="noreferrer">🔗 الرابط</a>}
                  {c?.proof_image && <button className="link-btn" onClick={() => setImg(c.proof_image)}>🖼 الصورة</button>}
                  {c && !c.proof_text && !c.proof_url && !c.proof_image && <span className="muted">{VERIFICATION[c.method].label}</span>}</td>
                <td className="row-actions">
                  {c?.status === 'pending' && <><button className="btn btn-sm btn-primary" onClick={() => review(c, true)}>اعتماد</button><button className="btn btn-sm btn-ghost" onClick={() => review(c, false)}>إعادة</button></>}
                  {c?.status === 'approved' && <button className="btn btn-sm btn-ghost" onClick={() => undo(c, s)}>إلغاء</button>}
                </td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </>}
      {img && <div className="qr-full" onClick={() => setImg(null)}><img src={img} alt="إثبات" style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 12 }} /></div>}
    </Modal>
  );
}
