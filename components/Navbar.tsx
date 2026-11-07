import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, MediaItem, TalentProfile } from '../types';
import { Search, Menu, ShieldCheck, LogIn, LogOut, X, Play, User as UserIcon, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

interface NavbarProps {
  user: User;
  currentPage?: string;
  onVerifyClick: () => void;
  onLoginClick: () => void;
  onAdminClick: () => void;
  onProfileClick: () => void;
  onLogout: () => void;
  onMenuClick: () => void;
  onSelectMedia?: (id: string) => void;
  onSelectTalent?: (id: string) => void;
  onSearchSubmit?: (query: string) => void;
  initialSearchQuery?: string;
}

const Navbar: React.FC<NavbarProps> = ({ 
  user, currentPage, onVerifyClick, onLoginClick, onAdminClick, onProfileClick, onLogout, onMenuClick,
  onSelectMedia, onSelectTalent, onSearchSubmit, initialSearchQuery = ''
}) => {
  const isGuest = user.id === 'guest';
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [searchResults, setSearchResults] = useState<{ media: MediaItem[]; talent: TalentProfile[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (showMobileSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showMobileSearch]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.search.query(query);
        setSearchResults(results);
        setShowSearchDropdown(true);
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    setShowSearchDropdown(false);
    setShowMobileSearch(false);
    if (onSearchSubmit) {
      onSearchSubmit(query);
    }
  };

  const handleMediaPick = (id: string) => {
    setShowSearchDropdown(false);
    setShowMobileSearch(false);
    if (onSelectMedia) onSelectMedia(id);
  };

  const handleTalentPick = (id: string) => {
    setShowSearchDropdown(false);
    setShowMobileSearch(false);
    if (onSelectTalent) onSelectTalent(id);
  };

  return (
    <header className="h-16 bg-black/80 backdrop-blur-md border-b border-zinc-900 flex items-center justify-between px-4 sticky top-0 z-30 flex-shrink-0">
      
      {/* Mobile Search Overlay */}
      {showMobileSearch ? (
         <div className="absolute inset-0 bg-black flex flex-col px-4 pt-2 z-50 animate-fade-in shadow-2xl">
            <form onSubmit={handleSearchSubmit} className="flex items-center h-12 w-full gap-2">
              <div className="flex-1 flex items-center bg-zinc-900 rounded-xl px-3 py-1.5 border border-zinc-800">
                <Search className="w-4 h-4 text-zinc-500 mr-2 shrink-0" />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search videos, creators, tags..." 
                  className="flex-1 bg-transparent border-none text-white focus:outline-none text-sm placeholder:text-zinc-500"
                />
                {isSearching && <Loader2 className="w-4 h-4 text-yellow-500 animate-spin mr-2 shrink-0" />}
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="p-1 text-zinc-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button 
                type="submit" 
                className="px-3.5 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl text-xs whitespace-nowrap active:scale-95 transition-all shadow-md cursor-pointer"
              >
                Search
              </button>
              <button 
                type="button" 
                onClick={() => { setShowMobileSearch(false); }} 
                className="p-1.5 text-zinc-400 hover:text-white"
                aria-label="Close search"
              >
                <X className="w-5 h-5" />
              </button>
            </form>

            {/* Mobile Search Results */}
            {searchResults && searchQuery.trim() && (
              <div className="max-h-[70vh] overflow-y-auto pb-4 divide-y divide-zinc-900">
                {searchResults.media.length === 0 && searchResults.talent.length === 0 ? (
                  <div className="py-6 text-center text-sm text-zinc-500">
                    <p>No quick results for "{searchQuery}"</p>
                    <button
                      type="button"
                      onClick={() => handleSearchSubmit()}
                      className="mt-3 px-4 py-2 bg-yellow-500 text-black font-bold rounded-xl text-xs inline-flex items-center gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Search entire site</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {searchResults.media.length > 0 && (
                      <div className="py-2">
                        <span className="text-xs uppercase font-bold text-zinc-500 px-2 tracking-wider">Videos</span>
                        {searchResults.media.slice(0, 5).map((m) => (
                          <div 
                            key={m.id} 
                            onClick={() => handleMediaPick(m.id)} 
                            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-zinc-900 cursor-pointer mt-1"
                          >
                            <div className="w-12 h-8 bg-zinc-800 rounded overflow-hidden flex-shrink-0 relative">
                              {m.thumbnailUrl ? <img src={m.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <Play className="w-4 h-4 text-zinc-600 m-auto" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium truncate">{m.title}</p>
                              <p className="text-xs text-zinc-500 truncate">{m.creatorName || 'Creator'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.talent.length > 0 && (
                      <div className="py-2">
                        <span className="text-xs uppercase font-bold text-zinc-500 px-2 tracking-wider">Creators</span>
                        {searchResults.talent.slice(0, 4).map((t) => (
                          <div 
                            key={t.id} 
                            onClick={() => handleTalentPick(t.id)} 
                            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-zinc-900 cursor-pointer mt-1"
                          >
                            <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0">
                              {t.avatarUrl ? <img src={t.avatarUrl} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 text-yellow-500 m-auto mt-2" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium truncate">{t.name}</p>
                              <p className="text-xs text-zinc-500 truncate">{t.title || 'Verified Creator'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSearchSubmit()}
                      className="w-full text-center py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded-xl border border-yellow-500/20 mt-2 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>View all results for "{searchQuery}"</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
         </div>
      ) : (
        <>
          <div className="flex items-center flex-1">
            <button type="button" aria-label="Open menu" className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white" onClick={onMenuClick}>
              <Menu className="w-6 h-6" />
            </button>
            
            {/* Desktop Global Search with Working Search Button & Live Results Dropdown */}
            <div className="relative max-w-md w-full ml-4 hidden md:block" ref={searchContainerRef}>
              <form onSubmit={handleSearchSubmit} className="relative w-full flex items-center">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4 pointer-events-none" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { if (searchResults) setShowSearchDropdown(true); }}
                  placeholder="Search creators, videos, tags, cities..." 
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-full py-2 pl-9 pr-24 text-sm text-zinc-200 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all placeholder:text-zinc-500" 
                />
                
                {isSearching ? (
                  <Loader2 className="absolute right-20 top-1/2 -translate-y-1/2 text-yellow-500 w-3.5 h-3.5 animate-spin" />
                ) : searchQuery ? (
                  <button 
                    type="button" 
                    onClick={() => setSearchQuery('')} 
                    className="absolute right-20 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}

                {/* Explicit Search Action Button */}
                <button
                  type="submit"
                  aria-label="Search site"
                  className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs rounded-full flex items-center gap-1 transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <Search className="w-3 h-3 stroke-[2.5]" />
                  <span>Search</span>
                </button>
              </form>

              {/* Desktop Results Dropdown */}
              {showSearchDropdown && searchResults && searchQuery.trim() && (
                <div className="absolute left-0 right-0 mt-2 bg-[#111] border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-96 overflow-y-auto">
                  {searchResults.media.length === 0 && searchResults.talent.length === 0 ? (
                    <div className="p-6 text-center text-sm text-zinc-500 space-y-2">
                      <p>No quick results for <span className="text-zinc-300 font-medium">"{searchQuery}"</span></p>
                      <button
                        type="button"
                        onClick={() => handleSearchSubmit()}
                        className="px-3.5 py-1.5 bg-yellow-500 text-black font-bold rounded-lg text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Search full platform</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-2 space-y-2">
                      {searchResults.media.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-zinc-500">
                            Videos ({searchResults.media.length})
                          </div>
                          {searchResults.media.slice(0, 4).map((item) => (
                            <div
                              key={item.id}
                              onClick={() => handleMediaPick(item.id)}
                              className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-zinc-800/70 cursor-pointer transition-colors"
                            >
                              <div className="w-14 h-9 bg-zinc-900 rounded overflow-hidden flex-shrink-0 relative border border-zinc-800">
                                {item.thumbnailUrl ? (
                                  <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Play className="w-3.5 h-3.5 text-yellow-500/80" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{item.title}</p>
                                <p className="text-xs text-zinc-400 truncate">{item.creatorName || 'Elysian Creator'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {searchResults.talent.length > 0 && (
                        <div className="border-t border-zinc-800/60 pt-2">
                          <div className="px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-zinc-500">
                            Creators ({searchResults.talent.length})
                          </div>
                          {searchResults.talent.slice(0, 3).map((talent) => (
                            <div
                              key={talent.id}
                              onClick={() => handleTalentPick(talent.id)}
                              className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-zinc-800/70 cursor-pointer transition-colors"
                            >
                              <div className="w-9 h-9 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-700">
                                {talent.avatarUrl ? (
                                  <img src={talent.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs text-yellow-500 font-bold">
                                    {talent.name.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{talent.name}</p>
                                <p className="text-xs text-zinc-400 truncate">{talent.title || 'Verified Creator'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Footer Full Search Button */}
                      <button
                        type="button"
                        onClick={() => handleSearchSubmit()}
                        className="w-full text-center py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded-b-xl border-t border-zinc-800/80 transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                      >
                        <span>View all results for "{searchQuery}"</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-4">
            {/* Mobile Search Trigger */}
            <button 
              type="button" 
              onClick={() => setShowMobileSearch(true)} 
              className="md:hidden p-2 text-zinc-400 hover:text-white"
              aria-label="Open search"
            >
              <Search className="w-5 h-5" />
            </button>

            {!isGuest && !user.verified && (
              <button type="button" onClick={onVerifyClick} className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-yellow-500/10 text-yellow-400 rounded-full text-xs font-medium hover:bg-yellow-500/20 border border-yellow-500/20 transition-all">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Get Verified</span>
              </button>
            )}

            {user.role === UserRole.ADMIN && (
              <button
                type="button"
                onClick={onAdminClick}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer ${
                  currentPage === 'admin-dashboard'
                    ? 'bg-yellow-500 text-zinc-950 shadow-yellow-500/20 ring-2 ring-yellow-400'
                    : 'bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/30'
                }`}
                title="Manage Site & Platform Controls"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Manage Site</span>
              </button>
            )}

            <div className="flex items-center space-x-3 border-l border-zinc-800 pl-2 sm:pl-4">
              {isGuest ? (
                 <button type="button" onClick={onLoginClick} className="flex items-center space-x-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg shadow-yellow-500/20 transition-all transform hover:scale-105 active:scale-95"><LogIn className="w-4 h-4" /><span className="hidden sm:inline">Sign In</span></button>
              ) : (
                <div className="relative" ref={userMenuRef}>
                  <button type="button" onClick={() => setShowUserMenu(!showUserMenu)} className="relative group flex items-center space-x-2 focus:outline-none cursor-pointer">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name || "User"} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-zinc-800 group-hover:border-yellow-500 object-cover transition-colors"/>
                    ) : (
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-zinc-800 group-hover:border-yellow-500 bg-zinc-800 text-yellow-500 font-bold flex items-center justify-center text-xs transition-colors">
                        {(user.name || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="text-right hidden sm:block"><p className="text-sm font-medium text-white max-w-[100px] truncate">{user.name}</p><p className="text-xs text-zinc-500">{user.role}</p></div>
                  </button>
                  {showUserMenu && (
                     <div className="absolute right-0 mt-2 w-52 bg-[#111] border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in-up">
                        <div className="px-4 py-3 border-b border-zinc-800">
                          <p className="text-white font-medium truncate">{user.name}</p>
                          <p className="text-xs text-yellow-500 font-semibold">{user.role}</p>
                        </div>
                        {user.role === UserRole.ADMIN && (
                            <button 
                              type="button" 
                              onClick={() => { onAdminClick(); setShowUserMenu(false); }} 
                              className="w-full text-left px-4 py-3 text-sm text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 font-bold flex items-center justify-between transition-colors border-b border-zinc-800/80 cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-yellow-400" />
                                <span>Admin Dashboard</span>
                              </span>
                              <span className="text-[10px] bg-yellow-500 text-zinc-950 px-1.5 py-0.5 rounded font-extrabold uppercase">Manage</span>
                            </button>
                        )}
                        <button type="button" onClick={() => { onProfileClick(); setShowUserMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer">My Profile</button>
                        <button type="button" onClick={() => { onLogout(); setShowUserMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-red-400 flex items-center transition-colors border-t border-zinc-800 cursor-pointer"><LogOut className="w-4 h-4 mr-2"/>Sign Out</button>
                     </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
};

export default Navbar;