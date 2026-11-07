import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MediaGrid from '../components/MediaGrid';
import AdBanner from '../components/AdBanner';
import EventScheduleElement from '../components/EventScheduleElement';
import { MediaItem, TalentProfile, Category } from '../types';
import { Play, Grid, ChevronRight, Sparkles, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface MediaHubProps {
  onMediaClick: (id: string) => void;
  onTalentClick?: (id: string) => void;
}

const CATEGORY_TAG_MAP: Record<string, string[]> = {
  all: [],
  exclusive: ['exclusive'],
  bts: ['bts', 'behind-the-scenes'],
  '4k': ['4k', 'uhd', 'hd'],
  vr: ['vr', '360'],
};

const DEFAULT_CATEGORIES: Array<{ id: string; name: string; slug: string }> = [
  { id: 'all', name: 'All Videos', slug: 'all' },
  { id: 'exclusive', name: 'Exclusive', slug: 'exclusive' },
  { id: '4k', name: '4K Ultra HD', slug: '4k' },
  { id: 'bts', name: 'Behind the Scenes', slug: 'bts' },
  { id: 'vr', name: 'Virtual Reality', slug: 'vr' },
];

const MediaHub: React.FC<MediaHubProps> = ({ onMediaClick, onTalentClick }) => {
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>(DEFAULT_CATEGORIES);
  const [activeCategorySlug, setActiveCategorySlug] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'views' | 'rating' | 'title'>('newest');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [featuredItem, setFeaturedItem] = useState<MediaItem | null>(null);
  const [topTalent, setTopTalent] = useState<TalentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Initial load for categories, top talent, and hero
  useEffect(() => {
    const fetchInit = async () => {
      try {
        const [cats, talent, settings] = await Promise.all([
          api.categories.getAll().catch(() => []),
          api.talent.getAll().catch(() => []),
          api.settings.get().catch(() => ({} as any))
        ]);

        if (Array.isArray(cats) && cats.length > 0) {
          const uniqueCats = cats.filter(c => c.slug !== 'all' && c.name.toLowerCase() !== 'all');
          setCategories([{ id: 'all', name: 'All', slug: 'all' }, ...uniqueCats]);
        }

        setTopTalent(Array.isArray(talent) ? talent.slice(0, 8) : []);

        // Featured Hero Media
        if (settings?.featuredMediaId) {
          try {
            const feat = await api.media.getById(settings.featuredMediaId);
            if (feat) setFeaturedItem(feat);
          } catch {}
        }
      } catch (err) {
        console.error('Failed to load media hub initial data:', err);
      }
    };
    fetchInit();
  }, []);

  // Fetch feed media based on active category and page
  const fetchFeed = useCallback(async (catSlug: string, pageNum: number, append: boolean = false) => {
    if (pageNum === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const feedRes = await api.media.getFeed(pageNum, 18, catSlug);
      const items = feedRes.items || [];
      setHasMore(feedRes.hasMore);

      if (append) {
        setMediaItems(prev => [...prev, ...items]);
      } else {
        setMediaItems(items);
        if (!featuredItem && items.length > 0) {
          setFeaturedItem(items[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch media feed:', err);
      // Fallback to rotated
      if (!append) {
        try {
          const fallback = await api.media.getRotated();
          setMediaItems(fallback);
        } catch {}
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [featuredItem]);

  // Trigger feed reload on category change
  useEffect(() => {
    setPage(1);
    fetchFeed(activeCategorySlug, 1, false);
  }, [activeCategorySlug, fetchFeed]);

  const handleLoadMore = () => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchFeed(activeCategorySlug, nextPage, true);
  };

  const generateBlankImage = (text: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600" viewBox="0 0 1600 600"><rect width="1600" height="600" fill="#27272a" /><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="48" font-family="sans-serif" fill="#71717a">${text}</text></svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  const filteredMediaItems = useMemo(() => {
    const targetTags = CATEGORY_TAG_MAP[activeCategorySlug] ?? (activeCategorySlug === 'all' ? [] : [activeCategorySlug]);
    let items = mediaItems;
    if (targetTags && targetTags.length > 0) {
      items = items.filter(item => {
        const tags = (Array.isArray(item.tags) ? item.tags : []).map(t => String(t).toLowerCase());
        const cat = (item.category || '').toLowerCase();
        const title = (item.title || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        return targetTags.some(t => {
          const lower = t.toLowerCase();
          return tags.includes(lower) || cat.includes(lower) || title.includes(lower) || desc.includes(lower);
        });
      });
    }

    return [...items].sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime();
      } else if (sortBy === 'views') {
        return (Number(b.views) || 0) - (Number(a.views) || 0);
      } else if (sortBy === 'rating') {
        return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      } else if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return 0;
    });
  }, [mediaItems, activeCategorySlug, sortBy]);

  const recommendedItems = useMemo(() => filteredMediaItems.slice(0, 12), [filteredMediaItems]);
  const newArrivalsItems = useMemo(() => filteredMediaItems.slice(12), [filteredMediaItems]);

  const heroItem = useMemo(() => {
    if (featuredItem) {
      const targetTags = CATEGORY_TAG_MAP[activeCategorySlug] ?? (activeCategorySlug === 'all' ? [] : [activeCategorySlug]);
      if (targetTags.length === 0) return featuredItem;
      const tags = (Array.isArray(featuredItem.tags) ? featuredItem.tags : []).map(t => String(t).toLowerCase());
      const cat = (featuredItem.category || '').toLowerCase();
      const title = (featuredItem.title || '').toLowerCase();
      const desc = (featuredItem.description || '').toLowerCase();
      const matches = targetTags.some(t => {
        const lower = t.toLowerCase();
        return tags.includes(lower) || cat.includes(lower) || title.includes(lower) || desc.includes(lower);
      });
      if (matches) return featuredItem;
    }
    if (filteredMediaItems.length > 0) return filteredMediaItems[0];
    return {
      id: 'placeholder',
      title: 'Featured Cinema Collection',
      description: 'Experience ultra high-definition productions featuring top verified creators.',
      thumbnailUrl: generateBlankImage('Featured Production'),
      redirectUrl: undefined,
    };
  }, [featuredItem, filteredMediaItems, activeCategorySlug]);

  const handleHeroClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (heroItem.redirectUrl) {
      window.open(heroItem.redirectUrl, '_blank', 'noopener,noreferrer');
    } else if (heroItem.id !== 'placeholder') {
      onMediaClick(heroItem.id);
    }
  };

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Category Pills Navigation */}
      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:justify-center md:pb-0 scroll-pl-4">
        {categories.map((cat) => {
          const isActive = activeCategorySlug === cat.slug;
          return (
            <button
              key={cat.id || cat.slug}
              onClick={() => setActiveCategorySlug(cat.slug)}
              className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all flex items-center flex-shrink-0 active:scale-95 ${
                isActive
                  ? 'bg-yellow-500 text-zinc-950 font-bold shadow-lg shadow-yellow-500/20'
                  : 'bg-[#111]/60 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              {cat.slug === 'all' && <Grid className="w-3.5 h-3.5 mr-1.5" />}
              {cat.slug === 'exclusive' && <Sparkles className="w-3.5 h-3.5 mr-1.5 text-yellow-400" />}
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Hero Showcase - Full Width Cinematic Banner */}
      {heroItem && (
        <div 
          className="relative -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-8 md:mb-12 overflow-hidden h-[480px] md:h-[560px] lg:h-[620px] border-b border-zinc-800/80 shadow-2xl group cursor-pointer active:scale-[0.99] transition-transform"
          onClick={() => handleHeroClick()}
        >
          {heroItem.thumbnailUrl ? (
            <img 
              src={heroItem.thumbnailUrl} 
              alt={heroItem.title} 
              className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-1000"
            />
          ) : (
            <div className="w-full h-full bg-zinc-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent flex flex-col justify-end p-6 md:p-12 lg:p-16">
            <div className="max-w-7xl mx-auto w-full">
              <div className="flex items-center space-x-2 mb-3">
                <span className="bg-yellow-500 px-3.5 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest text-zinc-950 shadow-lg shadow-yellow-500/30">
                  Featured Spotlight
                </span>
              </div>
              <h1 className="font-bold text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white mb-3 md:mb-4 max-w-4xl leading-tight">
                {heroItem.title}
              </h1>
              <p className="text-zinc-300 max-w-2xl mb-6 md:mb-8 text-sm sm:text-base md:text-lg line-clamp-2 font-light">
                {heroItem.description}
              </p>
              <div className="flex flex-row items-center gap-4">
                <button 
                  type="button"
                  onClick={handleHeroClick}
                  className="bg-yellow-500 text-zinc-950 px-8 py-4 rounded-full font-bold hover:bg-yellow-400 active:scale-95 transition-all flex items-center justify-center shadow-xl text-base flex-initial"
                >
                  <Play className="w-5 h-5 mr-2.5 fill-current" />
                  Watch Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Ad Unit */}
      <AdBanner slot="feed" />

      {/* Live & Upcoming Event Schedule Element */}
      <EventScheduleElement onTalentClick={onTalentClick} />

      {/* Top Creators / Verified Talent Section */}
      {topTalent.length > 0 && (
        <section className="space-y-4 md:space-y-6">
          <div className="flex items-end justify-between px-1">
            <div>
              <h2 className="text-lg md:text-2xl font-bold text-white flex items-center">
                <span className="w-1 md:w-1.5 h-6 md:h-8 bg-gradient-to-b from-yellow-500 to-yellow-600 rounded-full mr-3"></span>
                Top Verified Creators
              </h2>
            </div>
          </div>

          <div className="flex overflow-x-auto no-scrollbar gap-4 md:gap-6 pb-4 -mx-4 px-4 md:mx-0 md:px-0 scroll-pl-4">
            {topTalent.map((model) => (
              <div 
                key={model.id} 
                onClick={() => onTalentClick && onTalentClick(model.userId || model.id)}
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
                  
                  {/* Online Badge */}
                  <div className="absolute top-2 left-2 flex flex-col gap-2">
                    {model.online && (
                      <div className="bg-green-500 w-2 h-2 rounded-full border border-zinc-900 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
                    )}
                  </div>
                  
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="flex items-center text-white font-bold text-xs md:text-sm truncate">
                      {model.name}
                    </div>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5 truncate">{model.title || 'Verified Creator'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Algorithmic Feed Grid */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
          <h2 className="text-lg md:text-2xl font-bold text-white flex items-center">
            <span className="w-1 md:w-1.5 h-6 md:h-8 bg-yellow-500 rounded-full mr-3 shadow-[0_0_15px_rgba(234,179,8,0.4)]"></span>
            {activeCategorySlug === 'all' ? 'Recommended Releases' : `${categories.find(c => c.slug === activeCategorySlug)?.name || 'Filtered'} Releases`}
          </h2>
          <div className="flex items-center space-x-3 self-end sm:self-auto">
            <div className="flex items-center space-x-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5">
              <span className="text-xs text-zinc-400">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-medium text-white focus:outline-none cursor-pointer"
              >
                <option value="newest" className="bg-zinc-900 text-white">Newest</option>
                <option value="views" className="bg-zinc-900 text-white">Most Viewed</option>
                <option value="rating" className="bg-zinc-900 text-white">Highest Rated</option>
                <option value="title" className="bg-zinc-900 text-white">Title (A-Z)</option>
              </select>
            </div>
            <span className="text-xs text-zinc-500">{filteredMediaItems.length} videos</span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden animate-pulse flex flex-col h-80">
                  <div className="w-full h-48 bg-zinc-800/70"></div>
                  <div className="p-4 space-y-3 flex-1">
                    <div className="w-3/4 h-5 bg-zinc-800/70 rounded-md"></div>
                    <div className="w-1/2 h-4 bg-zinc-800/40 rounded-md"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredMediaItems.length === 0 ? (
          <div className="text-center py-16 bg-[#111]/40 border border-zinc-900 rounded-3xl p-8">
            <p className="text-zinc-400 text-base font-semibold">No media in this category yet</p>
            <p className="text-zinc-600 text-xs mt-1">Check back soon or select another category above.</p>
          </div>
        ) : (
          <>
            <MediaGrid items={recommendedItems} onItemClick={onMediaClick} />
            
            {/* Mid-feed Ad Banner */}
            <div className="py-4">
              <AdBanner slot="feed" />
            </div>

            {/* New Arrivals Section */}
            {newArrivalsItems.length > 0 && (
              <div className="space-y-6 pt-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-lg md:text-xl font-bold text-white flex items-center">
                    <span className="w-1 h-5 bg-yellow-500 rounded-full mr-2.5"></span>
                    New Arrivals
                  </h3>
                  <span className="text-xs text-zinc-500">{newArrivalsItems.length} more titles</span>
                </div>
                <MediaGrid items={newArrivalsItems} onItemClick={onMediaClick} />
              </div>
            )}

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-6">
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={handleLoadMore}
                  className="px-8 py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm rounded-full border border-zinc-700/80 hover:border-yellow-500 transition-all flex items-center space-x-2 active:scale-95 disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-yellow-500" />
                      <span>Loading more content...</span>
                    </>
                  ) : (
                    <span>Explore More Videos</span>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default MediaHub;
