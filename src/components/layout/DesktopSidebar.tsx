import React from 'react';
import {
  LayoutDashboard,
  Users,
  Send,
  Sparkles,
  Image as ImageIcon,
  MessageSquare,
  Terminal,
  Wifi,
  WifiOff,
  RefreshCw,
  LogOut,
  User,
  Database,
  Calendar,
} from 'lucide-react';
import { WhatsAppStatus, AuthUser } from '../../types';

export type NavTab =
  | 'dashboard'
  | 'bookings'
  | 'groups'
  | 'messaging'
  | 'ai_settings'
  | 'memory'
  | 'media_catalog'
  | 'simulator'
  | 'logs';

interface DesktopSidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  status: WhatsAppStatus;
  user?: AuthUser | null;
  onReconnect: () => void;
  onLogout?: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  currentTab,
  onSelectTab,
  status,
  user,
  onReconnect,
  onLogout,
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Panel & Conexión', icon: LayoutDashboard },
    { id: 'bookings' as NavTab, label: 'Agenda & Clases', icon: Calendar, badge: 'IA Gemini' },
    { id: 'groups' as NavTab, label: 'Grupos WhatsApp', icon: Users, badge: 'Filtros' },
    { id: 'messaging' as NavTab, label: 'Envíos & Excel', icon: Send, badge: 'Smart' },
    { id: 'ai_settings' as NavTab, label: 'IA & Base Conocimiento', icon: Sparkles },
    { id: 'memory' as NavTab, label: 'Memoria & Base de Datos', icon: Database, badge: 'Oracle/Supa' },
    { id: 'media_catalog' as NavTab, label: 'Catálogo & WebP', icon: ImageIcon },
    { id: 'simulator' as NavTab, label: 'Simulador Chat IA', icon: MessageSquare },
    { id: 'logs' as NavTab, label: 'Logs en Vivo', icon: Terminal },
  ];

  const isConnected = status.state === 'connected';

  return (
    <aside className="hidden md:flex flex-col w-72 h-screen fixed left-0 top-0 bg-slate-950/95 border-r border-slate-800/80 backdrop-blur-xl z-40 select-none">
      {/* Brand Header */}
      <div className="p-6 pb-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-950/50">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              OmniBot <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">SaaS</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">WhatsApp + Gemini Failover</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto custom-scrollbar">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Módulos Principales
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all group ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-950/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900/80 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition ${
                    isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-400 group-hover:text-slate-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* WhatsApp Connection Quick Card */}
      <div className="p-4 m-3 rounded-2xl bg-slate-900/80 border border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
            ) : (
              <WifiOff className="w-4 h-4 text-rose-400" />
            )}
            <span className="text-xs font-semibold text-slate-200">WhatsApp</span>
          </div>
          <button
            onClick={onReconnect}
            title="Reiniciar conexión"
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? 'bg-emerald-400 shadow-glow'
                : status.state === 'waiting_qr'
                ? 'bg-amber-400 animate-ping'
                : status.state === 'connecting'
                ? 'bg-sky-400 animate-pulse'
                : 'bg-rose-500'
            }`}
          />
          <span className="text-[11px] text-slate-300 font-medium capitalize">
            {isConnected
              ? `Conectado (+${status.botPhone || 'Bot'})`
              : status.state === 'waiting_qr'
              ? 'Esperando QR'
              : status.state === 'connecting'
              ? 'Conectando...'
              : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* User Session & Logout Card */}
      {user && (
        <div className="p-3 mx-3 mb-3 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Admin</p>
              <p className="text-xs text-slate-200 font-medium truncate" title={user.email}>
                {user.email}
              </p>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              title="Cerrar Sesión"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
