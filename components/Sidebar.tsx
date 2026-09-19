import React from 'react';
import { PlayCircle, Users, Settings, Shield, ShieldCheck, MessageSquare, X } from 'lucide-react';
import { User, UserRole } from '../types';

interface SidebarProps {
  user: User;
  activePage: 'media' | 'directory' | 'messages' | 'profile' | 'admin-dashboard';
  onNavigate: (page: 'media' | 'directory' | 'messages' | 'profile') => void;
  onAdminClick: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, activePage, onNavigate, onAdminClick, isOpen, onClose }) => {
  const navItems = [
    { id: 'media', label: 'Media Hub', icon: PlayCircle, action: () => onNavigate('media') },
    { id: 'directory', label: 'Talent Directory', icon: Users, action: () => onNavigate('directory') },
    { id: 'messages', label: 'Messages', icon: MessageSquare, action: () => onNavigate('messages') },
    { id: 'profile', label: 'My Profile', icon: Settings, action: () => onNavigate('profile') },
  ];

  const SidebarContent = () => (
    <div className="w-64 bg-black border-r border-zinc-900 flex flex-col justify-between h-full safe-area-pb">
      <div>
        <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-900">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg shadow-yellow-500/20 overflow-hidden">
              <img src="/peach-svgrepo-com.svg" alt="Elysian logo" className="w-6 h-6 object-contain" />
            </div>
            <span className="ml-3 font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
              Elysian
            </span>
          </div>
          {/* Mobile Close Button */}
          <button 
            type="button" 
            onClick={onClose} 
            className="md:hidden text-zinc-400 hover:text-white p-1 rounded-lg bg-zinc-900/50 border border-zinc-800"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="mt-6 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={item.action}
              className={`w-full flex items-center justify-start px-4 py-3 rounded-xl transition-all duration-200 group ${
                activePage === item.id ? 'bg-yellow-500/10 text-yellow-400' : 'text-zinc-400 hover:bg-[#111] hover:text-zinc-200'
              }`}
            >
              <item.icon className={`w-6 h-6 ${activePage === item.id ? 'stroke-2' : 'stroke-1.5'}`} />
              <span className={`ml-3 font-medium ${activePage === item.id ? 'font-semibold' : ''}`}>{item.label}</span>
              {activePage === item.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(220,38,38,0.6)]"></div>}
            </button>
          ))}
          
          {user.role === UserRole.ADMIN && (
             <button
              type="button"
              onClick={onAdminClick}
              className={`w-full flex items-center justify-start px-4 py-3 rounded-xl transition-all duration-200 group mt-4 border-t border-zinc-900 pt-6 ${
                activePage === 'admin-dashboard' ? 'bg-yellow-500/10 text-yellow-400' : 'text-zinc-400 hover:bg-[#111] hover:text-zinc-200'
              }`}
            >
              <ShieldCheck className={`w-6 h-6 ${activePage === 'admin-dashboard' ? 'stroke-2' : 'stroke-1.5'}`} />
              <span className={`ml-3 font-medium ${activePage === 'admin-dashboard' ? 'font-semibold' : ''}`}>Admin Panel</span>
              {activePage === 'admin-dashboard' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(220,38,38,0.6)]"></div>}
            </button>
          )}

        </nav>
      </div>
      <div className="p-4">
        <div className="bg-[#111] rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center space-x-2 text-yellow-400 mb-2">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Safety First</span>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            All creators and professionals are ID-verified using our bank-grade secure system.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block flex-shrink-0">
        <SidebarContent />
      </aside>
      
      {/* Mobile Sidebar */}
      <div className={`md:hidden fixed inset-0 z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </div>
      {isOpen && <div className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose}></div>}
    </>
  );
};

export default Sidebar;
