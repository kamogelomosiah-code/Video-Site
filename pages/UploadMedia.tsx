import React, { useState } from 'react';
import { Upload, X, FileVideo, DollarSign, Save } from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';

interface UploadMediaProps {
  user: User;
  onCancel: () => void;
  onUploadComplete: () => void;
}

const UploadMedia: React.FC<UploadMediaProps> = ({ user, onCancel, onUploadComplete }) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [externalUrl, setExternalUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  
  // Metadata
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [price, setPrice] = useState('');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type.startsWith('video/') || file.type.startsWith('image/')) {
      setFile(file);
      setTitle(file.name.replace(/\.[^/.]+$/, "")); // Remove extension for title
      simulateUpload();
    }
  };

  const simulateUpload = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 100);
  };



  const handlePublish = async () => {
    if (uploadMode === 'file' && !file) return;
    if (uploadMode === 'link' && (!externalUrl || !title)) return;
    
    setIsPublishing(true);

    try {
        let sourceUrl = '';
        let finalThumbnailUrl = thumbnailUrl;
        let mediaType: 'image' | 'video' = 'video';
        
        if (uploadMode === 'file' && file) {
            try {
              sourceUrl = await api.media.uploadFile(file);
            } catch (uploadErr) {
              console.error("Upload failed, falling back", uploadErr);
              sourceUrl = URL.createObjectURL(file);
            }
            mediaType = file.type.startsWith('image/') ? 'image' : 'video';
            if (mediaType === 'image') finalThumbnailUrl = sourceUrl;
        } else {
            sourceUrl = externalUrl;
        }
        
        const generateBlankImage = (text: string) => {
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#27272a" /><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="24" font-family="sans-serif" fill="#71717a">${text}</text></svg>`;
          return `data:image/svg+xml;base64,${btoa(svg)}`;
        };

        if (!finalThumbnailUrl) {
            finalThumbnailUrl = generateBlankImage('Video Thumbnail Hidden');
        }

        await api.media.create({
            userId: user.id,
            title,
            description,
            mediaType,
            sourceUrl,
            redirectUrl: uploadMode === 'link' ? externalUrl : undefined,
            thumbnailUrl: finalThumbnailUrl,
            duration: mediaType === 'video' ? '00:15' : undefined,
            creatorName: user.name,
            creatorAvatar: user.avatarUrl,
            tags,
            isPremium,
            price: isPremium ? parseFloat(price) : undefined
        });

        onUploadComplete();
    } catch (e) {
        console.error(e);
        alert('Upload failed');
    } finally {
        setIsPublishing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Upload Content</h1>
          <p className="text-zinc-400">Add new videos or photos to your channel</p>
        </div>
        <button type="button" aria-label="Cancel upload" onClick={onCancel} className="p-2 text-zinc-400 hover:text-white bg-[#111] rounded-full">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: File Upload */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex bg-[#111] rounded-xl p-1 mb-4">
             <button 
               className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${uploadMode === 'file' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
               onClick={() => setUploadMode('file')}
             >
               File Upload
             </button>
             <button 
               className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${uploadMode === 'link' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
               onClick={() => setUploadMode('link')}
             >
               External Link
             </button>
          </div>
          
          {uploadMode === 'file' ? (
          <div 
            className={`aspect-[3/4] rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-4 text-center ${
              dragActive 
                ? 'border-yellow-500 bg-yellow-500/5' 
                : file 
                  ? 'border-green-500/50 bg-green-500/5' 
                  : 'border-zinc-800 bg-[#111] hover:border-zinc-700'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="w-full h-full flex flex-col items-center justify-center">
                 <p className="text-sm font-semibold text-zinc-300 mb-2">Preview</p>
                 {file.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(file)} alt="Preview" className="w-full max-h-64 object-contain rounded-lg mb-4 shadow-lg" />
                 ) : (
                    <FileVideo className="w-16 h-16 text-green-500 my-8" />
                 )}
                 <p className="text-sm text-zinc-300 font-medium break-all">{file.name}</p>
                 <div className="w-full bg-zinc-800 h-2 rounded-full mt-4 overflow-hidden">
                    <div 
                      className="bg-green-500 h-full transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                 </div>
                 <p className="text-xs text-zinc-500 mt-2">{uploadProgress}% Uploaded</p>
                 {uploadProgress === 100 && (
                   <button 
                    type="button"
                    onClick={() => { setFile(null); setUploadProgress(0); }}
                    className="text-xs text-yellow-400 mt-4 hover:underline"
                   >
                     Remove File
                   </button>
                 )}
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-zinc-400" />
                </div>
                <p className="text-white font-medium mb-1">Drag & Drop Media</p>
                <p className="text-xs text-zinc-500 mb-6">Video or Images up to 2GB</p>
                <label className="bg-white text-zinc-900 px-6 py-2 rounded-full font-semibold text-sm hover:bg-zinc-200 transition-colors cursor-pointer">
                  Select Files
                  <input type="file" className="hidden" accept="video/*,image/*" onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
                </label>
              </>
            )}
          </div>
          ) : (
            <div className="bg-[#111]/50 p-6 rounded-2xl border border-zinc-800 h-full">
               <h3 className="text-lg font-semibold text-white mb-4">External URL</h3>
               <div className="space-y-4">
                 <div className="space-y-2">
                   <label className="text-sm text-zinc-400">Target Link (Required)</label>
                   <input 
                     type="url" 
                     value={externalUrl}
                     onChange={(e) => setExternalUrl(e.target.value)}
                     className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 focus:outline-none transition-all text-sm"
                     placeholder="https://example.com/tube-video"
                     required
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-sm text-zinc-400">Thumbnail Image URL (Optional)</label>
                   <input 
                     type="url" 
                     value={thumbnailUrl}
                     onChange={(e) => setThumbnailUrl(e.target.value)}
                     className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 focus:outline-none transition-all text-sm"
                     placeholder="https://example.com/thumbnail.jpg"
                   />
                 </div>
                 {thumbnailUrl && thumbnailUrl.trim().length > 0 && (
                    <div className="mt-4 aspect-video rounded-xl overflow-hidden border border-zinc-800">
                      <img src={thumbnailUrl.trim()} alt="Thumbnail preview" className="w-full h-full object-cover" />
                    </div>
                 )}
               </div>
            </div>
          )}
        </div>

        {/* Right Column: Metadata */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-4 bg-[#111]/50 p-6 rounded-2xl border border-zinc-800">
             <h3 className="text-lg font-semibold text-white">Content Details</h3>

             <div className="space-y-2">
               <label className="text-sm text-zinc-400">Title</label>
               <input 
                 type="text" 
                 value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 focus:outline-none transition-all"
                 placeholder="Enter a catchy title..."
               />
             </div>

             <div className="space-y-2">
               <label className="text-sm text-zinc-400">Description</label>
               <textarea 
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 focus:outline-none transition-all h-32 resize-none"
                 placeholder="What is your content about? (18+ allowed)"
               />
             </div>

             <div className="space-y-2">
               <label className="text-sm text-zinc-400">Tags</label>
               <div className="flex flex-wrap gap-2 mb-2">
                 {tags.map((tag, idx) => (
                   <span key={idx} className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-xs flex items-center">
                     {tag}
                     <button type="button" aria-label={`Remove tag: ${tag}`} onClick={() => setTags(tags.filter((_, i) => i !== idx))} className="ml-2 hover:text-white">
                       <X className="w-3 h-3" />
                     </button>
                   </span>
                 ))}
               </div>
               <input 
                 type="text" 
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') {
                     e.preventDefault();
                     const val = e.currentTarget.value.trim();
                     if (val) {
                       setTags([...tags, val]);
                       e.currentTarget.value = '';
                     }
                   }
                 }}
                 className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 focus:outline-none transition-all"
                 placeholder="Add tags (press Enter)..."
               />
             </div>
          </div>

          <div className="bg-[#111]/50 p-6 rounded-2xl border border-zinc-800">
            <h3 className="text-lg font-semibold text-white mb-4">Monetization (ZAR)</h3>
            <div className="flex items-center space-x-4 mb-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={isPremium} onChange={() => setIsPremium(!isPremium)} className="sr-only peer" />
                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                <span className="ml-3 text-sm font-medium text-zinc-300">Premium Paid Content</span>
              </label>
            </div>
            
            {isPremium && (
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">R</span>
                <input 
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Price (e.g. 199.00)"
                  className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-white focus:ring-1 focus:ring-yellow-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4">
             <button 
               type="button"
               onClick={onCancel}
               disabled={isPublishing}
               className="px-6 py-2.5 rounded-full text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
             >
               Discard
             </button>
             <button 
               type="button"
               onClick={handlePublish}
               disabled={(uploadMode === 'file' && (!file || uploadProgress < 100)) || (uploadMode === 'link' && (!externalUrl || !title)) || isPublishing}
               className="bg-white text-zinc-900 px-8 py-2.5 rounded-full font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-[0_0_15px_rgba(255,255,255,0.1)]"
             >
               {isPublishing ? (
                 <>
                   <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mr-2"></div>
                   Publishing...
                 </>
               ) : (
                 <>
                   <Save className="w-4 h-4 mr-2" />
                   Publish
                 </>
               )}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadMedia;