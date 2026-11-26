import { useRef, useState } from 'react';
import { Download, FileJson, Upload } from 'lucide-react';
import { api } from '../lib/api';
import { Alert, Button, Field, Modal, Select, Textarea, useToast } from '../components/ui';

const SAMPLE = `[
  {
    "title": "Sunset Session",
    "description": "Golden hour shoot on the beach.",
    "externalUrl": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
    "thumbnailUrl": "https://example.com/thumbs/sunset.jpg",
    "category": "glamour",
    "tags": ["sunset", "beach"],
    "duration": "12:30",
    "creatorName": "Studio K",
    "isPremium": false,
    "published": true
  }
]`;

type Result = { created: number; updated: number; failed: { index: number; title: string; error: string }[]; dryRun: boolean };

function parseItems(text: string): any[] {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.media)) return data.media; // backups from the old site
  if (data && typeof data === 'object') return [data];
  throw new Error('Expected a list of videos');
}

export function ImportVideosButton({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'create' | 'upsert'>('create');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const reset = () => {
    setText('');
    setError('');
    setResult(null);
  };

  const run = async (dryRun: boolean) => {
    setError('');
    setResult(null);
    let items: any[];
    try {
      items = parseItems(text);
    } catch (e: any) {
      setError(`That isn't valid JSON: ${e.message}`);
      return;
    }
    setBusy(true);
    try {
      const r = await api.post<Result>('/admin/media/import', { items, mode, dryRun });
      setResult(r);
      if (!dryRun && (r.created || r.updated)) {
        toast(`Imported: ${r.created} added, ${r.updated} updated${r.failed.length ? `, ${r.failed.length} skipped` : ''}`);
        onDone();
        if (!r.failed.length) {
          setOpen(false);
          reset();
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Import JSON
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Import videos from JSON" wide>
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Paste a JSON list of videos or choose a <code>.json</code> file. Each video needs a <code>title</code> and a link
            (<code>externalUrl</code> or a video file in <code>sourceUrl</code>). Also accepted: <code>url</code>, <code>link</code>,{' '}
            <code>thumbnail</code>, <code>image</code>, <code>name</code>, and backups from the old site.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <FileJson className="h-4 w-4" /> Choose .json file
            </Button>
            <Button variant="ghost" onClick={() => setText(SAMPLE)}>Insert example</Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) {
                  setText(await f.text());
                  setResult(null);
                }
              }}
            />
          </div>
          <Field label="JSON">
            <Textarea
              rows={12}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setResult(null);
              }}
              className="font-mono text-xs"
              placeholder={SAMPLE}
              spellCheck={false}
            />
          </Field>
          <Field label="How to import" hint="“Update by id” edits existing videos whose id matches and adds the rest — use it with a file from Export JSON.">
            <Select value={mode} onChange={(e) => setMode(e.target.value as any)}>
              <option value="create">Add all as new videos</option>
              <option value="upsert">Update by id, add the rest</option>
            </Select>
          </Field>
          {error && <Alert>{error}</Alert>}
          {result && (
            <Alert kind={result.failed.length ? 'error' : 'success'}>
              <p>
                {result.dryRun ? 'Check: ' : 'Done: '}
                {result.created} {result.dryRun ? 'would be added' : 'added'}, {result.updated} {result.dryRun ? 'would be updated' : 'updated'}
                {result.failed.length ? `, ${result.failed.length} with problems:` : ' — no problems found.'}
              </p>
              {!!result.failed.length && (
                <ul className="mt-2 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-4" data-testid="import-errors">
                  {result.failed.map((f) => (
                    <li key={f.index}>#{f.index + 1} “{f.title}”: {f.error}</li>
                  ))}
                </ul>
              )}
            </Alert>
          )}
          <div className="flex justify-end gap-2 border-t border-zinc-900 pt-4">
            <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
            <Button variant="secondary" loading={busy} disabled={!text.trim()} onClick={() => run(true)}>Check</Button>
            <Button loading={busy} disabled={!text.trim()} onClick={() => run(false)}>Import</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function ExportVideosButton() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const items = await api.get<any[]>('/admin/media/export');
          const url = URL.createObjectURL(new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = `videos-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          toast(`Exported ${items.length} videos`);
        } catch (e: any) {
          toast(e.message, 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      {!busy && <Download className="h-4 w-4" />} Export JSON
    </Button>
  );
}
