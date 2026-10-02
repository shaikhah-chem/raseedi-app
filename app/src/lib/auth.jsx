import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, usernameToEmail, arabicError } from './supabase';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [student, setStudent] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
    if (data) setSettings(data);
  }, []);

  const loadProfile = useCallback(async (sess) => {
    if (!sess) { setProfile(null); setStudent(null); return; }
    const { data: p } = await supabase.from('users').select('*').eq('id', sess.user.id).maybeSingle();
    setProfile(p || null);
    if (p?.role === 'student') {
      const { data: s } = await supabase.from('students').select('*, classes(grade,name)').eq('user_id', sess.user.id).maybeSingle();
      setStudent(s || null);
    } else setStudent(null);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(data.session);
      await Promise.all([loadProfile(data.session), loadSettings()]);
      setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((evt, sess) => {
      if (evt === 'SIGNED_OUT') { setSession(null); setProfile(null); setStudent(null); }
      else if (evt === 'TOKEN_REFRESHED' || evt === 'USER_UPDATED') setSession(sess);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadProfile, loadSettings]);

  const signIn = async (username, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    if (error) throw new Error(arabicError(error));
    setSession(data.session);
    await loadProfile(data.session);
    const { data: p } = await supabase.from('users').select('role').eq('id', data.user.id).maybeSingle();
    if (!p) { await supabase.auth.signOut(); throw new Error('هذا الحساب غير مرتبط بالنظام'); }
    return p.role;
  };

  const signOut = async () => { await supabase.auth.signOut(); setSession(null); setProfile(null); setStudent(null); };

  return (
    <AuthCtx.Provider value={{ session, profile, student, settings, loading, signIn, signOut,
      reloadProfile: () => loadProfile(session), reloadSettings: loadSettings }}>
      {children}
    </AuthCtx.Provider>
  );
}
