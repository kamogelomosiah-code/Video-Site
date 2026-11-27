import { useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, FileUp, Square, Upload } from 'lucide-react';
import { normalizeVideo, parseVideoFile } from '../../shared/video';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/settings';
import { Alert, Button, Field, Select, Toggle, useToast } from '../components/ui';

const BATCH = 500;
const SAMPLE = [
  {
    title: 'Sunset Session',
    link: 'https://www.example.com/watch/sunset-session',
    thumbnail: 'https://www.example.com/thumbs/sunset-session.jpg',
    category: 'Glamour',
    tags: ['sunset', 'beach'],
    duration: 750,
    creator: 'Studio K',
    published: true,
  },
];

type Preview = { fileName: string; size: number; rows: unknown[]; ok: number; warnings: number; errors: { row: number; title: string; error: string }[] };
type Report = { created: number; updated: number; skipped: number; failedCount: number; failed: { row: number; title: string; error: string }[]; warnings: number; newCategories: string[] };

const fmtSize = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

/** Reads and checks a whole file in the browser, so mistakes show up before anything is saved. */
async function readFile(file: File): Promise<Preview> {
  const text = await file.text();
  const rows = parseVideoFile(text);
  const errors: Preview['errors'] = [];
  let ok = 0;
  let warnings = 0;
  rows.forEach((raw, i) => {
    const n = normalizeVideo(raw);
    if (n.ok) {
      ok++;
      warnings += n.warnings.length;
    } else {
      errors.push({ row: i + 1, title: String((raw as any)?.title ?? (raw as any)?.name ?? '').slice(0, 80), error: n.error });
    }
  });
  return { fileName: file.name, size: file.size, rows, ok, warnings, errors };
}

export default function ImportVideos() {
  usePageTitle('Admin · Import videos');
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fileError, setFileError] = useState('');
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<'skip' | 'update' | 'add'>('skip');
  const [createCategories, setCreateCategories] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [report, setReport] = useState<Report | null>(null);
  const [importError, setImportError] = useState('');

  const load = async (file: File | undefined) => {
    if (!file) return;
    setFileError('');
    setReport(null);
    setImportError('');
    setReading(true);
    try {
      setPreview(await readFile(file));
    } catch (e: any) {
      setPreview(null);
      setFileError(`${file.name}: ${e.message}`);
    } finally {
      setReading(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    load(e.dataTransfer.files[0]);
  };

  const run = async () => {
    if (!preview) return;
    cancelled.current = false;
    setRunning(true);
    setReport(null);
    setImportError('');
    // Only rows that passed the check are sent; the others are listed in the report.
    const batchStart = Date.now();
    const total = preview.rows.length;
    const totals: Report = { created: 0, updated: 0, skipped: 0, failedCount: 0, failed: [], warnings: 0, newCategories: [] };
    setProgress({ done: 0, total });
    try {
      for (let offset = 0; offset < total; offset += BATCH) {
        if (cancelled.current) break;
        const items = preview.rows.slice(offset, offset + BATCH);
        const r = await api.post<Report>('/admin/videos/import', { items, mode, createCategories, offset, batchStart });
        totals.created += r.created;
        totals.updated += r.updated;
        totals.skipped += r.skipped;
        totals.failedCount += r.failedCount;
        totals.warnings += r.warnings;
        if (totals.failed.length < 500) totals.failed.push(...r.failed.slice(0, 500 - totals.failed.length));
        totals.newCategories = [...new Set([...totals.newCategories, ...r.newCategories])];
        setProgress({ done: Math.min(total, offset + items.length), total });
      }
      setReport({ ...totals });
      toast(cancelled.current ? 'Import stopped — rows saved so far are kept' : `Import finished: ${totals.created} added, ${totals.updated} updated`);
    } catch (e: any) {
      setImportError(`${e.message}. Everything before this point was saved — fix the cause and import again; rows already on the site are skipped.`);
    } finally {
      setRunning(false);
    }
  };

  const downloadErrors = () => {
    if (!report) return;
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const csv = ['row,title,problem', ...report.failed.map((f) => [f.row, esc(f.title), esc(f.error)].join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-problems.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/admin/videos" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to videos</Link>
      <div>
        <h1 className="text-2xl font-bold">Import videos</h1>
        <p className="text-sm text-zinc-400">Upload a JSON or JSON-lines file with up to hundreds of thousands of videos. The file is checked first, then saved in batches of {BATCH}.</p>
      </div>

      <section className="space-y-3 rounded-xl border border-zinc-900 bg-zinc-950 p-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Choose or drop a JSON file"
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${dragging ? 'border-brand-500 bg-brand-500/10' : 'border-zinc-700 hover:border-zinc-500'}`}
        >
          <FileUp className="h-10 w-10 text-zinc-500" />
          <p className="font-medium">{reading ? 'Reading file…' : 'Drop a .json file here, or click to choose one'}</p>
          <p className="text-xs text-zinc-500">Accepts a list of videos, { `{"items": [...]}` }, or one video per line (JSON lines).</p>
          <input ref={input} type="file" accept=".json,.jsonl,application/json" className="hidden" onChange={(e) => { load(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button variant="secondary" onClick={() => {
            const url = URL.createObjectURL(new Blob([JSON.stringify(SAMPLE, null, 2)], { type: 'application/json' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'videos-sample.json';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
          }}><Download className="h-4 w-4" /> Download sample file</Button>
          <span className="text-zinc-500">Fields: <code>title</code>, <code>link</code> (the original video's address), <code>thumbnail</code>, <code>category</code>, <code>tags</code>, <code>duration</code>, <code>creator</code>, <code>published</code>.</span>
        </div>
        {fileError && <Alert>{fileError}</Alert>}
      </section>

      {preview && (
        <section className="space-y-5 rounded-xl border border-zinc-900 bg-zinc-950 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">{preview.fileName} <span className="text-sm font-normal text-zinc-500">({fmtSize(preview.size)})</span></h2>
            <p className="text-sm">
              <span className="text-emerald-300">{preview.ok.toLocaleString()} ready</span>
              {preview.errors.length > 0 && <span className="text-red-300"> · {preview.errors.length.toLocaleString()} with problems</span>}
              {preview.warnings > 0 && <span className="text-amber-300"> · {preview.warnings} warnings</span>}
            </p>
          </div>

          {preview.errors.length > 0 && (
            <div>
              <p className="mb-2 text-sm text-zinc-400">These rows will be skipped. Fix them in your file and import again if you need them:</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 p-3 text-sm" data-testid="preview-errors">
                {preview.errors.slice(0, 200).map((e) => (
                  <li key={e.row}><span className="text-zinc-500">Row {e.row}</span> {e.title && <span>“{e.title}”: </span>}<span className="text-red-300">{e.error}</span></li>
                ))}
                {preview.errors.length > 200 && <li className="text-zinc-500">…and {(preview.errors.length - 200).toLocaleString()} more</li>}
              </ul>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="If a video is already on the site" hint="Matched by its id, or by the same link.">
              <Select value={mode} onChange={(e) => setMode(e.target.value as any)} disabled={running}>
                <option value="skip">Skip it (safe for repeat imports)</option>
                <option value="update">Update it with the file's values</option>
                <option value="add">Add it again as a new video</option>
              </Select>
            </Field>
            <Toggle label="Create missing categories" hint="Adds any category name in the file that doesn't exist yet." checked={createCategories} onChange={setCreateCategories} />
          </div>

          {running ? (
            <div className="space-y-3">
              <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                <div className="h-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-sm text-zinc-400">{progress.done.toLocaleString()} of {progress.total.toLocaleString()} rows ({pct}%)</p>
              <Button variant="danger" onClick={() => { cancelled.current = true; }}><Square className="h-4 w-4" /> Stop after this batch</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={run} disabled={preview.ok === 0} data-testid="start-import"><Upload className="h-4 w-4" /> Import {preview.ok.toLocaleString()} videos</Button>
              <Button variant="ghost" onClick={() => { setPreview(null); setReport(null); }}>Choose a different file</Button>
            </div>
          )}

          {importError && <Alert>{importError}</Alert>}

          {report && (
            <div className="space-y-3 rounded-lg border border-zinc-800 p-4" data-testid="import-report">
              <p className="font-semibold">Import finished</p>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                <li><span className="text-emerald-300">{report.created.toLocaleString()}</span> added</li>
                <li><span className="text-brand-300">{report.updated.toLocaleString()}</span> updated</li>
                <li><span className="text-zinc-300">{report.skipped.toLocaleString()}</span> already on the site (skipped)</li>
                <li><span className="text-red-300">{report.failedCount.toLocaleString()}</span> rows with problems</li>
                {report.newCategories.length > 0 && <li className="sm:col-span-2">New categories: {report.newCategories.join(', ')}</li>}
              </ul>
              {report.failedCount > 0 && (
                <Button variant="secondary" onClick={downloadErrors}><Download className="h-4 w-4" /> Download problem rows (CSV)</Button>
              )}
              <div className="flex gap-3 pt-1 text-sm">
                <Link to="/admin/videos" className="text-brand-400 hover:underline">View videos</Link>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
