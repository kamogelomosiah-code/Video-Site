import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, ExternalLink, FileUp, Globe, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import type { Category } from '../../shared/types';
import { api, tokenStore } from '../lib/api';
import { usePageTitle } from '../lib/settings';
import { formatViews, useDebounced, useFetch } from '../lib/utils';
import { Thumb } from '../components/Media';
import { Alert, Badge, Button, Empty, Field, ImageInput, Input, Modal, Select, Spinner, Textarea, Toggle, cx, useToast } from '../components/ui';

type Row = {
  id: string; title: string; externalUrl: string; thumbnailUrl: string; description: string; category: string;
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

function VideoForm({ initial, categories, onDone }: { initial: Partial<Row>; categories: Category[]; onDone: () => void }) {
  const { toast } = useToast();
  const [v, setV] = useState<any>({ ...initial, tags: (initial.tags || []).join(', ') });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, val: any) => setV((x: any) => ({ ...x, [k]: val }));
  const isNew = !initial.id;
  const [fetching, setFetching] = useState(false);

  /** Reads the link's page and fills in any empty fields. */
  const fetchDetails = async () => {
    setFetching(true);
    setError('');
    try {
      const { results } = await api.post<{ results: any[] }>('/admin/videos/scrape', { urls: [v.externalUrl] });
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
      <Field label="Title *">
        <Input value={v.title} onChange={(e) => set('title', e.target.value)} required maxLength={200} />
      </Field>
      <Field label="Link to the original video *" hint="Visitors are sent here when they click the video. Paste the full address.">
        <div className="flex gap-2">
          <Input value={v.externalUrl} onChange={(e) => set('externalUrl', e.target.value)} placeholder="https://…" required />
          <Button variant="secondary" className="shrink-0" loading={fetching} disabled={!v.externalUrl?.trim()} onClick={fetchDetails}>
            {!fetching && <Globe className="h-4 w-4" />} Fetch details
          </Button>
        </div>
      </Field>
      <Field label="Thumbnail" group>
        <ImageInput value={v.thumbnailUrl} onChange={(url) => set('thumbnailUrl', url)} label="Thumbnail" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          <Select value={v.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">— None —</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Duration" hint="e.g. 12:30">
          <Input value={v.duration} onChange={(e) => set('duration', e.target.value)} />
        </Field>
        <Field label="Creator">
          <Input value={v.creatorName} onChange={(e) => set('creatorName', e.target.value)} />
        </Field>
        <Field label="Tags" hint="Separate with commas">
          <Input value={v.tags} onChange={(e) => set('tags', e.target.value)} />
        </Field>
      </div>
      <Field label="Description">
        <Textarea rows={3} value={v.description} onChange={(e) => set('description', e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle label="Show on the site" hint="Off = hidden draft" checked={!!v.published} onChange={(x) => set('published', x)} />
        <Toggle label="Trending" hint="Shows at the top of Trending" checked={!!v.featured} onChange={(x) => set('featured', x)} />
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2 border-t border-zinc-900 pt-4">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={busy}>{isNew ? 'Add video' : 'Save changes'}</Button>
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
    try {
      await api.del(`/admin/videos/${row.id}`);
      toast('Video deleted');
      reload();
    } catch (x: any) {
      toast(x.message, 'error');
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Videos</h1>
          <p className="text-sm text-zinc-400">{data ? `${data.total.toLocaleString()} video${data.total === 1 ? '' : 's'}${filtersActive ? ' match' : ''}` : ' '}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportAll}><Download className="h-4 w-4" /> Export</Button>
          <Link to="/admin/videos/scrape" className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm hover:bg-zinc-700">
            <Globe className="h-4 w-4" /> Add from URL
          </Link>
          <Link to="/admin/videos/import" className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm hover:bg-zinc-700">
            <FileUp className="h-4 w-4" /> Import file
          </Link>
          <Button onClick={() => setEditing({ ...EMPTY })}><Plus className="h-4 w-4" /> Add video</Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input value={box} onChange={(e) => setBox(e.target.value)} placeholder="Search title, tags, creator, description…" className="pl-9" aria-label="Search videos" />
        </div>
        <Select value={status} onChange={(e) => setFilter('status', e.target.value, 'all')} className="lg:w-40" aria-label="Status">
          <option value="all">All statuses</option>
          <option value="published">Shown</option>
          <option value="draft">Hidden</option>
          <option value="pinned">Trending</option>
        </Select>
        <Select value={category} onChange={(e) => setFilter('category', e.target.value, 'all')} className="lg:w-48" aria-label="Category">
          <option value="all">All categories</option>
          <option value="__none">No category</option>
          {(categories || []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </Select>
        <Select value={sort} onChange={(e) => setFilter('sort', e.target.value, 'newest')} className="lg:w-40" aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="views">Most viewed</option>
          <option value="title">Title A–Z</option>
        </Select>
      </div>

      {selectionCount > 0 && (
        <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-brand-500/40 bg-zinc-950 p-3 shadow-lg lg:top-2" data-testid="bulk-bar">
          <span className="text-sm font-medium">{selectionCount.toLocaleString()} selected</span>
          <Button variant="secondary" loading={busyBulk} onClick={() => bulk('publish')}>Show</Button>
          <Button variant="secondary" loading={busyBulk} onClick={() => bulk('unpublish')}>Hide</Button>
          <Button variant="secondary" loading={busyBulk} onClick={() => bulk('pin')}>Trending</Button>
          <Button variant="secondary" loading={busyBulk} onClick={() => bulk('unpin')}>Remove from Trending</Button>
          <span className="flex items-center gap-1">
            <Select value={bulkCat} onChange={(e) => setBulkCat(e.target.value)} className="w-44" aria-label="Move to category">
              <option value="">Move to category…</option>
              <option value="__none">No category</option>
              {(categories || []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </Select>
            <Button variant="secondary" disabled={!bulkCat} loading={busyBulk} onClick={() => { bulk('category', { category: bulkCat === '__none' ? '' : bulkCat }); setBulkCat(''); }}>Move</Button>
          </span>
          <Button variant="danger" loading={busyBulk} onClick={() => bulk('delete')}><Trash2 className="h-4 w-4" /> Delete</Button>
          <Button variant="ghost" className="ml-auto" onClick={() => { setSelected(new Set()); setAllMatching(false); }}>Clear selection</Button>
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
        <div className={cx('overflow-x-auto rounded-xl border border-zinc-900', loading && 'opacity-60')}>
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
                        <Thumb src={r.thumbnailUrl} alt="" className="h-12 w-20 shrink-0 rounded-md" />
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit video' : 'Add video'} wide>
        {editing && (
          <VideoForm
            key={editing.id || 'new'}
            initial={editing}
            categories={categories || []}
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
