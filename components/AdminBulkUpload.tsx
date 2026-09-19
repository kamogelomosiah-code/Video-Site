import React, { useState, useRef } from 'react';
import { Upload, X, FileVideo, Save, Loader2, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';

interface Row {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  description: string;
  tags: string;
  creatorName: string;
  isPremium: boolean;
  price: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  uploadedUrl?: string;
  error?: string;
}

const AdminBulkUpload: React.FC<{ user: User; onComplete: () => void }> = ({ user, onComplete }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[]) => {
    const accepted: Row[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) return;
      accepted.push({
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
        title: file.name.replace(/\.[^/.]+$/, ''),
        description: '',
        tags: '',
        creatorName: user.name,
        isPremium: false,
        price: '',
        status: 'pending',
        progress: 0,
      });
    });
    setRows((prev) => [...prev, ...accepted]);
  };

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUploadAll = async () => {
    if (rows.length === 0) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      rows.forEach((r) => fd.append('files', r.file));
      const res = await api.media.batchUpload(fd);
      if (res && res.success && Array.isArray(res.results)) {
        const mediaItems = res.results.map((r: any, idx: number) => {
          const row = rows[idx];
          return {
            title: row?.title || r.filename,
            description: row?.description || '',
            sourceUrl: r.url,
            thumbnailUrl: r.mimetype?.startsWith('image/') ? r.url : '',
            mediaType: r.mimetype?.startsWith('image/') ? 'image' : 'video',
            creatorName: row?.creatorName || user.name,
            creatorAvatar: user.avatarUrl || '',
            tags: row?.tags ? row.tags.split(',').map((s: string) => s.trim()).filter(Boolean) : ['Exclusive'],
            isPremium: row?.isPremium || false,
            price: row?.price ? Number(row.price) : 0,
            views: 0,
          };
        });
        await api.media.bulkCreate(mediaItems);
        setRows((prev) => prev.map((r) => ({ ...r, status: 'done' })));
        setTimeout(() => {
          onComplete();
        }, 1000);
      }
    } catch (e: any) {
      alert(e.message || 'Bulk upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          dragActive ? 'border-yellow-500 bg-yellow-500/5' : 'border-zinc-800 bg-[#111]/50 hover:border-zinc-700'
        }`}
      >
        <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <Upload className="w-8 h-8 text-zinc-400" />
        </div>
        <p className="text-white font-bold text-lg mb-1">Drop videos or images here</p>
        <p className="text-zinc-500 text-sm mb-4">Up to 50 files per batch</p>
        <label className="inline-block bg-white text-zinc-900 px-6 py-2 rounded-full font-semibold text-sm hover:bg-zinc-200 transition-colors cursor-pointer">
          Select Files
          <input
            type="file"
            multiple
            accept="video/*,image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </label>
      </div>

      {rows.length > 0 && (
        <div className="bg-[#111] border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white text-lg">Batch Files ({rows.length})</h3>
            <button
              type="button"
              onClick={handleUploadAll}
              disabled={isUploading}
              className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold px-6 py-2.5 rounded-xl flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              <span>Upload & Publish All</span>
            </button>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {rows.map((row) => (
              <div key={row.id} className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="w-24 h-16 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative">
                  {row.previewUrl ? (
                    <img src={row.previewUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">
                      <FileVideo className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2 w-full">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) => updateRow(row.id, { title: e.target.value })}
                      placeholder="Title"
                      className="bg-black border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm"
                    />
                    <input
                      type="text"
                      value={row.tags}
                      onChange={(e) => updateRow(row.id, { tags: e.target.value })}
                      placeholder="Tags (comma separated)"
                      className="bg-black border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-zinc-400">
                    <span>{row.file.name}</span>
                    <span>{(row.file.size / (1024 * 1024)).toFixed(1)} MB</span>
                    {row.status === 'done' && <span className="text-emerald-400 flex items-center"><CheckCircle className="w-3.5 h-3.5 mr-1" /> Published</span>}
                  </div>
                </div>
                <button type="button" onClick={() => removeRow(row.id)} className="text-zinc-500 hover:text-red-400 p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBulkUpload;
