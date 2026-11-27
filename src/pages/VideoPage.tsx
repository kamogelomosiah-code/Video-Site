import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, Eye, Film, Play, Share2, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { PublicVideo, VideoDetail } from '../../shared/types';
import { api } from '../lib/api';
import { useSeo } from '../lib/seo';
import { categoryPath, summary, tagPath, videoPath } from '../../shared/seo';
import { formatViews, timeAgo } from '../lib/utils';
import { visitorId } from '../lib/visitor';
import { AdSlot, Thumb, VideoGrid } from '../components/Media';
import { Empty, cx, useToast } from '../components/ui';

type Reaction = 'like' | 'dislike' | null;
type Loaded = { video: VideoDetail; similar: PublicVideo[]; mine: Reaction };

/**
 * A video's own page: the picture, details, tags, likes and similar videos.
 * Watching happens on the original website, one tap away ("Watch on …" opens it in a new tab).
 */
export default function VideoPage() {
  const { id = '' } = useParams();
  const { toast } = useToast();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const dv = data?.video;
  useSeo(
    dv
      ? {
          title: dv.title,
          description: summary(dv.description || `${dv.title}${dv.creatorName ? ` by ${dv.creatorName}` : ''}. Watch it on ${dv.source || 'the original site'}.`),
          path: videoPath(dv),
          image: dv.thumbnailUrl,
        }
      : { noindex: true },
  );
  // Keep the address tidy: /v/<id>/<title-words> (old /v/<id> links still work).
  useEffect(() => {
    if (dv && decodeURIComponent(loc.pathname) !== decodeURIComponent(videoPath(dv))) nav(videoPath(dv) + loc.search, { replace: true });
  }, [dv, loc.pathname, loc.search, nav]);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    setMore(false);
    window.scrollTo({ top: 0 });
    const v = visitorId();
    api
      .get<Loaded>(`/videos/${encodeURIComponent(id)}${v ? `?visitor=${v}` : ''}`)
      .then((r) => alive && setData(r))
      .catch((e) => alive && setError(e.status === 404 ? 'gone' : e.message));
    return () => {
      alive = false;
    };
  }, [id]);

  if (error === 'gone') {
    return (
      <Empty title="This video is no longer available" icon={<Film className="h-10 w-10" />}>
        <Link to="/" className="mt-4 inline-block rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-zinc-950">Browse videos</Link>
      </Empty>
    );
  }
  if (error) return <Empty title="Couldn't load this video">{error}</Empty>;
  if (!data) {
    return (
      <div className="mx-auto max-w-3xl" aria-busy="true" aria-label="Loading video" data-testid="video-skeleton">
        <div className="skeleton aspect-video rounded-2xl sm:rounded-3xl" />
        <div className="skeleton mt-5 h-6 w-4/5 rounded-full" />
        <div className="skeleton mt-3 h-4 w-2/5 rounded-full" />
        <div className="mt-5 flex gap-2"><div className="skeleton h-11 w-36 rounded-full" /><div className="skeleton h-11 w-24 rounded-full" /></div>
        <div className="skeleton mt-4 h-12 w-full rounded-full" />
      </div>
    );
  }

  const { video: v, similar, mine } = data;
  const tags = v.tags || [];
  const watch = `/go/${encodeURIComponent(v.id)}`;
  const site = v.source || 'the original site';

  /** Like / dislike: tap again to undo. Shown at once, then confirmed by the server. */
  const react = async (value: 'like' | 'dislike') => {
    const next: Reaction = mine === value ? null : value;
    const visitor = visitorId();
    if (!visitor || busy) return;
    const before = data;
    const bump = (n = 0, on: boolean, off: boolean) => Math.max(0, n + (on ? 1 : 0) - (off ? 1 : 0));
    setData({
      ...data,
      mine: next,
      video: {
        ...v,
        likes: bump(v.likes, next === 'like', mine === 'like'),
        dislikes: bump(v.dislikes, next === 'dislike', mine === 'dislike'),
      },
    });
    setBusy(true);
    try {
      const r = await api.post<{ likes: number; dislikes: number; mine: Reaction }>(`/videos/${encodeURIComponent(v.id)}/react`, { value: next, visitor });
      setData((d) => d && { ...d, mine: r.mine, video: { ...d.video, likes: r.likes, dislikes: r.dislikes } });
    } catch (e: any) {
      setData(before);
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: v.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <div data-testid="video-page">
      <article className="mx-auto max-w-3xl">
        {/* The picture is a big "play" button that opens the video where it lives. */}
        <a
          href={watch}
          target="_blank"
          rel="noopener noreferrer"
          className="ripple group relative block aspect-video overflow-hidden rounded-2xl bg-zinc-900 shadow-xl shadow-black/40 sm:rounded-3xl"
          aria-label={`Watch “${v.title}” on ${site}`}
          data-testid="video-poster"
        >
          <Thumb src={v.thumbnailUrl} focus={v.thumbFocus} alt="" className="h-full w-full" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-zinc-950 shadow-2xl shadow-black/50 transition-transform group-hover:scale-110 group-active:scale-95 sm:h-20 sm:w-20">
              <Play className="ml-1 h-8 w-8 fill-current sm:h-9 sm:w-9" />
            </span>
          </span>
          {v.duration && <span className="absolute bottom-3 right-3 rounded-md bg-black/80 px-2 py-0.5 text-xs font-semibold">{v.duration}</span>}
        </a>

        <h1 className="mt-4 text-xl font-bold leading-snug sm:text-2xl">{v.title}</h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-sm text-zinc-400">
          {v.creatorName && <span className="font-medium text-zinc-300">{v.creatorName}</span>}
          {v.creatorName && <span aria-hidden>·</span>}
          <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {formatViews(v.views)} {v.views === 1 ? 'view' : 'views'}</span>
          {v.createdAt && <><span aria-hidden>·</span><span>{timeAgo(v.createdAt)}</span></>}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-zinc-800 bg-zinc-900" role="group" aria-label="Rate this video">
            <button
              type="button"
              onClick={() => react('like')}
              aria-pressed={mine === 'like'}
              data-testid="like"
              className={cx('ripple flex h-11 items-center gap-2 px-4 text-sm font-semibold transition-colors duration-200 ease-standard', mine === 'like' ? 'bg-brand-500 text-zinc-950' : 'text-zinc-200 hover:bg-white/[.06]')}
            >
              <ThumbsUp key={`l${mine}`} className={cx('h-4 w-4', mine === 'like' && 'fill-current animate-pop')} /> {formatViews(v.likes)}
              <span className="sr-only">likes</span>
            </button>
            <span className="w-px bg-zinc-800" aria-hidden />
            <button
              type="button"
              onClick={() => react('dislike')}
              aria-pressed={mine === 'dislike'}
              data-testid="dislike"
              className={cx('ripple flex h-11 items-center gap-2 px-4 text-sm font-semibold transition-colors duration-200 ease-standard', mine === 'dislike' ? 'bg-zinc-200 text-zinc-950' : 'text-zinc-200 hover:bg-white/[.06]')}
            >
              <ThumbsDown key={`d${mine}`} className={cx('h-4 w-4', mine === 'dislike' && 'fill-current animate-pop')} /> {formatViews(v.dislikes)}
              <span className="sr-only">dislikes</span>
            </button>
          </div>
          <button type="button" onClick={share} className="ripple flex h-11 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-4 text-sm font-semibold text-zinc-200 transition-colors hover:bg-zinc-800">
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>

        <a
          href={watch}
          target="_blank"
          rel="noopener noreferrer"
          className="ripple mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-6 text-base font-bold text-zinc-950 shadow-lg shadow-brand-500/20 transition-[background-color,box-shadow,transform] duration-200 ease-standard hover:bg-brand-400 hover:shadow-xl hover:shadow-brand-500/25 active:scale-[.98] sm:w-auto sm:inline-flex"
          data-testid="watch"
        >
          Watch on {site} <ExternalLink className="h-4 w-4" />
        </a>

        {(v.categoryName || tags.length > 0) && (
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Tags">
            {v.categoryName && (
              <Link to={categoryPath(v.category || '')} className="ripple rounded-lg bg-brand-500/15 px-3 py-1.5 text-sm font-medium text-brand-300 transition-colors hover:bg-brand-500/25">
                {v.categoryName}
              </Link>
            )}
            {tags.slice(0, 12).map((t) => (
              <Link key={t} to={tagPath(t)} className="ripple rounded-lg border border-zinc-700/80 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/[.06] hover:text-white">
                #{t}
              </Link>
            ))}
          </div>
        )}

        {v.description && (
          <div className="mt-5 rounded-2xl bg-zinc-900/60 p-4 text-sm leading-relaxed text-zinc-300">
            <p className={cx('whitespace-pre-line', !more && 'line-clamp-3')}>{v.description}</p>
            {v.description.length > 160 && (
              <button type="button" onClick={() => setMore((m) => !m)} className="mt-2 font-semibold text-zinc-100">
                {more ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}
      </article>

      <AdSlot slot="home_mid" className="my-8" />

      {similar.length > 0 && (
        <section aria-labelledby="similar-title" className="mt-8">
          <h2 id="similar-title" className="mb-4 text-lg font-bold">More like this</h2>
          <VideoGrid items={similar} />
        </section>
      )}
    </div>
  );
}
