import { useLoad } from '../../lib/hooks';
import { loadStudentAll } from '../../lib/studentData';
import { LEVELS, TRACK_LIST, levelFor } from '../../lib/constants';
import { pts, relTime } from '../../lib/format';
import { Card, ErrorBox, PageHeader, Progress, Spinner } from '../../components/ui';
import { HBars } from '../../components/charts';

export default function Balance() {
  const { data, loading, error, reload } = useLoad(loadStudentAll);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { me, txs } = data;
  const lv = levelFor(me.earned);
  const spent = -txs.filter((t) => t.kind === 'redemption').reduce((a, t) => a + t.amount, 0) - txs.filter((t) => t.kind === 'refund').reduce((a, t) => a + t.amount, 0);
  const tracks = TRACK_LIST.map((t) => ({ label: t.label, color: t.color, value: txs.filter((x) => x.track === t.key && x.amount > 0).reduce((a, x) => a + x.amount, 0) }));
  return (
    <>
      <PageHeader icon="⭐" title="رصيدي" subtitle="تقدمك الشخصي — لا مقارنة مع أحد" />
      <div className="bal-grid">
        <Card className="bal-main"><small>الرصيد الحالي</small><b>⭐ {me.balance}</b><span>{lv.icon} {lv.name}</span></Card>
        <Card className="bal-mini"><b>{me.earned}</b><small>إجمالي النقاط المكتسبة</small></Card>
        <Card className="bal-mini"><b>{me.initiatives}</b><small>عدد المبادرات</small></Card>
        <Card className="bal-mini"><b>{me.tasks_done}</b><small>المهام المنجزة</small></Card>
        <Card className="bal-mini"><b>{spent}</b><small>نقاط استُبدلت بمكافآت</small></Card>
        <Card className="bal-mini"><b>{me.last_activity ? relTime(me.last_activity) : '—'}</b><small>آخر نشاط</small></Card>
      </div>

      <Card>
        <h3>🏅 مستواي</h3>
        <div className="levels">
          {LEVELS.map((l, i) => (
            <div key={l.name} className={`level-step ${i === lv.index ? 'current' : i < lv.index ? 'passed' : ''}`}>
              <div className="level-icon">{l.icon}</div><b>{l.name}</b><small className="muted">{l.max ? `${l.min}–${l.max}` : `${l.min}+`}</small>
            </div>
          ))}
        </div>
        {lv.next ? <Progress label={`نحو ${lv.next.name}`} value={me.earned} max={lv.next.min} color="var(--purple-2)" /> : <p>🏆 أنتِ «صانعة أثر»!</p>}
        {lv.next && <p className="muted small">بقيت {pts(lv.toNext)} للمستوى التالي. المستوى لا ينخفض عند استبدال المكافآت.</p>}
      </Card>

      <Card>
        <h3>نقاطي حسب المسار</h3>
        <HBars data={tracks} unit="نقطة" />
      </Card>
    </>
  );
}
