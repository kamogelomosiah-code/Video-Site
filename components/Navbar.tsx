import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Notification } from '../types';
import { Search, Bell, Menu, ShieldCheck, LogIn, LogOut, X } from 'lucide-react';
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
}

const Navbar: React.FC<NavbarProps> = ({ 
  user, currentPage, onVerifyClick, onLoginClick, onAdminClick, onProfileClick, onLogout, onMenuClick
}) => {
  const isGuest = user.id === 'guest';
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isGuest) {
      setNotifications([]);
      return;
    }

    const fetchNotifications = async () => {
      try {
        const data = await api.notifications.getAll(user.id);
        if (Array.isArray(data)) {
          setNotifications(data);
        } else {
          setNotifications([]);
        }
      } catch (err: any) {
        const isSessionErr = err?.status === 401 || 
                             err?.message?.includes("Session expired") || 
                             err?.message?.includes("Authentication required") ||
                             err?.message?.includes("Unauthorized");
        
        const isNetworkErr = err?.message?.includes("Failed to fetch") || 
                             err?.name === "TypeError" || 
                             err?.message?.includes("NetworkError");
        
        setNotifications([]);
        if (isSessionErr) {
          console.warn('Session expired or invalid. Logging out.');
          onLogout();
        } else if (isNetworkErr) {
          console.log('Notification fetch skipped (transient server/network offline)');
        } else {
          console.error('Failed to fetch notifications:', err);
        }
      }
    };
    
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Poll less frequently

    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) setShowNotifications(false);
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      clearInterval(interval);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [user.id, isGuest]);

  useEffect(() => {
    if (showMobileSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showMobileSearch]);

  const unreadCount = Array.isArray(notifications) ? notifications.filter(n => !n.read).length : 0;
  const handleMarkAllRead = async () => { 
    if (isGuest) return;
    try {
      await api.notifications.markAllRead(user.id);
      const data = await api.notifications.getAll(user.id);
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };
  const handleNotificationClick = async (id: string) => { 
    if (isGuest) return;
    try {
      await api.notifications.markRead(id);
      const data = await api.notifications.getAll(user.id);
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  return (
    <header className="h-16 bg-black/80 backdrop-blur-md border-b border-zinc-900 flex items-center justify-between px-4 sticky top-0 z-30 flex-shrink-0">
      
      {/* Mobile Search Overlay */}
      {showMobileSearch ? (
         <div className="absolute inset-0 bg-black flex items-center px-4 z-40 animate-fade-in">
            <Search className="w-5 h-5 text-zinc-500 mr-3" />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Search content..." 
              className="flex-1 bg-transparent border-none text-white focus:outline-none text-base"
              onBlur={() => !searchInputRef.current?.value && setShowMobileSearch(false)}
            />
            <button onClick={() => setShowMobileSearch(false)} className="p-2 text-zinc-400">
              <X className="w-6 h-6" />
            </button>
         </div>
      ) : (
        <>
          <div className="flex items-center flex-1">
            <button type="button" aria-label="Open menu" className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white" onClick={onMenuClick}>
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="relative max-w-md w-full ml-4 hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
              <input type="text" placeholder="Search creators, professionals, or content..." className="w-full bg-black border border-zinc-800 rounded-full py-2 pl-10 pr-4 text-sm text-zinc-200 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all" />
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-4">
            {/* Mobile Search Trigger */}
            <button type="button" onClick={() => setShowMobileSearch(true)} className="md:hidden p-2 text-zinc-400 hover:text-white">
              <Search className="w-5 h-5" />
            </button>

            {!isGuest && !user.verified && (
              <button type="button" onClick={onVerifyClick} className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-yellow-500/10 text-yellow-400 rounded-full text-xs font-medium hover:bg-yellow-500/20 border border-yellow-500/20 transition-all">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Get Verified</span>
              </button>
            )}
            
            {/* Notifications icon (hidden when in Admin Panel) */}
            {currentPage !== 'admin-dashboard' && (
              <div className="relative" ref={notificationsRef}>
                  <button type="button" aria-label="Toggle notifications" onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 text-zinc-400 hover:text-yellow-400 transition-colors">
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-yellow-500 rounded-full border-2 border-zinc-950 animate-pulse"></span>}
                  </button>
                  {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 bg-[#111] border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
                          <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-black/50 backdrop-blur-sm"><h3 className="font-bold text-white text-sm">Notifications</h3>{unreadCount > 0 && <button type="button" onClick={handleMarkAllRead} className="text-xs text-yellow-400 hover:text-yellow-300 font-medium">Mark all read</button>}</div>
                          <div className="max-h-80 overflow-y-auto">{notifications.length === 0 ? <div className="p-8 text-center text-zinc-500 text-sm">No notifications yet.</div> : notifications.map(notif => (<div key={notif.id} onClick={() => handleNotificationClick(notif.id)} className={`p-4 border-b border-zinc-800/50 hover:bg-zinc-800 cursor-pointer transition-colors ${!notif.read ? 'bg-yellow-500/5' : ''}`}><div className="flex items-start"><div className={`w-2 h-2 rounded-full mt-2 mr-3 flex-shrink-0 ${!notif.read ? 'bg-yellow-500' : 'bg-transparent'}`}></div><div><p className={`text-sm ${!notif.read ? 'text-white font-medium' : 'text-zinc-400'}`}>{notif.message}</p><p className="text-xs text-zinc-600 mt-1">{notif.createdAt}</p></div></div></div>))}</div>
                      </div>
                  )}
              </div>
            )}

            <div className="flex items-center space-x-3 border-l border-zinc-800 pl-2 sm:pl-4">
              {isGuest ? (
                 <button type="button" onClick={onLoginClick} className="flex items-center space-x-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg shadow-yellow-500/20 transition-all transform hover:scale-105 active:scale-95"><LogIn className="w-4 h-4" /><span className="hidden sm:inline">Sign In</span></button>
              ) : (
                <div className="relative" ref={userMenuRef}>
                  <button type="button" onClick={() => setShowUserMenu(!showUserMenu)} className="relative group flex items-center space-x-2 focus:outline-none">
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
                     <div className="absolute right-0 mt-2 w-48 bg-[#111] border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in-up">
                        <div className="px-4 py-3 border-b border-zinc-800 sm:hidden">
                          <p className="text-white font-medium truncate">{user.name}</p>
                          <p className="text-xs text-zinc-500">{user.role}</p>
                        </div>
                        <button type="button" onClick={() => { onProfileClick(); setShowUserMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">My Profile</button>
                        {user.role === UserRole.ADMIN && (
                            <button type="button" onClick={() => { onAdminClick(); setShowUserMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors sm:hidden">Admin Dashboard</button>
                        )}
                        <button type="button" onClick={() => { onLogout(); setShowUserMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-yellow-400 hover:bg-zinc-800 hover:text-yellow-300 flex items-center transition-colors border-t border-zinc-800"><LogOut className="w-4 h-4 mr-2"/>Sign Out</button>
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