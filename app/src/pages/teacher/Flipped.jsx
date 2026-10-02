import { useEffect, useMemo, useState } from 'react';
import { useLoad } from '../../lib/hooks';
import { rpc } from '../../lib/supabase';
import { loadClasses, loadStudents, loadTasks, loadLessons, loadCompletions, classLabel, eligibleFor } from '../../lib/teacherData';
import { fmtDateTime, fromLocalInput, toLocalInput, downloadCSV } from '../../lib/format';
import { Card, Empty, ErrorBox, Modal, PageHeader, Progress, Spinner, useToast } from '../../components/ui';
import { Ring } from '../../components/charts';
import { TaskForm } from './Tasks';

export default function Flipped() {
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(async () => {
    const [classes, students, tasks, lessons, comps] = await Promise.all([loadClasses(), loadStudents(), loadTasks(), loadLessons(), loadCompletions()]);
    return { classes, students, tasks, lessons: lessons.filter((l) => l.is_flipped), comps };
  });
  const [lessonId, setLessonId] = useState('');
  const [cls, setCls] = useState('');
  const [open, setOpen] = useState({});
  const [tpl, setTpl] = useState(false);
  const [addTask, setAddTask] = useState(false);
  const [view, setView] = useState('bars');

  useEffect(() => { if (data && !lessonId && data.lessons.length) setLessonId(data.lessons[0].id); }, [data]); // eslint-disable-line

  const v = useMemo(() => {
    if (!data || !lessonId) return null;
    const lesson = data.lessons.find((l) => l.id === lessonId);
    const tasks = data.tasks.filter((t) => t.lesson_id === lessonId).sort((a, b) => a.sort_order - b.sort_order);
    const classId = cls || lesson?.class_id || '';
    const students = data.students.filter((s) => s.active && (!classId || s.class_id === classId));
    const rows = tasks.map((t) => {
      const el = eligibleFor(t, students);
      const doneIds = new Set(data.comps.filter((c) => c.task_id === t.id && c.status === 'approved').map((c) => c.student_id));
      const pendIds = new Set(data.comps.filter((c) => c.task_id === t.id && c.status === 'pending').map((c) => c.student_id));
      return { t, el, done: el.filter((s) => doneIds.has(s.id)), pending: el.filter((s) => pendIds.has(s.id)), missing: el.filter((s) => !doneIds.has(s.id) && !pendIds.has(s.id)), doneIds };
    });
    const req = rows.filter((r) => !r.t.is_optional);
    const total = req.reduce((a, r) => a + r.el.length, 0); const done = req.reduce((a, r) => a + r.done.length, 0);
    const fullyDone = students.filter((s) => req.length && req.every((r) => r.doneIds.has(s.id))).length;
    return { lesson, tasks, students, rows, pct: total ? Math.round((done / total) * 100) : 0, fullyDone, classId };
  }, [data, lessonId, cls]);

  const remind = async (t) => {
    try { const n = await rpc('teacher_send_reminder', { p_task_id: t.id, p_message: null }); toast(`أُرسل تذكير إلى ${n} طالبة 🔔`); } catch (e) { toast(e.message, 'err'); }
  };
  const remindAll = async () => {
    let n = 0;
    for (const r of v.rows) if (!r.t.is_optional && r.missing.length) n += await rpc('teacher_send_reminder', { p_task_id: r.t.id, p_message: null }).catch(() => 0);
    toast(`أُرسلت ${n} رسالة تذكير 🔔`);
  };
  const exportCSV = () => downloadCSV(`الصف_المقلوب_${v.lesson.title}`, ['الطالبة', ...v.rows.map((r) => r.t.title), 'المكتمل'],
    v.students.map((s) => [s.full_name, ...v.rows.map((r) => r.doneIds.has(s.id) ? '✔' : r.pending.some((p) => p.id === s.id) ? 'بانتظار' : '✘'), v.rows.filter((r) => r.doneIds.has(s.id)).length]));

  return (
    <>
      <PageHeader icon="🔄" title="متابعة الصف المقلوب" subtitle="«مهمتي قبل الحصة» — من أكملت ومن لم تُكمل، لكل مهمة"
        actions={<button className="btn btn-primary" onClick={() => setTpl(true)}>＋ درس مقلوب من القالب</button>} />
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Spinner /> : !data.lessons.length ? (
        <Empty icon="🔄" title="لا توجد دروس صف مقلوب بعد"><button className="btn btn-primary btn-sm" onClick={() => setTpl(true)}>إنشاء «درس المخاليط – الصف المقلوب»</button></Empty>
      ) : (
        <>
          <div className="filters">
            <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} aria-label="الدرس">
              {data.lessons.map((l) => <option key={l.id} value={l.id}>📖 درس {l.title}{l.class_id ? ` — ${classLabel(data.classes, l.class_id)}` : ''}</option>)}</select>
            <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="الفصل"><option value="">فصل الدرس</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.grade} — {c.name}</option>)}</select>
            <div className="seg seg-sm"><button className={view === 'bars' ? 'on' : ''} onClick={() => setView('bars')}>أشرطة</button><button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}>جدول الطالبات</button></div>
          </div>
          {v && <>
            <Card className="flip-head">
              <Ring pct={v.pct} size={110} label="إنجاز" color="var(--purple-2)" />
              <div className="flip-head-txt">
                <h2>📚 درس: {v.lesson.title}</h2>
                <div className="row-wrap muted"><span>👥 عدد الطالبات: <b>{v.students.length}</b></span><span>✅ أكملن كل المهام الإلزامية: <b>{v.fullyDone}</b></span><span>📋 المهام: <b>{v.tasks.length}</b></span></div>
                <div className="row-wrap">
                  <button className="btn btn-sm btn-gold" onClick={remindAll}>🔔 تذكير كل من لم تُكمل</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setAddTask(true)}>＋ إضافة مهمة للدرس</button>
                  <button className="btn btn-sm btn-ghost" onClick={exportCSV}>⬇️ تصدير</button>
                </div>
              </div>
            </Card>
            {!v.rows.length ? <Empty title="لا توجد مهام في هذا الدرس" /> : view === 'bars' ? (
              <div className="stack">{v.rows.map((r, i) => (
                <Card key={r.t.id} className="flip-task">
                  <div className="flip-task-head">
                    <span className="flip-num">{i + 1}</span>
                    <div className="grow"><b>{r.t.title}</b>{r.t.is_optional && <span className="badge badge-gold">اختيارية</span>}<div className="muted small">⭐ {r.t.points} • حتى {fmtDateTime(r.t.due_at)}</div></div>
                    <b className="flip-count">{r.done.length}/{r.el.length}</b>
                  </div>
                  <Progress value={r.done.length} max={r.el.length} color={r.t.is_optional ? 'var(--gold)' : 'var(--purple-2)'} showText={false} height={12} />
                  <div className="row-wrap small">
                    {r.pending.length > 0 && <span className="warn-txt">⏳ بانتظار الاعتماد: {r.pending.map((s) => s.full_name).join('، ')}</span>}
                    {r.missing.length > 0 && <button className="link-btn" onClick={() => setOpen({ ...open, [r.t.id]: !open[r.t.id] })}>❌ لم تُكمل ({r.missing.length}) {open[r.t.id] ? '▲' : '▼'}</button>}
                    {r.missing.length > 0 && !r.t.is_optional && <button className="btn btn-sm btn-ghost" onClick={() => remind(r.t)}>🔔 تذكير</button>}
                    {!r.missing.length && <span className="ok-txt">🎉 أكملت جميع الطالبات</span>}
                  </div>
                  {open[r.t.id] && <div className="missing-list">{r.missing.map((s) => <span key={s.id} className="chip">{s.full_name}</span>)}</div>}
                </Card>))}</div>
            ) : (
              <Card className="table-card"><div className="table-scroll"><table className="table matrix">
                <thead><tr><th>الطالبة</th>{v.rows.map((r, i) => <th key={r.t.id} title={r.t.title}>{i + 1}. {r.t.title}</th>)}</tr></thead>
                <tbody>{v.students.map((s) => <tr key={s.id}><td>{s.full_name}</td>{v.rows.map((r) => <td key={r.t.id} className="center">
                  {r.doneIds.has(s.id) ? '✅' : r.pending.some((p) => p.id === s.id) ? '⏳' : <span className="muted">✘</span>}</td>)}</tr>)}</tbody>
              </table></div></Card>
            )}
          </>}
        </>
      )}
      {tpl && <TemplateModal classes={data.classes} onClose={() => setTpl(false)} onDone={(id) => { setTpl(false); setLessonId(id); reload(true); }} />}
      {addTask && v && <TaskForm classes={data.classes} lessons={data.lessons} presetLesson={v.lesson.id} onClose={() => setAddTask(false)} onSaved={() => { setAddTask(false); reload(true); }} />}
    </>
  );
}

function TemplateModal({ classes, onClose, onDone }) {
  const toast = useToast();
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(22, 0, 0, 0);
  const [f, setF] = useState({ title: 'المخاليط', class_id: classes[0]?.id || '', due: toLocalInput(d) });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const id = await rpc('create_flipped_template', { p_class_id: f.class_id || null, p_due_at: fromLocalInput(f.due), p_title: f.title }); toast('تم إنشاء الدرس ومهامه الخمس وظهرت للطالبات 🎉'); onDone(id); }
    catch (e2) { toast(e2.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal open title="درس صف مقلوب جاهز" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <p className="muted">ينشئ القالب 5 مهام «قبل الحصة» يمكنكِ تعديلها لاحقًا:</p>
        <ol className="tpl-list"><li>الاختبار القبلي — ⭐ 1</li><li>مشاهدة فيديو الدرس — ⭐ 1</li><li>الإجابة عن أسئلة الفيديو — ⭐ 2 (إثبات)</li><li>الدخول إلى ورقة ذكية — ⭐ 1 (رمز/QR)</li><li>مهمة إثرائية اختيارية — ⭐ 2</li></ol>
        <label className="field"><span>اسم الدرس</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></label>
        <label className="field"><span>الفصل</span><select value={f.class_id} onChange={(e) => setF({ ...f, class_id: e.target.value })}><option value="">كل الفصول</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.grade} — {c.name}</option>)}</select></label>
        <label className="field"><span>الموعد النهائي (قبل الحصة)</span><input type="datetime-local" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} required /></label>
        <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button><button className="btn btn-primary" disabled={busy}>{busy ? 'جارٍ الإنشاء...' : 'إنشاء الدرس'}</button></div>
      </form>
    </Modal>
  );
}
