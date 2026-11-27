import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Check, Search, SearchX, Film, Flame, Play } from 'lucide-react';
import type { Category, PublicVideo } from '../../shared/types';
import { api } from '../lib/api';
import { useSettings } from '../lib/settings';
import { useSeo } from '../lib/seo';
import { categoryPath, tagPath, videoPath } from '../../shared/seo';
import { useDebounced, useFetch } from '../lib/utils';
import { AdSlot, GridSkeleton, Thumb, VideoGrid, VideoRow } from '../components/Media';
import { Alert, Button, Empty, Spinner, cx } from '../components/ui';

type Page = { items: PublicVideo[]; total: number; page: number; pages: number };
type Trending = { items: PublicVideo[]; tags: string[] };

/** Big rotating pictures of the pinned / trending videos, with a call-out, to catch the eye. */
function Slides({ items, callout }: { items: PublicVideo[]; callout: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const n = items.length;
  const go = (k: number) => setI(((k % n) + n) % n);
  useEffect(() => {
    if (n < 2 || paused || reduce) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') setI((x) => (x + 1) % n);
    }, 5500);
    return () => clearInterval(t);
  }, [n, paused, reduce]);
  const cur = items[i] || items[0];
  return (
    <section
      className="relative mb-5 overflow-hidden rounded-3xl bg-zinc-900"
      aria-roledescription="carousel"
      aria-label="Featured videos"
      data-testid="hero-slides"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; setPaused(true); }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        setPaused(false);
        if (start == null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="relative aspect-[4/3] max-h-[460px] w-full min-[480px]:aspect-video lg:aspect-[21/9]">
        {items.map((v, k) => (
          <div key={v.id} className={cx('absolute inset-0 transition-opacity duration-1000', k === i ? 'opacity-100' : 'opacity-0')} aria-hidden={k !== i}>
            <Thumb src={v.thumbnailUrl} focus={v.thumbFocus} alt="" priority={k === 0} className={cx('h-full w-full', k === i && !reduce && 'animate-[heroZoom_7s_ease-out_both]')} />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-950 shadow-lg animate-[pulseGlow_2.4s_ease-in-out_infinite]">
            <Flame className="h-3.5 w-3.5" /> {callout || 'Trending now'}
          </span>
          <h2 key={cur.id} className="mt-3 line-clamp-2 max-w-2xl text-2xl font-extrabold leading-tight drop-shadow-lg sm:text-4xl animate-[fadeUp_.6s_ease-out_both]">{cur.title}</h2>
          {cur.creatorName && <p className="mt-1 text-sm text-zinc-300">{cur.creatorName}</p>}
          <div className="mt-4 flex items-center justify-between gap-3">
            <Link to={videoPath(cur)} className="ripple inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-zinc-950 shadow-lg transition-[background-color,transform] duration-200 ease-standard hover:bg-zinc-200 active:scale-95" data-testid="hero-watch">
              <Play className="h-4 w-4 fill-current" /> Watch now
            </Link>
            {n > 1 && (
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Choose a featured video">
                {items.map((v, k) => (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={k === i}
                    aria-label={`Show “${v.title}”`}
                    onClick={() => go(k)}
                    className="flex h-6 items-center"
                  >
                    <span className={cx('block h-1.5 rounded-full transition-all', k === i ? 'w-6 bg-brand-500' : 'w-1.5 bg-white/50')} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** The top of the home page: rotating featured videos (if any), then the search box. */
function Hero({ value, onSubmit, onChange, tags, slides, loading }: {
  value: string;
  onSubmit: (e: FormEvent) => void;
  onChange: (v: string) => void;
  tags: string[];
  slides: PublicVideo[];
  /** The featured videos are still on their way: keep their space so nothing below jumps when they arrive. */
  loading?: boolean;
}) {
  const { settings } = useSettings();
  const show = settings.heroSlides && (slides.length > 0 || !!loading);
  return (
    <div className="mb-8" data-testid="hero">
      {show && (slides.length > 0 ? (
        <Slides items={slides} callout={settings.heroCallout} />
      ) : (
        <div className="skeleton mb-5 aspect-[4/3] max-h-[460px] w-full rounded-3xl min-[480px]:aspect-video lg:aspect-[21/9]" aria-hidden data-testid="hero-placeholder" />
      ))}
      <section className={cx(!show && 'rounded-2xl border border-zinc-900 bg-gradient-to-b from-zinc-900/70 to-zinc-950 px-5 py-10 text-center sm:py-14')}>
        <h1 className={cx('font-extrabold tracking-tight', show ? 'text-lg sm:text-xl' : 'text-3xl sm:text-4xl')}>{settings.heroHeadline}</h1>
        {settings.heroSubtext && <p className={cx('mt-1 text-sm text-zinc-400', !show && 'mx-auto mt-2 max-w-xl')}>{settings.heroSubtext}</p>}
        <form onSubmit={onSubmit} role="search" className={cx('mt-4 flex gap-2', !show && 'mx-auto mt-6 max-w-2xl')}>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Search videos…"
              aria-label="Search videos"
              type="search"
              enterKeyHint="search"
              className="h-12 w-full rounded-full border border-zinc-800 bg-zinc-900 pl-12 pr-4 text-base placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <Button type="submit" className="h-12 rounded-full px-5 sm:px-6" aria-label="Search">
            <Search className="h-5 w-5 sm:hidden" /><span className="hidden sm:inline">Search</span>
          </Button>
        </form>
        {tags.length > 0 && (
          <div className={cx('scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0', !show && 'sm:justify-center')}>
            {tags.map((t) => (
              <button key={t} type="button" onClick={() => onChange(t)} className="ripple h-8 shrink-0 rounded-lg border border-zinc-700/80 px-3 text-xs text-zinc-300 transition-colors hover:bg-white/[.06] hover:text-white">
                #{t}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * The video lists: the home page (/), a category (/c/:slug), a tag (/tag/:tag) and search results (/?q=).
 * Category and tag pages have their own addresses so search engines can list them as landing pages.
 */
export default function Home() {
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const route = useParams();
  const urlQ = params.get('q') || '';
  const legacyCategory = params.get('category');
  const category = route.slug || 'all';
  const tag = (route.tag || '').toLowerCase();
  const [box, setBox] = useState(urlQ);
  const q = useDebounced(box, 350).trim();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PublicVideo[]>([]);
  const [meta, setMeta] = useState({ total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Keep the box in step with back/forward navigation (?q= in the URL).
  useEffect(() => setBox(urlQ), [urlQ]);
  useEffect(() => {
    if (q !== urlQ) {
      const next = new URLSearchParams(params);
      if (q) next.set('q', q);
      else next.delete('q');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  useEffect(() => setPage(1), [q, category, tag]);

  const { data: categories } = useFetch(() => api.get<Category[]>('/categories'), []);
  const { data: trending } = useFetch(() => api.get<Trending>('/trending'), []);
  const loc = useLocation();
  useEffect(() => {
    if (loc.hash === '#trending' && trending) document.getElementById('trending')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loc.hash, loc.key, trending]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ page: String(page), limit: '24' });
    if (q) qs.set('q', q);
    if (category !== 'all') qs.set('category', category);
    if (tag) qs.set('tag', tag);
    api
      .get<Page>(`/videos?${qs}`)
      .then((r) => {
        if (!alive) return;
        setItems((prev) => (page === 1 ? r.items : [...prev, ...r.items]));
        setMeta({ total: r.total, pages: r.pages });
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [q, category, tag, page]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setParams(box.trim() ? { q: box.trim() } : {}, { replace: true });
  };

  const cat = categories?.find((c) => c.slug === category);
  const listing = category !== 'all' || !!tag; // a category or tag landing page
  const heading = tag ? `#${tag} videos` : cat ? `${cat.name} videos` : '';
  useSeo(
    q
      ? { title: `${q} – search`, noindex: true }
      : tag
        ? { title: `#${tag} videos`, description: `${meta.total} videos tagged #${tag} on ${settings.siteName}. Browse and watch the best #${tag} videos.`, path: tagPath(tag), noindex: !loading && meta.total < 2 }
        : cat
          ? { title: `${cat.name} videos`, description: `Watch ${meta.total} ${cat.name} videos on ${settings.siteName}. New ${cat.name.toLowerCase()} videos added regularly – free to browse.`, path: categoryPath(cat.slug) }
          : { path: '/' },
  );

  // Old links (?category=…) move to the category's own address.
  if (legacyCategory && legacyCategory !== 'all') return <Navigate to={categoryPath(legacyCategory)} replace />;

  return (
    <div>
      {listing ? (
        <header className="mb-6" data-testid="listing-header">
          <nav className="mb-2 text-xs text-zinc-500" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-zinc-300">Home</Link> <span aria-hidden>›</span> <span className="text-zinc-400">{tag ? `#${tag}` : cat?.name || category}</span>
          </nav>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{heading || `${category} videos`}</h1>
          {!loading && <p className="mt-1 text-sm text-zinc-400">{meta.total.toLocaleString()} video{meta.total === 1 ? '' : 's'}</p>}
        </header>
      ) : (
        <Hero value={box} onChange={setBox} onSubmit={submit} tags={trending?.tags || []} slides={q ? [] : (trending?.items || []).filter((v) => v.thumbnailUrl).slice(0, 5)} loading={!q && !trending} />
      )}
      <AdSlot slot="home_top" className="mb-8" />

      {/* Keep the Trending row's space while it loads, so the list below doesn't jump. */}
      {!q && !listing && !trending && (
        <section className="mb-10" aria-hidden data-testid="trending-placeholder">
          <div className="skeleton mb-4 h-6 w-32 rounded-full" />
          <div className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={cx('w-[44%] shrink-0 sm:w-auto', i >= 3 && 'sm:hidden', i === 3 && 'lg:block', i === 4 && 'xl:block')}>
                <div className="skeleton aspect-video rounded-2xl" />
                <div className="skeleton mt-3 h-3.5 w-11/12 rounded-full" />
                <div className="skeleton mt-2 h-3 w-1/2 rounded-full" />
              </div>
            ))}
          </div>
        </section>
      )}
      {!q && !listing && trending && trending.items.length > 0 && (
        <section id="trending" className="mb-10 scroll-mt-20" aria-labelledby="trending-title">
          <h2 id="trending-title" className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Flame className="h-5 w-5 text-brand-400" /> Trending
          </h2>
          <VideoRow items={trending.items.slice(0, 10)} />
        </section>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">
          {q ? <>Results for “{q}” <span className="text-sm font-normal text-zinc-500">({meta.total})</span></> : listing ? 'Newest first' : 'All videos'}
        </h2>
        {!!categories?.length && (
          <div className="scrollbar-none -mx-4 flex max-w-full gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Categories">
            {[{ slug: 'all', name: 'All' }, ...categories].map((c) => (
              // Real links, so search engines can follow them to each category page.
              <Link
                key={c.slug}
                to={c.slug === 'all' ? '/' : categoryPath(c.slug)}
                role="tab"
                aria-selected={category === c.slug}
                className={cx(
                  // Material filter chip: a check appears when it's on
                  'ripple flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3.5 text-sm transition-[background-color,border-color,color,padding] duration-200 ease-standard',
                  category === c.slug ? 'border-transparent bg-brand-500/20 pl-2.5 font-semibold text-brand-200' : 'border-zinc-700 text-zinc-300 hover:bg-white/[.04]',
                )}
              >
                {category === c.slug && <Check className="h-4 w-4 animate-pop" strokeWidth={2.6} />}
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {error && <Alert>{error}</Alert>}
      {loading && page === 1 ? (
        <GridSkeleton />
      ) : items.length === 0 && !error ? (
        q ? (
          <Empty title="No videos match your search" icon={<SearchX className="h-10 w-10" />}>Try a different word or browse the categories.</Empty>
        ) : (
          <Empty title="No videos here yet" icon={<Film className="h-10 w-10" />}>{settings.siteName} is adding videos — check back soon.</Empty>
        )
      ) : (
        <>
          <VideoGrid items={items.slice(0, 12)} insert={items.length > 5 ? { at: 5, node: <AdSlot key="infeed" slot="home_infeed" variant="card" /> } : undefined} />
          {items.length > 12 && (
            <>
              <AdSlot slot="home_mid" className="my-8" />
              <VideoGrid items={items.slice(12)} />
            </>
          )}
          {page < meta.pages && (
            <div className="mt-10 flex justify-center">
              <Button variant="secondary" loading={loading} onClick={() => setPage((p) => p + 1)}>Load more</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
