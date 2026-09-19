import React, { useRef, useState } from 'react';
import { UploadCloud, DownloadCloud, FileJson, Copy, Check, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { api } from '../services/api';

type MergeMode = 'create' | 'upsert' | 'skip-existing';

const SAMPLE = [
  {
    "title": "Elysian Premium Video",
    "description": "Exquisite high definition content.",
    "videoUrl": "https://example.com/video",
    "imageUrl": "https://example.com/thumbnail.jpg",
    "creatorName": "Elysian Originals",
    "tags": ["Exclusive", "HD"],
    "isPremium": true,
    "duration": "18:45"
  }
];

const AdminBulkImport: React.FC<{ onImported?: () => void }> = ({ onImported }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState<any[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(false);
  const [mergeMode, setMergeMode] = useState<MergeMode>('upsert');
  const [copied, setCopied] = useState(false);

  const handleParse = (text: string) => {
    setRaw(text);
    setParseError(null);
    setParsed(null);
    if (!text.trim()) return;
    try {
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [data];
      const normalized = arr.map((item: any, i: number) => ({
        __index: i,
        id: item.id || `imported-${Date.now()}-${i}`,
        title: item.title || 'Untitled',
        description: item.description || '',
        thumbnailUrl: item.imageUrl || item.thumbnailUrl || '',
        sourceUrl: item.videoUrl || item.sourceUrl || item.redirectUrl || '',
        mediaType: item.mediaType || 'video',
        duration: item.duration || '00:00',
        views: item.views || 0,
        creatorName: item.creatorName || 'Imported Content',
        creatorAvatar: item.creatorAvatar || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        isPremium: Boolean(item.isPremium),
        price: item.price,
        uploadedAt: item.uploadedAt || new Date().toISOString(),
      }));
      setParsed(normalized);
    } catch (e: any) {
      setParseError(e.message);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => handleParse(String(ev.target?.result || ''));
    reader.readAsText(file);
  };

  const handleDownload = async () => {
    try {
      const all = await api.media.getAll();
      const mediaData = all.filter((m) => m.mediaType === 'video');
      const blob = new Blob([JSON.stringify(mediaData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `videos-export-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setStatus('Failed to export videos');
      setStatusType('error');
    }
  };

  const handleImport = async () => {
    if (!parsed || parsed.length === 0) return;
    setLoading(true);
    setStatus(null);
    try {
      const cleanItems = parsed.map(({ __index, ...rest }) => rest);
      let finalItems = cleanItems;
      if (mergeMode === 'skip-existing') {
        const existing = await api.media.getAll();
        const existingIds = new Set(existing.map((e) => e.id));
        finalItems = cleanItems.filter((i) => !existingIds.has(i.id));
      }
      await api.media.bulkCreate(finalItems);
      setStatus(`Successfully imported ${finalItems.length} items`);
      setStatusType('success');
      setParsed(null);
      setRaw('');
      if (onImported) onImported();
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

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="bg-[#111]/50 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-bold text-white">Export library</h4>
            <p className="text-xs text-zinc-500">Download all video records as JSON backup.</p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-all"
          >
            <DownloadCloud className="w-4 h-4 mr-2" />
            Export JSON
          </button>
        </div>
      </div>

      <div className="bg-[#111] border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-bold text-white">Import JSON Library</h4>
            <p className="text-xs text-zinc-500">Paste JSON array or upload file.</p>
          </div>
          <button
            type="button"
            onClick={copySample}
            className="flex items-center text-xs text-yellow-500 hover:text-yellow-400 font-semibold"
          >
            {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? 'Copied Sample' : 'Copy Sample JSON'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl p-6 text-center cursor-pointer bg-black/40 flex flex-col items-center justify-center"
          >
            <UploadCloud className="w-8 h-8 text-zinc-400 mb-2" />
            <span className="text-sm font-semibold text-white">Choose JSON file</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          <div className="flex flex-col">
            <textarea
              value={raw}
              onChange={(e) => handleParse(e.target.value)}
              placeholder="Paste JSON array here..."
              className="w-full h-32 bg-black border border-zinc-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-yellow-500 resize-none"
            />
          </div>
        </div>

        {parseError && (
          <div className="flex items-center space-x-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>JSON Parse Error: {parseError}</span>
          </div>
        )}

        {parsed && (
          <div className="space-y-4 pt-2 border-t border-zinc-800">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-emerald-400 flex items-center">
                <CheckCircle className="w-4 h-4 mr-1.5" /> {parsed.length} items parsed successfully
              </span>
              <div className="flex items-center space-x-3">
                <select
                  value={mergeMode}
                  onChange={(e) => setMergeMode(e.target.value as MergeMode)}
                  className="bg-black border border-zinc-800 text-xs text-white rounded-lg px-3 py-2"
                >
                  <option value="upsert">Upsert (Insert or Update)</option>
                  <option value="create">Create All</option>
                  <option value="skip-existing">Skip Existing IDs</option>
                </select>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={loading}
                  className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold px-5 py-2 rounded-xl text-sm transition-colors"
                >
                  {loading ? 'Importing...' : 'Import Now'}
                </button>
              </div>
            </div>
          </div>
        )}

        {status && (
          <div className={`p-3 rounded-xl text-sm ${statusType === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBulkImport;
