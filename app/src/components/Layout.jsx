import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useInterval } from '../lib/hooks';
import { MOTTO } from '../lib/constants';

const TEACHER_NAV = [
  { to: '/t/dashboard', icon: '📊', label: 'لوحة التحكم' },
  { to: '/t/students', icon: '👩‍🎓', label: 'الطالبات' },
  { to: '/t/tasks', icon: '📚', label: 'المهام' },
  { to: '/t/points', icon: '⭐', label: 'النقاط' },
  { to: '/t/rewards', icon: '🎁', label: 'المكافآت' },
  { to: '/t/flipped', icon: '🔄', label: 'الصف المقلوب' },
  { to: '/t/reports', icon: '📈', label: 'التقارير' },
  { to: '/t/settings', icon: '⚙️', label: 'الإعدادات' },
];
const STUDENT_NAV = [
  { to: '/s/home', icon: '🏠', label: 'الرئيسية' },
  { to: '/s/tasks', icon: '📚', label: 'مهامي' },
  { to: '/s/balance', icon: '⭐', label: 'رصيدي' },
  { to: '/s/rewards', icon: '🎁', label: 'المكافآت' },
  { to: '/s/history', icon: '📜', label: 'سجل إنجازاتي' },
  { to: '/s/notifications', icon: '🔔', label: 'التنبيهات' },
];

export function Brand({ compact }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`}>
      <div className="brand-mark" aria-hidden>★</div>
      <div>
        <div className="brand-name">✨ رصيدي الذهبي ✨</div>
        {!compact && <div className="brand-motto">«{MOTTO}»</div>}
      </div>
    </div>
  );
}

export function Credit() {
  const { settings } = useAuth() || {};
  return <div className="credit">{settings?.teacher_credit || 'تنفيذ المعلمة: أ. شيخه المطيري'}</div>;
}

export default function Layout({ role }) {
  const { profile, signOut } = useAuth();
  const nav = role === 'teacher' ? TEACHER_NAV : STUDENT_NAV;
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const loc = useLocation();
  const navigate = useNavigate();

  const loadUnread = async () => {
    const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    setUnread(count || 0);
  };
  useEffect(() => { loadUnread(); setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => { if (role === 'student') supabase.rpc('generate_my_due_reminders').then(loadUnread); }, [role]);
  useInterval(loadUnread, 60000);
  useEffect(() => {
    const h = () => loadUnread();
    window.addEventListener('raseedi:notif', h);
    return () => window.removeEventListener('raseedi:notif', h);
  }, []);

  const bellTo = role === 'teacher' ? '/t/notifications' : '/s/notifications';

  return (
    <div className={`shell shell-${role}`}>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Brand />
        <nav className="side-nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
              <span className="nl-icon" aria-hidden>{n.icon}</span>{n.label}
              {n.to === bellTo && unread > 0 && <span className="pill">{unread}</span>}
            </NavLink>
          ))}
          <NavLink to={role === 'teacher' ? '/t/how' : '/s/how'} className={({ isActive }) => `side-link subtle ${isActive ? 'active' : ''}`}>
            <span className="nl-icon" aria-hidden>💡</span>كيف أجمع نقاطي؟
          </NavLink>
        </nav>
        <div className="side-user">
          <div className="avatar" aria-hidden>{role === 'teacher' ? '👩‍🏫' : '👩‍🎓'}</div>
          <div className="side-user-txt"><b>{profile?.full_name}</b><small>{role === 'teacher' ? 'معلمة' : 'طالبة'}</small></div>
          <button className="btn btn-sm btn-ghost" onClick={async () => { await signOut(); navigate('/login'); }}>خروج</button>
        </div>
      </aside>
      {open && <div className="side-back" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="القائمة">☰</button>
          <Brand compact />
          <div className="topbar-actions">
            <NavLink to={bellTo} className="bell" aria-label="التنبيهات">🔔{unread > 0 && <span className="bell-n">{unread}</span>}</NavLink>
          </div>
        </header>
        <main className="content"><Outlet context={{ refreshUnread: loadUnread }} /></main>
        <Credit />
      </div>

      {role === 'student' && (
        <nav className="bottom-nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `bn-link ${isActive ? 'active' : ''}`}>
              <span aria-hidden>{n.icon}</span><small>{n.label.replace('سجل إنجازاتي', 'سجلي')}</small>
              {n.to === bellTo && unread > 0 && <i className="bn-dot" />}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
