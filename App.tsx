import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MediaHub from './pages/MediaHub';
import TalentDirectory from './pages/TalentDirectory';
import MediaView from './pages/MediaView';
import VerificationModal from './components/VerificationModal';
import UserProfile from './pages/UserProfile';
import AdminDashboard from './pages/AdminDashboard';
import Auth from './pages/Auth';
import ResetPassword from './pages/ResetPassword';
import AgeGate from './components/AgeGate';
import BottomNav from './components/BottomNav';
import { generateAvatar } from './services/avatar';
import { api } from './services/api';

import MessagesPage from './pages/Messages';
import Footer from './components/Footer';
import CMPBanner from './components/CMPBanner';
import LegalDocsModal from './components/LegalDocsModal';

const GUEST_USER: User = {
  id: 'guest',
  name: 'Guest',
  role: UserRole.CONSUMER,
  verified: false,
  avatarUrl: generateAvatar('Guest')
};

const App: React.FC = () => {
  // Persistence Logic for GitHub Pages / Static Hosting Refresh Support
  const [currentPage, setCurrentPage] = useState<'auth' | 'media' | 'directory' | 'messages' | 'profile' | 'view' | 'admin-dashboard' | 'reset-password'>(() => {
    return (localStorage.getItem('elysian_current_page') as any) || 'media';
  });
  
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    const path = window.location.pathname;
    const pageParam = params.get('page');
    if (path.includes('reset-password') || pageParam === 'reset-password' || (path === '/' && t)) {
      if (t) setResetToken(t);
      setCurrentPage('reset-password');
    }
  }, []);

  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(() => {
    return localStorage.getItem('elysian_media_id');
  });
  
  const [viewingUserId, setViewingUserId] = useState<string | null>(() => {
    return localStorage.getItem('elysian_viewing_user_id');
  });

  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [legalDocs, setLegalDocs] = useState<{ isOpen: boolean; tab: 'privacy' | 'terms' }>({
    isOpen: false,
    tab: 'privacy'
  });
  
  // Auth State
  const [currentUser, setCurrentUser] = useState<User>(GUEST_USER);

  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      try {
        const sessionUser = await api.auth.getSession();
        if (sessionUser) {
          setCurrentUser(sessionUser);
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
      } finally {
        setIsInitializing(false);
      }
    };
    initSession();
  }, []);

  // Save navigation state
  useEffect(() => {
    localStorage.setItem('elysian_current_page', currentPage);
    if (selectedMediaId) localStorage.setItem('elysian_media_id', selectedMediaId);
    else localStorage.removeItem('elysian_media_id');
    
    if (viewingUserId) localStorage.setItem('elysian_viewing_user_id', viewingUserId);
    else localStorage.removeItem('elysian_viewing_user_id');
  }, [currentPage, selectedMediaId, viewingUserId]);

  // Auth guard: redirect guests away from protected views
  useEffect(() => {
    if (isInitializing) return;
    if (currentUser.id === 'guest') {
      if (currentPage === 'admin-dashboard' || currentPage === 'profile' || currentPage === 'messages') {
        setCurrentPage('media');
      }
    } else if (currentUser.role !== UserRole.ADMIN && currentPage === 'admin-dashboard') {
      setCurrentPage('media');
    }
  }, [isInitializing, currentUser, currentPage]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.role === UserRole.ADMIN) {
      setCurrentPage('admin-dashboard');
    } else {
      setCurrentPage('media');
    }
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setCurrentUser(GUEST_USER);
    setCurrentPage('media');
    setViewingUserId(null);
    setSelectedMediaId(null);
  };
  
  const handleUserUpdate = (user: User) => {
    setCurrentUser(user);
  };

  const handleMediaClick = (id: string) => {
    // Navigate to view media first, which then links to profile.
    setSelectedMediaId(id);
    setCurrentPage('view');
    setIsSidebarOpen(false);
  };

  const handleNavigate = (page: 'media' | 'directory' | 'messages' | 'profile', userId?: string) => {
    if (page === 'profile' || page === 'messages') {
      if (currentUser.id === 'guest' && !userId) {
        setCurrentPage('auth');
        setIsSidebarOpen(false);
        return;
      }
      setViewingUserId(userId || currentUser.id);
    } else {
      setViewingUserId(null);
    }
    
    setCurrentPage(page);
    setSelectedMediaId(null);
    setIsSidebarOpen(false);
  };

  const handleAdminNav = () => {
    setCurrentPage('admin-dashboard');
    setIsSidebarOpen(false);
  }

  if (isInitializing) {
    return (
      <div className="h-screen bg-black text-zinc-50 font-poppins flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  if (currentPage === 'auth') {
    return (
      <div className="h-screen bg-black text-zinc-50 font-poppins">
        <Auth 
          onLogin={handleLogin} 
          onNavigateBack={() => setCurrentPage('media')}
          onNavigateReset={(token) => {
            setResetToken(token);
            setCurrentPage('reset-password');
          }}
        />
      </div>
    );
  }

  if (currentPage === 'reset-password') {
    return (
      <div className="h-screen bg-black text-zinc-50 font-poppins">
        <ResetPassword 
          token={resetToken || ''} 
          onNavigateLogin={() => {
            setCurrentPage('auth');
            window.history.replaceState({}, '', window.location.pathname);
          }}
          onLoginSuccess={(user) => {
            handleLogin(user);
            window.history.replaceState({}, '', '/');
          }}
        />
      </div>
    );
  }
  
  let activeSidebarPage: string = currentPage;
  if (currentPage === 'view') {
    activeSidebarPage = 'media';
  }

  return (
    <div className="flex h-full bg-black text-zinc-50 overflow-hidden font-poppins">
      <AgeGate />

      <Sidebar
        user={currentUser}
        activePage={activeSidebarPage as any}
        onNavigate={handleNavigate}
        onAdminClick={handleAdminNav}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Navbar 
          user={currentUser} 
          currentPage={currentPage}
          onVerifyClick={() => setIsVerificationOpen(true)}
          onLoginClick={() => setCurrentPage('auth')}
          onAdminClick={handleAdminNav}
          onProfileClick={() => handleNavigate('profile')}
          onLogout={handleLogout}
          onMenuClick={() => setIsSidebarOpen(true)}
        />
        
        {/* Added pb-24 to account for mobile BottomNav */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 scroll-smooth">
          <div className="max-w-7xl mx-auto">
             {currentPage === 'media' && <MediaHub onMediaClick={handleMediaClick} />}
             {currentPage === 'view' && selectedMediaId && (
               <MediaView mediaId={selectedMediaId} currentUser={currentUser} onBack={() => setCurrentPage('media')} onRelatedClick={handleMediaClick} />
             )}
             {currentPage === 'directory' && <TalentDirectory />}
             {currentPage === 'messages' && <MessagesPage currentUser={currentUser} onBack={() => setCurrentPage('media')} />}
             {currentPage === 'profile' && (
               <UserProfile 
                userId={viewingUserId || currentUser.id} 
                currentUser={currentUser} 
                onMediaClick={(id) => {
                   setSelectedMediaId(id);
                   setCurrentPage('view');
                }} 
                onUserUpdate={handleUserUpdate} 
               />
             )}
             {currentPage === 'admin-dashboard' && <AdminDashboard user={currentUser} />}
             <Footer onOpenPrivacy={() => setLegalDocs({ isOpen: true, tab: 'privacy' })} onOpenTerms={() => setLegalDocs({ isOpen: true, tab: 'terms' })} />
          </div>
        </main>

        <BottomNav 
          activePage={activeSidebarPage} 
          onNavigate={handleNavigate} 
          onMenuClick={() => setIsSidebarOpen(true)}
        />
      </div>

      {isVerificationOpen && <VerificationModal onClose={() => setIsVerificationOpen(false)} />}
      <CMPBanner onOpenLegalDocs={(tab) => setLegalDocs({ isOpen: true, tab })} />
      <LegalDocsModal 
        isOpen={legalDocs.isOpen} 
        onClose={() => setLegalDocs(p => ({ ...p, isOpen: false }))} 
        defaultTab={legalDocs.tab}
      />
    </div>
  );
};

export default App;