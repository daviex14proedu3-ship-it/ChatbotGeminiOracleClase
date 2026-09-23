import React from 'react';
import { Bot, Power, Sparkles, AlertCircle, LogOut, User } from 'lucide-react';
import { WhatsAppStatus, AppSettings, AuthUser } from '../../types';

interface HeaderProps {
  title: string;
  subtitle?: string;
  status: WhatsAppStatus;
  settings?: AppSettings;
  user?: AuthUser | null;
  onToggleBot?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  status,
  settings,
  user,
  onToggleBot,
  onLogout,
}) => {
  const isConnected = status.state === 'connected';
  const botEnabled = settings?.botEnabled ?? true;

  const activeKey = settings?.geminiKeys?.[settings.activeKeyIndex ?? 0];

  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Gemini Active Model & Failover Status */}
        {settings && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-300 font-medium">
              {settings.selectedModel || 'gemini-2.0-flash'}
            </span>
            {activeKey && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                  activeKey.status === 'exhausted'
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-purple-500/20 text-purple-300'
                }`}
                title={`Clave: ${activeKey.name} (${activeKey.status})`}
              >
                {activeKey.status === 'exhausted' ? 'Agotada' : 'Pool OK'}
              </span>
            )}
          </div>
        )}

        {/* Bot Auto-Responder Switch */}
        {onToggleBot && (
          <button
            onClick={onToggleBot}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
              botEnabled
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className={`w-3.5 h-3.5 ${botEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span>Bot IA: {botEnabled ? 'Activo' : 'En Pausa'}</span>
            <Power className="w-3 h-3 ml-1" />
          </button>
        )}

        {/* WhatsApp Status Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${
            isConnected
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : status.state === 'waiting_qr'
              ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? 'bg-emerald-400 shadow-glow'
                : status.state === 'waiting_qr'
                ? 'bg-amber-400 animate-ping'
                : 'bg-rose-400'
            }`}
          />
          <span>
            {isConnected
              ? `WA: +${status.botPhone || 'Conectado'}`
              : status.state === 'waiting_qr'
              ? 'Escanear QR'
              : 'Desconectado'}
          </span>
        </div>

        {/* User Profile & Logout Button */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium max-w-[140px] truncate" title={user.email}>
                {user.email}
              </span>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                title="Cerrar Sesión"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
