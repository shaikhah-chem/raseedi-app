import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoad } from '../../lib/hooks';
import { supabase, q } from '../../lib/supabase';
import { loadClasses, loadStudents, loadTasks, loadCompletions, loadTransactions, eligibleFor } from '../../lib/teacherData';
import { LEVELS, TRACK_LIST, levelFor } from '../../lib/constants';
import { relTime, fmtShort } from '../../lib/format';
import { Card, ErrorBox, PageHeader, Progress, Spinner, Stat, Empty } from '../../components/ui';
import { BarChart, HBars, LineChart, Ring } from '../../components/charts';
import { useAuth } from '../../lib/auth';

export default function Dashboard() {
  const { profile } = useAuth();
  const [cls, setCls] = useState('');
  const { data, loading, error, reload } = useLoad(async () => {
    const [classes, students, tasks, comps, txs, pendingRed] = await Promise.all([
      loadClasses(), loadStudents(), loadTasks(), loadCompletions(), loadTransactions(),
      q(supabase.from('redemptions').select('id', { count: 'exact' }).eq('status', 'pending')),
    ]);
    return { classes, students, tasks, comps, txs, pendingRed };
  });

  const v = useMemo(() => {
    if (!data) return null;
    const students = data.students.filter((s) => s.active && (!cls || s.class_id === cls));
    const ids = new Set(students.map((s) => s.id));
    const now = Date.now();
    const tasks = data.tasks.filter((t) => t.status === 'active' && (!cls || !t.class_id || t.class_id === cls));
    const activeTasks = tasks.filter((t) => new Date(t.due_at).getTime() > now && new Date(t.start_at).getTime() <= now);
    const comps = data.comps.filter((c) => ids.has(c.student_id));
    const approved = comps.filter((c) => c.status === 'approved');
    const txs = data.txs.filter((t) => ids.has(t.student_id));
    const granted = txs.filter((t) => t.amount > 0 && !['refund'].includes(t.kind)).reduce((a, t) => a + t.amount, 0);
    const initiatives = txs.filter((t) => t.track === 'initiative' && t.amount > 0).length;
    const doneStudents = new Set(approved.map((c) => c.student_id)).size;
    // نسبة الإنجاز للمهام الإلزامية
    let need = 0, done = 0;
    const taskRates = tasks.filter((t) => !t.is_optional).map((t) => {
      const el = eligibleFor(t, students); const d = approved.filter((c) => c.task_id === t.id).length;
      need += el.length; done += Math.min(d, el.length);
      return { t, d, n: el.length };
    });
    const rate = need ? Math.round((done / need) * 100) : 0;
    // توزيع المستويات
    const levelDist = LEVELS.map((l, i) => ({ label: l.name, short: l.name, icon: l.icon, value: students.filter((s) => levelFor(s.earned).index === i).length }));
    const trackDist = TRACK_LIST.map((t) => ({ label: t.label, color: t.color, value: txs.filter((x) => x.track === t.key && x.amount > 0).reduce((a, x) => a + x.amount, 0) }));
    // تطور النقاط أسبوعيًا (آخر 8 أسابيع)
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const end = new Date(); end.setHours(23, 59, 59, 999); end.setDate(end.getDate() - i * 7);
      const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
      const val = txs.filter((x) => x.amount > 0 && x.kind !== 'refund' && new Date(x.created_at) >= start && new Date(x.created_at) <= end).reduce((a, x) => a + x.amount, 0);
      weeks.push({ label: `${start.getDate()}/${start.getMonth() + 1}`, full: `أسبوع ${start.getDate()}/${start.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}`, value: val });
    }
    const pendingProofs = comps.filter((c) => c.status === 'pending').length;
    return { students, tasks, activeTasks, doneStudents, granted, initiatives, rate, taskRates, levelDist, trackDist, weeks, pendingProofs, recent: txs.slice(0, 8) };
  }, [data, cls]);

  const nameOf = (id) => data?.students.find((s) => s.id === id)?.full_name || '—';

  return (
    <>
      <PageHeader icon="📊" title={`أهلًا ${profile?.full_name || ''} 👋`} subtitle="لوحة التحكم — نظرة شاملة على التحفيز والإنجاز"
        actions={data && <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="الفصل">
          <option value="">كل الفصول</option>
          {data.classes.map((c) => <option key={c.id} value={c.id}>{c.grade} — {c.name}</option>)}
        </select>} />
      <ErrorBox error={error} onRetry={reload} />
      {loading || !v ? <Spinner /> : (
        <>
          {(v.pendingProofs > 0 || data.pendingRed.length > 0) && (
            <div className="alert alert-warn">
              🔔 بانتظار مراجعتك:
              {v.pendingProofs > 0 && <Link to="/t/tasks?pending=1"> {v.pendingProofs} إثبات إنجاز</Link>}
              {v.pendingProofs > 0 && data.pendingRed.length > 0 && ' • '}
              {data.pendingRed.length > 0 && <Link to="/t/rewards"> {data.pendingRed.length} طلب استبدال</Link>}
            </div>
          )}
          <div className="stats-grid">
            <Stat icon="👩‍🎓" label="إجمالي الطالبات" value={v.students.length} tone="purple" />
            <Stat icon="📚" label="المهام النشطة" value={v.activeTasks.length} tone="gold" />
            <Stat icon="✅" label="طالبات أنجزن مهامًا" value={v.doneStudents} sub={`من ${v.students.length}`} tone="green" />
            <Stat icon="⭐" label="إجمالي النقاط الممنوحة" value={v.granted} tone="gold" />
            <Stat icon="💡" label="عدد المبادرات" value={v.initiatives} tone="purple" />
            <Stat icon="📈" label="نسبة الإنجاز" value={`${v.rate}%`} sub="للمهام الإلزامية" tone="blue" />
          </div>

          <div className="grid-2">
            <Card>
              <div className="card-head"><h3>توزيع الطالبات على المستويات</h3><small className="muted">عدد الطالبات — دون أسماء أو ترتيب</small></div>
              <BarChart data={v.levelDist} unit="طالبة" color="var(--gold)" />
            </Card>
            <Card>
              <div className="card-head"><h3>أكثر أنواع المشاركة شيوعًا</h3><small className="muted">مجموع النقاط في كل مسار</small></div>
              <HBars data={v.trackDist} unit="نقطة" />
            </Card>
            <Card>
              <div className="card-head"><h3>تطور النقاط بمرور الوقت</h3><small className="muted">النقاط الممنوحة أسبوعيًا</small></div>
              <LineChart data={v.weeks} unit="نقطة" color="var(--purple-2)" />
            </Card>
            <Card>
              <div className="card-head"><h3>نسبة إنجاز المهام</h3><Link to="/t/flipped" className="small">متابعة الصف المقلوب ←</Link></div>
              <div className="rate-row">
                <Ring pct={v.rate} label="إنجاز" />
                <div className="rate-list">
                  {v.taskRates.slice(0, 6).map(({ t, d, n }) => <Progress key={t.id} label={t.title} value={d} max={n} color="var(--purple-2)" height={8} />)}
                  {!v.taskRates.length && <span className="muted">لا توجد مهام بعد</span>}
                </div>
              </div>
            </Card>
          </div>

          <div className="grid-2">
            <Card>
              <div className="card-head"><h3>المهام النشطة</h3><Link to="/t/tasks" className="small">كل المهام ←</Link></div>
              {!v.activeTasks.length ? <Empty icon="📚" title="لا توجد مهام نشطة"><Link to="/t/tasks?new=1">أنشئي مهمة جديدة</Link></Empty> :
                <ul className="mini-list">{v.activeTasks.slice(0, 6).map((t) => (
                  <li key={t.id}><span>{t.title}</span><small className="muted">⭐ {t.points} • حتى {fmtShort(t.due_at)}</small></li>))}</ul>}
            </Card>
            <Card>
              <div className="card-head"><h3>آخر العمليات</h3><Link to="/t/points" className="small">سجل النقاط ←</Link></div>
              {!v.recent.length ? <Empty title="لا توجد عمليات بعد" /> :
                <ul className="mini-list">{v.recent.map((t) => (
                  <li key={t.id}><span><b className={t.amount > 0 ? 'pos' : 'neg'}>{t.amount > 0 ? '+' : ''}{t.amount} ⭐</b> {nameOf(t.student_id)}</span>
                    <small className="muted">{t.reason} • {relTime(t.created_at)}</small></li>))}</ul>}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
