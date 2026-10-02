import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { DialogProvider, Spinner, ToastProvider } from './components/ui';
import Layout from './components/Layout';
import Login from './pages/auth/Login';
import Setup from './pages/auth/Setup';
import Claim from './pages/student/Claim';
import Notifications from './pages/Notifications';
import HowTo from './pages/HowTo';
import Dashboard from './pages/teacher/Dashboard';
import Students from './pages/teacher/Students';
import Tasks from './pages/teacher/Tasks';
import Points from './pages/teacher/Points';
import Rewards from './pages/teacher/Rewards';
import Flipped from './pages/teacher/Flipped';
import Reports from './pages/teacher/Reports';
import Settings from './pages/teacher/Settings';
import SHome from './pages/student/Home';
import STasks from './pages/student/MyTasks';
import SBalance from './pages/student/Balance';
import SRewards from './pages/student/RewardsStore';
import SHistory from './pages/student/History';

function Guard({ role, children }) {
  const { session, profile, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="center-page"><Spinner /></div>;
  if (!session || !profile) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (profile.role !== role) return <Navigate to={profile.role === 'teacher' ? '/t/dashboard' : '/s/home'} replace />;
  return children;
}

function Home() {
  const { session, profile, loading } = useAuth();
  if (loading) return <div className="center-page"><Spinner /></div>;
  if (!session || !profile) return <Navigate to="/login" replace />;
  return <Navigate to={profile.role === 'teacher' ? '/t/dashboard' : '/s/home'} replace />;
}

export default function App() {
  return (
    <ToastProvider>
      <DialogProvider>
        <AuthProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/claim/:code" element={<Guard role="student"><Claim /></Guard>} />
              <Route path="/t" element={<Guard role="teacher"><Layout role="teacher" /></Guard>}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="students" element={<Students />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="points" element={<Points />} />
                <Route path="rewards" element={<Rewards />} />
                <Route path="flipped" element={<Flipped />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="how" element={<HowTo />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Route>
              <Route path="/s" element={<Guard role="student"><Layout role="student" /></Guard>}>
                <Route path="home" element={<SHome />} />
                <Route path="tasks" element={<STasks />} />
                <Route path="balance" element={<SBalance />} />
                <Route path="rewards" element={<SRewards />} />
                <Route path="history" element={<SHistory />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="how" element={<HowTo />} />
                <Route path="*" element={<Navigate to="home" replace />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
        </AuthProvider>
      </DialogProvider>
    </ToastProvider>
  );
}
