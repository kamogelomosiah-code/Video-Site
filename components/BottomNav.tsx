import { PlayCircle, Users, Settings, MessageSquare, Search, ShieldCheck } from 'lucide-react';
import { User, UserRole } from '../types';

interface BottomNavProps {
  activePage: string;
  user?: User;
  onNavigate: (page: 'media' | 'directory' | 'messages' | 'profile' | 'search') => void;
  onAdminClick?: () => void;
  onMenuClick: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activePage, user, onNavigate, onAdminClick, onMenuClick }) => {
  const isAdmin = user?.role === UserRole.ADMIN;
  
  const navItems = [
    { id: 'media', label: 'Media', icon: PlayCircle, action: () => onNavigate('media') },
    { id: 'search', label: 'Search', icon: Search, action: () => onNavigate('search') },
    { id: 'directory', label: 'Talent', icon: Users, action: () => onNavigate('directory') },
    { id: 'messages', label: 'Chat', icon: MessageSquare, action: () => onNavigate('messages') },
    ...(isAdmin && onAdminClick ? [{ id: 'admin-dashboard', label: 'Admin', icon: ShieldCheck, action: onAdminClick }] : []),
    { id: 'profile', label: 'Profile', icon: Settings, action: () => onNavigate('profile') },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-zinc-800 z-40 md:hidden safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={item.action}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform ${
              activePage === item.id ? 'text-yellow-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <item.icon className={`w-5 h-5 ${activePage === item.id ? 'stroke-2 text-yellow-400' : ''}`} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BottomNav;