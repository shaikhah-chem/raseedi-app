import { useState } from 'react';
import { useLoad } from '../../lib/hooks';
import { supabase, q, rpc } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { REDEMPTION_STATUS } from '../../lib/constants';
import { downloadCSV, fmtShort } from '../../lib/format';
import { Badge, Card, Empty, ErrorBox, Modal, PageHeader, Spinner, Tabs, useDialog, useToast } from '../../components/ui';

export default function Rewards() {
  const toast = useToast(); const dlg = useDialog();
  const { settings, reloadSettings } = useAuth();
  const { data, loading, error, reload } = useLoad(async () => {
    const [rewards, reds] = await Promise.all([
      q(supabase.from('rewards').select('*').order('sort_order').order('cost')),
      q(supabase.from('redemptions').select('*, rewards(title, icon), students(full_name)').order('created_at', { ascending: false }).limit(500)),
    ]);
    return { rewards, reds };
  });
  const [tab, setTab] = useState('requests');
  const [edit, setEdit] = useState(null);
  const [policy, setPolicy] = useState(null);

  const decide = async (r, ok) => {
    let note = null;
    if (!ok) { note = await dlg.prompt('رفض الطلب', 'سبب الرفض (ستُعاد النقاط تلقائيًا للطالبة)'); if (note === null) return; }
    try { await rpc('teacher_decide_redemption', { p_redemption_id: r.id, p_approve: ok, p_note: note }); toast(ok ? 'تم اعتماد المكافأة 🎁' : 'رُفض الطلب وأُعيدت النقاط'); reload(true); }
    catch (e) { toast(e.message, 'err'); }
  };
  const toggle = async (r) => { try { await q(supabase.from('rewards').update({ active: !r.active }).eq('id', r.id)); reload(true); } catch (e) { toast(e.message, 'err'); } };
  const savePolicy = async () => {
    try { await q(supabase.from('settings').update({ reward_policy: policy, updated_at: new Date().toISOString() }).eq('id', 1)); await reloadSettings(); setPolicy(null); toast('تم حفظ السياسة'); }
    catch (e) { toast(e.message, 'err'); }
  };
  const pending = (data?.reds || []).filter((r) => r.status === 'pending');

  return (
    <>
      <PageHeader icon="🎁" title="متجر النقاط الذهبية" subtitle="المكافآت التي تحددينها، وطلبات الاستبدال، والحد الأعلى لكل مكافأة"
        actions={<button className="btn btn-primary" onClick={() => setEdit({})}>＋ مكافأة جديدة</button>} />
      <ErrorBox error={error} onRetry={reload} />
      <Card className="policy-card">
        <div className="card-head"><h3>📜 سياسة الاستبدال (تظهر للطالبات)</h3>{policy === null && <button className="btn btn-sm btn-ghost" onClick={() => setPolicy(settings?.reward_policy || '')}>تعديل</button>}</div>
        {policy === null ? <p>{settings?.reward_policy}</p> : <>
          <textarea rows={3} value={policy} onChange={(e) => setPolicy(e.target.value)} />
          <div className="form-actions"><button className="btn btn-ghost btn-sm" onClick={() => setPolicy(null)}>إلغاء</button><button className="btn btn-primary btn-sm" onClick={savePolicy}>حفظ</button></div></>}
      </Card>
      {loading ? <Spinner /> : <>
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'requests', label: 'طلبات بانتظار الاعتماد', count: pending.length }, { value: 'rewards', label: 'المكافآت', count: data.rewards.length }, { value: 'history', label: 'سجل الاستبدال', count: data.reds.length }]} />
        {tab === 'requests' && (!pending.length ? <Empty icon="🎁" title="لا توجد طلبات جديدة" /> : (
          <div className="list-cards">{pending.map((r) => (
            <Card key={r.id} className="req-card">
              <div className="req-icon">{r.rewards?.icon}</div>
              <div className="req-txt"><b>{r.students?.full_name}</b><span>{r.rewards?.title}</span><small className="muted">⭐ {r.cost} • {fmtShort(r.created_at)}{r.student_note ? ` • «${r.student_note}»` : ''}</small></div>
              <div className="row-actions"><button className="btn btn-sm btn-primary" onClick={() => decide(r, true)}>اعتماد</button><button className="btn btn-sm btn-ghost" onClick={() => decide(r, false)}>رفض</button></div>
            </Card>))}</div>
        ))}
        {tab === 'rewards' && (!data.rewards.length ? <Empty icon="🎁" title="لا توجد مكافآت بعد" /> : (
          <div className="reward-grid">{data.rewards.map((r) => (
            <Card key={r.id} className={`reward-card ${r.active ? '' : 'inactive'}`}>
              <div className="reward-icon">{r.icon}</div>
              <h3>{r.title}</h3>{r.description && <p className="muted small">{r.description}</p>}
              <div className="reward-cost">⭐ {r.cost}</div>
              <div className="small muted">{r.max_per_student ? `الحد الأعلى: ${r.max_per_student} لكل طالبة` : 'بلا حد أعلى'}{r.stock !== null ? ` • المتبقي: ${r.stock}` : ''}{r.requires_approval ? ' • يحتاج اعتمادك' : ' • تلقائي'}</div>
              <div className="task-actions"><button className="btn btn-sm btn-ghost" onClick={() => setEdit(r)}>تعديل</button>
                <button className="btn btn-sm btn-ghost" onClick={() => toggle(r)}>{r.active ? 'إخفاء' : 'إظهار'}</button></div>
            </Card>))}</div>
        ))}
        {tab === 'history' && (
          <Card className="table-card">
            <div className="card-head"><span /><button className="btn btn-sm btn-ghost" onClick={() => downloadCSV('سجل_الاستبدال', ['التاريخ', 'الطالبة', 'المكافأة', 'النقاط', 'الحالة', 'ملاحظة'], data.reds.map((r) => [fmtShort(r.created_at), r.students?.full_name, r.rewards?.title, r.cost, REDEMPTION_STATUS[r.status].label, r.decision_note || '']))}>⬇️ تصدير</button></div>
            {!data.reds.length ? <Empty title="لا توجد عمليات استبدال" /> : <div className="table-scroll"><table className="table">
              <thead><tr><th>التاريخ</th><th>الطالبة</th><th>المكافأة</th><th>النقاط</th><th>الحالة</th></tr></thead>
              <tbody>{data.reds.map((r) => <tr key={r.id}><td className="small nowrap">{fmtShort(r.created_at)}</td><td>{r.students?.full_name}</td><td>{r.rewards?.icon} {r.rewards?.title}</td><td>⭐ {r.cost}</td><td><Badge cls={REDEMPTION_STATUS[r.status].cls}>{REDEMPTION_STATUS[r.status].label}</Badge></td></tr>)}</tbody>
            </table></div>}
          </Card>
        )}
      </>}
      {edit && <RewardForm reward={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(true); }} />}
    </>
  );
}

function RewardForm({ reward, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !reward.id;
  const [f, setF] = useState({ title: reward.title || '', description: reward.description || '', icon: reward.icon || '🎁', cost: reward.cost || 5,
    max_per_student: reward.max_per_student ?? '', stock: reward.stock ?? '', requires_approval: reward.requires_approval ?? true, active: reward.active ?? true, sort_order: reward.sort_order || 0 });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const row = { ...f, cost: Number(f.cost), max_per_student: f.max_per_student === '' ? null : Number(f.max_per_student), stock: f.stock === '' ? null : Number(f.stock), sort_order: Number(f.sort_order) || 0 };
    try {
      if (isNew) await q(supabase.from('rewards').insert(row)); else await q(supabase.from('rewards').update(row).eq('id', reward.id));
      toast('تم الحفظ'); onSaved();
    } catch (e2) { toast(e2.message, 'err'); }
  };
  return (
    <Modal open title={isNew ? 'مكافأة جديدة' : 'تعديل المكافأة'} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <div className="grid-icon"><label className="field"><span>أيقونة</span><input value={f.icon} onChange={set('icon')} maxLength={4} className="icon-input" /></label>
          <label className="field"><span>اسم المكافأة</span><input value={f.title} onChange={set('title')} required /></label></div>
        <label className="field"><span>الوصف / الشروط</span><textarea rows={2} value={f.description} onChange={set('description')} /></label>
        <div className="grid-3 tight">
          <label className="field"><span>السعر ⭐</span><input type="number" min={1} value={f.cost} onChange={set('cost')} required /></label>
          <label className="field"><span>الحد الأعلى لكل طالبة</span><input type="number" min={1} value={f.max_per_student} onChange={set('max_per_student')} placeholder="بلا حد" /></label>
          <label className="field"><span>الكمية المتاحة</span><input type="number" min={0} value={f.stock} onChange={set('stock')} placeholder="غير محدودة" /></label>
        </div>
        <label className="inline-check"><input type="checkbox" checked={f.requires_approval} onChange={set('requires_approval')} /> يحتاج الطلب إلى اعتمادي (يُنصح به لمكافآت الدرجات)</label>
        <label className="inline-check"><input type="checkbox" checked={f.active} onChange={set('active')} /> ظاهرة للطالبات</label>
        <div className="alert alert-info small">💡 مثال عادل: «5 نقاط = +1 في مهمة مؤهلة» مع حد أعلى 2 لكل طالبة — حتى لا تتحول النقاط إلى شراء مفتوح للدرجات.</div>
        <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button><button className="btn btn-primary">حفظ</button></div>
      </form>
    </Modal>
  );
}
