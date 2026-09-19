import React, { useState, useEffect } from 'react';
import MediaGrid from '../components/MediaGrid';
import AdBanner from '../components/AdBanner';
import { MediaItem, TalentProfile } from '../types';
import { Play, Grid, Star, Camera, Film, View, ChevronRight } from 'lucide-react';
import { api } from '../services/api';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Grid },
  { id: 'exclusive', label: 'Exclusive', icon: Star },
  { id: 'bts', label: 'BTS', icon: Camera },
  { id: '4k', label: '4K', icon: Film },
  { id: 'vr', label: 'VR', icon: View },
];

interface MediaHubProps {
  onMediaClick: (id: string) => void;
}

const MediaHub: React.FC<MediaHubProps> = ({ onMediaClick }) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [featuredItem, setFeaturedItem] = useState<MediaItem | null>(null);
  const [topTalent, setTopTalent] = useState<TalentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        try {
            const [items, talent, settings] = await Promise.all([
                api.media.getRotated(),
                api.talent.getAll(),
                api.settings.get()
            ]);
            
            setMediaItems(items);
            setTopTalent(talent.slice(0, 6));
            
            const featured = items.find(item => item.id === settings.featuredMediaId);
            setFeaturedItem(featured || items[0] || null);
        } catch (error) {
            console.error("Failed to fetch media hub data", error);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, []);

  const generateBlankImage = (text: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600" viewBox="0 0 1600 600"><rect width="1600" height="600" fill="#27272a" /><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="48" font-family="sans-serif" fill="#71717a">${text}</text></svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  const heroItem = featuredItem || {
      id: 'placeholder',
      title: 'Midnight in Paris: The Collection',
      description: 'Experience the latest exclusive shoot featuring top international talent in 4K resolution.',
      thumbnailUrl: generateBlankImage('Featured Image Hidden')
  };

  const handleHeroClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (heroItem.redirectUrl) {
      window.open(heroItem.redirectUrl, '_blank');
    } else {
      onMediaClick(heroItem.id);
    }
  };

  if (isLoading) {
      return <div className="flex h-96 items-center justify-center text-zinc-500">Loading content...</div>;
  }

  return (
    <div className="space-y-8 md:space-y-12">
      
      {/* Category Filters - Horizontal Scroll */}
      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:justify-center md:pb-0 scroll-pl-4">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all flex items-center flex-shrink-0 active:scale-95 ${
                activeCategory === cat.id
                  ? 'bg-zinc-100 text-black shadow-lg shadow-white/10'
                  : 'bg-[#111]/50 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              <cat.icon className={`w-3.5 h-3.5 mr-2 ${activeCategory === cat.id ? 'text-yellow-500' : ''}`} />
              {cat.label}
            </button>
          ))}
      </div>

      {/* Hero Section */}
      <div className="relative rounded-2xl md:rounded-3xl overflow-hidden h-96 md:h-[450px] border border-zinc-800 shadow-2xl group cursor-pointer active:scale-[0.99] transition-transform" onClick={() => handleHeroClick()}>
        {heroItem.thumbnailUrl ? (
          <img 
            src={heroItem.thumbnailUrl} 
            alt="Featured" 
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-1000"
          />
        ) : (
          <div className="w-full h-full bg-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent flex flex-col justify-end p-6 md:p-12">
          <div className="flex items-center space-x-2 mb-3">
            <span className="bg-yellow-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-yellow-500/30">
              New Premiere
            </span>
          </div>
          <h1 className="font-bold text-2xl sm:text-4xl md:text-5xl lg:text-7xl text-white mb-2 md:mb-4 max-w-3xl leading-tight">
            {heroItem.title}
          </h1>
          <p className="text-zinc-300 max-w-xl mb-6 md:mb-8 text-sm md:text-lg line-clamp-2 font-light hidden sm:block">
            {heroItem.description}
          </p>
          <div className="flex flex-row items-center gap-3">
            <button 
              onClick={handleHeroClick}
              className="bg-white text-zinc-900 px-6 md:px-8 py-3 md:py-4 rounded-full font-bold hover:bg-zinc-100 active:scale-95 transition-all flex items-center justify-center shadow-xl text-sm md:text-base flex-1 sm:flex-initial"
            >
              <Play className="w-4 h-4 md:w-5 md:h-5 mr-2 fill-current" />
              Watch Now
            </button>
            <button 
              onClick={(e) => e.stopPropagation()}
              className="bg-black/60 backdrop-blur-xl text-white px-6 md:px-8 py-3 md:py-4 rounded-full font-medium hover:bg-zinc-800 active:scale-95 transition-all border border-zinc-700 text-sm md:text-base hidden sm:block"
            >
              Details
            </button>
          </div>
        </div>
      </div>
      
      {/* Top Ad Banner */}
      <AdBanner />

      {/* Featured Creators Section */}
      <section className="space-y-4 md:space-y-6">
        <div className="flex items-end justify-between px-1">
          <div>
            <h2 className="text-lg md:text-2xl font-bold text-white flex items-center">
              <span className="w-1 md:w-1.5 h-6 md:h-8 bg-gradient-to-b from-yellow-500 to-yellow-600 rounded-full mr-3"></span>
              Top Creators
            </h2>
          </div>
          <button className="text-yellow-400 text-xs md:text-sm font-bold flex items-center hover:text-yellow-300 transition-colors">
            View All <ChevronRight className="w-3 h-3 md:w-4 md:h-4 ml-1" />
          </button>
        </div>

        <div className="flex overflow-x-auto no-scrollbar gap-4 md:gap-6 pb-4 -mx-4 px-4 md:mx-0 md:px-0 scroll-pl-4">
          {topTalent.map((model) => (
            <div 
              key={model.id} 
              className="flex-shrink-0 w-32 md:w-48 group cursor-pointer active:scale-95 transition-transform"
            >
              <div className="relative aspect-[3/4] rounded-xl md:rounded-2xl overflow-hidden mb-2 border border-zinc-800 group-hover:border-yellow-500/50 transition-all duration-500">
                {model.imageUrl ? (
                  <img 
                    src={model.imageUrl} 
                    alt={model.name} 
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" 
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-yellow-500 font-bold text-xl">
                    {(model.name || "T").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>
                
                {/* Status Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-2">
                  {model.online && (
                    <div className="bg-green-500 w-2 h-2 rounded-full border border-zinc-900 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
                  )}
                </div>
                
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="flex items-center text-white font-bold text-xs md:text-sm truncate">
                    {model.name}
                  </div>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5 truncate">{model.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Content Grids */}
      <section className="space-y-6">
        <div>
          <h2 className="text-lg md:text-2xl font-bold text-white mb-4 flex items-center px-1">
            <span className="w-1 md:w-1.5 h-6 md:h-8 bg-yellow-500 rounded-full mr-3 shadow-[0_0_15px_rgba(220,38,38,0.4)]"></span>
            Recommended
          </h2>
          <MediaGrid items={mediaItems} onItemClick={onMediaClick} />
        </div>
        
        <div className="py-2">
            <AdBanner />
        </div>
        
        <div className="pt-4">
          <h2 className="text-lg md:text-2xl font-bold text-white mb-4 flex items-center px-1">
            <span className="w-1 md:w-1.5 h-6 md:h-8 bg-yellow-600 rounded-full mr-3 shadow-[0_0_15px_rgba(190,18,60,0.4)]"></span>
            New Arrivals
          </h2>
          <MediaGrid items={[...mediaItems].reverse()} onItemClick={onMediaClick} />
        </div>
      </section>
    </div>
  );
};

export default MediaHub;