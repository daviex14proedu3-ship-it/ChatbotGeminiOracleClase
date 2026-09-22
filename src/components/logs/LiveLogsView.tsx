import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Trash2,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Info,
} from 'lucide-react';
import { LogEntry } from '../../types';
import { api } from '../../services/api';
import { socket } from '../../services/socket';
import { useToast } from '../../context/ToastContext';
import { ConfirmModal } from '../ui/ConfirmModal';

export const LiveLogsView: React.FC = () => {
  const toast = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [showClearModal, setShowClearModal] = useState(false);

  useEffect(() => {
    // Initial fetch
    api.getLogs().then(setLogs).catch(console.error);

    // Live socket listener
    const unsub = socket.on('log', (entry: LogEntry) => {
      setLogs((prev) => [entry, ...prev.slice(0, 199)]);
    });

    const unsubInitial = socket.on('initial_logs', (initialLogs: LogEntry[]) => {
      setLogs(initialLogs);
    });

    const unsubCleared = socket.on('logs_cleared', () => {
      setLogs([]);
    });

    return () => {
      unsub();
      unsubInitial();
      unsubCleared();
    };
  }, []);

  const handleClearLogs = async () => {
    try {
      await api.clearLogs();
      setLogs([]);
      toast.info('Consola de logs limpiada');
    } catch (err) {
      toast.error('Error al limpiar logs');
    } finally {
      setShowClearModal(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterSource !== 'all' && log.source !== filterSource) return false;
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Consola de Eventos & Logs en Tiempo Real</h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {filteredLogs.length} eventos
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Source filter */}
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">Origen: Todos</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="ai">Inteligencia Artificial</option>
            <option value="bulk">Envíos Masivos</option>
            <option value="groups">Grupos</option>
            <option value="system">Sistema</option>
          </select>

          {/* Level filter */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">Nivel: Todos</option>
            <option value="failover">⚡ Failover de IA</option>
            <option value="success">Éxito</option>
            <option value="error">Error</option>
            <option value="warn">Advertencia</option>
            <option value="info">Info</option>
          </select>

          <button
            onClick={() => setShowClearModal(true)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition"
            title="Limpiar consola"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logs Window */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 font-mono text-xs overflow-y-auto max-h-[640px] custom-scrollbar space-y-2 shadow-inner">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-16 text-slate-600">
            No hay registros de actividad que coincidan con los filtros seleccionados.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div
                key={log.id}
                className={`p-2.5 rounded-xl border flex items-start gap-3 transition ${
                  log.level === 'failover'
                    ? 'bg-purple-950/40 border-purple-500/40 text-purple-200'
                    : log.level === 'error'
                    ? 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                    : log.level === 'warn'
                    ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                    : log.level === 'success'
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                    : 'bg-slate-900/40 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {log.level === 'failover' && <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin" />}
                  {log.level === 'error' && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                  {log.level === 'warn' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                  {log.level === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  {log.level === 'info' && <Info className="w-3.5 h-3.5 text-slate-400" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] text-slate-500">{timeStr}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        log.source === 'whatsapp'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : log.source === 'ai'
                          ? 'bg-purple-500/20 text-purple-400'
                          : log.source === 'bulk'
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : log.source === 'groups'
                          ? 'bg-indigo-500/20 text-indigo-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {log.source}
                    </span>
                  </div>

                  <p className="leading-relaxed break-words">{log.message}</p>

                  {log.details && (
                    <pre className="text-[10px] text-slate-400 mt-1 bg-black/40 p-2 rounded-lg overflow-x-auto">
                      {typeof log.details === 'object'
                        ? JSON.stringify(log.details, null, 2)
                        : String(log.details)}
                    </pre>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirm Clear Modal (No alert) */}
      <ConfirmModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearLogs}
        title="¿Limpiar el historial de logs?"
        message="Se eliminarán todos los registros de la consola actual."
        confirmText="Sí, vaciar"
        variant="warning"
      />
    </div>
  );
};
