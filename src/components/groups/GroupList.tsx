import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckSquare,
  Square,
  Send,
  RefreshCw,
  Shield,
  MessageCircle,
  ArrowUpDown,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Lock,
} from 'lucide-react';
import { GroupInfo, WhatsAppStatus } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui/Modal';
import { convertImageToWebP, formatBytes } from '../../services/webpConverter';
import { socket } from '../../services/socket';

interface GroupListProps {
  status: WhatsAppStatus;
}

export const GroupList: React.FC<GroupListProps> = ({ status }) => {
  const toast = useToast();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filters
  const [filterCanSend, setFilterCanSend] = useState<'all' | 'can_send' | 'read_only'>('all');
  const [filterIsAdmin, setFilterIsAdmin] = useState<'all' | 'admin' | 'member'>('all');
  const [sortBy, setSortBy] = useState<'alpha_asc' | 'alpha_desc' | 'members_desc' | 'members_asc'>('alpha_asc');

  // Selection
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

  // Bulk Modal state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(4);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [webpPreview, setWebpPreview] = useState<string | null>(null);
  const [webpSavings, setWebpSavings] = useState<{ orig: number; webp: number; pct: number } | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Bulk Progress state
  const [progressData, setProgressData] = useState<{
    current: number;
    total: number;
    sentCount: number;
    failedCount: number;
  } | null>(null);

  const isConnected = status.state === 'connected';

  const fetchGroups = async () => {
    if (!isConnected) {
      toast.warning('WhatsApp debe estar conectado para extraer los grupos');
      return;
    }
    setLoading(true);
    try {
      const data = await api.getGroups();
      setGroups(data);
      toast.success(`Se sincronizaron ${data.length} grupos de WhatsApp`);
    } catch (err: any) {
      toast.error(err?.message || 'Error al obtener grupos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && groups.length === 0) {
      fetchGroups();
    }
  }, [isConnected]);

  // Listen to WebSocket group progress
  useEffect(() => {
    const unsubProgress = socket.on('group_bulk_progress', (data) => {
      setProgressData(data);
    });

    const unsubCompleted = socket.on('group_bulk_completed', (data) => {
      setIsSending(false);
      toast.success(`Envío a grupos completado: ${data.sentCount} enviados, ${data.failedCount} fallidos.`);
    });

    return () => {
      unsubProgress();
      unsubCompleted();
    };
  }, []);

  // Filter and sort
  const filteredGroups = useMemo(() => {
    return groups
      .filter((g) => {
        // Search
        if (searchTerm.trim() !== '') {
          const term = searchTerm.toLowerCase();
          const matchName = (g.subject || '').toLowerCase().includes(term);
          if (!matchName) return false;
        }

        // Can send
        if (filterCanSend === 'can_send' && !g.canSend) return false;
        if (filterCanSend === 'read_only' && g.canSend) return false;

        // Is Admin
        if (filterIsAdmin === 'admin' && !g.isAdmin) return false;
        if (filterIsAdmin === 'member' && g.isAdmin) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'alpha_asc') return (a.subject || '').localeCompare(b.subject || '');
        if (sortBy === 'alpha_desc') return (b.subject || '').localeCompare(a.subject || '');
        if (sortBy === 'members_desc') return b.participantsCount - a.participantsCount;
        if (sortBy === 'members_asc') return a.participantsCount - b.participantsCount;
        return 0;
      });
  }, [groups, searchTerm, filterCanSend, filterIsAdmin, sortBy]);

  // Multi-selection handlers
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedGroupIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedGroupIds(next);
  };

  const handleSelectAllVisible = () => {
    const next = new Set(selectedGroupIds);
    filteredGroups.forEach((g) => next.add(g.id));
    setSelectedGroupIds(next);
  };

  const handleDeselectAll = () => {
    setSelectedGroupIds(new Set());
  };

  const handleInvertSelection = () => {
    const next = new Set(selectedGroupIds);
    filteredGroups.forEach((g) => {
      if (next.has(g.id)) next.delete(g.id);
      else next.add(g.id);
    });
    setSelectedGroupIds(next);
  };

  // Image upload with frontend WebP conversion
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info('Optimizando imagen a WebP en el navegador...');
      const converted = await convertImageToWebP(file);
      setMediaFile(converted.file);
      setWebpPreview(converted.dataUrl);
      setWebpSavings({
        orig: converted.originalSize,
        webp: converted.newSize,
        pct: converted.savingsPercent,
      });
      toast.success(`Imagen optimizada a WebP: Ahorro de ${converted.savingsPercent}%`);
    } catch (err: any) {
      toast.error(err?.message || 'Error al procesar la imagen');
    }
  };

  // Bulk send to groups execution
  const handleExecuteGroupBulk = async () => {
    if (selectedGroupIds.size === 0) {
      toast.warning('Debes seleccionar al menos un grupo');
      return;
    }

    if (!bulkMessage.trim() && !mediaFile) {
      toast.warning('Debes escribir un mensaje o adjuntar una imagen');
      return;
    }

    setIsSending(true);
    setProgressData({
      current: 0,
      total: selectedGroupIds.size,
      sentCount: 0,
      failedCount: 0,
    });

    try {
      let uploadedFilename: string | undefined;
      if (mediaFile) {
        const uploadRes = await api.uploadMedia(mediaFile, {
          name: 'Adjunto Grupos ' + new Date().toLocaleDateString(),
        });
        uploadedFilename = uploadRes.filename;
      }

      await api.sendGroupBulk({
        groupIds: Array.from(selectedGroupIds),
        message: bulkMessage,
        mediaFilename: uploadedFilename,
        delaySeconds,
      });

      toast.info('Campaña masiva a grupos iniciada');
    } catch (err: any) {
      setIsSending(false);
      toast.error(err?.message || 'Error al iniciar envío masivo a grupos');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span>Extracción y Gestión de Grupos de WhatsApp</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Filtra por permisos de escritura, administración, ordena y envía mensajes masivos a múltiples grupos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchGroups}
            disabled={loading || !isConnected}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700/80 text-white transition flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{loading ? 'Extrayendo Grupos...' : 'Extraer / Actualizar'}</span>
          </button>

          <button
            onClick={() => setShowBulkModal(true)}
            disabled={selectedGroupIds.size === 0 || !isConnected}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition flex items-center gap-2 disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar a Grupos ({selectedGroupIds.size})</span>
          </button>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Filter: Can Send */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={filterCanSend}
            onChange={(e) => setFilterCanSend(e.target.value as any)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="all">Permisos: Todos</option>
            <option value="can_send">✅ Solo donde puedo enviar</option>
            <option value="read_only">🔒 Solo lectura (Restringidos)</option>
          </select>
        </div>

        {/* Filter: Is Admin */}
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-500" />
          <select
            value={filterIsAdmin}
            onChange={(e) => setFilterIsAdmin(e.target.value as any)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="all">Rol: Todos</option>
            <option value="admin">👑 Soy Administrador</option>
            <option value="member">👤 Solo Miembro</option>
          </select>
        </div>

        {/* Sorting */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-slate-500" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="alpha_asc">Alfabético: A &rarr; Z</option>
            <option value="alpha_desc">Alfabético: Z &rarr; A</option>
            <option value="members_desc">Participantes: Mayor a Menor</option>
            <option value="members_asc">Participantes: Menor a Mayor</option>
          </select>
        </div>
      </div>

      {/* Selection helpers bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>
            Mostrando <strong>{filteredGroups.length}</strong> de {groups.length} grupos
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400 font-semibold">
            {selectedGroupIds.size} seleccionados
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectAllVisible}
            className="text-slate-300 hover:text-white hover:underline transition"
          >
            Seleccionar Visibles
          </button>
          <button
            onClick={handleInvertSelection}
            className="text-slate-300 hover:text-white hover:underline transition"
          >
            Invertir Selección
          </button>
          <button
            onClick={handleDeselectAll}
            className="text-slate-300 hover:text-white hover:underline transition"
          >
            Deseleccionar Todos
          </button>
        </div>
      </div>

      {/* Groups List Table / Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800 text-[11px]">
              <tr>
                <th className="p-4 w-12 text-center">
                  <button
                    onClick={() => {
                      if (selectedGroupIds.size === filteredGroups.length && filteredGroups.length > 0) {
                        handleDeselectAll();
                      } else {
                        handleSelectAllVisible();
                      }
                    }}
                  >
                    {selectedGroupIds.size > 0 && selectedGroupIds.size === filteredGroups.length ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                </th>
                <th className="py-4 px-3">Grupo / Nombre</th>
                <th className="py-4 px-3">Participantes</th>
                <th className="py-4 px-3">¿Puedo Enviar?</th>
                <th className="py-4 px-3">Mi Rol</th>
                <th className="py-4 px-3 text-right">ID de WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    {groups.length === 0
                      ? 'No hay grupos cargados. Haz clic en "Extraer / Actualizar".'
                      : 'Ningún grupo coincide con los filtros aplicados.'}
                  </td>
                </tr>
              ) : (
                filteredGroups.map((group) => {
                  const isSelected = selectedGroupIds.has(group.id);
                  return (
                    <tr
                      key={group.id}
                      onClick={() => handleToggleSelect(group.id)}
                      className={`cursor-pointer transition ${
                        isSelected ? 'bg-emerald-500/10 hover:bg-emerald-500/15' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleToggleSelect(group.id)}>
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="py-4 px-3">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span className="truncate max-w-xs">{group.subject}</span>
                        </div>
                        {group.desc && (
                          <p className="text-[11px] text-slate-400 truncate max-w-sm mt-0.5">
                            {group.desc}
                          </p>
                        )}
                      </td>
                      <td className="py-4 px-3 font-mono text-slate-200">
                        {group.participantsCount} miembros
                      </td>
                      <td className="py-4 px-3">
                        {group.canSend ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Permitido</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            <Lock className="w-3 h-3 text-rose-400" />
                            <span>Solo Admins</span>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-3">
                        {group.isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Shield className="w-3 h-3 text-amber-400" />
                            <span>Admin</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Miembro</span>
                        )}
                      </td>
                      <td className="py-4 px-3 text-right font-mono text-[10px] text-slate-500">
                        {group.id.split('@')[0]}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Message to Groups Modal */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => {
          if (!isSending) setShowBulkModal(false);
        }}
        title={`Envío Masivo a ${selectedGroupIds.size} Grupos`}
        subtitle="Los mensajes se enviarán uno por uno con retardo inteligente para evitar bloqueos."
        maxWidth="lg"
        footer={
          <>
            <button
              onClick={() => setShowBulkModal(false)}
              disabled={isSending}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl transition disabled:opacity-50"
            >
              Cerrar
            </button>
            <button
              onClick={handleExecuteGroupBulk}
              disabled={isSending || selectedGroupIds.size === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-950/50 transition flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Enviando...' : `Disparar a ${selectedGroupIds.size} Grupos`}</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Progress Card if sending */}
          {progressData && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">
                  Progreso: {progressData.current} de {progressData.total}
                </span>
                <span className="text-emerald-400 font-bold">
                  {Math.round((progressData.current / progressData.total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                  style={{ width: `${(progressData.current / progressData.total) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span className="text-emerald-400">✅ Enviados: {progressData.sentCount}</span>
                <span className="text-rose-400">❌ Fallidos: {progressData.failedCount}</span>
              </div>
            </div>
          )}

          {/* Message Textarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Mensaje para los Grupos
            </label>
            <textarea
              rows={4}
              placeholder="Escribe el mensaje que deseas enviar a todos los grupos seleccionados..."
              value={bulkMessage}
              onChange={(e) => setBulkMessage(e.target.value)}
              disabled={isSending}
              className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
          </div>

          {/* WebP Image Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Adjuntar Imagen (Conversión automática a WebP en el Frontend)</span>
            </label>

            <div className="p-4 border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl bg-slate-950/40 text-center relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={isSending}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-300 font-medium">
                Arrastra o haz clic para seleccionar una imagen
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                PNG, JPG, BMP &rarr; Se convertirá instantáneamente a WebP ultraligero antes de subir
              </p>
            </div>

            {webpPreview && webpSavings && (
              <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={webpPreview}
                    alt="WebP preview"
                    className="w-12 h-12 rounded-lg object-cover border border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Optimizado a WebP (-{webpSavings.pct}%)
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Original: {formatBytes(webpSavings.orig)} &rarr; WebP: {formatBytes(webpSavings.webp)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMediaFile(null);
                    setWebpPreview(null);
                    setWebpSavings(null);
                  }}
                  className="text-xs text-rose-400 hover:underline p-1"
                >
                  Quitar
                </button>
              </div>
            )}
          </div>

          {/* Delay selector */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Pausa de seguridad entre cada grupo:</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={2}
                max={30}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Math.max(2, parseInt(e.target.value) || 2))}
                disabled={isSending}
                className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-center text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-xs text-slate-400">seg</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
