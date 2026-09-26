import React from 'react';
import {
  LayoutDashboard,
  Users,
  Send,
  Sparkles,
  Image as ImageIcon,
  MessageSquare,
  Terminal,
  Database,
  Calendar,
} from 'lucide-react';
import { NavTab } from './DesktopSidebar';

interface MobileNavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const MobileNavbar: React.FC<MobileNavbarProps> = ({ currentTab, onSelectTab }) => {
  const items = [
    { id: 'dashboard' as NavTab, label: 'Panel', icon: LayoutDashboard },
    { id: 'bookings' as NavTab, label: 'Agenda', icon: Calendar },
    { id: 'groups' as NavTab, label: 'Grupos', icon: Users },
    { id: 'messaging' as NavTab, label: 'Envíos', icon: Send },
    { id: 'ai_settings' as NavTab, label: 'IA & KB', icon: Sparkles },
    { id: 'memory' as NavTab, label: 'Memoria', icon: Database },
    { id: 'media_catalog' as NavTab, label: 'WebP', icon: ImageIcon },
    { id: 'simulator' as NavTab, label: 'Chat', icon: MessageSquare },
    { id: 'logs' as NavTab, label: 'Logs', icon: Terminal },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 z-50 px-2 flex items-center justify-around">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
              isActive ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition ${
                isActive ? 'bg-emerald-500/15' : 'bg-transparent'
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
