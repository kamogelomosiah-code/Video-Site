import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SearchX, Film, Flame } from 'lucide-react';
import type { Category, PublicVideo } from '../../shared/types';
import { api } from '../lib/api';
import { useSettings, usePageTitle } from '../lib/settings';
import { useDebounced, useFetch } from '../lib/utils';
import { AdSlot, VideoGrid } from '../components/Media';
import { Alert, Button, Empty, Spinner, cx } from '../components/ui';

type Page = { items: PublicVideo[]; total: number; page: number; pages: number };
type Trending = { items: PublicVideo[]; tags: string[] };

/** The search hero: a big search box and quick suggestions from the trending tags. */
function Hero({ value, onSubmit, onChange, tags }: {
  value: string;
  onSubmit: (e: FormEvent) => void;
  onChange: (v: string) => void;
  tags: string[];
}) {
  const { settings } = useSettings();
  return (
    <section className="mb-8 rounded-2xl border border-zinc-900 bg-gradient-to-b from-zinc-900/70 to-zinc-950 px-5 py-10 text-center sm:py-14" data-testid="hero">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{settings.heroHeadline}</h1>
      {settings.heroSubtext && <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">{settings.heroSubtext}</p>}
      <form onSubmit={onSubmit} role="search" className="mx-auto mt-6 flex max-w-2xl gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search videos…"
            aria-label="Search videos"
            className="w-full rounded-full border border-zinc-800 bg-zinc-900 py-3.5 pl-12 pr-4 text-base placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <Button type="submit" className="rounded-full px-6">Search</Button>
      </form>
      {tags.length > 0 && (
        <div className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
          {tags.map((t) => (
            <button key={t} type="button" onClick={() => onChange(t)} className="rounded-full bg-zinc-800/80 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white">
              {t}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const urlQ = params.get('q') || '';
  const category = params.get('category') || 'all';
  const [box, setBox] = useState(urlQ);
  const q = useDebounced(box, 350).trim();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PublicVideo[]>([]);
  const [meta, setMeta] = useState({ total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  usePageTitle(q ? `Search: ${q}` : undefined);

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
  useEffect(() => setPage(1), [q, category]);

  const { data: categories } = useFetch(() => api.get<Category[]>('/categories'), []);
  const { data: trending } = useFetch(() => api.get<Trending>('/trending'), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ page: String(page), limit: '24' });
    if (q) qs.set('q', q);
    if (category !== 'all') qs.set('category', category);
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
  }, [q, category, page]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setParams(box.trim() ? { q: box.trim() } : {}, { replace: true });
  };

  const pickCategory = (slug: string) => {
    const next = new URLSearchParams(params);
    if (slug === 'all') next.delete('category');
    else next.set('category', slug);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <Hero value={box} onChange={setBox} onSubmit={submit} tags={trending?.tags || []} />
      <AdSlot slot="home_top" className="mb-8" />

      {!q && trending && trending.items.length > 0 && (
        <section className="mb-10" aria-labelledby="trending-title">
          <h2 id="trending-title" className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Flame className="h-5 w-5 text-brand-400" /> Trending
          </h2>
          <VideoGrid items={trending.items.slice(0, 5)} />
        </section>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">
          {q ? <>Results for “{q}” <span className="text-sm font-normal text-zinc-500">({meta.total})</span></> : 'All videos'}
        </h2>
        {!!categories?.length && (
          <div className="scrollbar-none -mx-4 flex max-w-full gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Categories">
            {[{ slug: 'all', name: 'All' }, ...categories].map((c) => (
              <button
                key={c.slug}
                type="button"
                role="tab"
                aria-selected={category === c.slug}
                onClick={() => pickCategory(c.slug)}
                className={cx(
                  'shrink-0 rounded-full border px-3.5 py-1 text-sm transition-colors',
                  category === c.slug ? 'border-brand-500 bg-brand-500 font-semibold text-zinc-950' : 'border-zinc-800 text-zinc-300 hover:border-zinc-600',
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <Alert>{error}</Alert>}
      {loading && page === 1 ? (
        <Spinner />
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
