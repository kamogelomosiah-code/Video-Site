import { Link } from 'react-router-dom';
import { Database, Eye, Film, Mail, Plus, Settings, ShieldCheck, Tags, Users } from 'lucide-react';
import type { AdminStats } from '../../shared/types';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/settings';
import { formatNumber, formatViews, timeAgo, useFetch } from '../lib/utils';
import { Alert, Spinner } from '../components/ui';

const MAIL: Record<string, string> = {
  smtp: 'SMTP email', resend: 'Resend email', sendgrid: 'SendGrid email',
  console: 'Not configured — reset codes go to the server log',
};

export default function Overview() {
  usePageTitle('Admin');
  const { data, loading, error } = useFetch(() => api.get<AdminStats>('/admin/stats'), []);
  if (loading) return <Spinner />;
  if (error || !data) return <Alert>{error || 'Could not load the dashboard'}</Alert>;

  const cards = [
    { label: 'Videos', value: formatNumber(data.videos), icon: Film, to: '/admin/videos' },
    { label: 'Published', value: formatNumber(data.published), icon: Film, to: '/admin/videos?status=published' },
    { label: 'Drafts (hidden)', value: formatNumber(data.drafts), icon: Film, to: '/admin/videos?status=draft' },
    { label: 'Total views', value: formatViews(data.totalViews), icon: Eye, to: '/admin/videos' },
    { label: 'Users', value: formatNumber(data.users), icon: Users, to: '/admin/users' },
    { label: 'Categories', value: formatNumber(data.categories), icon: Tags, to: '/admin/categories' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-zinc-400">Everything you manage, in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/videos/import" className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm hover:bg-zinc-700">
            Import videos
          </Link>
          <Link to="/admin/videos?new=1" className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-brand-400">
            <Plus className="h-4 w-4" /> Add video
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="min-w-0 rounded-xl border border-zinc-900 bg-zinc-950 p-4 hover:border-zinc-700" data-testid="stat-card">
            <c.icon className="h-5 w-5 text-brand-400" />
            <p className="mt-3 text-2xl font-bold">{c.value}</p>
            <p className="text-sm text-zinc-500">{c.label}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-xl border border-zinc-900 bg-zinc-950 p-5" aria-labelledby="system-title">
        <h2 id="system-title" className="mb-3 font-semibold">System</h2>
        <ul className="grid gap-3 text-sm sm:grid-cols-3">
          <li className="flex gap-2"><Database className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" /><span>
            <span className="block text-zinc-400">Database</span>
            {data.system.storage === 'mongodb' ? `MongoDB · ${data.system.database}` : 'Local file (development only)'}
          </span></li>
          <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" /><span>
            <span className="block text-zinc-400">Email</span>
            {MAIL[data.system.emailProvider]}
          </span></li>
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" /><span>
            <span className="block text-zinc-400">Admin sign-in</span>
            {data.system.adminPin ? 'Username, password and PIN' : 'Username and password'}
          </span></li>
        </ul>
        {data.system.storage !== 'mongodb' && (
          <p className="mt-4 text-xs text-amber-300">Videos are saved to a local file, so they won't survive a redeploy. Set MONGODB_URI to use your database.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-900 bg-zinc-950 p-5">
          <h2 className="mb-3 font-semibold">Most viewed</h2>
          {!data.topVideos.length ? (
            <p className="text-sm text-zinc-500">No videos yet.</p>
          ) : (
            <ol className="space-y-2">
              {data.topVideos.map((m, i) => (
                <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link to={`/admin/videos?q=${encodeURIComponent(m.title)}`} className="min-w-0 truncate hover:text-brand-300">{i + 1}. {m.title}</Link>
                  <span className="shrink-0 text-zinc-500">{formatViews(m.views)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="rounded-xl border border-zinc-900 bg-zinc-950 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent activity</h2>
            <Link to="/admin/activity" className="text-xs text-brand-400 hover:underline">View all</Link>
          </div>
          {!data.recentActivity.length ? (
            <p className="text-sm text-zinc-500">Nothing yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-zinc-300">{a.details}</span>
                  <span className="shrink-0 text-xs text-zinc-500">{timeAgo(a.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-zinc-600">
        <Settings className="mr-1 inline h-3 w-3" />
        Site name, announcement, maintenance mode and the 18+ gate are under <Link to="/admin/settings" className="underline">Site settings</Link>.
      </p>
    </div>
  );
}
