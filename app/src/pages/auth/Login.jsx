import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { MOTTO } from '../../lib/constants';
import { Credit } from '../../components/Layout';

export default function Login() {
  const { signIn, session, profile } = useAuth();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [show, setShow] = useState(false);
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get('next');

  useEffect(() => { supabase.rpc('needs_setup').then(({ data }) => setNeedsSetup(!!data)); }, []);
  useEffect(() => {
    if (session && profile) nav(next || (profile.role === 'teacher' ? '/t/dashboard' : '/s/home'), { replace: true });
  }, [session, profile]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const role = await signIn(u, p);
      const okNext = next && ((role === 'teacher' && next.startsWith('/t')) || (role === 'student' && (next.startsWith('/s') || next.startsWith('/claim'))));
      nav(okNext ? next : role === 'teacher' ? '/t/dashboard' : '/s/home', { replace: true });
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-hero">
          <div className="auth-star" aria-hidden>★</div>
          <h1>✨ رصيدي الذهبي ✨</h1>
          <p>«{MOTTO}»</p>
        </div>
        {needsSetup && (
          <div className="alert alert-info">النظام جديد ولم يُنشأ حساب المعلمة بعد. <Link to="/setup"><b>ابدئي الإعداد لأول مرة ←</b></Link></div>
        )}
        {next?.startsWith('/claim') && <div className="alert alert-info">سجّلي دخولك لتسجيل إنجاز المهمة 🔳</div>}
        <form onSubmit={submit} className="stack">
          <label className="field"><span>اسم المستخدم</span>
            <input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" dir="ltr" placeholder="مثال: s0101" required autoCapitalize="none" />
          </label>
          <label className="field"><span>كلمة المرور</span>
            <div className="pw">
              <input type={show ? 'text' : 'password'} value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" dir="ltr" required />
              <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label="إظهار كلمة المرور">{show ? '🙈' : '👁️'}</button>
            </div>
          </label>
          {err && <div className="alert alert-err">⚠️ {err}</div>}
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'جارٍ الدخول...' : 'دخول'}</button>
        </form>
        <p className="muted small center">نسيتِ كلمة المرور؟ اطلبي من معلمتك إعادة تعيينها.</p>
      </div>
      <Credit />
    </div>
  );
}
