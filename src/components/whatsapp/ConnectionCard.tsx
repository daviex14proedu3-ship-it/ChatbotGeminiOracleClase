import React, { useState } from 'react';
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Zap,
  Copy,
  Check,
} from 'lucide-react';
import { WhatsAppStatus } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ConfirmModal } from '../ui/ConfirmModal';

interface ConnectionCardProps {
  status: WhatsAppStatus;
  onRefresh: () => void;
}

export const ConnectionCard: React.FC<ConnectionCardProps> = ({ status, onRefresh }) => {
  const toast = useToast();
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loadingPairing, setLoadingPairing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isConnected = status.state === 'connected';

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingPhone) {
      toast.warning('Por favor ingresa tu número con código de país (ej: 5491122334455)');
      return;
    }

    setLoadingPairing(true);
    try {
      const res = await api.requestPairingCode(pairingPhone);
      setPairingCode(res.code);
      toast.success('Código de vinculación generado con éxito.');
    } catch (err: any) {
      toast.error(err?.message || 'Error al solicitar código de vinculación');
    } finally {
      setLoadingPairing(false);
    }
  };

  const handleCopyCode = () => {
    if (pairingCode) {
      navigator.clipboard.writeText(pairingCode);
      setCopiedCode(true);
      toast.info('Código copiado al portapapeles');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await api.disconnectWhatsApp();
      toast.success('Sesión de WhatsApp cerrada');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Error al desconectar');
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  const handleReconnect = async () => {
    try {
      await api.reconnectWhatsApp();
      toast.info('Reconexión solicitada a Baileys');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Error al reconectar');
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div
        className={`p-6 rounded-2xl border backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          isConnected
            ? 'bg-emerald-950/40 border-emerald-500/30'
            : status.state === 'waiting_qr'
            ? 'bg-amber-950/40 border-amber-500/30'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              isConnected
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-glow'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isConnected ? <CheckCircle2 className="w-8 h-8" /> : <Smartphone className="w-8 h-8" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">
                {isConnected ? 'WhatsApp Conectado y Listo' : 'Esperando Vinculación'}
              </h3>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold capitalize ${
                  isConnected
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {status.state}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {isConnected
                ? `Bot activo con el número +${status.botPhone}. Recibiendo y respondiendo mensajes.`
                : 'Escanea el código QR desde tu app de WhatsApp o ingresa tu número para recibir un código de vinculación.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleReconnect}
            className="flex-1 md:flex-none px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700/80 rounded-xl transition flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reconectar</span>
          </button>

          {isConnected && (
            <button
              onClick={() => setShowLogoutModal(true)}
              className="flex-1 md:flex-none px-4 py-2 text-xs font-semibold text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 rounded-xl transition flex items-center justify-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          )}
        </div>
      </div>

      {!isConnected && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QR Code Method */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center text-center">
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>Método 1: Escanear Código QR</span>
            </div>
            <p className="text-xs text-slate-400 mb-6 max-w-xs">
              Abre WhatsApp en tu teléfono &gt; Dispositivos vinculados &gt; Vincular dispositivo &gt; Escanea este QR.
            </p>

            <div className="p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center w-64 h-64 border-4 border-slate-800">
              {status.qrDataUrl ? (
                <img
                  src={status.qrDataUrl}
                  alt="Código QR de WhatsApp"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
                  <span className="text-xs font-medium">Generando código QR...</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conexión segura Multi-Device cifrada de punto a punto</span>
            </div>
          </div>

          {/* Pairing Code Method */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Método 2: Código de Vinculación (8 Dígitos)</span>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Si no puedes escanear con la cámara, solicita un código de 8 caracteres que podrás ingresar directamente en WhatsApp.
              </p>

              <form onSubmit={handleRequestPairingCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Número de Teléfono (con código de país sin + ni guiones)
                  </label>
                  <input
                    type="tel"
                    placeholder="Ejemplo: 5491122334455"
                    value={pairingPhone}
                    onChange={(e) => setPairingPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Ejemplos: Argentina (549...), México (52...), Colombia (57...), España (34...)
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loadingPairing}
                  className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  <span>{loadingPairing ? 'Solicitando...' : 'Generar Código de 8 Dígitos'}</span>
                </button>
              </form>

              {pairingCode && (
                <div className="mt-6 p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-center">
                  <span className="text-xs text-cyan-300 block mb-1">Código de Emparejamiento:</span>
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-mono text-2xl font-black text-cyan-200 tracking-wider">
                      {pairingCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition"
                      title="Copiar código"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-cyan-400/80 mt-2">
                    Ingresa en WhatsApp &gt; Dispositivos vinculados &gt; Vincular con el número de teléfono
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs text-slate-400">
              💡 <strong>Recomendación:</strong> Una vez conectado, la sesión se guardará localmente y se reconectará automáticamente cada vez que inicies el servidor.
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Logout (No window.confirm) */}
      <ConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        title="¿Cerrar sesión de WhatsApp?"
        message="Se eliminarán las credenciales locales de la sesión. Para volver a usar el bot deberás escanear nuevamente el código QR."
        confirmText="Sí, cerrar sesión"
        variant="danger"
        loading={isLoggingOut}
      />
    </div>
  );
};
