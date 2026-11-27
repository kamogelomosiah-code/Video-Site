import { useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Activity, ExternalLink, FileUp, Film, Globe, LayoutDashboard, Megaphone, Menu, Settings, Tags, User, Users, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { usePageTitle } from '../lib/settings';
import { Logo } from '../components/Layout';
import { cx } from '../components/ui';
import { AccountForms } from '../pages/Account';
import Overview from './Overview';
import VideosAdmin from './VideosAdmin';
import ImportVideos from './ImportVideos';
import AddFromUrl from './AddFromUrl';
import { AdsAdmin, CategoriesAdmin } from './Taxonomy';
import UsersAdmin from './UsersAdmin';
import SettingsAdmin from './SettingsAdmin';
import ActivityAdmin from './ActivityAdmin';

const NAV = [
  { to: '', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: 'videos', label: 'Videos', icon: Film, end: true },
  { to: 'videos/scrape', label: 'Add from URL', icon: Globe },
  { to: 'videos/import', label: 'Import file', icon: FileUp },
  { to: 'categories', label: 'Categories', icon: Tags },
  { to: 'ads', label: 'Ads', icon: Megaphone },
  { to: 'users', label: 'Users', icon: Users },
  { to: 'settings', label: 'Site settings', icon: Settings },
  { to: 'activity', label: 'Activity log', icon: Activity },
  { to: 'account', label: 'My account', icon: User },
];

function AccountSection() {
  usePageTitle('Admin · My account');
  return (
    <div className="max-w-2xl">
      <h1 className="mb-5 text-2xl font-bold">My account</h1>
      <AccountForms />
    </div>
  );
}

export default function AdminApp() {
  const { user, isAdmin } = useAuth();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  if (!user) return <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />;
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="text-sm text-zinc-400">Your account doesn't have access to the admin panel.</p>
        <Link to="/" className="text-brand-400 hover:underline">Back to the site</Link>
      </div>
    );
  }

  const nav = (
    <nav className="space-y-0.5" aria-label="Admin">
      {NAV.map((n) => (
        <NavLink
          key={n.to || 'overview'}
          to={n.to ? `/admin/${n.to}` : '/admin'}
          end={n.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm', isActive ? 'bg-brand-500 font-semibold text-zinc-950' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white')
          }
        >
          <n.icon className="h-4 w-4" /> {n.label}
        </NavLink>
      ))}
      <Link to="/" className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white">
        <ExternalLink className="h-4 w-4" /> View site
      </Link>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-zinc-900 bg-zinc-950 p-4 lg:flex">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-400">Admin</span>
        </div>
        {nav}
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-900 bg-zinc-950/90 px-4 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-md p-2 hover:bg-zinc-800" aria-label="Admin menu" aria-expanded={open}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Logo />
          <span className="text-xs font-bold uppercase text-brand-400">Admin</span>
        </header>
        {open && <div className="border-b border-zinc-900 bg-zinc-950 p-4 lg:hidden">{nav}</div>}
        <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="videos" element={<VideosAdmin />} />
            <Route path="videos/import" element={<ImportVideos />} />
            <Route path="videos/scrape" element={<AddFromUrl />} />
            <Route path="categories" element={<CategoriesAdmin />} />
            <Route path="ads" element={<AdsAdmin />} />
            <Route path="users" element={<UsersAdmin />} />
            <Route path="settings" element={<SettingsAdmin />} />
            <Route path="activity" element={<ActivityAdmin />} />
            <Route path="account" element={<AccountSection />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
