import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { useSettings } from './lib/settings';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Home from './pages/Home';
import { ForgotPasswordPage, LoginPage, RegisterPage } from './pages/AuthPages';
import AccountPage from './pages/Account';
import { LegalPage, MaintenancePage, NotFoundPage } from './pages/Misc';

const AdminApp = lazy(() => import('./admin/AdminApp'));

/** Old addresses (?page=…) still work. Old video links go straight to the original site. */
function legacyTarget(search: string): string | null {
  const p = new URLSearchParams(search);
  const page = p.get('page');
  if (!page) return null;
  if (page === 'view' && p.get('mediaId')) return `/go/${encodeURIComponent(p.get('mediaId')!)}`;
  const map: Record<string, string> = {
    media: '/',
    directory: '/',
    auth: '/login',
    'admin-dashboard': '/admin',
    'reset-password': '/forgot-password',
    search: `/?q=${encodeURIComponent(p.get('q') || '')}`,
    profile: '/account',
  };
  return map[page] ?? '/';
}

export default function App() {
  const { loading, isAdmin } = useAuth();
  const { settings, loaded } = useSettings();
  const loc = useLocation();

  const legacy = legacyTarget(loc.search);
  if (legacy?.startsWith('/go/')) {
    // A full-page redirect, because /go/ is served by the server.
    window.location.replace(legacy);
    return <Spinner className="min-h-screen items-center" />;
  }
  if (legacy) return <Navigate to={legacy} replace />;
  if (loading || !loaded) return <Spinner className="min-h-screen items-center" />;

  // Maintenance mode: visitors see a holding page; admins and the sign-in page still work.
  if (settings.maintenanceMode && !isAdmin && !['/login', '/forgot-password'].includes(loc.pathname)) {
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
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<Navigate to="/forgot-password" replace />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="privacy" element={<LegalPage kind="privacy" />} />
        <Route path="terms" element={<LegalPage kind="terms" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
