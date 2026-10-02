import { Link } from 'react-router-dom';
import { useLoad } from '../../lib/hooks';
import { loadStudentAll, nextRewardTarget } from '../../lib/studentData';
import { levelFor } from '../../lib/constants';
import { pts, relTime, timeLeft } from '../../lib/format';
import { Card, Empty, ErrorBox, Progress, Spinner, TrackBadge } from '../../components/ui';
import { useAuth } from '../../lib/auth';

export default function Home() {
  const { student } = useAuth();
  const { data, loading, error, reload } = useLoad(loadStudentAll);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { me, tasks, comps, txs, rewards, reds } = data;
  const first = (me?.full_name || '').split(' ')[0];
  const lv = levelFor(me.earned);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const month = txs.filter((t) => t.amount > 0 && !['refund', 'redemption'].includes(t.kind) && new Date(t.created_at) >= monthStart).reduce((a, t) => a + t.amount, 0);
  const { next, affordable } = nextRewardTarget(me.balance, rewards, reds);
  const doneIds = new Set(comps.map((c) => c.task_id));
  const todo = tasks.filter((t) => !doneIds.has(t.id) && new Date(t.due_at) > new Date()).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

  return (
    <>
      <div className="hero-card">
        <div className="hero-glow" aria-hidden />
        <div className="hero-top">
          <div>
            <div className="hero-hi">👩‍🎓 مرحبًا بكِ يا {first}</div>
            <div className="hero-sub">{student?.classes ? `${student.classes.grade} — ${student.classes.name}` : ''}</div>
          </div>
          <div className="hero-level"><span>{lv.icon}</span><b>{lv.name}</b></div>
        </div>
        <div className="hero-bal"><small>رصيدك الذهبي</small><b>⭐ {me.balance}</b></div>
        {next ? (
          <div className="hero-progress">
            <Progress value={me.balance} max={next.cost} color="linear-gradient(90deg,#E9C46A,#C9962B)" showText={false} height={12} />
            <div className="hero-progress-txt"><b>{me.balance} / {next.cost} نقطة</b><span>بقيت لكِ {pts(next.cost - me.balance)} للوصول إلى المكافأة التالية: {next.icon} {next.title}</span></div>
          </div>
        ) : lv.next ? (
          <div className="hero-progress">
            <Progress value={me.earned} max={lv.next.min} color="linear-gradient(90deg,#E9C46A,#C9962B)" showText={false} height={12} />
            <div className="hero-progress-txt"><b>{me.earned} / {lv.next.min} نقطة</b><span>بقيت لكِ {pts(lv.toNext)} للوصول إلى مستوى {lv.next.icon} {lv.next.name}</span></div>
          </div>
        ) : null}
        {affordable.length > 0 && <Link to="/s/rewards" className="hero-cta">🎁 رصيدك يكفي لاستبدال مكافأة الآن! ←</Link>}
      </div>

      <div className="stats-grid three">
        <div className="stat stat-green"><div className="stat-icon">✅</div><div><div className="stat-value">{me.tasks_done}</div><div className="stat-label">المهام المكتملة</div></div></div>
        <div className="stat stat-gold"><div className="stat-icon">💡</div><div><div className="stat-value">{me.initiatives}</div><div className="stat-label">المبادرات</div></div></div>
        <div className="stat stat-purple"><div className="stat-icon">📅</div><div><div className="stat-value">{month}</div><div className="stat-label">النقاط المكتسبة هذا الشهر</div></div></div>
      </div>

      <Card>
        <div className="card-head"><h3>مستوى تقدمي</h3><Link to="/s/balance" className="small">التفاصيل ←</Link></div>
        {lv.next ? <Progress label={`${lv.icon} ${lv.name} ← ${lv.next.icon} ${lv.next.name}`} value={me.earned} max={lv.next.min} color="var(--purple-2)" />
          : <p>🏆 وصلتِ إلى أعلى مستوى: <b>صانعة أثر</b>. أثركِ واضح!</p>}
        {lv.next && <p className="muted small">بقيت {pts(lv.toNext)} للوصول إلى مستوى {lv.next.name}</p>}
      </Card>

      <div className="grid-2">
        <Card>
          <div className="card-head"><h3>📚 مهام بانتظارك</h3><Link to="/s/tasks" className="small">كل مهامي ←</Link></div>
          {!todo.length ? <Empty icon="🎉" title="أنجزتِ كل مهامك الحالية!" /> : (
            <ul className="mini-list">{todo.slice(0, 5).map((t) => { const tl = timeLeft(t.due_at); return (
              <li key={t.id}><span><b className="gold-num">⭐ {t.points}</b> {t.title}</span><small className={tl.urgent ? 'warn-txt' : 'muted'}>{t.lessons?.title ? `📖 ${t.lessons.title} • ` : ''}{tl.text}</small></li>); })}</ul>
          )}
        </Card>
        <Card>
          <div className="card-head"><h3>📜 آخر إنجازاتي</h3><Link to="/s/history" className="small">السجل ←</Link></div>
          {!txs.length ? <Empty title="ابدئي بأول مهمة لتظهر إنجازاتك هنا" /> : (
            <ul className="mini-list">{txs.slice(0, 5).map((t) => (
              <li key={t.id}><span><b className={t.amount > 0 ? 'pos' : 'neg'}>{t.amount > 0 ? '+' : ''}{t.amount} ⭐</b> {t.reason}</span><small className="muted">{t.track && <TrackBadge track={t.track} />} {relTime(t.created_at)}</small></li>))}</ul>
          )}
        </Card>
      </div>
      <p className="center muted small">«النقاط ليست هدفًا بحد ذاتها... بل وسيلة لنحتفي بمبادرتك وتقدمك 🌟»</p>
    </>
  );
}
