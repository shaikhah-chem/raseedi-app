import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLoad } from '../../lib/hooks';
import { rpc } from '../../lib/supabase';
import { fmtDateTime, pts } from '../../lib/format';
import { Brand, Credit } from '../../components/Layout';
import { Spinner, useToast } from '../../components/ui';

export default function Claim() {
  const { code } = useParams();
  const toast = useToast();
  const { data, loading, error } = useLoad(() => rpc('task_by_code', { p_code: code }), [code]);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true); setErr('');
    try { const r = await rpc('student_claim_code', { p_code: code }); setRes(r); if (r.points) toast(`حصلتِ على ${pts(r.points)} ذهبية 🎉`); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card claim-card">
        <Brand />
        {loading ? <Spinner /> : error ? (
          <><div className="claim-icon">⚠️</div><h2>{error}</h2><Link className="btn btn-primary" to="/s/tasks">العودة إلى مهامي</Link></>
        ) : res ? (
          <>
            <div className="claim-icon pop">{res.points > 0 ? '🎉' : '✅'}</div>
            <h2>{res.points > 0 ? `أحسنتِ! +${res.points} ⭐` : 'سُجِّل إنجازك'}</h2>
            <p>{res.task_title}</p>
            {!res.on_time && <p className="muted">سُجّل بعد الموعد النهائي، لذا لم تُحتسب نقاط.</p>}
            <Link className="btn btn-primary btn-lg" to="/s/home">رصيدي الذهبي ←</Link>
          </>
        ) : data.done ? (
          <><div className="claim-icon">✔️</div><h2>سجّلتِ هذه المهمة مسبقًا</h2><p>{data.title}</p><Link className="btn btn-primary" to="/s/tasks">مهامي</Link></>
        ) : (
          <>
            <div className="claim-icon">🔳</div>
            <small className="eyebrow">تأكيد إنجاز المهمة</small>
            <h2>{data.title}</h2>
            {data.description && <p className="muted">{data.description}</p>}
            <div className="claim-pts">⭐ {data.points}</div>
            <p className="small">الموعد النهائي: {fmtDateTime(data.due_at)}</p>
            {err && <div className="alert alert-err">⚠️ {err}</div>}
            <button className="btn btn-gold btn-lg" disabled={busy} onClick={confirm}>{busy ? 'جارٍ التسجيل...' : '✔️ أنجزتُ النشاط — سجّلي إنجازي'}</button>
            <Link to="/s/tasks" className="small">إلغاء</Link>
          </>
        )}
      </div>
      <Credit />
    </div>
  );
}
