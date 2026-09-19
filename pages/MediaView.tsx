import React, { useState, useEffect } from 'react';
import { ArrowLeft, ThumbsUp, ThumbsDown, Share2, Bell, CheckCircle2, Play, Lock, Frown } from 'lucide-react';
import { MediaItem, User } from '../types';
import { api } from '../services/api';
import AdBanner from '../components/AdBanner';

interface MediaViewProps {
  mediaId: string;
  currentUser: User;
  onBack: () => void;
  onRelatedClick: (id: string) => void;
}

const MediaView: React.FC<MediaViewProps> = ({ mediaId, currentUser, onBack, onRelatedClick }) => {
  const [media, setMedia] = useState<MediaItem | undefined | null>(undefined);
  const [related, setRelated] = useState<MediaItem[]>([]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);

  useEffect(() => {
    // Reset state
    setMedia(undefined);
    setIsPlaying(false);
    
    const fetchMediaData = async () => {
        try {
            const item = await api.media.getById(mediaId);
            if (item) {
                setMedia(item);
                setIsLiked(item.likes?.includes(currentUser.id) || false);
                setIsDisliked(item.dislikes?.includes(currentUser.id) || false);
                
                const relatedItems = await api.media.getRelated(mediaId);
                setRelated(relatedItems);
            } else {
                setMedia(null);
            }
        } catch (e) {
            console.error("Error loading media", e);
            setMedia(null);
        }
    };

    // Scroll to top
    const mainContainer = document.querySelector('main');
    if (mainContainer) mainContainer.scrollTo({ top: 0, behavior: 'smooth' });

    fetchMediaData();
  }, [mediaId, currentUser.id]);

  const handleRate = async (type: 'like' | 'dislike') => {
      if (!media) return;
      
      const newIsLiked = type === 'like' ? !isLiked : false;
      const newIsDisliked = type === 'dislike' ? !isDisliked : false;
      
      setIsLiked(newIsLiked);
      setIsDisliked(newIsDisliked);
      
      try {
          await api.media.rate(media.id, currentUser.id, type === 'like');
          
          // Optionally update local media state to reflect new counts without full refetch
          setMedia(prev => {
              if (!prev) return prev;
              const likes = (prev.likes || []).filter(id => id !== currentUser.id);
              const dislikes = (prev.dislikes || []).filter(id => id !== currentUser.id);
              if (newIsLiked) likes.push(currentUser.id);
              if (newIsDisliked) dislikes.push(currentUser.id);
              return { ...prev, likes, dislikes };
          });
      } catch(e) {
          console.error(e);
          // Revert on error could go here
      }
  };

  // Loading State
  if (media === undefined) {
    return <div className="text-center py-20 text-zinc-400">Loading content...</div>;
  }
  
  // Not Found State
  if (media === null) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-[#111]/50 rounded-3xl border-2 border-dashed border-zinc-800">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6">
                <Frown className="w-8 h-8 text-yellow-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Content Not Found</h2>
            <p className="text-zinc-400 mb-8 max-w-sm">
                This media may have been removed by an administrator or the link is incorrect.
            </p>
            <button 
                type="button"
                onClick={onBack} 
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 py-3 rounded-full font-bold flex items-center transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Media Hub
            </button>
        </div>
      );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-10">
      {/* Main Content Column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Player Container */}
        <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-zinc-900 group">
          {/* Back Button Overlay */}
          <button 
            type="button"
            aria-label="Go back"
            onClick={onBack}
            className="absolute top-4 left-4 z-20 bg-black/50 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100 duration-300"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Video / Image Display */}
          {media.mediaType === 'image' ? (
              (media.sourceUrl || media.thumbnailUrl) ? (
                <img src={media.sourceUrl || media.thumbnailUrl} alt={media.title} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">No Image Available</div>
              )
          ) : (
            <>
               {!isPlaying ? (
                   <>
                    {media.thumbnailUrl ? (
                      <img 
                          src={media.thumbnailUrl} 
                          alt="Content" 
                          className="w-full h-full object-cover opacity-80"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-600">No Preview Available</div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <button 
                            type="button"
                            aria-label="Play content"
                            onClick={() => {
                                const mode = media.playbackMode
                                  ?? (media.redirectUrl || (media.sourceUrl && /^https?:\/\//.test(media.sourceUrl) && !media.sourceUrl.includes('/api/files/'))
                                    ? 'external'
                                    : 'local');
                                if (mode === 'external') {
                                    window.open(media.externalUrl || media.redirectUrl || media.sourceUrl, '_blank');
                                } else {
                                    setIsPlaying(true);
                                }
                            }}
                            className="w-20 h-20 bg-yellow-500/90 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-[0_0_30px_rgba(220,38,38,0.5)]"
                        >
                            <Play className="w-8 h-8 text-white ml-1 fill-current" />
                        </button>
                    </div>
                   </>
               ) : (
                   <video 
                     src={media.sourceUrl || undefined} 
                     controls 
                     autoPlay 
                     className="w-full h-full" 
                     poster={media.thumbnailUrl || undefined}
                   >
                       Your browser does not support video playback.
                   </video>
               )}
            </>
          )}
        </div>

        {/* Premium Banner (if applicable) */}
        {media.isPremium && (
            <div className="bg-gradient-to-r from-red-900/30 to-black border border-yellow-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center">
                    <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center mr-4 shadow-lg shadow-yellow-500/30 flex-shrink-0">
                        <Lock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white">Unlock Full Uncensored Video</h4>
                        <p className="text-xs text-red-300">Join now to access premium content from {media.creatorName}</p>
                    </div>
                </div>
                <button type="button" className="bg-yellow-500 hover:bg-yellow-400 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-yellow-500/20 whitespace-nowrap w-full sm:w-auto">
                    Join for R{media.price || 99}
                </button>
            </div>
        )}

        {/* Video Info */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2 leading-snug">
            {media.title}
          </h1>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-zinc-900">
            <div className="flex items-center text-sm text-zinc-400 space-x-2">
                <span>{media.views.toLocaleString()} views</span>
                <span className="w-1 h-1 bg-zinc-600 rounded-full"></span>
                <span>{media.uploadedAt}</span>
            </div>

            <div className="flex items-center space-x-2">
                <div className="flex bg-[#111] rounded-full overflow-hidden border border-zinc-800">
                    <button 
                        type="button"
                        onClick={() => handleRate('like')}
                        className={`flex items-center space-x-2 px-4 py-2 hover:bg-zinc-800 transition-colors ${isLiked ? 'text-yellow-400' : 'text-zinc-300'}`}
                    >
                        <ThumbsUp className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                        <span className="text-sm font-medium">{media.likes?.length || 0}</span>
                    </button>
                    <div className="w-px bg-zinc-800"></div>
                    <button 
                        type="button"
                        onClick={() => handleRate('dislike')}
                        className={`flex items-center space-x-2 px-4 py-2 hover:bg-zinc-800 transition-colors ${isDisliked ? 'text-yellow-400' : 'text-zinc-300'}`}
                    >
                        <ThumbsDown className={`w-5 h-5 ${isDisliked ? 'fill-current' : ''}`} />
                        <span className="text-sm font-medium">{media.dislikes?.length || 0}</span>
                    </button>
                </div>
                <button type="button" className="flex items-center space-x-2 px-4 py-2 bg-[#111] rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border border-zinc-800">
                    <Share2 className="w-5 h-5" />
                    <span className="text-sm font-medium hidden sm:inline">Share</span>
                </button>
            </div>
          </div>

          {/* Creator Row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-6 border-b border-zinc-900">
            <div className="flex items-center space-x-4">
                {media.creatorAvatar ? (
                  <img src={media.creatorAvatar} alt="Creator" className="w-12 h-12 rounded-full border-2 border-zinc-800 object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full border-2 border-zinc-800 bg-zinc-800 text-yellow-500 font-bold flex items-center justify-center text-lg flex-shrink-0">
                    {(media.creatorName || "C").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                    <h3 className="text-white font-bold flex items-center">
                        {media.creatorName}
                        {media.userId !== 'admin-user' && <CheckCircle2 className="w-4 h-4 text-zinc-400 ml-1.5" />}
                    </h3>
                    <p className="text-xs text-zinc-400">
                        {media.userId === 'admin-user' ? 'Official Platform Host' : '850K subscribers'}
                    </p>
                </div>
            </div>
            {media.userId !== 'admin-user' && (
              <button 
                  type="button"
                  onClick={() => setIsSubscribed(!isSubscribed)}
                  className={`flex items-center justify-center space-x-2 px-6 py-2.5 rounded-full font-semibold transition-all w-full sm:w-auto ${
                      isSubscribed 
                      ? 'bg-[#111] text-zinc-300 border border-zinc-800 hover:bg-zinc-800' 
                      : 'bg-white text-zinc-900 hover:bg-zinc-100 hover:text-yellow-500'
                  }`}
              >
                  {isSubscribed ? (
                      <>
                          <Bell className="w-4 h-4" />
                          <span>Subscribed</span>
                      </>
                  ) : (
                      <span>Subscribe</span>
                  )}
              </button>
            )}
          </div>

          {/* Description */}
          <div className="py-4">
              <div className={`bg-[#111]/50 rounded-xl p-4 text-sm text-zinc-300 whitespace-pre-line border border-zinc-800 hover:bg-[#111] transition-colors cursor-pointer`} onClick={() => setShowFullDesc(!showFullDesc)}>
                  <p className={showFullDesc ? '' : 'line-clamp-2'}>
                    <span className="font-bold text-white mb-2 block text-base">About this content</span>
                    {media.description}
                  </p>
                  <button type="button" className="text-zinc-500 font-semibold mt-2 hover:text-white transition-colors text-xs uppercase tracking-wide">
                      {showFullDesc ? 'Show Less' : 'Show More'}
                  </button>
              </div>
          </div>
        </div>
      </div>

      {/* Sidebar: Related Videos */}
      <div className="lg:col-span-1 space-y-6">
        <AdBanner type="rectangle" />
        
        <div>
            <h3 className="text-lg font-bold text-white mb-4">Up Next</h3>
            <div className="space-y-4">
                {related.map(video => (
                <div 
                    key={video.id} 
                    className="flex space-x-3 group cursor-pointer"
                    onClick={() => {
                        if (video.sourceUrl && (video.sourceUrl.startsWith('http://') || video.sourceUrl.startsWith('https://'))) {
                            window.open(video.sourceUrl, '_blank');
                        } else {
                            onRelatedClick(video.id);
                        }
                    }}
                >
                    <div className="relative w-40 h-24 flex-shrink-0 rounded-lg overflow-hidden border border-zinc-800">
                        {video.thumbnailUrl ? (
                            <img 
                                src={video.thumbnailUrl} 
                                alt={video.title} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                            />
                        ) : (
                            <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-600 text-xs">No media</div>
                        )}
                        <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded font-mono">
                            {video.duration || 'IMG'}
                        </div>
                        {video.isPremium && (
                             <div className="absolute top-1 left-1 bg-amber-500/90 text-zinc-900 p-0.5 rounded">
                                <Lock className="w-3 h-3" />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-zinc-200 line-clamp-2 leading-snug group-hover:text-yellow-400 transition-colors">
                            {video.title}
                        </h4>
                        {video.userId !== 'admin-user' && (
                            <p className="text-xs text-zinc-400 mt-1">{video.creatorName}</p>
                        )}
                        <div className="text-[10px] text-zinc-500 mt-auto flex items-center">
                            {video.views.toLocaleString()} views • {video.uploadedAt}
                        </div>
                    </div>
                </div>
            ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default MediaView;