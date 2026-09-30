import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TalentProfile } from '../types';
import { MapPin, Star, ShieldCheck, CheckCircle2, MessageCircle, Calendar, Search, Sparkles, X } from 'lucide-react';
import { api } from '../services/api';
import { scoreTalentProfile, ScoredTalentProfile } from '../services/searchAlgorithm';

interface TalentDirectoryProps {
  onNavigateMessages?: (talentId?: string) => void;
  onNavigateSearch?: (query: string) => void;
}

const TalentDirectory: React.FC<TalentDirectoryProps> = ({ onNavigateMessages }) => {
  const [talent, setTalent] = useState<TalentProfile[]>([]);
  const [uniqueLocations, setUniqueLocations] = useState<string[]>([]);
  const [filterCity, setFilterCity] = useState('');
  const [smartMatchQuery, setSmartMatchQuery] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for booking feedback
  const [bookedTalent, setBookedTalent] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State for location suggestions
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const fetchTalent = async () => {
        setIsLoading(true);
        try {
            const allTalent = await api.talent.getAll();
            setTalent(allTalent);
            // Extract unique city names for suggestions
            const locations = [...new Set(allTalent.map(t => t.location.split(',')[0].trim()))];
            setUniqueLocations(locations);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };
    fetchTalent();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
            setShowSuggestions(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setFilterCity(query);

    if (query.length > 0) {
        const suggestions = uniqueLocations.filter(loc =>
            loc.toLowerCase().startsWith(query.toLowerCase())
        );
        setLocationSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
    } else {
        setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setFilterCity(suggestion);
    setShowSuggestions(false);
  };

  const handleSmartMatch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = smartMatchQuery.trim();
    if (!clean) {
      setActiveSearchTerm('');
      return;
    }
    
    setIsMatching(true);
    setActiveSearchTerm(clean);
    
    setTimeout(() => {
      setIsMatching(false);
    }, 150);
  };

  const handleClearSearch = () => {
    setSmartMatchQuery('');
    setActiveSearchTerm('');
  };

  const handleBook = async (t: TalentProfile) => {
    const user = await api.auth.getSession();
    if (!user) {
      alert('Please log in to book talent.');
      return;
    }
    const targetUserId = t.userId || t.id;
    setBookingLoading(t.id);
    setErrorMessage(null);
    try {
      const thread = await api.chat.open(targetUserId);
      await api.chat.sendMessage(thread.id, `Hi ${t.name}, I would like to inquire about booking your creative services.`);
      setBookedTalent(t.name);
      setTimeout(() => setBookedTalent(null), 3500);
      if (onNavigateMessages) {
        onNavigateMessages(targetUserId);
      }
    } catch (err: any) {
      console.error('Booking failed:', err);
      const msg = err.message || 'Chat is disabled for this talent profile.';
      setErrorMessage(msg);
      alert(msg);
    } finally {
      setBookingLoading(null);
    }
  };

  const handleMessage = async (t: TalentProfile) => {
    const user = await api.auth.getSession();
    if (!user) {
      alert('Please log in to message talent.');
      return;
    }
    const targetUserId = t.userId || t.id;
    try {
      await api.chat.open(targetUserId);
      if (onNavigateMessages) {
        onNavigateMessages(targetUserId);
      }
    } catch (err: any) {
      alert(err.message || 'Messaging is currently disabled for this talent.');
    }
  };

  const filteredTalent = useMemo(() => {
    let list = talent;
    if (filterCity.trim()) {
      const cityLower = filterCity.trim().toLowerCase();
      list = list.filter(t => (t.location || '').toLowerCase().includes(cityLower));
    }

    if (activeSearchTerm.trim()) {
      const scoredList: ScoredTalentProfile[] = [];
      for (const t of list) {
        const scored = scoreTalentProfile(t, activeSearchTerm);
        if (scored) {
          scoredList.push(scored);
        }
      }
      scoredList.sort((a, b) => b.score - a.score);
      return scoredList;
    }

    return list;
  }, [talent, filterCity, activeSearchTerm]);

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {bookedTalent && (
          <div className="fixed bottom-20 right-4 md:bottom-10 md:right-10 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center animate-bounce">
              <CheckCircle2 className="w-5 h-5 mr-3" />
              Request sent to {bookedTalent}!
          </div>
      )}

      <div className="bg-[#111] border border-zinc-800 rounded-2xl md:rounded-3xl p-6 md:p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Find Verified Models</h1>
            <p className="text-zinc-400 mb-6 max-w-xl text-sm md:text-base">
                Browse South Africa's premier directory of verified adult industry models. Filter by location, services, and availability.
            </p>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <div className="bg-black p-2 rounded-xl border border-zinc-800 flex items-center shadow-inner">
                        <MapPin className="ml-3 text-zinc-500 w-5 h-5 flex-shrink-0" />
                        <input 
                            type="text" 
                            placeholder="Location (e.g. Sandton)"
                            className="bg-transparent border-none focus:outline-none text-zinc-200 px-4 w-full py-2 text-sm md:text-base"
                            value={filterCity}
                            onChange={handleLocationChange}
                            onFocus={handleLocationChange}
                        />
                    </div>
                    {showSuggestions && (
                        <div ref={suggestionsRef} className="absolute top-full mt-2 w-full bg-[#111] border border-zinc-800 rounded-xl shadow-lg z-10 overflow-hidden animate-fade-in-up">
                            <ul className="py-1">
                                {locationSuggestions.map((suggestion, index) => (
                                    <li key={index}>
                                        <button
                                            type="button"
                                            onClick={() => handleSuggestionClick(suggestion)}
                                            className="w-full text-left px-4 py-2 text-zinc-300 hover:bg-yellow-500/10 hover:text-yellow-400 transition-colors text-sm"
                                        >
                                            {suggestion}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                <form onSubmit={handleSmartMatch} className="flex-[2] bg-black p-2 rounded-xl border border-zinc-800 flex items-center shadow-inner">
                    <div className="relative w-full flex items-center">
                         <input 
                            type="text" 
                            placeholder="Describe needs (e.g. 'Party in Cape Town', 'Lingerie', '4K')"
                            className="bg-transparent border-none focus:outline-none text-zinc-200 px-4 w-full py-2 text-sm md:text-base"
                            value={smartMatchQuery}
                            onChange={(e) => setSmartMatchQuery(e.target.value)}
                        />
                        {smartMatchQuery && (
                          <button
                            type="button"
                            onClick={handleClearSearch}
                            className="p-1 text-zinc-500 hover:text-zinc-300 mr-2"
                            aria-label="Clear search query"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {isMatching && (
                             <span className="text-xs text-yellow-400 animate-pulse hidden sm:flex items-center gap-1 mr-2 whitespace-nowrap">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Ranking...</span>
                            </span>
                        )}
                    </div>
                   
                    <button 
                        type="submit"
                        className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 md:px-6 py-2 rounded-lg font-bold transition-all ml-2 shadow-lg shadow-yellow-500/20 text-sm md:text-base whitespace-nowrap active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                        <Search className="w-4 h-4 stroke-[2.5]" />
                        <span>Search</span>
                    </button>
                </form>
            </div>

            {/* Active search filter feedback */}
            {activeSearchTerm && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs text-yellow-300">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
                  <span>
                    Showing <strong>{filteredTalent.length}</strong> verified creator{filteredTalent.length === 1 ? '' : 's'} matching <strong>"{activeSearchTerm}"</strong> sorted by algorithmic relevance
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {onNavigateSearch && (
                    <button
                      type="button"
                      onClick={() => onNavigateSearch(activeSearchTerm)}
                      className="px-2.5 py-1 bg-yellow-500 text-black rounded font-bold hover:bg-yellow-400 transition-colors"
                    >
                      Search site-wide for "{activeSearchTerm}"
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="p-1 hover:text-white"
                    aria-label="Clear active filter"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="bg-black rounded-2xl border border-zinc-800 overflow-hidden animate-pulse flex flex-col h-[420px]">
              <div className="w-full h-64 md:h-72 bg-zinc-900/80"></div>
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-1/3 h-4 bg-zinc-900 rounded"></div>
                  <div className="w-3/4 h-6 bg-zinc-900 rounded"></div>
                </div>
                <div className="flex gap-2">
                  <div className="w-16 h-6 bg-zinc-900 rounded-md"></div>
                  <div className="w-16 h-6 bg-zinc-900 rounded-md"></div>
                </div>
                <div className="pt-4 border-t border-zinc-900 flex items-center justify-between">
                  <div className="w-20 h-6 bg-zinc-900 rounded"></div>
                  <div className="flex space-x-2">
                    <div className="w-10 h-10 bg-zinc-900 rounded-xl"></div>
                    <div className="w-20 h-10 bg-zinc-900 rounded-xl"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredTalent.length === 0 ? (
        <div className="text-center py-16 bg-[#111]/40 border border-zinc-900 rounded-3xl p-8">
          <p className="text-zinc-400 text-base font-semibold">No verified models match your filters</p>
          <p className="text-zinc-600 text-xs mt-1">Try clearing your location or search terms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredTalent.map((talent) => (
          <div key={talent.id} className="bg-black rounded-2xl border border-zinc-800 overflow-hidden hover:border-yellow-500/50 transition-all duration-300 group flex flex-col h-full hover:shadow-2xl hover:shadow-yellow-500/10">
            <div className="relative h-64 md:h-72">
              {talent.imageUrl ? (
                <img src={talent.imageUrl} alt={talent.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-yellow-500 font-bold text-4xl">
                  {(talent.name || "T").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
              
              {talent.verified && (
                  <div className="absolute top-4 left-4 bg-white/10 backdrop-blur-md border border-white/20 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-green-400" />
                    Verified
                  </div>
              )}

              {(talent as ScoredTalentProfile).score !== undefined && (
                <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md border border-zinc-700/60 text-yellow-400 font-mono tabular-nums text-xs px-2.5 py-1 rounded-md font-semibold">
                  Match Score: {(talent as ScoredTalentProfile).score}
                </div>
              )}

              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center">
                    {talent.name}
                    {talent.online && <span className="w-2.5 h-2.5 bg-green-500 rounded-full ml-2 border-2 border-black"></span>}
                  </h3>
                  <p className="text-zinc-300 text-sm">{talent.title}</p>
                </div>
                <div className="flex items-center bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                    <Star className="w-4 h-4 text-amber-500 fill-current mr-1" />
                    <span className="font-bold text-amber-500">{talent.rating}</span>
                </div>
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center text-sm text-zinc-400 mb-2">
                    <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0" />
                    <span className="truncate">{talent.location}</span>
                </div>

                {(talent as ScoredTalentProfile).matchReasons && (talent as ScoredTalentProfile).matchReasons.length > 0 && (
                  <div className="mb-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2.5 py-1 text-xs text-yellow-300 truncate">
                    {(talent as ScoredTalentProfile).matchReasons[0]}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mb-6">
                    {talent.tags.slice(0,3).map(tag => (
                        <span key={tag} className="px-2.5 py-1 bg-[#111] border border-zinc-800 rounded-md text-xs text-zinc-400">
                            {tag}
                        </span>
                    ))}
                </div>

                <div className="mt-auto pt-4 border-t border-zinc-900 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Rate</p>
                        <p className="text-lg font-bold text-white">R{talent.hourlyRate}<span className="text-sm font-normal text-zinc-500">/hr</span></p>
                    </div>
                    <div className="flex space-x-2">
                        <button 
                            type="button"
                            onClick={() => handleMessage(talent)}
                            aria-label={`Message ${talent.name}`}
                            className="p-2.5 rounded-xl bg-[#111] text-yellow-400 border border-zinc-800 hover:bg-yellow-500 hover:text-white transition-all"
                        >
                            <MessageCircle className="w-5 h-5" />
                        </button>
                        <button 
                            type="button"
                            disabled={bookingLoading === talent.id}
                            onClick={() => handleBook(talent)}
                            className="px-4 py-2.5 rounded-xl bg-yellow-500 text-white font-medium hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-500/20 flex items-center disabled:opacity-50"
                        >
                            <Calendar className="w-4 h-4 mr-2" />
                            {bookingLoading === talent.id ? 'Booking...' : 'Book'}
                        </button>
                    </div>
                </div>
            </div>
            
            <div className={`px-2 py-1 text-center text-[10px] font-bold uppercase tracking-widest ${
                talent.availability === 'Available Now' ? 'bg-green-500/10 text-green-500' : 
                talent.availability === 'This Week' ? 'bg-blue-500/10 text-blue-500' : 'bg-yellow-400/10 text-yellow-400'
            }`}>
                {talent.availability}
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
};

export default TalentDirectory;