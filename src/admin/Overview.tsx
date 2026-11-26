import { Link } from 'react-router-dom';
import { CalendarDays, Eye, Film, MessageSquare, Plus, Settings, UserSquare2, Users } from 'lucide-react';
import type { AdminStats } from '../../shared/types';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/settings';
import { formatViews, timeAgo, useFetch } from '../lib/utils';
import { Alert, Spinner } from '../components/ui';

export default function Overview() {
  usePageTitle('Admin');
  const { data, loading, error } = useFetch(() => api.get<AdminStats & { storage: string }>('/admin/stats'), []);
  if (loading) return <Spinner />;
  if (error || !data) return <Alert>{error}</Alert>;

  const cards = [
    { label: 'Videos', value: data.media, icon: Film, to: '/admin/media' },
    { label: 'Total views', value: formatViews(data.totalViews), icon: Eye, to: '/admin/media' },
    { label: 'Users', value: data.users, icon: Users, to: '/admin/users' },
    { label: 'Creators', value: data.talent, icon: UserSquare2, to: '/admin/creators' },
    { label: 'Events', value: data.events, icon: CalendarDays, to: '/admin/events' },
    { label: 'Comments', value: data.comments, icon: MessageSquare, to: '/admin/comments' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-zinc-400">
            Storage: {data.storage === 'mongodb' ? 'MongoDB' : 'local file (development)'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/media?new=1" className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-brand-400">
            <Plus className="h-4 w-4" /> Add video
          </Link>
          <Link to="/admin/settings" className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm hover:bg-zinc-700">
            <Settings className="h-4 w-4" /> Site settings
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 hover:border-zinc-700" data-testid="stat-card">
            <c.icon className="h-5 w-5 text-brand-400" />
            <p className="mt-3 text-2xl font-bold">{c.value}</p>
            <p className="text-sm text-zinc-500">{c.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-zinc-900 bg-zinc-950 p-5">
          <h2 className="mb-3 font-semibold">Most viewed</h2>
          {!data.topMedia.length ? (
            <p className="text-sm text-zinc-500">No videos yet.</p>
          ) : (
            <ol className="space-y-2">
              {data.topMedia.map((m, i) => (
                <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link to={`/admin/media?edit=${m.id}`} className="min-w-0 truncate hover:text-brand-300">{i + 1}. {m.title}</Link>
                  <span className="shrink-0 text-zinc-500">{formatViews(m.views)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="min-w-0 rounded-xl border border-zinc-900 bg-zinc-950 p-5">
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
    </div>
  );
}
