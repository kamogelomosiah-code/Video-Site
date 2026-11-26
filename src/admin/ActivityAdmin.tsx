import type { ActivityLog } from '../../shared/types';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/settings';
import { useFetch } from '../lib/utils';
import { Empty, Spinner } from '../components/ui';

export default function ActivityAdmin() {
  usePageTitle('Admin · Activity');
  const { data, loading } = useFetch(() => api.get<(ActivityLog & { userName: string })[]>('/admin/activity'), []);
  return (
    <div>
      <h1 className="text-2xl font-bold">Activity log</h1>
      <p className="mb-5 text-sm text-zinc-400">Recent sign-ups and admin changes (last 300).</p>
      {loading ? (
        <Spinner />
      ) : !data?.length ? (
        <Empty title="No activity yet" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-900">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-zinc-900/70 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">What</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {data.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-zinc-500">{new Date(a.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{a.userName || '—'}</td>
                  <td className="px-4 py-2.5">{a.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
