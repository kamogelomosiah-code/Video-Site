import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Play, Users, Star, MapPin, CheckCircle2, 
  SlidersHorizontal, Sparkles, X, ChevronRight, MessageSquare, 
  Calendar, Eye, Loader2, ArrowUpDown, Tag, Film, ShieldCheck
} from 'lucide-react';
import { MediaItem, TalentProfile, User } from '../types';
import { api } from '../services/api';
import { executeSearch, ScoredMediaItem, ScoredTalentProfile } from '../services/searchAlgorithm';

interface SearchResultsProps {
  initialQuery: string;
  currentUser: User;
  onMediaClick: (id: string) => void;
  onTalentClick: (id: string) => void;
  onMessageClick?: (talentId: string) => void;
  onSearchChange?: (query: string) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  initialQuery,
  currentUser,
  onMediaClick,
  onTalentClick,
  onMessageClick,
  onSearchChange
}) => {
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<'all' | 'media' | 'talent'>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'views' | 'rating' | 'newest'>('relevance');
  
  // Quick filter tags
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [mediaResults, setMediaResults] = useState<ScoredMediaItem[]>([]);
  const [talentResults, setTalentResults] = useState<ScoredTalentProfile[]>([]);
  const [tookMs, setTookMs] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allMediaCache, setAllMediaCache] = useState<MediaItem[]>([]);
  const [allTalentCache, setAllTalentCache] = useState<TalentProfile[]>([]);

  // Keep queryInput in sync if parent updates initialQuery
  useEffect(() => {
    setQueryInput(initialQuery);
    setActiveQuery(initialQuery);
  }, [initialQuery]);

  // Load all items once for fast hybrid client-side ranking & filtering
  useEffect(() => {
    let isMounted = true;
    const loadCache = async () => {
      try {
        const [mediaList, talentList] = await Promise.all([
          api.media.getAll().catch(() => []),
          api.talent.getAll().catch(() => [])
        ]);
        if (isMounted) {
          setAllMediaCache(mediaList);
          setAllTalentCache(talentList);
        }
      } catch (err) {
        console.error('Failed to load cache:', err);
      }
    };
    loadCache();
    return () => { isMounted = false; };
  }, []);

  // Perform search whenever activeQuery or sorting changes
  useEffect(() => {
    let isCancelled = false;

    const runSearch = async () => {
      const q = activeQuery.trim();
      if (!q) {
        setMediaResults([]);
        setTalentResults([]);
        setTookMs(0);
        return;
      }

      setIsLoading(true);
      const start = performance.now();

      try {
        // First try server API search with options
        const response = await api.search.query(q, {
          type: activeTab,
          sort: sortBy,
        });

        if (!isCancelled) {
          if (response && (response.media || response.talent)) {
            setMediaResults(response.media as ScoredMediaItem[]);
            setTalentResults(response.talent as ScoredTalentProfile[]);
            setTookMs(Math.round(response.tookMs || (performance.now() - start)));
            setSuggestions(response.suggestions || []);
          }
        }
      } catch (err) {
        console.warn('Backend search error, falling back to client algorithm:', err);
        // Fallback to client algorithm engine
        if (!isCancelled && (allMediaCache.length > 0 || allTalentCache.length > 0)) {
          const clientRes = executeSearch(allMediaCache, allTalentCache, q, {
            type: activeTab,
            sort: sortBy
          });
          setMediaResults(clientRes.media);
          setTalentResults(clientRes.talent);
          setTookMs(Math.round(performance.now() - start));
          setSuggestions(clientRes.suggestions);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    runSearch();

    return () => {
      isCancelled = true;
    };
  }, [activeQuery, activeTab, sortBy, allMediaCache, allTalentCache]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = queryInput.trim();
    if (!clean) return;
    setActiveQuery(clean);
    if (onSearchChange) {
      onSearchChange(clean);
    }
  };

  const handleSuggestionClick = (term: string) => {
    setQueryInput(term);
    setActiveQuery(term);
    if (onSearchChange) {
      onSearchChange(term);
    }
  };

  // Filtered views based on secondary tag filters
  const filteredMedia = useMemo(() => {
    if (!selectedTag) return mediaResults;
    const tagLower = selectedTag.toLowerCase();
    return mediaResults.filter(m => 
      Array.isArray(m.tags) && m.tags.some(t => t.toLowerCase().includes(tagLower))
    );
  }, [mediaResults, selectedTag]);

  const filteredTalent = useMemo(() => {
    let list = talentResults;
    if (verifiedOnly) {
      list = list.filter(t => t.verified);
    }
    if (availableOnly) {
      list = list.filter(t => t.availability === 'Available Now' || t.online || t.chatOnline);
    }
    if (selectedTag) {
      const tagLower = selectedTag.toLowerCase();
      list = list.filter(t => 
        (Array.isArray(t.tags) && t.tags.some(tg => tg.toLowerCase().includes(tagLower))) ||
        (t.location && t.location.toLowerCase().includes(tagLower))
      );
    }
    return list;
  }, [talentResults, verifiedOnly, availableOnly, selectedTag]);

  const totalResultsCount = filteredMedia.length + filteredTalent.length;

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Search Bar & Query Control */}
      <div className="bg-[#111] border border-zinc-800/80 rounded-2xl md:rounded-3xl p-5 md:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="flex items-center gap-2 text-xs text-yellow-400 font-medium uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Optimized Algorithmic Search</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight text-balance">
            Search Results
          </h1>

          <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search videos, creators, cities, tags (e.g. 'Party Cape Town', '4K')..."
                className="w-full bg-black/80 border border-zinc-700/80 rounded-xl py-3 pl-11 pr-10 text-white placeholder-zinc-500 text-sm md:text-base focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all shadow-inner"
              />
              {queryInput && (
                <button
                  type="button"
                  onClick={() => { setQueryInput(''); setActiveQuery(''); }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
                  aria-label="Clear query"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl text-sm md:text-base transition-all duration-200 shadow-lg shadow-yellow-500/20 active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <Search className="w-4 h-4 stroke-[2.5]" />
              )}
              <span>Search</span>
            </button>
          </form>

          {/* Search Statistics & Query Summary */}
          {activeQuery && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-zinc-400">
              <span>Showing results for <strong className="text-white">"{activeQuery}"</strong></span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{totalResultsCount} found</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{tookMs}ms ranking latency</span>
              {selectedTag && (
                <>
                  <span aria-hidden="true">·</span>
                  <button 
                    onClick={() => setSelectedTag(null)}
                    className="inline-flex items-center gap-1 text-yellow-400 hover:text-yellow-300 font-medium"
                  >
                    <span>Filtered by #{selectedTag}</span>
                    <X className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filter and Sorting Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-[#111]/70 border border-zinc-800/80 rounded-2xl p-3 md:px-5">
        {/* Segmented Type Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-black/60 rounded-xl border border-zinc-800/80 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-yellow-500 text-black font-semibold shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All Results ({mediaResults.length + talentResults.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('media')}
            className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'media'
                ? 'bg-yellow-500 text-black font-semibold shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Videos ({mediaResults.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('talent')}
            className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'talent'
                ? 'bg-yellow-500 text-black font-semibold shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Creators ({talentResults.length})</span>
          </button>
        </div>

        {/* Refinements & Sort Controls */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {/* Quick Filter Buttons */}
          <button
            type="button"
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all whitespace-nowrap flex items-center gap-1.5 ${
              verifiedOnly
                ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/40'
                : 'bg-black/40 text-zinc-400 border-zinc-800 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Only</span>
          </button>

          <button
            type="button"
            onClick={() => setAvailableOnly(!availableOnly)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all whitespace-nowrap flex items-center gap-1.5 ${
              availableOnly
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                : 'bg-black/40 text-zinc-400 border-zinc-800 hover:text-white'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Available Now</span>
          </button>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-black/40 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-zinc-300 font-medium focus:outline-none cursor-pointer pr-1"
            >
              <option value="relevance" className="bg-[#111] text-white">Best Match (Relevance)</option>
              <option value="views" className="bg-[#111] text-white">Most Viewed</option>
              <option value="rating" className="bg-[#111] text-white">Highest Rated</option>
              <option value="newest" className="bg-[#111] text-white">Newest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="py-16 text-center space-y-3">
          <div className="w-10 h-10 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm font-medium">Ranking results with optimized scoring...</p>
        </div>
      )}

      {/* No Results Fallback with Smart Suggestions */}
      {!isLoading && activeQuery && totalResultsCount === 0 && (
        <div className="bg-[#111] border border-zinc-800/80 rounded-2xl p-8 md:p-12 text-center space-y-6 max-w-2xl mx-auto my-8">
          <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto text-zinc-500 border border-zinc-800">
            <Search className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">No exact matches found for "{activeQuery}"</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              We checked titles, creator names, model specialties, location tags, and descriptions. Try using broader search keywords or check one of our popular suggestions below.
            </p>
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-3 pt-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                Suggested searches
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => handleSuggestionClick(sug)}
                    className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-yellow-400 text-xs font-medium transition-colors cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TALENT RESULTS SECTION */}
      {!isLoading && (activeTab === 'all' || activeTab === 'talent') && filteredTalent.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-1 h-5 bg-yellow-500 rounded-full" />
              <h2 className="text-lg md:text-xl font-bold text-white">
                Verified Creators & Models ({filteredTalent.length})
              </h2>
            </div>
            {activeTab === 'all' && filteredTalent.length > 4 && (
              <button
                type="button"
                onClick={() => setActiveTab('talent')}
                className="text-xs text-yellow-400 hover:text-yellow-300 font-medium flex items-center gap-1"
              >
                <span>View all creators</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {filteredTalent.slice(0, activeTab === 'all' ? 4 : 50).map((talent) => (
              <div
                key={talent.id}
                className="bg-[#111] border border-zinc-800 rounded-2xl overflow-hidden hover:border-yellow-500/50 transition-all duration-300 group flex flex-col justify-between hover:shadow-xl hover:shadow-yellow-500/5"
              >
                <div>
                  {/* Photo Banner with Badges */}
                  <div 
                    onClick={() => onTalentClick(talent.userId || talent.id)}
                    className="relative aspect-[4/3] bg-zinc-900 cursor-pointer overflow-hidden"
                  >
                    {talent.imageUrl ? (
                      <img
                        src={talent.imageUrl}
                        alt={talent.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-yellow-500 font-bold text-3xl">
                        {talent.name.charAt(0)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    
                    {/* Status & Relevance Pills */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      {talent.verified && (
                        <span className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Verified</span>
                        </span>
                      )}
                      {(talent.online || talent.chatOnline) && (
                        <span className="bg-emerald-500/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-md">
                          Online
                        </span>
                      )}
                    </div>

                    {talent.score !== undefined && (
                      <div className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-md border border-zinc-700/60 text-yellow-400 text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-md font-semibold">
                        Relevance: {talent.score}
                      </div>
                    )}

                    <div className="absolute bottom-2.5 left-2.5 right-2.5">
                      <p className="text-white font-bold text-base truncate">{talent.name}</p>
                      <p className="text-xs text-zinc-300 truncate">{talent.title || 'Verified Creator'}</p>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-3.5 space-y-2.5 text-xs text-zinc-400">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-zinc-300 truncate">
                        <MapPin className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                        <span className="truncate">{talent.location || 'South Africa'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-400 font-semibold shrink-0">
                        <Star className="w-3.5 h-3.5 fill-yellow-400" />
                        <span>{talent.rating ? talent.rating.toFixed(1) : '4.9'}</span>
                      </div>
                    </div>

                    {/* Match Reason highlight */}
                    {talent.matchReasons && talent.matchReasons.length > 0 && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2.5 py-1 text-[11px] text-yellow-300 truncate">
                        {talent.matchReasons[0]}
                      </div>
                    )}

                    {/* Tags preview */}
                    {Array.isArray(talent.tags) && talent.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {talent.tags.slice(0, 3).map(tg => (
                          <button
                            key={tg}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedTag(tg); }}
                            className="text-[10px] text-zinc-400 hover:text-white bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800 transition-colors"
                          >
                            #{tg}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer action buttons */}
                <div className="p-3.5 pt-0 flex items-center gap-2 border-t border-zinc-900 mt-2">
                  <button
                    type="button"
                    onClick={() => onTalentClick(talent.userId || talent.id)}
                    className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold text-center border border-zinc-800 transition-colors"
                  >
                    View Profile
                  </button>
                  {onMessageClick && (
                    <button
                      type="button"
                      onClick={() => onMessageClick(talent.userId || talent.id)}
                      className="p-1.5 bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg transition-colors"
                      title="Send message"
                      aria-label="Send message"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MEDIA RESULTS SECTION */}
      {!isLoading && (activeTab === 'all' || activeTab === 'media') && filteredMedia.length > 0 && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-1 h-5 bg-yellow-500 rounded-full" />
              <h2 className="text-lg md:text-xl font-bold text-white">
                Videos & Productions ({filteredMedia.length})
              </h2>
            </div>
            {activeTab === 'all' && filteredMedia.length > 8 && (
              <button
                type="button"
                onClick={() => setActiveTab('media')}
                className="text-xs text-yellow-400 hover:text-yellow-300 font-medium flex items-center gap-1"
              >
                <span>View all videos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {filteredMedia.slice(0, activeTab === 'all' ? 12 : 100).map((item) => (
              <div
                key={item.id}
                onClick={() => onMediaClick(item.id)}
                className="bg-[#111] border border-zinc-800/80 rounded-2xl overflow-hidden hover:border-yellow-500/50 transition-all duration-300 group cursor-pointer flex flex-col justify-between hover:shadow-xl hover:shadow-yellow-500/5"
              >
                <div>
                  {/* Thumbnail Container */}
                  <div className="relative aspect-video bg-zinc-900 overflow-hidden">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-yellow-500">
                        <Play className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Play Hover Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 rounded-full bg-yellow-500/90 text-black flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>

                    {/* Video Duration Badge */}
                    {item.duration && (
                      <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-zinc-300 font-semibold">
                        {item.duration}
                      </div>
                    )}

                    {/* Match Score Badge */}
                    {item.score !== undefined && (
                      <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md border border-zinc-700/60 text-yellow-400 text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-md font-semibold">
                        Score: {item.score}
                      </div>
                    )}

                    {item.isPremium && (
                      <div className="absolute top-2 right-2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md">
                        PREMIUM
                      </div>
                    )}
                  </div>

                  {/* Title and Metadata */}
                  <div className="p-3.5 space-y-2">
                    <h3 className="text-sm font-semibold text-white group-hover:text-yellow-400 transition-colors line-clamp-2 leading-snug">
                      {item.title}
                    </h3>

                    {/* Creator Info and Views */}
                    <div className="flex items-center justify-between text-xs text-zinc-400 pt-0.5">
                      <span className="text-zinc-300 font-medium truncate max-w-[130px]">
                        {item.creatorName || 'Elysian Creator'}
                      </span>
                      <span className="font-mono tabular-nums text-zinc-400 flex items-center gap-1">
                        <Eye className="w-3 h-3 text-zinc-500" />
                        <span>{item.views ? Number(item.views).toLocaleString() : '0'}</span>
                      </span>
                    </div>

                    {/* Match Reasoning Snippet */}
                    {item.matchReasons && item.matchReasons.length > 0 && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md px-2 py-0.5 text-[11px] text-yellow-300 truncate">
                        {item.matchReasons[0]}
                      </div>
                    )}

                    {/* Tags preview */}
                    {Array.isArray(item.tags) && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.tags.slice(0, 2).map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedTag(tag); }}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 transition-colors"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default SearchResults;
