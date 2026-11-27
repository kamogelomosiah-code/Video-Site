import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowUp, Check, ChevronRight, Hash, History, Search, SearchX, Film, Flame, Play, Sparkles } from 'lucide-react';
import type { Category, PublicVideo } from '../../shared/types';
import { api } from '../lib/api';
import { useSettings } from '../lib/settings';
import { useSeo } from '../lib/seo';
import { categoryPath, tagPath, videoPath } from '../../shared/seo';
import { useDebounced, useFetch } from '../lib/utils';
import { AdSlot, GridSkeleton, Thumb, VideoGrid, VideoRow } from '../components/Media';
import SiteSearch from '../components/SiteSearch';
import { history, lastVisit, likedTags, type Seen } from '../lib/track';
import { Alert, Button, Empty, Spinner, cx } from '../components/ui';

type Page = { items: PublicVideo[]; total: number; page: number; pages: number; loose?: boolean };
type Trending = { items: PublicVideo[]; tags: string[] };

const chunk = <T,>(list: T[], n: number) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

function RowSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={cx('w-[44%] shrink-0 sm:w-auto', i >= 3 && 'sm:hidden', i === 3 && 'lg:block', i === 4 && 'xl:block', i === 5 && '2xl:block')}>
          <div className="skeleton aspect-video rounded-2xl" />
          <div className="skeleton mt-3 h-3.5 w-11/12 rounded-full" />
          <div className="skeleton mt-2 h-3 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  );
}

type Group = { kind: 'category' | 'tag'; key: string; name: string };

/** "More in <category>" / "#topic": a swipeable row that loads only when it is about to scroll into view. */
function GroupRow({ group }: { group: Group }) {
  const ref = useRef<HTMLElement>(null);
  const [items, setItems] = useState<PublicVideo[] | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const q = group.kind === 'category' ? `category=${encodeURIComponent(group.key)}` : `tag=${encodeURIComponent(group.key)}`;
    const load = () => api.get<Page>(`/videos?${q}&sort=smart&limit=10`).then((r) => setItems(r.items)).catch(() => setItems([]));
    if (typeof IntersectionObserver === 'undefined') return void load();
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [group.kind, group.key]);
  if (items && items.length < 3) return <div className="h-8" />;
  const to = group.kind === 'category' ? categoryPath(group.key) : tagPath(group.key);
  const title = group.kind === 'category' ? `More in ${group.name}` : `#${group.key}`;
  return (
    <section ref={ref} className="my-10 rounded-3xl bg-zinc-900/40 p-4 sm:p-5" aria-label={title} data-testid="category-row">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold sm:text-lg">{title}</h2>
        <Link to={to} className="ripple flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-brand-300 hover:bg-white/[.05]">
          See all <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      {items ? <VideoRow items={items} /> : <RowSkeleton />}
    </section>
  );
}

type Topic = { tag: string; label: string; count: number; cover?: PublicVideo };

/** Topics made from the videos' tags: picture cards you swipe through. */
function TopicsRow({ topics }: { topics: Topic[] | undefined }) {
  if (!topics) {
    // Still loading: keep the row's space so the list below doesn't jump.
    return (
      <section className="mb-8" aria-hidden>
        <div className="skeleton mb-3 h-6 w-40 rounded-full" />
        <div className="flex gap-3 overflow-hidden">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton aspect-[4/3] w-36 shrink-0 rounded-2xl sm:w-44" />)}</div>
      </section>
    );
  }
  if (topics.length < 3) return null;
  return (
    <section className="mb-8" aria-labelledby="topics-title" data-testid="topics">
      <h2 id="topics-title" className="mb-3 flex items-center gap-2 text-lg font-bold"><Hash className="h-5 w-5 text-brand-400" /> Popular topics</h2>
      <div className="scrollbar-none -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
        {topics.map((t) => (
          <Link key={t.tag} to={tagPath(t.tag)} className="ripple group relative aspect-[4/3] w-36 shrink-0 snap-start overflow-hidden rounded-2xl bg-zinc-900 sm:w-44">
            {t.cover && <Thumb src={t.cover.thumbnailUrl} focus={t.cover.thumbFocus} alt="" className="absolute inset-0 h-full w-full transition-transform duration-500 ease-emphasized group-hover:scale-105" />}
            <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-3">
              <span className="block truncate text-sm font-bold">#{t.tag}</span>
              <span className="text-xs text-zinc-300">{t.count} videos</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * For returning visitors (from this browser's own history): what's new since last time,
 * "Continue browsing" and "Because you watched …".
 */
function ForYou({ onShowNewest }: { onShowNewest: () => void }) {
  const [seen] = useState<Seen[]>(() => history());
  const [since] = useState(() => lastVisit());
  const [fresh, setFresh] = useState(0);
  const [because, setBecause] = useState<PublicVideo[] | null>(null);
  const last = seen[0];
  useEffect(() => {
    if (since) api.get<Page>(`/videos?since=${encodeURIComponent(new Date(since).toISOString())}&limit=1`).then((r) => setFresh(r.total)).catch(() => {});
    if (last) api.get<{ items: PublicVideo[] }>(`/videos/${encodeURIComponent(last.id)}/similar?limit=10`).then((r) => setBecause(r.items.filter((v) => !seen.some((x) => x.id === v.id)))).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {fresh > 0 && (
        <button type="button" onClick={onShowNewest} className="ripple mb-6 flex w-full items-center gap-3 rounded-2xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-left text-sm" data-testid="new-since">
          <Sparkles className="h-5 w-5 shrink-0 text-brand-300" />
          <span className="flex-1"><b className="text-brand-200">{fresh} new video{fresh === 1 ? '' : 's'}</b> since your last visit</span>
          <span className="font-semibold text-brand-300">Show</span>
        </button>
      )}
      {seen.length >= 2 && (
        <section className="mb-8" aria-labelledby="continue-title" data-testid="continue">
          <h2 id="continue-title" className="mb-3 flex items-center gap-2 text-lg font-bold"><History className="h-5 w-5 text-brand-400" /> Continue browsing</h2>
          <VideoRow items={seen.slice(0, 10) as unknown as PublicVideo[]} />
        </section>
      )}
      {last && !because && (
        <section className="mb-8" aria-hidden>
          <div className="skeleton mb-3 h-6 w-64 rounded-full" />
          <RowSkeleton />
        </section>
      )}
      {last && because && because.length >= 3 && (
        <section className="mb-8" aria-labelledby="because-title" data-testid="because">
          <h2 id="because-title" className="mb-3 line-clamp-1 text-lg font-bold">Because you watched <span className="text-brand-300">{last.title}</span></h2>
          <VideoRow items={because} />
        </section>
      )}
    </>
  );
}

/** A small round button that appears after scrolling a long way, to jump back to the top. */
function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 1600);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      data-testid="back-to-top"
      className="ripple fixed bottom-[calc(96px+env(safe-area-inset-bottom))] right-4 z-[110] flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-100 shadow-xl shadow-black/50 animate-dialog hover:bg-zinc-700 md:bottom-8"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

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
      className="relative mb-4 overflow-hidden rounded-3xl bg-zinc-900"
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
function Hero({ tags, slides, loading }: {
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
        <div className="skeleton mb-4 aspect-[4/3] max-h-[460px] w-full rounded-3xl min-[480px]:aspect-video lg:aspect-[21/9]" aria-hidden data-testid="hero-placeholder" />
      ))}
      <section className={cx(!show && 'rounded-3xl border border-zinc-900 bg-gradient-to-b from-zinc-900/70 to-zinc-950 px-5 py-10 text-center sm:py-14')}>
        {/* With the pictures showing, the headline is for search engines and screen readers; the page stays minimal. */}
        <h1 className={cx(show ? 'sr-only' : 'text-3xl font-extrabold tracking-tight sm:text-4xl')}>{settings.heroHeadline}</h1>
        {!show && settings.heroSubtext && <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">{settings.heroSubtext}</p>}
        {/* The top bar has the search on larger screens; phones get it here, under the pictures. */}
        <div className={cx(!show ? 'mx-auto mt-6 max-w-2xl text-left' : 'md:hidden')}>
          <SiteSearch variant="hero" />
        </div>
        {tags.length > 0 && (
          <div className={cx('scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0', !show && 'sm:justify-center', show && 'md:mt-0')}>
            {tags.map((t) => (
              <Link key={t} to={tagPath(t)} className="ripple flex h-8 shrink-0 items-center rounded-lg border border-zinc-800 px-3 text-xs text-zinc-300 transition-colors hover:bg-white/[.06] hover:text-white">
                #{t}
              </Link>
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
  const q = urlQ.trim(); // the search box sends people to /?q=…
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PublicVideo[]>([]);
  const [meta, setMeta] = useState({ total: 0, pages: 0, loose: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Lists use the smart order (good right now + what this visitor likes); "Show newest" switches to date order.
  const [order, setOrder] = useState<'smart' | 'newest'>('smart');
  const [liked] = useState(() => likedTags());
  useEffect(() => setPage(1), [q, category, tag, order]);

  const { data: categories } = useFetch(() => api.get<Category[]>('/categories'), []);
  const { data: trending } = useFetch(() => api.get<Trending>('/trending'), []);
  const { data: topicList } = useFetch(() => api.get<Topic[]>('/topics'), []);
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
    if (!q) {
      qs.set('sort', order);
      if (order === 'smart' && liked.length && category === 'all' && !tag) qs.set('for', liked.join(','));
    }
    api
      .get<Page>(`/videos?${qs}`)
      .then((r) => {
        if (!alive) return;
        setItems((prev) => (page === 1 ? r.items : [...prev, ...r.items]));
        setMeta({ total: r.total, pages: r.pages, loose: !!r.loose });
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [q, category, tag, page, order]);



  const cat = categories?.find((c) => c.slug === category);
  // Categories for the "More in …" rows: only ones that have videos in the list (so a row is never empty).
  // Rows between blocks: categories that have videos in this list, and topics from the tags, taking turns.
  const inList = new Set(items.map((v) => v.category).filter(Boolean));
  const catGroups: Group[] = (categories || []).filter((c) => c.slug !== category && inList.has(c.slug)).map((c) => ({ kind: 'category', key: c.slug, name: c.name }));
  const tagGroups: Group[] = (topicList || []).filter((t) => t.count >= 3).map((t) => ({ kind: 'tag', key: t.tag, name: t.label }));
  const others: Group[] = [];
  for (let i = 0; i < Math.max(catGroups.length, tagGroups.length); i++) {
    if (catGroups[i]) others.push(catGroups[i]);
    if (tagGroups[i]) others.push(tagGroups[i]);
  }

  // Load the next page a little before the visitor reaches the end.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || loading || page >= meta.pages || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setPage((p) => p + 1), { rootMargin: '900px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loading, page, meta.pages]);
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
      ) : q ? (
        // Search results: just the search bar (already holding the words), then the results.
        <div className="mx-auto mb-6 max-w-2xl"><SiteSearch variant="hero" /></div>
      ) : (
        <Hero tags={trending?.tags || []} slides={q ? [] : (trending?.items || []).filter((v) => v.thumbnailUrl).slice(0, 5)} loading={!q && !trending} />
      )}
      {/* Keep the Trending row's space while it loads, so the list below doesn't jump. */}
      {!q && !listing && !trending && (
        <section className="mb-8" aria-hidden data-testid="trending-placeholder">
          <div className="skeleton mb-4 h-6 w-32 rounded-full" />
          <RowSkeleton />
        </section>
      )}
      {!q && !listing && trending && trending.items.length > 0 && (
        <section id="trending" className="mb-8 scroll-mt-20" aria-labelledby="trending-title">
          <h2 id="trending-title" className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Flame className="h-5 w-5 text-brand-400" /> Trending now
          </h2>
          <VideoRow items={trending.items.slice(0, 10)} />
        </section>
      )}
      {/* Returning visitors: what's new, where they left off, more like what they watched. */}
      {!q && !listing && <ForYou onShowNewest={() => { setOrder('newest'); document.getElementById('list-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} />}
      {/* The first ad comes after something worth watching, not before it (home page only). */}
      {!q && !listing && <AdSlot slot="home_top" className="mb-8" />}
      {!q && !listing && <TopicsRow topics={topicList ?? undefined} />}

      <h2 className="mb-1 scroll-mt-24 text-lg font-bold" id="list-title">
        {q ? <>Results for “{q}” <span className="text-sm font-normal text-zinc-500">({meta.total})</span></> : order === 'newest' ? 'Newest' : listing ? 'Top picks' : liked.length ? 'Picked for you' : 'Fresh picks'}
      </h2>
      {/* The category chips stay just under the top bar while you scroll, so switching is always one tap away. */}
      {!!categories?.length && !tag && (
        <div className="sticky top-16 z-30 -mx-4 mb-4 bg-zinc-950/90 px-4 py-2.5 backdrop-blur-xl" data-testid="chip-bar">
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Categories">
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
                  category === c.slug ? 'border-transparent bg-brand-500/20 pl-2.5 font-semibold text-brand-200' : 'border-zinc-800 text-zinc-300 hover:bg-white/[.04]',
                )}
              >
                {category === c.slug && <Check className="h-4 w-4 animate-pop" strokeWidth={2.6} />}
                {c.name}
                {(c as any).count > 0 && <span className="text-xs font-normal opacity-60">{(c as any).count}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
      {(!categories?.length || tag) && <div className="mb-4" />}

      {q && meta.loose && !loading && (
        <p className="mb-4 rounded-xl bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300" data-testid="close-matches">
          No videos match every word of “{q}”. Here are the closest matches.
        </p>
      )}
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
          {/* The list in blocks of 12. Between blocks: a row from another category (on the home page) or an ad,
              so there is always something new a little further down. */}
          {chunk(items, 12).map((block, i) => {
            const extra = !q && !listing && others.length ? others[(i / 2) % others.length] : null;
            return (
              <Fragment key={i}>
                <VideoGrid items={block} insert={i === 0 && block.length > 5 ? { at: 5, node: <AdSlot key="infeed" slot="home_infeed" variant="card" /> } : undefined} />
                {(i < chunk(items, 12).length - 1 || page >= meta.pages) && (
                  i % 2 === 0 && extra ? <GroupRow key={`row-${extra.kind}-${extra.key}-${i}`} group={extra} /> : i % 2 === 1 ? <AdSlot slot="home_mid" className="my-10" /> : <div className="h-8" />
                )}
              </Fragment>
            );
          })}
          {/* Endless list: more videos load as you near the bottom */}
          {page < meta.pages ? (
            <div ref={sentinel} className="mt-6" data-testid="load-more">
              {loading ? <GridSkeleton count={4} /> : (
                <div className="flex justify-center"><Button variant="secondary" onClick={() => setPage((p) => p + 1)}>Show more</Button></div>
              )}
            </div>
          ) : (
            items.length > 12 && (
              <div className="mt-12 rounded-3xl border border-zinc-900 bg-zinc-900/40 p-6 text-center" data-testid="end-of-list">
                <p className="font-semibold">You’re all caught up</p>
                <p className="mt-1 text-sm text-zinc-400">Try another category:</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {(categories || []).filter((c) => c.slug !== category).map((c) => (
                    <Link key={c.slug} to={categoryPath(c.slug)} className="ripple rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-200 hover:bg-white/[.05]">{c.name}</Link>
                  ))}
                </div>
              </div>
            )
          )}
        </>
      )}
      <BackToTop />
    </div>
  );
}
