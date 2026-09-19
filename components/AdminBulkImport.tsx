import React, { useRef, useState } from 'react';
import { UploadCloud, DownloadCloud, FileJson, Copy, Check, AlertCircle, CheckCircle, Trash2, Video, Image as ImageIcon, Wand2 } from 'lucide-react';
import { api } from '../services/api';
import { MediaItem } from '../types';

type MergeMode = 'create' | 'upsert' | 'skip-existing';

const SAMPLE_VIDEO = [
  {
    "title": "Elysian Premium Video",
    "description": "Exquisite high definition content shot in 4K.",
    "videoUrl": "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-lights-41580-large.mp4",
    "imageUrl": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800",
    "creatorName": "Elysian Originals",
    "creatorAvatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
    "tags": ["exclusive", "4k", "cinematic"],
    "isPremium": true,
    "price": 199,
    "duration": "18:45"
  },
  {
    "title": "Behind The Scenes Volume 3",
    "description": "Exclusive backstage access.",
    "videoUrl": "https://assets.mixkit.co/videos/preview/mixkit-dj-playing-music-in-a-nightclub-41578-large.mp4",
    "imageUrl": "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&q=80&w=800",
    "creatorName": "Studio Nine",
    "tags": ["bts", "documentary"],
    "isPremium": false,
    "duration": "07:12"
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

  const normalize = (item: any, i: number) => ({
    __index: i,
    id: item.id || `imported-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    title: item.title || 'Untitled',
    description: item.description || '',
    thumbnailUrl: item.imageUrl || item.thumbnailUrl || '',
    sourceUrl: item.videoUrl || item.sourceUrl || item.redirectUrl || '',
    redirectUrl: item.redirectUrl || item.videoUrl || undefined,
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
  });

  const handleParse = (text: string) => {
    setRaw(text);
    setParseError(null);
    setParsed(null);
    if (!text.trim()) return;
    try {
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [data];
      const normalized = arr.map(normalize);
      const missing = normalized.find((n) => !n.title || !n.sourceUrl);
      if (missing) {
        setParseError('Each item must include "title" and "videoUrl" (or "sourceUrl").');
        return;
      }
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
      const cleanItems = parsed.map(({ __index, ...rest }) => rest) as Partial<MediaItem>[];
      const res = await api.media.bulkCreate(cleanItems);
      setStatus(`Successfully imported ${res.created || cleanItems.length} items!`);
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
    navigator.clipboard.writeText(JSON.stringify(SAMPLE_VIDEO, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const videoCount = parsed?.filter((p) => p.mediaType === 'video').length || 0;
  const imageCount = parsed?.filter((p) => p.mediaType === 'image').length || 0;
  const premiumCount = parsed?.filter((p) => p.isPremium).length || 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Export Section */}
      <div className="bg-[#111]/50 border border-zinc-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h4 className="font-bold text-white">Backup Your Video Library</h4>
          <p className="text-xs text-zinc-500 mt-1">Download all video records as a JSON snapshot for external backup or migration.</p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-all self-start sm:self-auto"
        >
          <DownloadCloud className="w-4 h-4 mr-2" /> Export Videos
        </button>
      </div>

      {/* Import Section */}
      <div className="bg-[#111]/40 border border-zinc-800/80 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Bulk JSON Video Import</h3>
            <p className="text-xs text-zinc-400 mt-1">Paste a JSON array of video objects or upload a `.json` file.</p>
          </div>
          <button
            type="button"
            onClick={copySample}
            className="flex items-center text-xs bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 px-4 py-2 rounded-xl transition-all self-start sm:self-auto"
          >
            {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 mr-1.5 text-yellow-500" />}
            <span>{copied ? 'Copied Sample!' : 'Copy Sample JSON'}</span>
          </button>
        </div>

        {/* Upload drop / text area */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <textarea
              rows={8}
              value={raw}
              onChange={(e) => handleParse(e.target.value)}
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
              className="border-2 border-dashed border-zinc-800 hover:border-yellow-500/50 rounded-xl p-6 text-center cursor-pointer flex flex-col items-center justify-center bg-black/40 transition-all flex-1"
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

        {/* Parsed Preview & Summary */}
        {parsed && (
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-3 text-xs">
                <Stat label="Total" value={parsed.length} />
                <Stat label="Videos" value={videoCount} icon={<Video className="w-3.5 h-3.5 text-yellow-500" />} />
                <Stat label="Images" value={imageCount} icon={<ImageIcon className="w-3.5 h-3.5 text-blue-400" />} />
                <Stat label="Premium" value={premiumCount} />
              </div>
              <button
                type="button"
                onClick={handleImport}
                disabled={loading || parsed.length === 0}
                className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{loading ? 'Importing...' : `Import ${parsed.length} Items`}</span>
              </button>
            </div>

            {/* Preview table */}
            <div className="bg-black/50 border border-zinc-800 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs text-left text-zinc-400">
                <thead className="bg-[#111] text-zinc-300 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Thumb</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Creator</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((item, idx) => (
                    <tr key={idx} className="border-b border-zinc-900 hover:bg-zinc-900/40">
                      <td className="px-4 py-2">
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt="" className="w-12 h-8 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-8 bg-zinc-800 rounded flex items-center justify-center text-[10px]">No img</div>
                        )}
                      </td>
                      <td className="px-4 py-2 font-medium text-white max-w-[180px] truncate">{item.title}</td>
                      <td className="px-4 py-2">{item.creatorName}</td>
                      <td className="px-4 py-2 uppercase">{item.mediaType}</td>
                      <td className="px-4 py-2 font-mono">{item.duration}</td>
                      <td className="px-4 py-2">
                        {item.isPremium ? <span className="text-amber-500 font-semibold">Yes</span> : <span className="text-zinc-500">No</span>}
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

const Stat: React.FC<{ label: string; value: number; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-center space-x-2 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-1.5">
    {icon}
    <span className="text-zinc-500">{label}:</span>
    <span className="text-white font-bold">{value}</span>
  </div>
);

export default AdminBulkImport;
