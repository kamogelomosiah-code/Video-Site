import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Search, Trash2 } from 'lucide-react';
import type { Comment } from '../../shared/types';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/settings';
import { timeAgo, useFetch } from '../lib/utils';
import { Button, Empty, Input, Spinner, useToast } from '../components/ui';

export default function CommentsAdmin() {
  usePageTitle('Admin · Comments');
  const { toast, confirm } = useToast();
  const { data, loading, reload } = useFetch(() => api.get<(Comment & { mediaTitle: string })[]>('/admin/comments'), []);
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data || []).filter((c) => !s || `${c.text} ${c.userName} ${c.mediaTitle}`.toLowerCase().includes(s));
  }, [data, q]);

  const remove = async (c: Comment) => {
    if (!(await confirm('Delete this comment?', { confirmLabel: 'Delete' }))) return;
    try {
      await api.del(`/admin/comments/${c.id}`);
      toast('Comment deleted');
      reload();
    } catch (x: any) {
      toast(x.message, 'error');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Comments</h1>
      <p className="mb-5 text-sm text-zinc-400">Moderate what people post under videos.</p>
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search comments…" className="pl-9" aria-label="Search comments" />
      </div>
      {loading ? (
        <Spinner />
      ) : !rows.length ? (
        <Empty title="No comments" icon={<MessageSquare className="h-10 w-10" />} />
      ) : (
        <ul className="divide-y divide-zinc-900 rounded-xl border border-zinc-900">
          {rows.map((c) => (
            <li key={c.id} className="flex gap-3 p-4" data-testid="admin-row">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-500">
                  <span className="font-medium text-zinc-300">{c.userName}</span> on{' '}
                  <Link to={`/watch/${c.mediaId}`} className="text-brand-400 hover:underline">{c.mediaTitle}</Link> · {timeAgo(c.createdAt)}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.text}</p>
              </div>
              <Button variant="ghost" className="self-start px-2.5 hover:text-red-400" onClick={() => remove(c)} aria-label="Delete comment">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
