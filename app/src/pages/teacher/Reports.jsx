import { useMemo, useState } from 'react';
import { useLoad } from '../../lib/hooks';
import { loadClasses, loadStudents, loadTasks, loadLessons, loadCompletions, loadTransactions, classLabel, eligibleFor } from '../../lib/teacherData';
import { TRACKS, TRACK_LIST, TX_KIND, levelFor } from '../../lib/constants';
import { downloadCSV, fmtShort, fmtDate } from '../../lib/format';
import { Card, Empty, ErrorBox, PageHeader, Spinner, Tabs } from '../../components/ui';
import { HBars } from '../../components/charts';

const TYPES = [
  { value: 'student', label: '👩‍🎓 تقرير طالبة' }, { value: 'class', label: '🏫 تقرير فصل' }, { value: 'task', label: '📚 تقرير مهمة' },
  { value: 'points', label: '⭐ تقرير النقاط' }, { value: 'initiatives', label: '💡 تقرير المبادرات' }, { value: 'flipped', label: '🔄 إنجاز الصف المقلوب' },
];

export default function Reports() {
  const { data, loading, error, reload } = useLoad(async () => {
    const [classes, students, tasks, lessons, comps, txs] = await Promise.all([loadClasses(), loadStudents(), loadTasks(), loadLessons(), loadCompletions(), loadTransactions()]);
    return { classes, students, tasks, lessons, comps, txs };
  });
  const [type, setType] = useState('class');
  const [f, setF] = useState({ cls: '', from: '', to: '', track: '', task: '', student: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const rep = useMemo(() => {
    if (!data) return null;
    const inRange = (d) => (!f.from || new Date(d) >= new Date(f.from)) && (!f.to || new Date(d) <= new Date(f.to + 'T23:59:59'));
    const sm = Object.fromEntries(data.students.map((s) => [s.id, s]));
    const tm = Object.fromEntries(data.tasks.map((t) => [t.id, t]));
    const students = data.students.filter((s) => (!f.cls || s.class_id === f.cls));
    const sIds = new Set(students.map((s) => s.id));
    const txs = data.txs.filter((t) => sIds.has(t.student_id) && inRange(t.created_at) && (!f.track || t.track === f.track) && (!f.task || t.task_id === f.task));
    const comps = data.comps.filter((c) => sIds.has(c.student_id) && inRange(c.submitted_at) && (!f.task || c.task_id === f.task));
    const tasks = data.tasks.filter((t) => (!f.cls || !t.class_id || t.class_id === f.cls) && (!f.task || t.id === f.task) && (!f.from && !f.to ? true : inRange(t.due_at)));
    const trackSum = TRACK_LIST.map((t) => ({ label: t.label, color: t.color, value: txs.filter((x) => x.track === t.key && x.amount > 0).reduce((a, x) => a + x.amount, 0) }));

    if (type === 'student') {
      const s = sm[f.student];
      if (!s) return { pick: true };
      const st = txs.filter((t) => t.student_id === s.id); const sc = comps.filter((c) => c.student_id === s.id);
      return { title: `تقرير الطالبة: ${s.full_name}`,
        summary: [['الرصيد الحالي', s.balance], ['إجمالي المكتسب', s.earned], ['المستوى', levelFor(s.earned).name], ['المهام المنجزة (الفترة)', sc.filter((c) => c.status === 'approved').length], ['المبادرات (الفترة)', st.filter((t) => t.track === 'initiative' && t.amount > 0).length], ['نقاط الفترة', st.filter((t) => t.amount > 0 && t.kind !== 'refund').reduce((a, t) => a + t.amount, 0)]],
        chart: TRACK_LIST.map((t) => ({ label: t.label, color: t.color, value: st.filter((x) => x.track === t.key && x.amount > 0).reduce((a, x) => a + x.amount, 0) })),
        headers: ['التاريخ', 'النوع', 'النقاط', 'المسار', 'السبب', 'المنفذة'],
        rows: st.map((t) => [fmtShort(t.created_at), TX_KIND[t.kind], t.amount, TRACKS[t.track]?.short || '', t.reason, t.users?.full_name || '']) };
    }
    if (type === 'class') {
      return { title: `تقرير فصل: ${f.cls ? classLabel(data.classes, f.cls) : 'كل الفصول'}`,
        summary: [['عدد الطالبات', students.filter((s) => s.active).length], ['النقاط الممنوحة', txs.filter((t) => t.amount > 0 && t.kind !== 'refund').reduce((a, t) => a + t.amount, 0)], ['المهام المنجزة', comps.filter((c) => c.status === 'approved').length], ['المبادرات', txs.filter((t) => t.track === 'initiative' && t.amount > 0).length]],
        chart: trackSum, note: 'مرتبة أبجديًا — لا يعرض النظام ترتيبًا تنافسيًا بين الطالبات.',
        headers: ['الطالبة', 'الفصل', 'الرصيد', 'المكتسب', 'المستوى', 'نقاط الفترة', 'مهام الفترة', 'مبادرات الفترة'],
        rows: students.filter((s) => s.active).map((s) => { const st = txs.filter((t) => t.student_id === s.id);
          return [s.full_name, classLabel(data.classes, s.class_id), s.balance, s.earned, levelFor(s.earned).name, st.filter((t) => t.amount > 0 && t.kind !== 'refund').reduce((a, t) => a + t.amount, 0), comps.filter((c) => c.student_id === s.id && c.status === 'approved').length, st.filter((t) => t.track === 'initiative' && t.amount > 0).length]; }) };
    }
    if (type === 'task') {
      return { title: 'تقرير المهام',
        summary: [['عدد المهام', tasks.length], ['إنجازات معتمدة', comps.filter((c) => c.status === 'approved').length], ['في الموعد', comps.filter((c) => c.on_time && c.status === 'approved').length], ['بعد الموعد', comps.filter((c) => !c.on_time).length]],
        headers: ['المهمة', 'الدرس', 'الفصل', 'النقاط', 'الموعد', 'المستهدفات', 'مكتمل', 'في الموعد', 'بانتظار', 'النسبة'],
        rows: tasks.map((t) => { const el = eligibleFor(t, students); const c = data.comps.filter((x) => x.task_id === t.id && sIds.has(x.student_id)); const d = c.filter((x) => x.status === 'approved').length;
          return [t.title, t.lessons?.title || '', classLabel(data.classes, t.class_id), t.points, fmtShort(t.due_at), el.length, d, c.filter((x) => x.status === 'approved' && x.on_time).length, c.filter((x) => x.status === 'pending').length, el.length ? Math.round((d / el.length) * 100) + '%' : '—']; }) };
    }
    if (type === 'points' || type === 'initiatives') {
      const list = type === 'initiatives' ? txs.filter((t) => t.track === 'initiative' && t.amount > 0) : txs;
      return { title: type === 'points' ? 'تقرير النقاط' : 'تقرير المبادرات',
        summary: type === 'points'
          ? [['إضافات', list.filter((t) => t.amount > 0 && t.kind !== 'refund').reduce((a, t) => a + t.amount, 0)], ['خصومات', list.filter((t) => t.kind === 'manual_deduct' || t.kind === 'reversal').reduce((a, t) => a + t.amount, 0)], ['مستبدلة', list.filter((t) => t.kind === 'redemption').reduce((a, t) => a + t.amount, 0) + list.filter((t) => t.kind === 'refund').reduce((a, t) => a + t.amount, 0)], ['عدد العمليات', list.length]]
          : [['عدد المبادرات', list.length], ['طالبات مبادرات', new Set(list.map((t) => t.student_id)).size], ['نقاط المبادرة', list.reduce((a, t) => a + t.amount, 0)]],
        chart: type === 'points' ? trackSum : null,
        headers: ['التاريخ', 'الطالبة', 'الفصل', 'النوع', 'النقاط', 'المسار', 'السبب', 'المنفذة'],
        rows: list.map((t) => [fmtShort(t.created_at), sm[t.student_id]?.full_name, classLabel(data.classes, sm[t.student_id]?.class_id), TX_KIND[t.kind], t.amount, TRACKS[t.track]?.short || '', t.reason, t.users?.full_name || '']) };
    }
    if (type === 'flipped') {
      const ft = tasks.filter((t) => t.lessons?.is_flipped);
      return { title: 'تقرير إنجاز الصف المقلوب',
        summary: [['دروس مقلوبة', new Set(ft.map((t) => t.lesson_id)).size], ['مهام قبل الحصة', ft.length]],
        headers: ['الدرس', 'المهمة', 'الفصل', 'النقاط', 'مكتمل', 'المستهدفات', 'النسبة', 'لم تُكمل'],
        rows: ft.map((t) => { const el = eligibleFor(t, students); const done = new Set(data.comps.filter((c) => c.task_id === t.id && c.status === 'approved').map((c) => c.student_id));
          return [t.lessons?.title, t.title + (t.is_optional ? ' (اختيارية)' : ''), classLabel(data.classes, t.class_id), t.points, el.filter((s) => done.has(s.id)).length, el.length, el.length ? Math.round((el.filter((s) => done.has(s.id)).length / el.length) * 100) + '%' : '—', el.filter((s) => !done.has(s.id)).map((s) => s.full_name).join('، ')]; }) };
    }
    return null;
  }, [data, type, f]);

  const period = f.from || f.to ? ` (${f.from ? fmtDate(f.from) : '…'} — ${f.to ? fmtDate(f.to) : '…'})` : '';

  return (
    <>
      <PageHeader icon="📈" title="التقارير" subtitle="تقارير قابلة للتصفية والتصدير إلى Excel والطباعة"
        actions={rep?.rows && <><button className="btn btn-ghost" onClick={() => window.print()}>🖨 طباعة</button>
          <button className="btn btn-primary" onClick={() => downloadCSV(rep.title + period, rep.headers, rep.rows)}>⬇️ تصدير Excel</button></>} />
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Spinner /> : <>
        <div className="no-print"><Tabs value={type} onChange={setType} tabs={TYPES} /></div>
        <Card className="filters-card no-print">
          <div className="filters">
            <label className="field"><span>الفصل</span><select value={f.cls} onChange={set('cls')}><option value="">الكل</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.grade} — {c.name}</option>)}</select></label>
            {type === 'student' && <label className="field"><span>الطالبة</span><select value={f.student} onChange={set('student')}><option value="">اختاري...</option>{data.students.filter((s) => !f.cls || s.class_id === f.cls).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label>}
            <label className="field"><span>من تاريخ</span><input type="date" value={f.from} onChange={set('from')} /></label>
            <label className="field"><span>إلى تاريخ</span><input type="date" value={f.to} onChange={set('to')} /></label>
            {['points', 'student', 'class'].includes(type) && <label className="field"><span>نوع النقاط (المسار)</span><select value={f.track} onChange={set('track')}><option value="">الكل</option>{TRACK_LIST.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>}
            <label className="field"><span>المهمة</span><select value={f.task} onChange={set('task')}><option value="">الكل</option>{data.tasks.map((t) => <option key={t.id} value={t.id}>{t.title}{t.lessons?.title ? ` — ${t.lessons.title}` : ''}</option>)}</select></label>
            <button className="btn btn-sm btn-ghost" onClick={() => setF({ cls: '', from: '', to: '', track: '', task: '', student: f.student })}>مسح</button>
          </div>
        </Card>
        {rep?.pick ? <Empty icon="👩‍🎓" title="اختاري طالبة لعرض تقريرها" /> : rep && (
          <div className="print-area">
            <div className="report-head"><h2>{rep.title}{period}</h2><small className="muted">✨ رصيدي الذهبي • {fmtDate(new Date())}</small></div>
            <div className="sum-grid">{rep.summary.map(([k, v]) => <div key={k} className="sum"><b>{v}</b><small>{k}</small></div>)}</div>
            {rep.chart && <Card><h3>النقاط حسب المسار</h3><HBars data={rep.chart} unit="نقطة" /></Card>}
            {rep.note && <p className="muted small">{rep.note}</p>}
            <Card className="table-card">{!rep.rows.length ? <Empty title="لا توجد بيانات مطابقة للتصفية" /> : (
              <div className="table-scroll"><table className="table">
                <thead><tr>{rep.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{rep.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
              </table></div>)}</Card>
          </div>
        )}
      </>}
    </>
  );
}
