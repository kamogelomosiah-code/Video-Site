import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, Eye, Lock, Pencil, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import type { Comment, MediaItem } from '../../shared/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePageTitle } from '../lib/settings';
import { formatPrice, formatViews, playbackFor, timeAgo, useFetch } from '../lib/utils';
import { AdSlot, MediaCard, Thumb } from '../components/Media';
import { Alert, Button, Empty, Spinner, Textarea, cx, useToast } from '../components/ui';

function Player({ item }: { item: MediaItem }) {
  const p = playbackFor(item);
  if (p.kind === 'file') {
    return (
      <video key={p.url} src={p.url} poster={item.thumbnailUrl} controls playsInline className="aspect-video w-full rounded-xl bg-black" data-testid="player-video" />
    );
  }
  if (p.kind === 'embed') {
    return (
      <iframe
        key={p.url}
        src={p.url}
        title={item.title}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="aspect-video w-full rounded-xl border-0 bg-black"
        data-testid="player-embed"
      />
    );
  }
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-black" data-testid="player-link">
      <Thumb src={item.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full opacity-60" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 p-4 text-center">
        {p.kind === 'link' ? (
          <>
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 font-semibold text-zinc-950 hover:bg-brand-400">
              <ExternalLink className="h-5 w-5" /> Watch full video
            </a>
            <p className="text-xs text-zinc-300">Opens on the creator's hosting site in a new tab.</p>
          </>
        ) : (
          <p className="text-sm text-zinc-300">This video isn't available right now.</p>
        )}
      </div>
    </div>
  );
}

function Comments({ mediaId }: { mediaId: string }) {
  const { user, isAdmin } = useAuth();
  const { toast, confirm } = useToast();
  const { data, loading, setData } = useFetch(() => api.get<Comment[]>(`/media/${mediaId}/comments`), [mediaId]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      const c = await api.post<Comment>(`/media/${mediaId}/comments`, { text });
      setData([c, ...(data || [])]);
      setText('');
    } catch (x: any) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Comment) => {
    if (!(await confirm('Delete this comment?', { confirmLabel: 'Delete' }))) return;
    try {
      await api.del(`/comments/${c.id}`);
      setData((data || []).filter((x) => x.id !== c.id));
      toast('Comment deleted');
    } catch (x: any) {
      toast(x.message, 'error');
    }
  };

  return (
    <section className="mt-8" aria-labelledby="comments-title">
      <h2 id="comments-title" className="mb-4 text-lg font-semibold">Comments {data ? `(${data.length})` : ''}</h2>
      {user ? (
        <form onSubmit={submit} className="mb-6 space-y-2">
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" maxLength={1000} aria-label="Comment" />
          {error && <Alert>{error}</Alert>}
          <div className="flex justify-end">
            <Button type="submit" loading={busy} disabled={!text.trim()}>Post comment</Button>
          </div>
        </form>
      ) : (
        <p className="mb-6 text-sm text-zinc-400">
          <Link to="/login" className="text-brand-400 hover:underline">Sign in</Link> to join the conversation.
        </p>
      )}
      {loading ? (
        <Spinner className="py-6" />
      ) : !data?.length ? (
        <p className="text-sm text-zinc-500">No comments yet.</p>
      ) : (
        <ul className="space-y-4">
          {data.map((c) => (
            <li key={c.id} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-sm font-semibold">
                {c.userAvatar ? <img src={c.userAvatar} alt="" className="h-full w-full object-cover" /> : (c.userName || '?').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">{c.userName}</span>{' '}
                  <span className="text-xs text-zinc-500">{timeAgo(c.createdAt)}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-zinc-300">{c.text}</p>
              </div>
              {(isAdmin || user?.id === c.userId) && (
                <button type="button" onClick={() => remove(c)} className="self-start rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400" aria-label="Delete comment">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Watch() {
  const { id = '' } = useParams();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const { data, loading, error } = useFetch(() => api.get<{ item: MediaItem; related: MediaItem[] }>(`/media/${id}`), [id]);
  const [reactions, setReactions] = useState<{ likes: string[]; dislikes: string[] }>({ likes: [], dislikes: [] });
  const [views, setViews] = useState(0);
  usePageTitle(data?.item.title);

  useEffect(() => {
    if (!data) return;
    setReactions({ likes: data.item.likes || [], dislikes: data.item.dislikes || [] });
    setViews(data.item.views || 0);
    api.post<{ counted: boolean; views?: number }>(`/media/${id}/view`).then((r) => r.views && setViews(r.views)).catch(() => {});
  }, [data, id]);

  if (loading) return <Spinner />;
  if (error || !data) return <Empty title="Video not found">It may have been removed. <Link to="/" className="text-brand-400">Browse videos</Link></Empty>;
  const { item, related } = data;
  const liked = !!user && reactions.likes.includes(user.id);
  const disliked = !!user && reactions.dislikes.includes(user.id);

  const react = async (value: 'like' | 'dislike') => {
    if (!user) return toast('Sign in to rate videos', 'error');
    const next = (value === 'like' ? liked : disliked) ? null : value;
    try {
      setReactions(await api.post(`/media/${id}/react`, { value: next }));
    } catch (x: any) {
      toast(x.message, 'error');
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <Player item={item} />
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold sm:text-2xl">{item.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-zinc-500">
              <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" /> {formatViews(views)} views</span>
              {item.createdAt && <span>· {timeAgo(item.createdAt)}</span>}
              {item.creatorName && <span>· {item.creatorName}</span>}
              {item.isPremium && (
                <span className="inline-flex items-center gap-1 text-brand-400">· <Lock className="h-3.5 w-3.5" /> Premium {item.price ? formatPrice(item.price) : ''}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => react('like')} aria-pressed={liked} className={cx('inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm', liked ? 'border-brand-500 bg-brand-500/15 text-brand-300' : 'border-zinc-800 hover:bg-zinc-900')}>
              <ThumbsUp className="h-4 w-4" /> {reactions.likes.length}
            </button>
            <button type="button" onClick={() => react('dislike')} aria-pressed={disliked} aria-label="Dislike" className={cx('inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm', disliked ? 'border-zinc-500 bg-zinc-800' : 'border-zinc-800 hover:bg-zinc-900')}>
              <ThumbsDown className="h-4 w-4" />
            </button>
            {isAdmin && (
              <Link to={`/admin/media?edit=${item.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/50 px-4 py-2 text-sm text-brand-400 hover:bg-brand-500/10">
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            )}
          </div>
        </div>
        {item.description && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-zinc-900/60 p-4 text-sm leading-relaxed text-zinc-300">{item.description}</p>}
        {!!item.tags?.length && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.tags.map((t) => (
              <Link key={t} to={`/?q=${encodeURIComponent(t)}`} className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400 hover:text-white">#{t}</Link>
            ))}
          </div>
        )}
        <Comments mediaId={item.id} />
      </div>
      <aside className="space-y-5">
        <AdSlot slot="media_sidebar" />
        <h2 className="font-semibold">Up next</h2>
        {related.length ? related.map((m) => <MediaCard key={m.id} item={m} />) : <p className="text-sm text-zinc-500">No related videos yet.</p>}
      </aside>
    </div>
  );
}
