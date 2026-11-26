import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { useSettings } from './lib/settings';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Home from './pages/Home';
import Watch from './pages/Watch';
import { CreatorDetailPage, CreatorsPage } from './pages/Creators';
import EventsPage from './pages/Events';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages';
import AccountPage from './pages/Account';
import { LegalPage, MaintenancePage, NotFoundPage } from './pages/Misc';

const AdminApp = lazy(() => import('./admin/AdminApp'));

/** Old links used ?page=view&mediaId=… — send them to the new addresses. */
function legacyRedirect(search: string): string | null {
  const p = new URLSearchParams(search);
  const page = p.get('page');
  if (!page) return null;
  const map: Record<string, string> = {
    view: p.get('mediaId') ? `/watch/${p.get('mediaId')}` : '/',
    media: '/',
    directory: '/creators',
    auth: '/login',
    'admin-dashboard': '/admin',
    'reset-password': `/reset-password?token=${p.get('token') || ''}`,
    search: `/?q=${encodeURIComponent(p.get('q') || '')}`,
    profile: '/account',
  };
  return map[page] ?? '/';
}

export default function App() {
  const { loading, isAdmin } = useAuth();
  const { settings, loaded } = useSettings();
  const loc = useLocation();

  const legacy = legacyRedirect(loc.search);
  if (legacy) return <Navigate to={legacy} replace />;
  if (loading || !loaded) return <Spinner className="min-h-screen items-center" />;

  // Maintenance mode: visitors see a holding page; admins and the sign-in page still work.
  if (settings.maintenanceMode && !isAdmin && !['/login', '/forgot-password', '/reset-password'].includes(loc.pathname)) {
    return <MaintenancePage />;
  }

  return (
    <Routes>
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<Spinner className="min-h-screen items-center" />}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="watch/:id" element={<Watch />} />
        <Route path="creators" element={<CreatorsPage />} />
        <Route path="creators/:id" element={<CreatorDetailPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="privacy" element={<LegalPage kind="privacy" />} />
        <Route path="terms" element={<LegalPage kind="terms" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
