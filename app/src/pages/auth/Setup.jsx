import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, rpc } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Spinner } from '../../components/ui';

export default function Setup() {
  const [state, setState] = useState('loading');
  const [f, setF] = useState({ full_name: 'أ. شيخه المطيري', username: '', password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const nav = useNavigate();

  useEffect(() => { supabase.rpc('needs_setup').then(({ data, error }) => setState(error ? 'error' : data ? 'ready' : 'done')); }, []);

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (f.password !== f.confirm) return setErr('كلمتا المرور غير متطابقتين');
    setBusy(true);
    try {
      await rpc('bootstrap_teacher', { p_username: f.username, p_password: f.password, p_full_name: f.full_name });
      await signIn(f.username, f.password);
      nav('/t/settings?welcome=1', { replace: true });
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-hero"><div className="auth-star">★</div><h1>الإعداد لأول مرة</h1><p>إنشاء حساب المعلمة (المسؤولة)</p></div>
        {state === 'loading' && <Spinner />}
        {state === 'error' && <div className="alert alert-err">تعذّر الاتصال بقاعدة البيانات. تأكدي من تشغيل ملف 01_schema.sql ومن ملف config.js</div>}
        {state === 'done' && <div className="alert alert-info">تم إعداد حساب المعلمة مسبقًا. <a href="#/login">الذهاب لتسجيل الدخول</a></div>}
        {state === 'ready' && (
          <form onSubmit={submit} className="stack">
            <label className="field"><span>الاسم الظاهر</span><input value={f.full_name} onChange={set('full_name')} required /></label>
            <label className="field"><span>اسم المستخدم (إنجليزي)</span><input dir="ltr" value={f.username} onChange={set('username')} placeholder="مثال: shaikha" required autoCapitalize="none" /></label>
            <label className="field"><span>كلمة المرور (6 خانات على الأقل)</span><input dir="ltr" type="password" value={f.password} onChange={set('password')} required minLength={6} /></label>
            <label className="field"><span>تأكيد كلمة المرور</span><input dir="ltr" type="password" value={f.confirm} onChange={set('confirm')} required /></label>
            {err && <div className="alert alert-err">⚠️ {err}</div>}
            <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'جارٍ الإنشاء...' : 'إنشاء حساب المعلمة'}</button>
            <p className="muted small">هذه الشاشة تعمل مرة واحدة فقط، ثم تُقفل تلقائيًا.</p>
          </form>
        )}
      </div>
    </div>
  );
}
