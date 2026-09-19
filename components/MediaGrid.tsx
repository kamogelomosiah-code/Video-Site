import React from 'react';
import { MediaItem } from '../types';
import { Play, Lock, Clock } from 'lucide-react';

interface MediaGridProps {
  items: MediaItem[];
  onItemClick: (id: string) => void;
  showPremiumBadge?: boolean;
}

const MediaGrid: React.FC<MediaGridProps> = ({ items, onItemClick, showPremiumBadge = false }) => {
  const handleClick = (item: MediaItem) => {
    if (item.sourceUrl && (item.sourceUrl.startsWith('http://') || item.sourceUrl.startsWith('https://'))) {
      window.open(item.sourceUrl, '_blank');
    } else if (item.redirectUrl) {
      window.open(item.redirectUrl, '_blank');
    } else {
      onItemClick(item.id);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4 md:gap-6">
      {items.map((item) => (
        <div 
          key={item.id} 
          onClick={() => handleClick(item)}
          className="group relative bg-black rounded-xl sm:rounded-2xl overflow-hidden border border-zinc-900 hover:border-yellow-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-yellow-500/10 cursor-pointer flex flex-col"
        >
          <div className="relative aspect-video overflow-hidden">
            {item.thumbnailUrl ? (
              <img 
                src={item.thumbnailUrl} 
                alt={item.title} 
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
              />
            ) : (
              <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-600 text-xs">
                No Preview
              </div>
            )}
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
            
            {/* Premium Lock or Duration */}
            <div className="absolute top-1 right-1 sm:top-3 sm:right-3 flex items-center space-x-1 sm:space-x-2">
              {showPremiumBadge && item.isPremium && (
                <div className="bg-amber-500/20 backdrop-blur-md border border-amber-500/50 text-amber-500 px-1 sm:px-2 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-xs font-bold uppercase tracking-wider flex items-center">
                  <Lock className="w-2 h-2 sm:w-3 sm:h-3 mr-1" />
                  Premium
                </div>
              )}
              <div className="bg-black/60 backdrop-blur-md px-1 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-mono text-white">
                {item.duration || '12:45'}
              </div>
            </div>

            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
               <div className="w-10 h-10 sm:w-14 sm:h-14 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/40">
                 <Play className="w-4 h-4 sm:w-6 sm:h-6 text-white ml-1" fill="currentColor" />
               </div>
            </div>
          </div>

          <div className="p-2 sm:p-4 flex flex-col flex-1">
            <div className="flex justify-between items-start mb-1 sm:mb-2">
              <h3 className="font-semibold text-zinc-200 text-xs sm:text-base line-clamp-2 sm:line-clamp-1 group-hover:text-yellow-400 transition-colors leading-tight">
                {item.title}
              </h3>
            </div>
            
            <div className="flex items-center justify-between text-[10px] sm:text-xs text-zinc-500 mb-2 sm:mb-3">
              <span className="flex items-center">
                <Clock className="w-3 h-3 mr-1 hidden sm:block" />
                {item.uploadedAt}
              </span>
              <span>{item.views.toLocaleString()} views</span>
            </div>

            {item.userId !== 'admin-user' && (
              <div className="flex items-center pt-2 sm:pt-3 border-t border-zinc-800/50 mt-auto">
                {item.creatorAvatar ? (
                  <img 
                    src={item.creatorAvatar} 
                    alt={item.creatorName || 'Creator'} 
                    className="w-4 h-4 sm:w-6 sm:h-6 rounded-full object-cover mr-1.5 sm:mr-2"
                  />
                ) : (
                  <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-zinc-800 text-yellow-500 font-bold flex items-center justify-center text-[9px] mr-1.5 sm:mr-2 flex-shrink-0">
                    {(item.creatorName || 'C').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-[10px] sm:text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors truncate">
                  {item.creatorName}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MediaGrid;