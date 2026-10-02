import { useState } from 'react';
import { useLoad } from '../../lib/hooks';
import { loadStudentAll } from '../../lib/studentData';
import { rpc } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { REDEMPTION_STATUS } from '../../lib/constants';
import { fmtShort, pts } from '../../lib/format';
import { Badge, Card, Empty, ErrorBox, PageHeader, Spinner, useDialog, useToast } from '../../components/ui';

export default function RewardsStore() {
  const toast = useToast(); const dlg = useDialog(); const { settings } = useAuth();
  const { data, loading, error, reload } = useLoad(loadStudentAll);
  const [busy, setBusy] = useState(null);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { me, rewards, reds } = data;

  const redeem = async (r) => {
    if (!(await dlg.confirm(`استبدال: ${r.icon} ${r.title}`, `سيُخصم ${pts(r.cost)} من رصيدك (${me.balance} ← ${me.balance - r.cost}).${r.requires_approval ? ' يُرسل الطلب للمعلمة لاعتماده، وإن لم يُعتمد تعود النقاط تلقائيًا.' : ''}`, 'تأكيد الاستبدال'))) return;
    setBusy(r.id);
    try { const res = await rpc('student_redeem', { p_reward_id: r.id, p_note: null }); toast(res.status === 'pending' ? 'أُرسل طلبك للمعلمة 🎁' : 'تم الاستبدال 🎁'); reload(true); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(null); }
  };

  return (
    <>
      <PageHeader icon="🎁" title="متجر النقاط الذهبية" subtitle={`رصيدك الآن: ⭐ ${me.balance}`} />
      {settings?.reward_policy && <div className="alert alert-info small">📜 {settings.reward_policy}</div>}
      {!rewards.length ? <Empty icon="🎁" title="لا توجد مكافآت متاحة حاليًا" /> : (
        <div className="reward-grid">{rewards.map((r) => {
          const used = reds.filter((x) => x.reward_id === r.id && x.status !== 'rejected').length;
          const maxed = r.max_per_student && used >= r.max_per_student;
          const out = r.stock !== null && r.stock <= 0;
          const can = me.balance >= r.cost && !maxed && !out;
          return (
            <Card key={r.id} className={`reward-card ${can ? 'can' : ''}`}>
              <div className="reward-icon">{r.icon}</div>
              <small className="eyebrow">🎁 مكافأة</small>
              <h3>{r.title}</h3>{r.description && <p className="muted small">{r.description}</p>}
              <div className="reward-cost">السعر: ⭐ {r.cost}</div>
              {r.max_per_student && <div className="small muted">استخدمتِ {used} من {r.max_per_student}</div>}
              {!can && !maxed && !out && <div className="progress" style={{ height: 6 }}><div className="progress-fill" style={{ width: `${Math.min(100, (me.balance / r.cost) * 100)}%`, background: 'var(--gold)' }} /></div>}
              <button className={`btn ${can ? 'btn-gold' : 'btn-ghost'}`} disabled={!can || busy === r.id} onClick={() => redeem(r)}>
                {maxed ? 'وصلتِ للحد الأعلى' : out ? 'نفدت الكمية' : can ? 'استبدال' : `بقيت ${pts(r.cost - me.balance)}`}
              </button>
            </Card>
          );
        })}</div>
      )}
      <h2 className="section-title">طلباتي</h2>
      {!reds.length ? <Empty title="لم تستبدلي مكافآت بعد" /> : (
        <Card className="list-card">{reds.map((r) => (
          <div key={r.id} className="notif"><div className="notif-icon">{r.rewards?.icon}</div>
            <div className="notif-txt"><b>{r.rewards?.title}</b><span className="muted">⭐ {r.cost} • {fmtShort(r.created_at)}{r.decision_note ? ` • ${r.decision_note}` : ''}</span></div>
            <Badge cls={REDEMPTION_STATUS[r.status].cls}>{REDEMPTION_STATUS[r.status].label}</Badge></div>))}</Card>
      )}
    </>
  );
}
