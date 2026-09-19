import React from 'react';
import { PlayCircle, Users, Settings, Menu, MessageSquare } from 'lucide-react';

interface BottomNavProps {
  activePage: string;
  onNavigate: (page: 'media' | 'directory' | 'messages' | 'profile') => void;
  onMenuClick: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activePage, onNavigate, onMenuClick }) => {
  const navItems = [
    { id: 'media', label: 'Media', icon: PlayCircle, action: () => onNavigate('media') },
    { id: 'directory', label: 'Talent', icon: Users, action: () => onNavigate('directory') },
    { id: 'messages', label: 'Chat', icon: MessageSquare, action: () => onNavigate('messages') },
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
            <item.icon className={`w-6 h-6 ${activePage === item.id ? 'stroke-2' : ''}`} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
        <button
            onClick={onMenuClick}
            className="flex flex-col items-center justify-center w-full h-full space-y-1 text-zinc-500 hover:text-zinc-300 active:scale-95 transition-transform"
        >
            <Menu className="w-6 h-6" />
            <span className="text-[10px] font-medium">Menu</span>
        </button>
      </div>
    </div>
  );
};

export default BottomNav;