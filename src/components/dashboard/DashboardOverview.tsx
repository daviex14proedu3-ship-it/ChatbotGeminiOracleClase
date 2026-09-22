import React from 'react';
import {
  Users,
  Send,
  Sparkles,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  MessageSquare,
  Shield,
  ArrowRight,
  TrendingUp,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { WhatsAppStatus, AppSettings } from '../../types';
import { ConnectionCard } from '../whatsapp/ConnectionCard';
import { NavTab } from '../layout/DesktopSidebar';

interface DashboardOverviewProps {
  status: WhatsAppStatus;
  settings: AppSettings | null;
  onRefresh: () => void;
  onSelectTab: (tab: NavTab) => void;
  groupsCount: number;
  kbCount: number;
  mediaCount: number;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  status,
  settings,
  onRefresh,
  onSelectTab,
  groupsCount,
  kbCount,
  mediaCount,
}) => {
  const isConnected = status.state === 'connected';
  const configuredKeysCount = settings?.geminiKeys?.filter((k) => k.key && k.key.trim() !== '').length || 0;

  return (
    <div className="space-y-6">
      {/* WhatsApp Connection Card */}
      <ConnectionCard status={status} onRefresh={onRefresh} />

      {/* No API Key Alert Banner if connected but key is missing */}
      {configuredKeysCount === 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 flex-shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-200">
                ⚠️ Clave de Google AI Studio pendiente de configuración
              </h4>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                {isConnected
                  ? 'WhatsApp está conectado, pero la IA no responderá a los mensajes entrantes hasta que ingreses tu API Key de Gemini.'
                  : 'Para que tu chatbot responda automáticamente, debes ingresar tu API Key gratuita de Gemini.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectTab('ai_settings')}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-2 shadow-md flex-shrink-0"
          >
            <span>Configurar Clave Ahora</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Groups */}
        <div
          onClick={() => onSelectTab('groups')}
          className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer group shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Grupos de WhatsApp</span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 group-hover:scale-110 transition">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-white">{groupsCount}</span>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Filtrado & Envíos</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition" />
            </p>
          </div>
        </div>

        {/* Card 2: Knowledge Base */}
        <div
          onClick={() => onSelectTab('ai_settings')}
          className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer group shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Base de Conocimientos</span>
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 group-hover:scale-110 transition">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-white">{kbCount}</span>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Artículos Activos</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition" />
            </p>
          </div>
        </div>

        {/* Card 3: Media Catalog */}
        <div
          onClick={() => onSelectTab('media_catalog')}
          className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer group shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Catálogo WebP IA</span>
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 group-hover:scale-110 transition">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-white">{mediaCount}</span>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Imágenes optimizadas</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition" />
            </p>
          </div>
        </div>

        {/* Card 4: Gemini Failover Status */}
        <div
          onClick={() => onSelectTab('ai_settings')}
          className={`p-5 rounded-2xl border transition cursor-pointer group shadow-lg flex flex-col justify-between ${
            configuredKeysCount === 0
              ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400'
              : 'bg-slate-900 border border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Pool de Claves IA</span>
            <div
              className={`p-2 rounded-xl group-hover:scale-110 transition ${
                configuredKeysCount === 0
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-black ${configuredKeysCount === 0 ? 'text-amber-400' : 'text-white'}`}>
                {configuredKeysCount}
              </span>
              {configuredKeysCount === 0 && (
                <span className="text-[11px] font-bold text-amber-400/90">
                  (Sin Configurar)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{configuredKeysCount === 0 ? 'Haz clic para agregar' : (settings?.selectedModel || 'Gemini')}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition" />
            </p>
          </div>
        </div>
      </div>

      {/* Google AI Studio Quick Access Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-emerald-950/40 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Google AI Studio & Modelos Flash-Lite (3.5 / 3.1)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                0 Tokens / Gratuito
              </span>
            </h4>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Utiliza modelos ultrarrápidos de bajo consumo y obtén tus API keys directamente en la consola oficial.
            </p>
          </div>
        </div>

        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-purple-950/40 flex-shrink-0"
        >
          <span>Obtener Clave en Google AI Studio</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Feature Highlights Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Action Card 1: Bulk Sender */}
        <div
          onClick={() => onSelectTab('messaging')}
          className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-950/40 border border-slate-800 hover:border-emerald-500/40 transition cursor-pointer group shadow-xl"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition">
                Envío Masivo Inteligente con Excel
              </h4>
              <p className="text-xs text-slate-400">
                Pega celdas o sube tu .xlsx con detección automática de teléfonos y nombres.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold mt-4">
            <span>Configurar Campaña</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </div>
        </div>

        {/* Action Card 2: Chat Simulator */}
        <div
          onClick={() => onSelectTab('simulator')}
          className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-purple-950/40 border border-slate-800 hover:border-purple-500/40 transition cursor-pointer group shadow-xl"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition">
                Probar Chatbot en el Simulador
              </h4>
              <p className="text-xs text-slate-400">
                Interactúa con Gemini, verifica la base de conocimientos y el envío de imágenes.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-purple-400 font-semibold mt-4">
            <span>Abrir Simulador</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </div>
        </div>
      </div>
    </div>
  );
};
