import { useMemo, useState } from 'react';
import { useLoad } from '../../lib/hooks';
import { rpc } from '../../lib/supabase';
import { loadClasses, loadStudents, loadTransactions, classLabel } from '../../lib/teacherData';
import { TRACKS, TRACK_LIST, TX_KIND } from '../../lib/constants';
import { downloadCSV, fmtShort, pts } from '../../lib/format';
import { Card, Empty, ErrorBox, PageHeader, Spinner, StudentPicker, TrackBadge, useToast } from '../../components/ui';

export function AdjustPointsForm({ fixedIds, students, classes, onDone }) {
  const toast = useToast();
  const [mode, setMode] = useState('add');
  const [amount, setAmount] = useState(1);
  const [track, setTrack] = useState('participation');
  const [reason, setReason] = useState('');
  const [ids, setIds] = useState(fixedIds || []);
  const [busy, setBusy] = useState(false);
  const target = fixedIds || ids;

  const submit = async (e) => {
    e.preventDefault();
    if (!target.length) return toast('اختاري طالبة واحدة على الأقل', 'err');
    if (!reason.trim()) return toast('اكتبي سبب العملية', 'err');
    setBusy(true);
    try {
      const n = await rpc('admin_adjust_points', { p_student_ids: target, p_amount: mode === 'add' ? Number(amount) : -Number(amount), p_track: mode === 'add' ? track : null, p_reason: reason.trim() });
      toast(mode === 'add' ? `أُضيفت ${pts(amount)} لـ ${n} طالبة 🎉` : `تم خصم ${pts(amount)} مع تسجيل السبب`);
      setReason(''); if (!fixedIds) setIds([]);
      onDone?.();
    } catch (e2) { toast(e2.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="seg">
        <button type="button" className={mode === 'add' ? 'on' : ''} onClick={() => setMode('add')}>➕ إضافة نقاط</button>
        <button type="button" className={mode === 'deduct' ? 'on danger' : ''} onClick={() => setMode('deduct')}>➖ خصم نقاط</button>
      </div>
      {!fixedIds && <StudentPicker students={students} classes={classes} value={ids} onChange={setIds} />}
      <div className="field"><span>عدد النقاط</span>
        <div className="amount-row">
          {[1, 2, 3, 5].map((n) => <button type="button" key={n} className={`amount-btn ${Number(amount) === n ? 'on' : ''}`} onClick={() => setAmount(n)}>{n}</button>)}
          <input type="number" min={1} max={50} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="عدد مخصص" />
        </div>
      </div>
      {mode === 'add' && (
        <div className="field"><span>المسار</span>
          <div className="track-pick">{TRACK_LIST.map((t) => (
            <button type="button" key={t.key} className={`track-btn ${track === t.key ? 'on' : ''}`} style={{ '--tc': t.color, '--ts': t.soft }} onClick={() => setTrack(t.key)}>{t.dot} {t.short}</button>))}</div>
        </div>
      )}
      <div className="field"><span>السبب {mode === 'deduct' && <b className="danger-txt">(إلزامي)</b>}</span>
        {mode === 'add' && <div className="chips">{TRACKS[track].items.map((i) => <button type="button" key={i} className={`chip ${reason === i ? 'on' : ''}`} onClick={() => setReason(i)}>{i}</button>)}</div>}
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={mode === 'add' ? 'أو اكتبي سببًا آخر...' : 'مثال: عدم الالتزام بتعليمات المختبر'} />
      </div>
      <button className={`btn ${mode === 'add' ? 'btn-gold' : 'btn-danger'} btn-lg`} disabled={busy}>
        {busy ? 'جارٍ التنفيذ...' : mode === 'add' ? `منح ${pts(amount)} ⭐${target.length > 1 ? ` لـ ${target.length} طالبات` : ''}` : `خصم ${pts(amount)}`}
      </button>
      <p className="muted small">كل عملية تُسجَّل باسمك مع التاريخ والوقت والسبب في سجل العمليات.</p>
    </form>
  );
}

export default function Points() {
  const { data, loading, error, reload } = useLoad(async () => {
    const [classes, students, txs] = await Promise.all([loadClasses(), loadStudents(), loadTransactions()]);
    return { classes, students, txs };
  });
  const [f, setF] = useState({ cls: '', track: '', kind: '', from: '', to: '', qs: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const rows = useMemo(() => {
    if (!data) return [];
    const sm = Object.fromEntries(data.students.map((s) => [s.id, s]));
    return data.txs.filter((t) => {
      const s = sm[t.student_id]; if (!s) return false;
      if (f.cls && s.class_id !== f.cls) return false;
      if (f.track && t.track !== f.track) return false;
      if (f.kind === 'add' && t.amount < 0) return false;
      if (f.kind === 'deduct' && t.amount > 0) return false;
      if (f.kind && !['add', 'deduct'].includes(f.kind) && t.kind !== f.kind) return false;
      if (f.from && new Date(t.created_at) < new Date(f.from)) return false;
      if (f.to && new Date(t.created_at) > new Date(f.to + 'T23:59:59')) return false;
      if (f.qs && !s.full_name.includes(f.qs) && !t.reason.includes(f.qs)) return false;
      return true;
    }).map((t) => ({ ...t, s: sm[t.student_id] }));
  }, [data, f]);

  const exportCSV = () => downloadCSV('سجل_النقاط', ['التاريخ', 'الطالبة', 'الفصل', 'النوع', 'النقاط', 'المسار', 'السبب', 'المنفذة'],
    rows.map((t) => [fmtShort(t.created_at), t.s.full_name, classLabel(data.classes, t.s.class_id), TX_KIND[t.kind], t.amount, TRACKS[t.track]?.short || '', t.reason, t.users?.full_name || '']));

  return (
    <>
      <PageHeader icon="⭐" title="النقاط الذهبية" subtitle="منح النقاط وخصمها مع تسجيل السبب — وسجل كامل لكل العمليات" />
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Spinner /> : (
        <div className="grid-side">
          <Card><h3>منح / خصم نقاط</h3><AdjustPointsForm students={data.students} classes={data.classes} onDone={() => reload(true)} /></Card>
          <Card className="table-card">
            <div className="card-head"><h3>سجل العمليات ({rows.length})</h3><button className="btn btn-sm btn-ghost" onClick={exportCSV} disabled={!rows.length}>⬇️ تصدير Excel</button></div>
            <div className="filters">
              <select value={f.cls} onChange={set('cls')}><option value="">كل الفصول</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.grade} — {c.name}</option>)}</select>
              <select value={f.track} onChange={set('track')}><option value="">كل المسارات</option>{TRACK_LIST.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
              <select value={f.kind} onChange={set('kind')}><option value="">كل الأنواع</option><option value="add">إضافات</option><option value="deduct">خصومات</option>
                {Object.entries(TX_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <input type="date" value={f.from} onChange={set('from')} aria-label="من" />
              <input type="date" value={f.to} onChange={set('to')} aria-label="إلى" />
              <input placeholder="بحث..." value={f.qs} onChange={set('qs')} />
            </div>
            {!rows.length ? <Empty title="لا توجد عمليات مطابقة" /> : (
              <div className="table-scroll"><table className="table">
                <thead><tr><th>النقاط</th><th>الطالبة</th><th>السبب</th><th>المسار</th><th>التاريخ</th><th>المنفذة</th></tr></thead>
                <tbody>{rows.slice(0, 400).map((t) => (
                  <tr key={t.id}><td><b className={t.amount > 0 ? 'pos' : 'neg'}>{t.amount > 0 ? '+' : ''}{t.amount}</b></td>
                    <td>{t.s.full_name}</td><td>{t.reason}<div className="muted small">{TX_KIND[t.kind]}</div></td>
                    <td>{t.track ? <TrackBadge track={t.track} /> : '—'}</td><td className="small nowrap">{fmtShort(t.created_at)}</td><td className="small">{t.users?.full_name || '—'}</td></tr>))}</tbody>
              </table>{rows.length > 400 && <p className="muted small">يظهر أحدث 400 عملية — استخدمي التصدير للحصول على الكل.</p>}</div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
