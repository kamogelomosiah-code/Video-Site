import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Play, SearchX, Film } from 'lucide-react';
import type { Category, MediaItem } from '../../shared/types';
import { api } from '../lib/api';
import { useSettings, usePageTitle } from '../lib/settings';
import { useFetch } from '../lib/utils';
import { AdSlot, MediaGrid, Thumb } from '../components/Media';
import { Alert, Button, Empty, Spinner, cx } from '../components/ui';

type Page = { items: MediaItem[]; total: number; page: number; pages: number };

function Hero({ item }: { item: MediaItem }) {
  const { settings } = useSettings();
  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl border border-zinc-900" data-testid="hero">
      <Thumb src={item.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />
      <div className="relative flex min-h-[320px] flex-col justify-end p-6 sm:min-h-[420px] sm:p-10">
        <span className="mb-3 w-fit rounded-full bg-brand-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-zinc-950">Featured</span>
        <h1 className="max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">{settings.heroHeadline || item.title}</h1>
        {(settings.heroSubtext || item.description) && (
          <p className="mt-3 line-clamp-2 max-w-2xl text-sm text-zinc-300 sm:text-base">{settings.heroSubtext || item.description}</p>
        )}
        <Link to={`/watch/${item.id}`} className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-brand-500 px-6 py-3 font-semibold text-zinc-950 hover:bg-brand-400">
          <Play className="h-5 w-5 fill-current" /> Watch now
        </Link>
      </div>
    </section>
  );
}

export default function Home() {
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const category = params.get('category') || 'all';
  const sort = params.get('sort') || 'newest';
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [meta, setMeta] = useState<{ total: number; pages: number }>({ total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  usePageTitle(q ? `Search: ${q}` : undefined);

  const { data: categories } = useFetch(() => api.get<Category[]>('/categories'), []);
  const { data: featured } = useFetch(
    async () => {
      if (settings.featuredMediaId) {
        try {
          return (await api.get<{ item: MediaItem }>(`/media/${settings.featuredMediaId}`)).item;
        } catch {
          /* fall back to the newest video */
        }
      }
      return (await api.get<Page>('/media?limit=1')).items[0] || null;
    },
    [settings.featuredMediaId],
  );

  useEffect(() => setPage(1), [q, category, sort]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ page: String(page), limit: '24', sort });
    if (q) qs.set('q', q);
    if (category !== 'all') qs.set('category', category);
    api
      .get<Page>(`/media?${qs}`)
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
  }, [q, category, sort, page]);

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <div>
      {!q && featured && <Hero item={featured} />}
      <AdSlot slot="home_top" className="mb-8" />

      {q ? (
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold">
            Results for “{q}” <span className="text-base font-normal text-zinc-500">({meta.total})</span>
          </h1>
          <Link to="/" className="text-sm text-brand-400 hover:underline">Clear search</Link>
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Categories">
            {[{ slug: 'all', name: 'All' }, ...(categories || [])].map((c) => (
              <button
                key={c.slug}
                type="button"
                role="tab"
                aria-selected={category === c.slug}
                onClick={() => setParam('category', c.slug, 'all')}
                className={cx(
                  'shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors',
                  category === c.slug ? 'border-brand-500 bg-brand-500 font-semibold text-zinc-950' : 'border-zinc-800 text-zinc-300 hover:border-zinc-600',
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setParam('sort', e.target.value, 'newest')}
            aria-label="Sort videos"
            className="w-fit rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="popular">Most viewed</option>
            <option value="liked">Most liked</option>
          </select>
        </div>
      )}

      {error && <Alert>{error}</Alert>}
      {loading && page === 1 ? (
        <Spinner />
      ) : items.length === 0 && !error ? (
        q ? (
          <Empty title="No videos match your search" icon={<SearchX className="h-10 w-10" />}>Try different words or browse the categories.</Empty>
        ) : (
          <Empty title="No videos here yet" icon={<Film className="h-10 w-10" />}>
            {settings.siteName} is adding new content — check back soon.
          </Empty>
        )
      ) : (
        <>
          <MediaGrid items={items.slice(0, 8)} />
          {items.length > 8 && (
            <>
              <AdSlot slot="home_mid" className="my-8" />
              <MediaGrid items={items.slice(8)} />
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
