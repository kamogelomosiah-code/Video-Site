import React, { useMemo, useRef, useState } from 'react';
import {
  UploadCloud, DownloadCloud, FileJson, Copy, Check,
  AlertCircle, CheckCircle, Trash2, Video, Image as ImageIcon,
  Loader2, RefreshCw, ExternalLink, HardDrive,
} from 'lucide-react';
import { api } from '../services/api';

type MergeMode = 'create' | 'upsert' | 'skip-existing';

interface PreviewRow {
  index: number;
  ok: boolean;
  issues: string[];
  preview: any;
}

const SAMPLE = [
  {
    "title": "Midnight in Paris Vol 1",
    "description": "Cinematic 4K feature with top talent.",
    "externalUrl": "https://example.com/watch/midnight-paris-vol1",
    "imageUrl": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800",
    "mediaType": "video",
    "playbackMode": "external",
    "duration": "24:18",
    "creatorName": "Elysian Originals",
    "tags": ["exclusive", "4k", "cinematic"],
    "isPremium": true,
    "price": 199
  },
  {
    "title": "Behind The Scenes — Studio 03",
    "description": "Direct local video.",
    "videoUrl": "/api/files/000000000000000000000000",
    "imageUrl": "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800",
    "mediaType": "video",
    "playbackMode": "local",
    "duration": "07:12",
    "creatorName": "Studio Nine",
    "tags": ["bts", "documentary"],
    "isPremium": false
  }
];

const AdminBulkImport: React.FC<{ onImported?: () => void }> = ({ onImported }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(false);
  const [mergeMode, setMergeMode] = useState<MergeMode>('upsert');
  const [copied, setCopied] = useState(false);

  const detectMode = (item: any): 'external' | 'local' => {
    if (item.playbackMode === 'external' || item.playbackMode === 'local') return item.playbackMode;
    const url = item.externalUrl || item.redirectUrl || item.videoUrl || item.sourceUrl || '';
    if (!url) return 'local';
    if (url.startsWith('/api/files/')) return 'local';
    if (/^https?:\/\//.test(url)) return 'external';
    return 'local';
  };

  const normalize = (item: any, i: number) => {
    const mode = detectMode(item);
    const external = item.externalUrl || item.redirectUrl || (mode === 'external' ? (item.videoUrl || item.sourceUrl) : undefined);
    const local = item.sourceUrl && item.sourceUrl.startsWith('/api/files/') ? item.sourceUrl
      : (item.videoUrl && item.videoUrl.startsWith('/api/files/') ? item.videoUrl : '');

    return {
      id: item.id || `imported-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      title: item.title || 'Untitled',
      description: item.description || '',
      thumbnailUrl: item.imageUrl || item.thumbnailUrl || '',
      sourceUrl: mode === 'external' ? (external || '') : (local || item.sourceUrl || ''),
      externalUrl: external,
      playbackMode: mode,
      mediaType: item.mediaType || 'video',
      duration: item.duration || '00:00',
      views: Number(item.views) || 0,
      creatorName: item.creatorName || 'Imported Content',
      creatorAvatar: item.creatorAvatar || '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      isPremium: Boolean(item.isPremium),
      price: item.price != null ? Number(item.price) : undefined,
      uploadedAt: item.uploadedAt || new Date().toISOString(),
      likes: item.likes || [],
      dislikes: item.dislikes || [],
    };
  };

  const parseAndValidate = async (text: string) => {
    setRaw(text);
    setParseError(null);
    setRows([]);
    setStatus(null);
    if (!text.trim()) return;
    let arr: any[];
    try {
      const parsed = JSON.parse(text);
      arr = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e: any) {
      setParseError(e.message);
      return;
    }
    const normalized = arr.map(normalize);
    try {
      const res = await api.media.bulkValidate(normalized);
      setRows(res.results.map(r => ({ index: r.index, ok: r.ok, issues: r.issues, preview: r.preview })));
    } catch (e: any) {
      // Fall back to client-side validation if endpoint missing
      setRows(normalized.map((n, i) => {
        const issues: string[] = [];
        if (!n.title) issues.push('title is required');
        if (!n.sourceUrl && !n.externalUrl) issues.push('sourceUrl or externalUrl is required');
        return { index: i, ok: issues.length === 0, issues, preview: n };
      }));
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => parseAndValidate(String(ev.target?.result || ''));
    reader.readAsText(file);
  };

  const handleExport = async () => {
    try {
      const all = await api.media.getAll();
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `elysian-media-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setStatus('Export failed');
      setStatusType('error');
    }
  };

  const handleImport = async () => {
    const validRows = rows.filter(r => r.ok);
    if (validRows.length === 0) return;
    setLoading(true);
    setStatus(null);
    try {
      const items = validRows.map(r => r.preview);
      if (mergeMode === 'skip-existing') {
        const existing = await api.media.getAll();
        const ids = new Set(existing.map((m: any) => m.id));
        const filtered = items.filter(i => !ids.has(i.id));
        if (filtered.length === 0) {
          setStatus(`Nothing to import — all ${items.length} item(s) already exist`);
          setStatusType('success');
          setLoading(false);
          return;
        }
        const res = await api.media.bulkCreate(filtered);
        setStatus(`Imported ${res.created} new, skipped ${items.length - filtered.length}`);
      } else {
        const res = await api.media.bulkCreate(items);
        setStatus(`Imported ${res.created} item(s)${res.errors?.length ? ` (${res.errors.length} errors)` : ''}`);
      }
      setStatusType('success');
      setRows([]);
      setRaw('');
      onImported?.();
    } catch (e: any) {
      setStatus(e.message || 'Import failed');
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  };

  const copySample = () => {
    navigator.clipboard.writeText(JSON.stringify(SAMPLE, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = useMemo(() => {
    const valid = rows.filter(r => r.ok).length;
    return {
      total: rows.length,
      valid,
      invalid: rows.length - valid,
      external: rows.filter(r => r.preview?.playbackMode === 'external').length,
      local: rows.filter(r => r.preview?.playbackMode === 'local').length,
      premium: rows.filter(r => r.preview?.isPremium).length,
    };
  }, [rows]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="bg-[#111]/50 border border-zinc-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h4 className="font-bold text-white">Backup your library</h4>
          <p className="text-xs text-zinc-500 mt-1">Download all media records as a JSON snapshot.</p>
        </div>
        <button type="button" onClick={handleExport} className="flex items-center bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-full font-semibold text-sm cursor-pointer">
          <DownloadCloud className="w-4 h-4 mr-2" /> Export JSON
        </button>
      </div>

      <div className="bg-[#111]/40 border border-zinc-800/80 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Bulk JSON Media Import</h3>
            <p className="text-xs text-zinc-400 mt-1">Paste a JSON array of media items or upload a `.json` file.</p>
          </div>
          <button
            type="button"
            onClick={copySample}
            className="flex items-center text-xs bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 px-4 py-2 rounded-xl transition-all self-start sm:self-auto cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 mr-1.5 text-yellow-500" />}
            <span>{copied ? 'Copied Sample!' : 'Copy Sample JSON'}</span>
          </button>
        </div>

        {/* Text Area & Drag-and-Drop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <textarea
              rows={8}
              value={raw}
              onChange={(e) => parseAndValidate(e.target.value)}
              placeholder="Paste JSON array here..."
              className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white font-mono text-xs focus:outline-none focus:border-yellow-500"
            />
            {parseError && (
              <div className="flex items-center text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>JSON Error: {parseError}</span>
              </div>
            )}
          </div>

          <div className="space-y-4 flex flex-col justify-between">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-800 hover:border-yellow-500/50 rounded-xl p-6 text-center cursor-pointer flex flex-col items-center justify-center bg-black/40 transition-all flex-1 min-h-[140px]"
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <UploadCloud className="w-10 h-10 text-yellow-500 mb-3" />
              <p className="font-semibold text-white text-sm">Upload JSON File</p>
              <p className="text-xs text-zinc-500 mt-1">Click to browse or drop file here</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Merge Mode</label>
              <select
                value={mergeMode}
                onChange={(e) => setMergeMode(e.target.value as MergeMode)}
                className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-yellow-500 cursor-pointer"
              >
                <option value="upsert">Upsert (Update existing IDs)</option>
                <option value="create">Create New Only</option>
                <option value="skip-existing">Skip Existing IDs</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Summary Panel */}
        {rows.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-2">
            <Chip label="Total" value={stats.total} tone="neutral" />
            <Chip label="Valid" value={stats.valid} tone="good" />
            {stats.invalid > 0 && <Chip label="Invalid" value={stats.invalid} tone="bad" />}
            <Chip label="External Mode" value={stats.external} tone="neutral" />
            <Chip label="Local Playback" value={stats.local} tone="neutral" />
            <Chip label="Premium" value={stats.premium} tone="warn" />
          </div>
        )}

        {/* Validate Panel & Import Trigger */}
        {rows.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Ready to import: {stats.valid} valid records.</span>
              <button
                type="button"
                onClick={handleImport}
                disabled={loading || stats.valid === 0}
                className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                <span>{loading ? 'Importing...' : `Import ${stats.valid} Items`}</span>
              </button>
            </div>

            {/* Preview table */}
            <div className="bg-black/50 border border-zinc-800 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs text-left text-zinc-400">
                <thead className="bg-[#111] text-zinc-300 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Thumb</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Playback</th>
                    <th className="px-4 py-3">Creator</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Premium</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.index} className={`border-b border-zinc-900 hover:bg-zinc-900/40 ${!row.ok ? 'bg-red-500/5' : ''}`}>
                      <td className="px-4 py-2">
                        {row.preview.thumbnailUrl ? (
                          <img src={row.preview.thumbnailUrl} alt="" className="w-12 h-8 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-8 bg-zinc-800 rounded flex items-center justify-center text-[10px]">No img</div>
                        )}
                      </td>
                      <td className="px-4 py-2 font-medium text-white max-w-[180px] truncate">{row.preview.title}</td>
                      <td className="px-4 py-2">
                        {row.preview.playbackMode === 'external' ? (
                          <span className="inline-flex items-center text-amber-400"><ExternalLink className="w-3 h-3 mr-1" /> External</span>
                        ) : (
                          <span className="inline-flex items-center text-blue-400"><HardDrive className="w-3 h-3 mr-1" /> Local</span>
                        )}
                      </td>
                      <td className="px-4 py-2">{row.preview.creatorName}</td>
                      <td className="px-4 py-2 uppercase">{row.preview.mediaType}</td>
                      <td className="px-4 py-2">
                        {row.preview.isPremium ? <span className="text-amber-500 font-semibold">Yes (R{row.preview.price || 0})</span> : <span className="text-zinc-500">No</span>}
                      </td>
                      <td className="px-4 py-2">
                        {row.ok ? (
                          <span className="text-green-400 font-semibold flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> OK</span>
                        ) : (
                          <span className="text-red-400 font-semibold flex items-center cursor-help" title={row.issues.join(', ')}>
                            <AlertCircle className="w-3 h-3 mr-1" /> Error
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {status && (
          <div className={`flex items-center text-xs p-4 rounded-xl ${statusType === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {statusType === 'success' ? <CheckCircle className="w-4 h-4 mr-2" /> : <AlertCircle className="w-4 h-4 mr-2" />}
            <span>{status}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const Chip: React.FC<{ label: string; value: number; tone: 'neutral' | 'good' | 'bad' | 'warn' }> = ({ label, value, tone }) => {
  const tones = {
    neutral: 'bg-zinc-900/60 border-zinc-800 text-zinc-400',
    good: 'bg-green-950/40 border-green-800/40 text-green-300',
    bad: 'bg-red-950/40 border-red-800/40 text-red-300',
    warn: 'bg-amber-950/40 border-amber-800/40 text-amber-300',
  };
  return (
    <div className={`flex items-center space-x-2 border rounded-lg px-3 py-1.5 ${tones[tone]}`}>
      <span>{label}</span>
      <span className="text-white font-bold">{value}</span>
    </div>
  );
};

export default AdminBulkImport;
