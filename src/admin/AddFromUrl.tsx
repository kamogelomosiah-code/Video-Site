import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Globe, Plus } from 'lucide-react';
import type { Category } from '../../shared/types';
import { normalizeVideo } from '../../shared/video';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/settings';
import { useFetch } from '../lib/utils';
import { Thumb } from '../components/Media';
import { Alert, Button, Field, Input, Select, Textarea, useToast } from '../components/ui';

interface Scraped { title: string; link: string; thumbnail?: string; description?: string; duration?: number | string; tags?: string[]; creator?: string }
type Result = { url: string; ok: true; source: string; videos: Scraped[] } | { url: string; ok: false; error: string };
type Row = Scraped & { key: string; selected: boolean; category: string; from: string };

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};
const fmt = (d?: number | string) => {
  if (typeof d !== 'number') return d || '';
  return `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`;
};

export default function AddFromUrl() {
  usePageTitle('Admin · Add from URL');
  const { toast } = useToast();
  const { data: categories } = useFetch(() => api.get<Category[]>('/admin/categories'), []);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<{ url: string; error: string }[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ created: number; skipped: number; failed: number } | null>(null);

  const urls = useMemo(() => [...new Set(text.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean))], [text]);

  const fetchAll = async () => {
    setBusy(true);
    setError('');
    setDone(null);
    try {
      const { results } = await api.post<{ results: Result[] }>('/admin/videos/scrape', { urls: urls.slice(0, 25) });
      const found: Row[] = [];
      const bad: { url: string; error: string }[] = [];
      for (const r of results) {
        if (r.ok) r.videos.forEach((v, i) => found.push({ ...v, key: `${r.url}#${i}`, selected: true, category: '', from: r.url }));
        else bad.push({ url: r.url, error: r.error });
      }
      setRows(found);
      setErrors(bad);
      if (!found.length && !bad.length) setError('Nothing found.');
    } catch (x: any) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  };

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const checked = rows.filter((r) => r.selected);
  const problems = new Map(rows.map((r) => {
    const n = normalizeVideo({ ...r, category: r.category });
    return [r.key, n.ok ? '' : n.error];
  }));

  const add = async () => {
    setSaving(true);
    setError('');
    try {
      const items = checked.filter((r) => !problems.get(r.key)).map(({ key, selected, from, ...v }) => v);
      const r = await api.post<{ created: number; skipped: number; failedCount: number }>('/admin/videos/import', { items, mode: 'skip', createCategories: false, batchStart: Date.now() });
      setDone({ created: r.created, skipped: r.skipped, failed: r.failedCount });
      toast(`Added ${r.created} video${r.created === 1 ? '' : 's'}${r.skipped ? ` · ${r.skipped} already on the site` : ''}`);
      setRows((rs) => rs.filter((x) => !x.selected));
    } catch (x: any) {
      setError(x.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/admin/videos" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to videos</Link>
      <div>
        <h1 className="text-2xl font-bold">Add from URL</h1>
        <p className="text-sm text-zinc-400">
          Paste links to video pages. We read the title, thumbnail, description and length that each page publishes for link previews,
          so you can check them before adding. Pages that list several videos give you one row per video.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-zinc-900 bg-zinc-950 p-5">
        <Field label="Links (one per line, up to 25)">
          <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'https://www.example.com/watch/123\nhttps://www.example.com/videos/page-2'} className="font-mono text-xs" spellCheck={false} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={fetchAll} loading={busy} disabled={!urls.length} data-testid="fetch-urls"><Globe className="h-4 w-4" /> Fetch details{urls.length ? ` (${Math.min(urls.length, 25)})` : ''}</Button>
          {urls.length > 25 && <span className="text-xs text-amber-300">Only the first 25 links are fetched.</span>}
        </div>
        {error && <Alert>{error}</Alert>}
        {errors.length > 0 && (
          <Alert>
            Couldn't read {errors.length} link{errors.length === 1 ? '' : 's'}:
            <ul className="mt-1 list-disc pl-4" data-testid="scrape-errors">
              {errors.map((e) => <li key={e.url}><span className="break-all">{e.url}</span> — {e.error}</li>)}
            </ul>
          </Alert>
        )}
      </section>

      {rows.length > 0 && (
        <section className="space-y-4 rounded-xl border border-zinc-900 bg-zinc-950 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-semibold">Found {rows.length} video{rows.length === 1 ? '' : 's'}</h2>
            <Field label="Category for all selected" className="w-56">
              <Select value="" onChange={(e) => setRows((rs) => rs.map((r) => (r.selected ? { ...r, category: e.target.value === '__none' ? '' : e.target.value } : r)))}>
                <option value="">Choose…</option>
                <option value="__none">No category</option>
                {(categories || []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </Select>
            </Field>
          </div>
          <ul className="divide-y divide-zinc-900" data-testid="scraped-rows">
            {rows.map((r) => (
              <li key={r.key} className="flex gap-3 py-3">
                <input type="checkbox" className="mt-3 accent-amber-500" checked={r.selected} onChange={(e) => update(r.key, { selected: e.target.checked })} aria-label={`Include ${r.title}`} />
                <Thumb src={r.thumbnail} alt="" className="h-16 w-28 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Input value={r.title} onChange={(e) => update(r.key, { title: e.target.value })} aria-label="Title" />
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <a href={r.link} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">{host(r.link)}</a>
                    {r.duration ? <span>· {fmt(r.duration)}</span> : null}
                    {r.creator && <span>· {r.creator}</span>}
                    <Select value={r.category} onChange={(e) => update(r.key, { category: e.target.value })} className="ml-auto w-44 py-1 text-xs" aria-label="Category">
                      <option value="">No category</option>
                      {(categories || []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                    </Select>
                  </div>
                  {problems.get(r.key) && <p className="text-xs text-red-300">{problems.get(r.key)}</p>}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-900 pt-4">
            <Button onClick={add} loading={saving} disabled={!checked.length} data-testid="add-scraped"><Plus className="h-4 w-4" /> Add {checked.length} video{checked.length === 1 ? '' : 's'}</Button>
            <span className="text-xs text-zinc-500">Videos whose link is already on the site are skipped.</span>
          </div>
        </section>
      )}

      {done && (
        <Alert kind="success">
          Added {done.created}. {done.skipped > 0 && `${done.skipped} were already on the site. `}
          {done.failed > 0 && `${done.failed} had problems. `}
          <Link to="/admin/videos" className="underline">View videos</Link>
        </Alert>
      )}
    </div>
  );
}
