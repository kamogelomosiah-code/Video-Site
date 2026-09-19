import React, { useRef, useState } from 'react';
import { UploadCloud, DownloadCloud, FileJson, Copy, Check } from 'lucide-react';
import { api } from '../services/api';
import { MediaItem } from '../types';

const AdminBulkImport: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const sampleJSON = `[
  {
    "title": "Elysian Premium Video",
    "description": "Exquisite high definition content.",
    "videoUrl": "https://example.com/video",
    "imageUrl": "https://example.com/thumbnail.jpg",
    "creatorName": "Elysian Originals",
    "tags": ["Exclusive", "HD", "Sensual"],
    "isPremium": true,
    "duration": "18:45"
  }
]`;

    const handleCopy = () => {
        navigator.clipboard.writeText(sampleJSON);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Download videos JSON export
    const handleDownload = async () => {
        try {
            const all = await api.media.getAll();
            const mediaData = all.filter(item => item.mediaType === 'video');
            const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(mediaData, null, 2))}`;
            const link = document.createElement('a');
            link.href = jsonString;
            link.download = 'videos-export.json';
            link.click();
        } catch {
            alert('Failed to export videos');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);
        setLoading(true);
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            setStatus('Please select a JSON file.');
            setLoading(false);
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const content = event.target?.result;
                if (typeof content !== 'string') {
                    throw new Error("Invalid file content");
                }
                const parsedData = JSON.parse(content) as any[];
                
                if (!Array.isArray(parsedData)) {
                   throw new Error("Invalid JSON format. Expected an array of objects.");
                }

                // Map the simplified JSON format to full MediaItem schema
                const itemsToImport: MediaItem[] = parsedData.map(item => ({
                    id: item.id || `imported-${Math.random().toString(36).substr(2, 9)}`,
                    userId: item.userId || 'admin-user',
                    title: item.title || 'Untitled',
                    description: item.description || '',
                    thumbnailUrl: item.imageUrl || item.thumbnailUrl || '',
                    sourceUrl: item.videoUrl || item.sourceUrl || '',
                    redirectUrl: item.videoUrl || item.redirectUrl || '', // Treat imported videoUrl as a redirect if needed
                    mediaType: item.mediaType || 'video',
                    duration: item.duration || '00:00',
                    views: item.views || 0,
                    creatorName: item.creatorName || 'Imported Content',
                    creatorAvatar: item.creatorAvatar || '',
                    tags: item.tags || [],
                    isPremium: item.isPremium || false,
                    uploadedAt: item.uploadedAt || new Date().toISOString()
                }));

                // Basic validation
                if (itemsToImport.some(item => !item.title)) {
                   throw new Error("Invalid JSON format. Missing title field.");
                }

                await api.media.importBulk(itemsToImport);
                setStatus(`${itemsToImport.length} videos imported successfully!`);
            } catch (err: any) {
                setStatus(err.message || 'Import failed: Invalid JSON file.');
            } finally {
                setLoading(false);
            }
        };
        reader.onerror = () => {
             setStatus('Failed to read the file.');
             setLoading(false);
        };

        reader.readAsText(file);
    };

    return (
        <div className="max-w-3xl mx-auto p-6 md:p-8 bg-[#111]/50 rounded-2xl mt-4 border border-zinc-800">
            <div className="flex items-center mb-6">
                <DownloadCloud className="w-8 h-8 text-yellow-400 mr-4" />
                <div>
                    <h3 className="text-xl font-bold text-white">Bulk Import & Export</h3>
                    <p className="text-zinc-400 text-sm">Backup or restore video content using JSON files.</p>
                </div>
            </div>
            <div className="space-y-6">
                <div className="bg-black rounded-xl p-6 border border-zinc-800">
                    <h4 className="font-semibold text-white mb-2">Export Video Data</h4>
                    <p className="text-sm text-zinc-500 mb-4">Download a JSON file containing all video records. This can be used as a backup.</p>
                    <button
                        onClick={handleDownload}
                        className="flex items-center bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2 rounded-lg font-semibold text-sm transition-all"
                        type="button"
                    >
                        <DownloadCloud className="w-4 h-4 mr-2" />
                        Download Videos JSON
                    </button>
                </div>

                 <form onSubmit={handleSubmit} className="bg-black rounded-xl p-6 border border-zinc-800">
                    <h4 className="font-semibold text-white mb-2">Import Video Data</h4>
                    <p className="text-sm text-zinc-500 mb-4">Upload a JSON file to add multiple videos. Existing videos with the same ID will be updated.</p>
                    <input
                        type="file"
                        accept="application/json"
                        ref={fileInputRef}
                        className="mb-4 block w-full text-sm text-zinc-400 file:bg-zinc-800 file:text-zinc-200 file:rounded-lg file:border-0 file:px-4 file:py-2 file:mr-4 file:font-semibold file:hover:bg-zinc-700 cursor-pointer"
                    />
                    <button
                        type="submit"
                        className="flex items-center bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-yellow-600/20 transition-all text-sm"
                        disabled={loading}
                    >
                        <UploadCloud className="w-4 h-4 mr-2" />
                        {loading ? 'Importing...' : 'Upload & Import JSON'}
                    </button>
                </form>

                <div className="bg-black rounded-xl p-6 border border-zinc-800">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                            <FileJson className="w-5 h-5 text-yellow-500" />
                            <h4 className="font-semibold text-white">Expected JSON Schema</h4>
                        </div>
                        <button
                            onClick={handleCopy}
                            className="text-xs font-bold text-zinc-400 hover:text-white flex items-center space-x-1.5 transition-colors px-2.5 py-1.5 bg-zinc-900 rounded-lg border border-zinc-800 cursor-pointer select-none"
                            type="button"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-green-400" />
                                    <span className="text-green-400">Copied!</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>Copy Sample JSON</span>
                                </>
                            )}
                        </button>
                    </div>

                    <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                        When uploading video collections, ensure your JSON structure matches the fields mapped below. Missing parameters are fallback-initialized or auto-generated.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-400 mb-4 bg-zinc-950 p-4 rounded-xl border border-zinc-900">
                        <div>
                            <span className="text-zinc-200 font-semibold block mb-1">Required/Primary Fields:</span>
                            <ul className="list-disc pl-4 space-y-1">
                                <li><strong className="text-yellow-500 font-semibold">title</strong>: string — Video display heading</li>
                                <li><strong className="text-yellow-500 font-semibold">videoUrl</strong> or <strong className="text-yellow-500 font-semibold">sourceUrl</strong>: string — Original external tube video link</li>
                                <li><strong className="text-yellow-500 font-semibold">imageUrl</strong> or <strong className="text-yellow-500 font-semibold">thumbnailUrl</strong>: string — Cover image link</li>
                            </ul>
                        </div>
                        <div>
                            <span className="text-zinc-200 font-semibold block mb-1">Metadata Fields (Optional):</span>
                            <ul className="list-disc pl-4 space-y-1">
                                <li><strong className="font-semibold">description</strong>: string — Description or tags synopsis</li>
                                <li><strong className="font-semibold">creatorName</strong>: string — Creator studio name</li>
                                <li><strong className="font-semibold">tags</strong>: string[] — Array of categories</li>
                                <li><strong className="font-semibold">duration</strong>: string — e.g. "18:45"</li>
                                <li><strong className="font-semibold">isPremium</strong>: boolean — Set to true for VIP views</li>
                            </ul>
                        </div>
                    </div>

                    <pre className="bg-zinc-950 p-4 rounded-xl text-xs text-zinc-300 font-mono overflow-x-auto border border-zinc-900 max-h-48 leading-relaxed">
{sampleJSON}
                    </pre>
                </div>
            </div>
           
            {status && <div className={`mt-6 text-center rounded-xl py-3 px-4 text-sm font-medium ${status.includes('success') ? 'bg-green-900/40 text-green-400 border border-green-700/50' : 'bg-red-900/40 text-yellow-300 border border-yellow-600/50'}`}>{status}</div>}
        </div>
    );
};

export default AdminBulkImport;