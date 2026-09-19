import React, { useState, useEffect, useRef } from 'react';
import { TalentProfile } from '../types';
import { MapPin, Star, ShieldCheck, CheckCircle2, MessageCircle, Calendar } from 'lucide-react';
import { api } from '../services/api';

const TalentDirectory: React.FC = () => {
  const [talent, setTalent] = useState<TalentProfile[]>([]);
  const [uniqueLocations, setUniqueLocations] = useState<string[]>([]);
  const [filterCity, setFilterCity] = useState('');
  const [smartMatchQuery, setSmartMatchQuery] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  
  // State for booking feedback
  const [bookedTalent, setBookedTalent] = useState<string | null>(null);

  // State for location suggestions
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const fetchTalent = async () => {
        try {
            const allTalent = await api.talent.getAll();
            setTalent(allTalent);
            // Extract unique city names for suggestions
            const locations = [...new Set(allTalent.map(t => t.location.split(',')[0].trim()))];
            setUniqueLocations(locations);
        } catch (error) {
            console.error(error);
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

  const handleSmartMatch = async () => {
    if (!smartMatchQuery) return;
    setIsMatching(true);
    
    // Simulate AI delay via local timeout since api doesn't have a semantic search mock yet
    setTimeout(() => {
      setIsMatching(false);
      // In a real app, we would use Gemini here to filter results semantically
    }, 1500);
  };

  const handleBook = async (name: string) => {
      const user = await api.auth.getSession();
      if (!user) {
          alert('Please log in to book talent.');
          return;
      }
      setBookedTalent(name);
      // Clear toast after 3s
      setTimeout(() => setBookedTalent(null), 3000);
  };

  const handleMessage = (name: string) => {
      alert(`Demo Mode: Messaging ${name} requires a premium subscription.`);
  };

  const filteredTalent = talent.filter(t => 
    t.location.toLowerCase().includes(filterCity.toLowerCase())
  );

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
                <div className="flex-[2] bg-black p-2 rounded-xl border border-zinc-800 flex items-center shadow-inner">
                    <div className="relative w-full">
                         <input 
                            type="text" 
                            placeholder="Describe needs (e.g. 'Party in Cape Town')"
                            className="bg-transparent border-none focus:outline-none text-zinc-200 px-4 w-full py-2 text-sm md:text-base"
                            value={smartMatchQuery}
                            onChange={(e) => setSmartMatchQuery(e.target.value)}
                        />
                        {isMatching && (
                             <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-yellow-300 animate-pulse hidden sm:block">
                                AI Matching...
                            </span>
                        )}
                    </div>
                   
                    <button 
                        type="button"
                        onClick={handleSmartMatch}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 md:px-6 py-2 rounded-lg font-medium transition-colors ml-2 shadow-lg shadow-yellow-500/20 text-sm md:text-base whitespace-nowrap"
                    >
                        Search
                    </button>
                </div>
            </div>
        </div>
      </div>

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
                <div className="flex items-center text-sm text-zinc-400 mb-4">
                    <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0" />
                    <span className="truncate">{talent.location}</span>
                </div>

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
                            onClick={() => handleMessage(talent.name)}
                            aria-label={`Message ${talent.name}`}
                            className="p-2.5 rounded-xl bg-[#111] text-yellow-400 border border-zinc-800 hover:bg-yellow-500 hover:text-white transition-all"
                        >
                            <MessageCircle className="w-5 h-5" />
                        </button>
                        <button 
                            type="button"
                            onClick={() => handleBook(talent.name)}
                            className="px-4 py-2.5 rounded-xl bg-yellow-500 text-white font-medium hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-500/20 flex items-center"
                        >
                            <Calendar className="w-4 h-4 mr-2" />
                            Book
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
    </div>
  );
};

export default TalentDirectory;