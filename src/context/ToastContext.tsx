import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, RefreshCw, X } from 'lucide-react';
import { socket } from '../services/socket';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'failover';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  details?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, title?: string, details?: string, duration?: number) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  failover: (message: string, details?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, details?: string, duration = 5000) => {
      const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      const newToast: ToastItem = { id, type, title, message, details, duration };

      setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 on screen

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((msg: string, title = 'Éxito') => showToast('success', msg, title), [showToast]);
  const error = useCallback((msg: string, title = 'Error') => showToast('error', msg, title, undefined, 7000), [showToast]);
  const warning = useCallback((msg: string, title = 'Atención') => showToast('warning', msg, title), [showToast]);
  const info = useCallback((msg: string, title = 'Información') => showToast('info', msg, title), [showToast]);
  const failover = useCallback(
    (msg: string, details?: string) => showToast('failover', msg, '⚡ Failover de IA Activado', details, 8000),
    [showToast]
  );

  // Automatically listen to WebSocket failover notifications
  useEffect(() => {
    const unsub = socket.on('failover_alert', (payload) => {
      failover(payload.message, payload.details ? JSON.stringify(payload.details) : undefined);
    });
    return unsub;
  }, [failover]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, failover, removeToast }}>
      {children}
      {/* Toast floating container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-2xl border backdrop-blur-md flex items-start gap-3 transition-all transform duration-300 animate-in fade-in slide-in-from-top-4 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-100 shadow-emerald-950/50'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/30 text-rose-100 shadow-rose-950/50'
                : toast.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/30 text-amber-100 shadow-amber-950/50'
                : toast.type === 'failover'
                ? 'bg-gradient-to-r from-purple-950/95 to-indigo-950/95 border-purple-400/40 text-purple-100 shadow-purple-950/50'
                : 'bg-slate-900/90 border-slate-700 text-slate-100 shadow-slate-950/50'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {toast.type === 'error' && <XCircle className="w-5 h-5 text-rose-400" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
              {toast.type === 'failover' && <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-sky-400" />}
            </div>

            <div className="flex-1 min-w-0">
              {toast.title && <h4 className="text-sm font-semibold mb-0.5 leading-tight">{toast.title}</h4>}
              <p className="text-xs text-slate-200/90 leading-relaxed break-words">{toast.message}</p>
              {toast.details && (
                <p className="text-[11px] text-slate-400 font-mono mt-1 bg-black/30 px-2 py-1 rounded">
                  {toast.details}
                </p>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
