import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckSquare, ChevronDown, Download, ExternalLink, FileUp, Globe, MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, Star, Trash2 } from 'lucide-react';
import type { Category } from '../../shared/types';
import type { Focus } from '../../shared/image';
import { api, tokenStore } from '../lib/api';
import { usePageTitle } from '../lib/settings';
import { formatViews, useDebounced, useFetch } from '../lib/utils';
import { Thumb } from '../components/Media';
import { Alert, Badge, Button, Empty, Field, FocusPicker, ImageInput, Input, Modal, Select, Spinner, Textarea, Toggle, cx, useToast } from '../components/ui';

type Row = {
  id: string; title: string; externalUrl: string; thumbnailUrl: string; thumbFocus?: Focus | null; description: string; category: string;
  tags: string[]; duration: string; creatorName: string; views: number; published: boolean; featured: boolean; createdAt?: string;
};
type Page = { items: Row[]; total: number; page: number; pages: number };

const EMPTY: Partial<Row> = { title: '', externalUrl: '', thumbnailUrl: '', description: '', category: '', tags: [], duration: '', creatorName: '', published: true, featured: false };

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

function VideoForm({ initial, categories, onDone, onDelete }: { initial: Partial<Row>; categories: Category[]; onDone: () => void; onDelete?: () => void }) {
  const { toast } = useToast();
  const [v, setV] = useState<any>({ ...initial, tags: (initial.tags || []).join(', ') });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, val: any) => setV((x: any) => ({ ...x, [k]: val }));
  const isNew = !initial.id;
  const [fetching, setFetching] = useState(false);
  const lastFetched = useRef('');   // the last link we read, so leaving the field twice doesn't read it twice
  // The form starts with just the essentials; the rest is one tap away (open when editing a video that has them).
  const [more, setMore] = useState(() => !!(initial.description || initial.creatorName || initial.duration));

  /** Reads the link's page and fills in any empty fields. */
  const fetchDetails = async (url: string = v.externalUrl) => {
    setFetching(true);
    setError('');
    try {
      const { results } = await api.post<{ results: any[] }>('/admin/videos/scrape', { urls: [url] });
      const r = results[0];
      if (!r?.ok) throw new Error(r?.error || 'No details found');
      const d = r.videos[0];
      const dur = typeof d.duration === 'number' ? `${Math.floor(d.duration / 60)}:${String(d.duration % 60).padStart(2, '0')}` : d.duration || '';
      setV((x: any) => ({
        ...x,
        title: x.title || d.title || '',
        thumbnailUrl: x.thumbnailUrl || d.thumbnail || '',
        description: x.description || d.description || '',
        duration: x.duration || dur,
        creatorName: x.creatorName || d.creator || '',
        tags: x.tags || (d.tags || []).join(', '),
      }));
      if (d.description || d.creator || dur) setMore(true); // show what was found
      toast('Details filled in from the page');
    } catch (x: any) {
      setError(`Couldn't fetch details: ${x.message}`);
    } finally {
      setFetching(false);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = { ...v, tags: String(v.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean) };
    try {
      if (isNew) await api.post('/admin/videos', body);
      else await api.put(`/admin/videos/${initial.id}`, body);
      toast(isNew ? 'Video added' : 'Video saved');
      onDone();
    } catch (x: any) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Link to the original video *" hint={isNew ? 'Paste the address and the details fill in by themselves.' : 'Visitors are sent here when they click the video.'}>
        <div className="flex gap-2">
          <Input
            value={v.externalUrl}
            onChange={(e) => set('externalUrl', e.target.value)}
            onPaste={(e) => {
              // Pasting a link into a new video reads the page straight away.
              const t = e.clipboardData.getData('text').trim();
              if (isNew && !v.title && /^https?:\/\//i.test(t)) setTimeout(() => fetchDetails(t), 0);
            }}
            onBlur={(e) => {
              // Typed or dictated links (and phone keyboards that don't fire paste) read the page when you leave the field.
              const t = e.currentTarget.value.trim();
              if (isNew && !v.title && /^https?:\/\/[^\s/]+\.[^\s]+/i.test(t) && t !== lastFetched.current) {
                lastFetched.current = t;
                fetchDetails(t);
              }
            }}
            placeholder="https://…"
            inputMode="url"
            autoCapitalize="off"
            required
          />
          <Button variant="secondary" className="shrink-0" loading={fetching} disabled={!v.externalUrl?.trim()} onClick={() => fetchDetails()}>
            {!fetching && <Globe className="h-4 w-4" />} Fetch details
          </Button>
        </div>
      </Field>
      <Field label="Title *">
        <Input value={v.title} onChange={(e) => set('title', e.target.value)} required maxLength={200} />
      </Field>
      <Field label="Thumbnail" group>
        <ImageInput value={v.thumbnailUrl} onChange={(url) => set('thumbnailUrl', url)} label="Thumbnail" />
      </Field>
      {v.thumbnailUrl && (
        <Field label="Thumbnail crop" hint="Drag to choose the part that shows on the video card, then zoom if you want it closer." group>
          <FocusPicker src={v.thumbnailUrl} value={v.thumbFocus} onChange={(f) => set('thumbFocus', f)} ratio={16 / 9} label="Thumbnail" />
        </Field>
      )}
      {/* The essentials: where it goes, and how it's found */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          <Select value={v.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">— None —</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Tags" hint="Separate with commas — shown on the video page">
          <Input value={v.tags} onChange={(e) => set('tags', e.target.value)} placeholder="funny, live, football" />
        </Field>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle label="Show on the site" hint="Off = hidden draft" checked={!!v.published} onChange={(x) => set('published', x)} />
        <Toggle label="Trending" hint="Pinned to Trending and the big pictures at the top" checked={!!v.featured} onChange={(x) => set('featured', x)} />
      </div>

      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        aria-expanded={more}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-800 px-3.5 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-900"
      >
        More details <span className="ml-1 mr-auto text-xs font-normal text-zinc-500">duration, creator, description</span><ChevronDown className={cx('h-4 w-4 transition-transform', more && 'rotate-180')} />
      </button>
      {more && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duration" hint="e.g. 12:30">
              <Input value={v.duration} onChange={(e) => set('duration', e.target.value)} />
            </Field>
            <Field label="Creator">
              <Input value={v.creatorName} onChange={(e) => set('creatorName', e.target.value)} />
            </Field>
          </div>
          <Field label="Description">
            <Textarea rows={3} value={v.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
      )}

      {error && <Alert>{error}</Alert>}
      {/* Stays in view while scrolling, so saving is always one tap away */}
      <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center gap-2 border-t border-zinc-800 bg-zinc-950/95 px-5 py-3 backdrop-blur">
        {onDelete && (
          <Button variant="danger" onClick={onDelete} aria-label="Delete this video"><Trash2 className="h-4 w-4" /></Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={onDone}>Cancel</Button>
          <Button type="submit" loading={busy}>{isNew ? 'Add video' : 'Save'}</Button>
        </div>
      </div>
    </form>
  );
}

export default function VideosAdmin() {
  usePageTitle('Admin · Videos');
  const { toast, confirm } = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all';
  const category = params.get('category') || 'all';
  const sort = params.get('sort') || 'newest';
  const [box, setBox] = useState(params.get('q') || '');
  const q = useDebounced(box, 300).trim();
  const [page, setPage] = useState(1);
  const limit = Number(params.get('limit')) || 25;
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [bulkCat, setBulkCat] = useState('');
  const [selectMode, setSelectMode] = useState(false); // phones: checkboxes only appear when asked for
  const [showFilters, setShowFilters] = useState(false);
  const [busyBulk, setBusyBulk] = useState(false);
  const [version, setVersion] = useState(0);
  const { data: categories } = useFetch(() => api.get<Category[]>('/admin/categories'), []);

  useEffect(() => setPage(1), [q, status, category, sort, limit]);
  useEffect(() => {
    if (params.get('new')) {
      setEditing({ ...EMPTY });
      params.delete('new');
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Clear the selection whenever the list changes meaning.
  useEffect(() => {
    setSelected(new Set());
    setAllMatching(false);
  }, [q, status, category, sort, page, limit]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ page: String(page), limit: String(limit), sort, status, category });
    if (q) qs.set('q', q);
    api
      .get<Page>(`/admin/videos?${qs}`)
      .then((r) => alive && setData(r))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [q, status, category, sort, page, limit, version]);

  const reload = () => setVersion((n) => n + 1);
  const setFilter = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const ids = data?.items.map((r) => r.id) || [];
  const allOnPage = ids.length > 0 && ids.every((id) => selected.has(id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const selectionCount = allMatching ? data?.total || 0 : selected.size;
  const bulk = async (action: string, extra: Record<string, unknown> = {}) => {
    if (action === 'delete') {
      const ok = await confirm(`Permanently delete ${selectionCount.toLocaleString()} video(s)? This can't be undone.`, { confirmLabel: 'Delete' });
      if (!ok) return;
    }
    setBusyBulk(true);
    const body = allMatching
      ? { action, filter: { q, status, category }, expectedCount: data?.total, ...extra }
      : { action, ids: [...selected], ...extra };
    try {
      const r = await api.post<{ count: number }>('/admin/videos/bulk', body);
      toast(`${r.count.toLocaleString()} video(s) updated`);
      reload();
    } catch (x: any) {
      toast(x.message, 'error');
      if (x.status === 409) reload();
    } finally {
      setBusyBulk(false);
    }
  };

  /** One-click show/hide or Trending from the row itself. */
  const quick = async (row: Row, action: 'publish' | 'unpublish' | 'pin' | 'unpin') => {
    try {
      await api.post('/admin/videos/bulk', { action, ids: [row.id] });
      setData((d) => d && { ...d, items: d.items.map((x) => (x.id === row.id ? { ...x, published: action === 'publish' ? true : action === 'unpublish' ? false : x.published, featured: action === 'pin' ? true : action === 'unpin' ? false : x.featured } : x)) });
    } catch (x: any) {
      toast(x.message, 'error');
    }
  };

  const remove = async (row: Row) => {
    if (!(await confirm(`Delete “${row.title}”?`, { confirmLabel: 'Delete' }))) return;
    // Disappears at once; comes back (with the error) only if the server refuses.
    setData((d) => d && { ...d, items: d.items.filter((x) => x.id !== row.id), total: Math.max(0, d.total - 1) });
    try {
      await api.del(`/admin/videos/${row.id}`);
      toast('Video deleted');
    } catch (x: any) {
      toast(x.message, 'error');
      reload();
    }
  };

  const exportAll = async () => {
    try {
      const token = tokenStore.get();
      const res = await fetch('/api/admin/videos/export', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `videos-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (x: any) {
      toast(x.message, 'error');
    }
  };

  const filtersActive = !!q || status !== 'all' || category !== 'all';

  const closeMenu = (e: React.MouseEvent<HTMLElement>) => e.currentTarget.closest('details')?.removeAttribute('open');
  const STATUS_CHIPS = [['all', 'All'], ['published', 'Shown'], ['draft', 'Hidden'], ['pinned', 'Trending']] as const;
  const moreFiltersActive = category !== 'all' || sort !== 'newest';

  return (
    <div className={cx('space-y-4', selectionCount > 0 && 'pb-24 md:pb-0')}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Videos</h1>
          <p className="text-sm text-zinc-400">{data ? `${data.total.toLocaleString()} video${data.total === 1 ? '' : 's'}${filtersActive ? ' match' : ''}` : ' '}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden flex-wrap gap-2 md:flex">
            <Button variant="secondary" onClick={exportAll}><Download className="h-4 w-4" /> Export</Button>
            <Link to="/admin/videos/scrape" className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm hover:bg-zinc-700">
              <Globe className="h-4 w-4" /> Add from URL
            </Link>
            <Link to="/admin/videos/import" className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm hover:bg-zinc-700">
              <FileUp className="h-4 w-4" /> Import file
            </Link>
          </div>
          {/* Phones: the less common actions live in one small menu */}
          <details className="relative md:hidden">
            <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 [&::-webkit-details-marker]:hidden" aria-label="More actions">
              <MoreHorizontal className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-zinc-800 bg-zinc-950 p-1 shadow-2xl">
              <Link to="/admin/videos/scrape" className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm hover:bg-zinc-900"><Globe className="h-4 w-4" /> Add from URL</Link>
              <Link to="/admin/videos/import" className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm hover:bg-zinc-900"><FileUp className="h-4 w-4" /> Import file</Link>
              <button type="button" onClick={(e) => { closeMenu(e); exportAll(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm hover:bg-zinc-900"><Download className="h-4 w-4" /> Export all</button>
            </div>
          </details>
          <button
            type="button"
            onClick={() => { setSelectMode((m) => !m); setSelected(new Set()); setAllMatching(false); }}
            aria-pressed={selectMode}
            data-testid="select-mode"
            className={cx('flex h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium md:hidden', selectMode ? 'border-brand-500 bg-brand-500 text-zinc-950' : 'border-zinc-700 bg-zinc-800 text-zinc-200')}
          >
            {selectMode ? 'Done' : <><CheckSquare className="h-4 w-4" /> Select</>}
          </button>
          <Button onClick={() => setEditing({ ...EMPTY })} aria-label="Add video"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add video</span><span className="sm:hidden">Add</span></Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input value={box} onChange={(e) => setBox(e.target.value)} placeholder="Search videos…" className="pl-9" aria-label="Search videos" type="search" />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((x) => !x)}
            aria-expanded={showFilters}
            aria-label="More filters"
            className={cx('relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border md:hidden', showFilters ? 'border-brand-500 text-brand-400' : 'border-zinc-700 bg-zinc-800')}
          >
            <SlidersHorizontal className="h-5 w-5" />
            {moreFiltersActive && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500" />}
          </button>
        </div>
        <Select value={status} onChange={(e) => setFilter('status', e.target.value, 'all')} className="hidden md:block lg:w-40" aria-label="Status">
          <option value="all">All statuses</option>
          <option value="published">Shown</option>
          <option value="draft">Hidden</option>
          <option value="pinned">Trending</option>
        </Select>
        <Select value={category} onChange={(e) => setFilter('category', e.target.value, 'all')} className="hidden md:block lg:w-48" aria-label="Category">
          <option value="all">All categories</option>
          <option value="__none">No category</option>
          {(categories || []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </Select>
        <Select value={sort} onChange={(e) => setFilter('sort', e.target.value, 'newest')} className="hidden md:block lg:w-40" aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="views">Most viewed</option>
          <option value="title">Title A–Z</option>
        </Select>
      </div>

      {/* Phones: one-tap status chips (Select for bulk actions is in the header) */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden" role="group" aria-label="Show videos">
        {STATUS_CHIPS.map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setFilter('status', val, 'all')}
            aria-pressed={status === val}
            className={cx('h-10 shrink-0 rounded-full border px-4 text-sm', status === val ? 'border-brand-500 bg-brand-500/15 text-brand-300' : 'border-zinc-800 bg-zinc-950 text-zinc-300')}
          >
            {label}
          </button>
        ))}
      </div>
      {showFilters && (
        <div className="grid grid-cols-2 gap-2 md:hidden">
          <Select value={category} onChange={(e) => setFilter('category', e.target.value, 'all')} aria-label="Filter by category">
            <option value="all">All categories</option>
            <option value="__none">No category</option>
            {(categories || []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
          <Select value={sort} onChange={(e) => setFilter('sort', e.target.value, 'newest')} aria-label="Sort order">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="views">Most viewed</option>
            <option value="title">Title A–Z</option>
          </Select>
        </div>
      )}

      {selectionCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 mb-0 flex flex-wrap items-center gap-2 border-t border-brand-500/40 bg-zinc-950 p-3 shadow-2xl md:sticky md:inset-x-auto md:bottom-auto md:top-14 md:mb-4 md:rounded-xl md:border md:shadow-lg lg:top-2 [&>*]:whitespace-nowrap" data-testid="bulk-bar">
          <span className="text-sm font-medium">{selectionCount.toLocaleString()} selected</span>
          {/* Delete sits next to the count so it is always visible on a phone (the bar wraps, it never scrolls off-screen). */}
          <Button variant="danger" loading={busyBulk} onClick={() => bulk('delete')}><Trash2 className="h-4 w-4" /> Delete</Button>
          <Button variant="secondary" loading={busyBulk} onClick={() => bulk('publish')}>Show</Button>
          <Button variant="secondary" loading={busyBulk} onClick={() => bulk('unpublish')}>Hide</Button>
          <details className="relative md:hidden">
            <summary className="flex h-11 cursor-pointer list-none items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm [&::-webkit-details-marker]:hidden">More <ChevronDown className="h-4 w-4" /></summary>
            <div className="absolute bottom-full left-0 z-40 mb-2 w-56 rounded-xl border border-zinc-800 bg-zinc-950 p-1 shadow-2xl">
              <button type="button" className="w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-zinc-900" onClick={(e) => { closeMenu(e); bulk('pin'); }}>Add to Trending</button>
              <button type="button" className="w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-zinc-900" onClick={(e) => { closeMenu(e); bulk('unpin'); }}>Remove from Trending</button>
              {(categories || []).map((c) => (
                <button key={c.slug} type="button" className="w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-zinc-900" onClick={(e) => { closeMenu(e); bulk('category', { category: c.slug }); }}>Move to {c.name}</button>
              ))}
            </div>
          </details>
          <span className="hidden gap-2 md:flex">
            <Button variant="secondary" loading={busyBulk} onClick={() => bulk('pin')}>Trending</Button>
            <Button variant="secondary" loading={busyBulk} onClick={() => bulk('unpin')}>Remove from Trending</Button>
          </span>
          <span className="hidden items-center gap-1 md:flex">
            <Select value={bulkCat} onChange={(e) => setBulkCat(e.target.value)} className="w-44" aria-label="Move to category">
              <option value="">Move to category…</option>
              <option value="__none">No category</option>
              {(categories || []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </Select>
            <Button variant="secondary" disabled={!bulkCat} loading={busyBulk} onClick={() => { bulk('category', { category: bulkCat === '__none' ? '' : bulkCat }); setBulkCat(''); }}>Move</Button>
          </span>
          <Button variant="ghost" className="md:ml-auto" onClick={() => { setSelected(new Set()); setAllMatching(false); }}>Clear</Button>
        </div>
      )}

      {data && allOnPage && !allMatching && data.total > ids.length && (
        <Alert kind="info">
          All {ids.length} on this page are selected.{' '}
          <button type="button" className="font-semibold underline" onClick={() => setAllMatching(true)}>
            Select all {data.total.toLocaleString()} matching videos
          </button>
        </Alert>
      )}
      {allMatching && (
        <Alert kind="info">
          All {data?.total.toLocaleString()} matching videos are selected.{' '}
          <button type="button" className="font-semibold underline" onClick={() => setAllMatching(false)}>Undo</button>
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}

      {loading && !data ? (
        <Spinner />
      ) : !data?.items.length ? (
        <Empty title={filtersActive ? 'No videos match these filters' : 'No videos yet'}>
          {!filtersActive && (
            <div className="mt-4 flex justify-center gap-2">
              <Link to="/admin/videos/import" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-zinc-950">Import a file</Link>
              <Button variant="secondary" onClick={() => setEditing({ ...EMPTY })}>Add one video</Button>
            </div>
          )}
        </Empty>
      ) : (
        <>
        {/* Phones: tap a card to edit it. Show/Hide and Trending are one tap on the card. */}
        <ul className={cx('space-y-2 md:hidden', loading && 'opacity-60')} data-testid="admin-cards">
          {selectMode && (
            <li className="flex items-center justify-between px-1 text-sm text-zinc-400">
              <span>Tap videos to select</span>
              <span className="flex gap-3">
                <button type="button" className="font-medium text-brand-400" onClick={() => setSelected(new Set(ids))}>This page</button>
                {data.total > ids.length && <button type="button" className="font-medium text-brand-400" onClick={() => { setSelected(new Set(ids)); setAllMatching(true); }}>All {data.total.toLocaleString()}</button>}
              </span>
            </li>
          )}
          {data.items.map((r) => {
            const on = selected.has(r.id) || allMatching;
            return (
              <li key={r.id} className={cx('overflow-hidden rounded-xl border', on ? 'border-brand-500/60 bg-brand-500/5' : 'border-zinc-900 bg-zinc-950')} data-testid="admin-card">
                <button
                  type="button"
                  onClick={() => (selectMode ? toggle(r.id) : setEditing(r))}
                  className="flex w-full items-center gap-3 p-3 text-left active:bg-zinc-900"
                  aria-label={selectMode ? `Select ${r.title}` : `Edit ${r.title}`}
                >
                  {selectMode && (
                    <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-brand-500 bg-brand-500 text-zinc-950' : 'border-zinc-600')} aria-hidden>
                      {on && <span className="text-xs font-bold">✓</span>}
                    </span>
                  )}
                  <Thumb src={r.thumbnailUrl} focus={r.thumbFocus} alt="" className="h-16 w-28 shrink-0 rounded-md" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[15px] font-medium leading-snug">{r.title}</span>
                    <span className="mt-1 block truncate text-xs text-zinc-500">{[r.creatorName, r.duration, `${formatViews(r.views)} ${r.views === 1 ? 'view' : 'views'}`].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
                {!selectMode && (
                  <div className="flex items-center justify-between border-t border-zinc-900 pl-3 pr-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={r.published}
                      onClick={() => quick(r, r.published ? 'unpublish' : 'publish')}
                      className="flex min-h-11 items-center gap-2.5 text-sm"
                      aria-label={`${r.published ? 'Hide' : 'Show'} ${r.title}`}
                    >
                      <span className={cx('relative h-6 w-11 rounded-full transition-colors', r.published ? 'bg-brand-500' : 'bg-zinc-700')} aria-hidden>
                        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', r.published ? 'left-[22px]' : 'left-0.5')} />
                      </span>
                      <span className={r.published ? 'text-zinc-200' : 'text-zinc-500'}>{r.published ? 'Shown' : 'Hidden'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => quick(r, r.featured ? 'unpin' : 'pin')}
                      className={cx('flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm', r.featured ? 'text-brand-400' : 'text-zinc-500')}
                      aria-pressed={r.featured}
                      aria-label={r.featured ? 'Remove from Trending' : 'Add to Trending'}
                    >
                      <Star className={cx('h-5 w-5', r.featured && 'fill-current')} /> Trending
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className={cx('hidden overflow-x-auto rounded-xl border border-zinc-900 md:block', loading && 'opacity-60')}>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-zinc-900/70 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" aria-label="Select all on this page" className="accent-amber-500" checked={allOnPage} onChange={(e) => {
                    setAllMatching(false);
                    setSelected(e.target.checked ? new Set(ids) : new Set());
                  }} />
                </th>
                <th className="px-4 py-3 font-medium">Video</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Views</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {data.items.map((r) => {
                const catName = (categories || []).find((c) => c.slug === r.category)?.name || r.category || '—';
                return (
                  <tr key={r.id} className={selected.has(r.id) || allMatching ? 'bg-brand-500/5' : 'hover:bg-zinc-900/40'} data-testid="admin-row">
                    <td className="px-4 py-3">
                      <input type="checkbox" aria-label={`Select ${r.title}`} className="accent-amber-500" checked={allMatching || selected.has(r.id)} onChange={() => toggle(r.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Thumb src={r.thumbnailUrl} focus={r.thumbFocus} alt="" className="h-12 w-20 shrink-0 rounded-md" />
                        <div className="min-w-0">
                          <p className="line-clamp-1 font-medium">{r.title}</p>
                          <p className="flex items-center gap-1 truncate text-xs text-zinc-500">
                            {r.creatorName && <span>{r.creatorName} · </span>}
                            <a href={r.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-zinc-300">
                              {hostOf(r.externalUrl)} <ExternalLink className="h-3 w-3" />
                            </a>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{catName}</td>
                    <td className="px-4 py-3 text-zinc-400">{formatViews(r.views)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" onClick={() => quick(r, r.published ? 'unpublish' : 'publish')} title={r.published ? 'Click to hide' : 'Click to show'} aria-label={r.published ? `Hide ${r.title}` : `Show ${r.title}`}>
                          <Badge on={r.published} yes="Shown" no="Hidden" />
                        </button>
                        {r.featured && <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2 py-0.5 text-xs text-brand-300"><Star className="h-3 w-3 fill-current" /> Trending</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="px-2.5" onClick={() => quick(r, r.featured ? 'unpin' : 'pin')} aria-label={r.featured ? 'Remove from Trending' : 'Add to Trending'} title={r.featured ? 'Remove from Trending' : 'Add to Trending'}>
                          <Star className={cx('h-4 w-4', r.featured && 'fill-brand-400 text-brand-400')} />
                        </Button>
                        <Button variant="ghost" className="px-2.5" onClick={() => setEditing(r)} aria-label="Edit video"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" className="px-2.5 hover:text-red-400" onClick={() => remove(r)} aria-label="Delete video"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {data && data.pages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Show</span>
            <Select value={String(limit)} onChange={(e) => setFilter('limit', e.target.value, '25')} className="w-24" aria-label="Rows per page">
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-zinc-400">Page {data.page} of {data.pages}</span>
            <Button variant="secondary" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit video' : 'Add video'} wide sheet>
        {editing && (
          <VideoForm
            key={editing.id || 'new'}
            initial={editing}
            categories={categories || []}
            onDelete={editing.id ? () => { const row = editing as Row; setEditing(null); remove(row); } : undefined}
            onDone={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
