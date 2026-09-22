import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  RefreshCw,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ConfirmModal } from '../ui/ConfirmModal';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  mediaItem?: {
    id: string;
    name: string;
    filename: string;
    description: string;
  } | null;
}

export const ChatSimulator: React.FC = () => {
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: '¡Hola! Soy tu asistente virtual impulsado por Google Gemini. Puedes hacerme preguntas para probar cómo responderé a tus clientes con la Base de Conocimientos o pedirme imágenes del catálogo.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMsgText = inputMessage.trim();
    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const res = await api.simulateChat(userMsgText);

      const botMsg: ChatMessage = {
        id: 'bot-' + Date.now(),
        sender: 'bot',
        text: res.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mediaItem: res.mediaItem,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      toast.error(err?.message || 'Error al obtener respuesta de Gemini');
      const errorMsg: ChatMessage = {
        id: 'bot-err-' + Date.now(),
        sender: 'bot',
        text: '❌ Hubo un error al procesar tu solicitud con la IA. Revisa las claves API y la conexión.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await api.clearSimulationHistory();
      setMessages([
        {
          id: 'welcome-' + Date.now(),
          sender: 'bot',
          text: 'Historial del chat reiniciado. ¿En qué puedo ayudarte hoy?',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      toast.info('Historial del simulador reiniciado');
    } catch (err) {
      toast.error('Error al reiniciar historial');
    } finally {
      setShowClearModal(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Simulador de Chat en Vivo</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                Online
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Prueba respuestas, failover de claves y despacho de imágenes multimedia.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowClearModal(true)}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          <span>Reiniciar Chat</span>
        </button>
      </div>

      {/* Chat Messages Container */}
      <div className="h-[520px] bg-slate-950/80 border border-slate-800 rounded-2xl p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3 shadow-inner">
        {messages.map((msg) => {
          const isBot = msg.sender === 'bot';
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2.5 max-w-[85%] ${
                isBot ? 'self-start' : 'self-end flex-row-reverse'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs ${
                  isBot
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div
                className={`p-3.5 rounded-2xl text-xs leading-relaxed space-y-2 shadow-md ${
                  isBot
                    ? 'bg-slate-900 border border-slate-800 text-slate-200'
                    : 'bg-emerald-950/80 border border-emerald-500/30 text-emerald-100'
                }`}
              >
                {/* Media Image if dispatched by AI */}
                {msg.mediaItem && (
                  <div className="rounded-xl overflow-hidden border border-slate-700 bg-black/40">
                    <img
                      src={`/api/media/file/${msg.mediaItem.filename}`}
                      alt={msg.mediaItem.name}
                      className="w-full max-h-56 object-cover"
                    />
                    <div className="p-2 bg-slate-950/90 text-[11px] text-emerald-400 flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      <span>{msg.mediaItem.name} (Despachado por IA)</span>
                    </div>
                  </div>
                )}

                <p className="whitespace-pre-wrap">{msg.text}</p>
                <div className="text-[10px] text-slate-500 text-right">{msg.timestamp}</div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="self-start flex items-center gap-2 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
            <span>Gemini pensando y consultando la Base de Conocimientos...</span>
          </div>
        )}
      </div>

      {/* Input Composer */}
      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Escribe una pregunta para el bot (ej: ¿Cuáles son sus horarios? o ¿Tienes fotos de productos?)..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          disabled={isLoading}
          className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
        />
        <button
          type="submit"
          disabled={isLoading || !inputMessage.trim()}
          className="p-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition disabled:opacity-40 shadow-lg shadow-purple-950/40"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Confirm Clear Modal (No alert) */}
      <ConfirmModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearHistory}
        title="¿Reiniciar conversación del simulador?"
        message="Se vaciará el historial de la conversación de prueba actual con la IA."
        confirmText="Sí, reiniciar"
        variant="info"
      />
    </div>
  );
};
