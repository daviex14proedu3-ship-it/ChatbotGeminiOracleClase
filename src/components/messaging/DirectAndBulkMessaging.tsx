import React, { useState, useEffect, useMemo } from 'react';
import {
  Send,
  FileSpreadsheet,
  ClipboardPaste,
  Upload,
  Sparkles,
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Image as ImageIcon,
  HelpCircle,
  Play,
  Pause,
  StopCircle,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { ExcelColumnMapping, ParsedContactRow, WhatsAppStatus } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  parsePastedExcel,
  parseExcelFile,
  buildCompiledContacts,
  interpolateTemplate,
} from '../../services/excelDetector';
import { convertImageToWebP, formatBytes } from '../../services/webpConverter';
import { Modal } from '../ui/Modal';
import { socket } from '../../services/socket';

interface MessagingProps {
  status: WhatsAppStatus;
}

export const DirectAndBulkMessaging: React.FC<MessagingProps> = ({ status }) => {
  const toast = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'bulk' | 'direct'>('bulk');

  // Direct send state
  const [directPhone, setDirectPhone] = useState('');
  const [directMessage, setDirectMessage] = useState('');
  const [directMediaFile, setDirectMediaFile] = useState<File | null>(null);
  const [directWebpPreview, setDirectWebpPreview] = useState<string | null>(null);
  const [directSavings, setDirectSavings] = useState<{ orig: number; webp: number; pct: number } | null>(null);
  const [isSendingDirect, setIsSendingDirect] = useState(false);

  // Bulk send state
  const [ingestionMode, setIngestionMode] = useState<'paste' | 'upload'>('paste');
  const [pasteData, setPasteData] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Parsed columns & rows
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mappings, setMappings] = useState<ExcelColumnMapping[]>([]);

  // Message template
  const [campaignTitle, setCampaignTitle] = useState('Campaña Masiva');
  const [messageTemplate, setMessageTemplate] = useState('¡Hola {{Nombre}}! Te escribimos para comentarte las novedades.');
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Media attachment for bulk
  const [bulkMediaFile, setBulkMediaFile] = useState<File | null>(null);
  const [bulkWebpPreview, setBulkWebpPreview] = useState<string | null>(null);
  const [bulkSavings, setBulkSavings] = useState<{ orig: number; webp: number; pct: number } | null>(null);

  // Campaign progress modal
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [progressData, setProgressData] = useState<{
    current: number;
    total: number;
    sent: number;
    failed: number;
    contact?: any;
  } | null>(null);
  const [isCampaignRunning, setIsCampaignRunning] = useState(false);

  const isConnected = status.state === 'connected';

  // WebSocket listeners for bulk campaign
  useEffect(() => {
    const unsubProgress = socket.on('bulk_progress', (data) => {
      setProgressData(data);
    });

    const unsubCompleted = socket.on('bulk_completed', (data) => {
      setIsCampaignRunning(false);
      toast.success(
        `Campaña completada: ${data.sent} enviados exitosamente, ${data.failed} fallidos de ${data.total}.`
      );
    });

    return () => {
      unsubProgress();
      unsubCompleted();
    };
  }, []);

  // Handle parsing when pasted text changes
  const handleProcessPastedData = () => {
    if (!pasteData.trim()) {
      toast.warning('Pega primero los datos de Excel o Google Sheets');
      return;
    }

    const result = parsePastedExcel(pasteData);
    setHeaders(result.headers);
    setRawRows(result.rawRows);
    setMappings(result.mappings);

    toast.success(`Detectadas ${result.rawRows.length} filas y ${result.headers.length} columnas`);
  };

  // Handle uploading Excel file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    try {
      toast.info('Analizando archivo Excel...');
      const result = await parseExcelFile(file);
      setHeaders(result.headers);
      setRawRows(result.rawRows);
      setMappings(result.mappings);
      toast.success(`Archivo Excel cargado: ${result.rawRows.length} filas detectadas`);
    } catch (err: any) {
      toast.error(err?.message || 'Error al procesar archivo Excel');
    }
  };

  // Update mapping type for a specific column
  const handleUpdateMapping = (header: string, newType: ExcelColumnMapping['assignedType']) => {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.originalHeader === header) {
          return { ...m, assignedType: newType };
        }
        // If assigning phone, remove phone from others
        if (newType === 'phone' && m.assignedType === 'phone') {
          return { ...m, assignedType: 'variable' };
        }
        return m;
      })
    );
  };

  // Compute final valid contacts list
  const { contacts: validContacts, invalidRowsCount } = useMemo(() => {
    if (rawRows.length === 0) return { contacts: [], invalidRowsCount: 0 };
    return buildCompiledContacts(rawRows, mappings, messageTemplate);
  }, [rawRows, mappings, messageTemplate]);

  // Insert variable tag into template
  const handleInsertVariable = (varName: string) => {
    const tag = `{{${varName}}}`;
    setMessageTemplate((prev) => prev + ' ' + tag);
  };

  // WebP image optimizer for direct message
  const handleDirectImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const converted = await convertImageToWebP(file);
      setDirectMediaFile(converted.file);
      setDirectWebpPreview(converted.dataUrl);
      setDirectSavings({
        orig: converted.originalSize,
        webp: converted.newSize,
        pct: converted.savingsPercent,
      });
      toast.success(`Imagen optimizada a WebP (-${converted.savingsPercent}%)`);
    } catch (err: any) {
      toast.error(err?.message || 'Error optimizando imagen');
    }
  };

  // WebP image optimizer for bulk message
  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const converted = await convertImageToWebP(file);
      setBulkMediaFile(converted.file);
      setBulkWebpPreview(converted.dataUrl);
      setBulkSavings({
        orig: converted.originalSize,
        webp: converted.newSize,
        pct: converted.savingsPercent,
      });
      toast.success(`Imagen optimizada a WebP (-${converted.savingsPercent}%)`);
    } catch (err: any) {
      toast.error(err?.message || 'Error optimizando imagen');
    }
  };

  // Send Direct Message
  const handleSendDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      toast.warning('WhatsApp no está conectado');
      return;
    }

    if (!directPhone.trim()) {
      toast.warning('Ingresa el número de teléfono con código de país');
      return;
    }

    if (!directMessage.trim() && !directMediaFile) {
      toast.warning('Escribe un mensaje o adjunta una imagen');
      return;
    }

    setIsSendingDirect(true);
    try {
      let uploadedFilename: string | undefined;
      if (directMediaFile) {
        const uploadRes = await api.uploadMedia(directMediaFile, {
          name: `Directo ${directPhone}`,
        });
        uploadedFilename = uploadRes.filename;
      }

      await api.sendDirectMessage({
        phone: directPhone,
        message: directMessage,
        mediaFilename: uploadedFilename,
      });

      toast.success(`Mensaje enviado exitosamente a ${directPhone}`);
      setDirectMessage('');
      setDirectMediaFile(null);
      setDirectWebpPreview(null);
      setDirectSavings(null);
    } catch (err: any) {
      toast.error(err?.message || 'Error al enviar mensaje directo');
    } finally {
      setIsSendingDirect(false);
    }
  };

  // Start Bulk Campaign
  const handleStartBulkCampaign = async () => {
    if (!isConnected) {
      toast.warning('WhatsApp no está conectado');
      return;
    }

    if (validContacts.length === 0) {
      toast.warning('No hay contactos válidos para enviar. Verifica la columna de Teléfono.');
      return;
    }

    if (!messageTemplate.trim() && !bulkMediaFile) {
      toast.warning('Debes redactar una plantilla o adjuntar una imagen');
      return;
    }

    setIsCampaignRunning(true);
    setShowProgressModal(true);
    setProgressData({
      current: 0,
      total: validContacts.length,
      sent: 0,
      failed: 0,
    });

    try {
      let uploadedFilename: string | undefined;
      if (bulkMediaFile) {
        const uploadRes = await api.uploadMedia(bulkMediaFile, {
          name: `Campaña ${campaignTitle}`,
        });
        uploadedFilename = uploadRes.filename;
      }

      // Prepare contacts with individualized message
      const payloadContacts = validContacts.map((contact) => ({
        phone: contact.phone,
        name: contact.name,
        message: interpolateTemplate(messageTemplate, contact.variables),
      }));

      const res = await api.startBulkCampaign({
        title: campaignTitle,
        contacts: payloadContacts,
        mediaFilename: uploadedFilename,
        delaySeconds,
      });

      setCampaignId(res.campaignId);
      toast.info('Campaña masiva iniciada con éxito');
    } catch (err: any) {
      setIsCampaignRunning(false);
      toast.error(err?.message || 'Error al iniciar campaña');
    }
  };

  const handleCancelCampaign = async () => {
    try {
      await api.cancelBulkCampaign();
      toast.warning('Cancelando campaña masiva...');
    } catch (err: any) {
      toast.error('Error al solicitar cancelación');
    }
  };

  // Preview computed message for current previewIndex
  const currentPreviewMessage = useMemo(() => {
    if (validContacts.length === 0) return messageTemplate;
    const contact = validContacts[previewIndex % validContacts.length];
    return interpolateTemplate(messageTemplate, contact.variables);
  }, [validContacts, previewIndex, messageTemplate]);

  return (
    <div className="space-y-6">
      {/* Sub tabs: Bulk vs Direct */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 w-fit">
        <button
          onClick={() => setActiveSubTab('bulk')}
          className={`px-5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
            activeSubTab === 'bulk'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Envío Masivo Inteligente (Excel / Portapapeles)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('direct')}
          className={`px-5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
            activeSubTab === 'direct'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Envío Individual / Directo</span>
        </button>
      </div>

      {/* VIEW 1: DIRECT SEND */}
      {activeSubTab === 'direct' && (
        <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <span>Envío Directo Individual</span>
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            Envía un mensaje o imagen de forma inmediata a un solo contacto de WhatsApp.
          </p>

          <form onSubmit={handleSendDirect} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Número de Teléfono Destino (con código de país)
              </label>
              <input
                type="tel"
                placeholder="Ejemplo: 5491122334455 o +5215512345678"
                value={directPhone}
                onChange={(e) => setDirectPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mensaje de Texto
              </label>
              <textarea
                rows={4}
                placeholder="Escribe tu mensaje... Puedes usar *negritas*, _cursivas_ o emojis."
                value={directMessage}
                onChange={(e) => setDirectMessage(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>

            {/* Direct Image WebP Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>Adjuntar Imagen (Conversión automática a WebP en el Frontend)</span>
              </label>

              <div className="p-4 border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl bg-slate-950/40 text-center relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleDirectImageUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-6 h-6 text-slate-500 mx-auto mb-1.5" />
                <p className="text-xs text-slate-300 font-medium">
                  Arrastra o selecciona una imagen JPG, PNG o HEIC
                </p>
                <p className="text-[11px] text-slate-500">
                  Se optimizará a WebP en tu navegador antes de enviarse al servidor
                </p>
              </div>

              {directWebpPreview && directSavings && (
                <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={directWebpPreview}
                      alt="Preview"
                      className="w-12 h-12 rounded-lg object-cover border border-slate-700"
                    />
                    <div>
                      <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        WebP Optimizado (-{directSavings.pct}%)
                      </span>
                      <p className="text-[11px] text-slate-400">
                        {formatBytes(directSavings.orig)} &rarr; {formatBytes(directSavings.webp)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectMediaFile(null);
                      setDirectWebpPreview(null);
                      setDirectSavings(null);
                    }}
                    className="text-xs text-rose-400 hover:underline p-1"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSendingDirect || !isConnected}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSendingDirect ? 'Enviando Mensaje...' : 'Enviar Mensaje Directo'}</span>
            </button>
          </form>
        </div>
      )}

      {/* VIEW 2: BULK MESSAGING WITH SMART EXCEL DETECTION */}
      {activeSubTab === 'bulk' && (
        <div className="space-y-6">
          {/* Step 1: Ingestion Method */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
                  1
                </span>
                <span>Origen de los Datos de Contactos</span>
              </h3>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setIngestionMode('paste')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                    ingestionMode === 'paste'
                      ? 'bg-slate-800 text-emerald-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Pegar Celdas de Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIngestionMode('upload')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                    ingestionMode === 'upload'
                      ? 'bg-slate-800 text-emerald-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir Archivo (.xlsx, .csv)</span>
                </button>
              </div>
            </div>

            {ingestionMode === 'paste' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Copia un rango de celdas en tu Excel o Google Sheets (con o sin encabezados) y pégalas directamente aquí:
                </p>
                <textarea
                  rows={5}
                  placeholder={`Nombre\tTelefono\tCiudad\nJuan Perez\t+5491122334455\tBuenos Aires\nMaria Gomez\t+5215588776655\tCDMX`}
                  value={pasteData}
                  onChange={(e) => setPasteData(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  type="button"
                  onClick={handleProcessPastedData}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analizar y Detectar Columnas</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-6 border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl bg-slate-950/40 text-center relative">
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <FileSpreadsheet className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-200 font-semibold">
                    {uploadedFile ? uploadedFile.name : 'Haz clic o arrastra tu archivo Excel aquí'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Compatible con Microsoft Excel (.xlsx, .xls) y valores separados por comas (.csv)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Smart Column Detection & Mapping */}
          {headers.length > 0 && (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
                      2
                    </span>
                    <span>Detección Inteligente de Columnas</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    El sistema identificó los tipos de columna. Puedes ajustar o reasignar manualmente el rol de cada una.
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-300">
                    Total Filas: <strong>{rawRows.length}</strong>
                  </span>
                  <span className="text-emerald-400 font-bold">
                    Válidos para envío: {validContacts.length}
                  </span>
                  {invalidRowsCount > 0 && (
                    <span className="text-rose-400 font-medium">
                      Inválidos (sin tel): {invalidRowsCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Column Mapping Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-2">
                {mappings.map((m) => (
                  <div
                    key={m.originalHeader}
                    className={`p-3.5 rounded-xl border transition ${
                      m.assignedType === 'phone'
                        ? 'bg-emerald-950/40 border-emerald-500/40'
                        : m.assignedType === 'name'
                        ? 'bg-cyan-950/40 border-cyan-500/40'
                        : m.assignedType === 'ignore'
                        ? 'bg-slate-950/40 border-slate-800 opacity-60'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white truncate" title={m.originalHeader}>
                        {m.originalHeader}
                      </span>
                      {m.assignedType === 'phone' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                          DESTINO
                        </span>
                      )}
                    </div>

                    <label className="block text-[11px] text-slate-400 mb-1">Tipo Asignado:</label>
                    <select
                      value={m.assignedType}
                      onChange={(e) => handleUpdateMapping(m.originalHeader, e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="phone">📱 Teléfono (WhatsApp)</option>
                      <option value="name">👤 Nombre del Contacto</option>
                      <option value="variable">🏷️ Variable Personalizada</option>
                      <option value="ignore">❌ Ignorar Columna</option>
                    </select>

                    {/* Sample preview value */}
                    <div className="mt-2 text-[11px] text-slate-500 truncate">
                      Ej: {String(rawRows[0]?.[m.originalHeader] || '(vacío)')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Template Composer, Variables & WebP Attachment */}
          {validContacts.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Composer */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
                    3
                  </span>
                  <span>Redactor de Plantilla y Variables</span>
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Título de la Campaña
                  </label>
                  <input
                    type="text"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                {/* Variable inserter pills */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Insertar Variables detectadas en el texto:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('Nombre')}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold hover:bg-cyan-500/25 transition"
                    >
                      + {"{{Nombre}}"}
                    </button>

                    {mappings
                      .filter((m) => m.assignedType === 'variable')
                      .map((vm) => (
                        <button
                          key={vm.variableName}
                          type="button"
                          onClick={() => handleInsertVariable(vm.variableName)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-medium hover:bg-slate-700 hover:text-white transition"
                        >
                          + {`{{${vm.variableName}}}`}
                        </button>
                      ))}
                  </div>
                </div>

                {/* Message Textarea */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Contenido del Mensaje
                  </label>
                  <textarea
                    rows={5}
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none font-sans"
                  />
                </div>

                {/* WebP image upload for bulk */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Adjuntar Imagen a Todos (Conversión WebP Automática)</span>
                  </label>

                  <div className="p-3 border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl bg-slate-950/40 text-center relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBulkImageUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="w-5 h-5 text-slate-500 mx-auto mb-1" />
                    <p className="text-xs text-slate-300">Seleccionar imagen para la campaña</p>
                  </div>

                  {bulkWebpPreview && bulkSavings && (
                    <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={bulkWebpPreview}
                          alt="WebP"
                          className="w-10 h-10 rounded-lg object-cover border border-slate-700"
                        />
                        <div className="text-[11px]">
                          <span className="font-semibold text-emerald-400">WebP (-{bulkSavings.pct}%)</span>
                          <p className="text-slate-400">
                            {formatBytes(bulkSavings.orig)} &rarr; {formatBytes(bulkSavings.webp)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBulkMediaFile(null);
                          setBulkWebpPreview(null);
                          setBulkSavings(null);
                        }}
                        className="text-xs text-rose-400 p-1"
                      >
                        Quitar
                      </button>
                    </div>
                  )}
                </div>

                {/* Delay configuration */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Intervalo anti-bloqueo entre envíos:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={3}
                      max={60}
                      value={delaySeconds}
                      onChange={(e) => setDelaySeconds(Math.max(3, parseInt(e.target.value) || 3))}
                      className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-center text-white"
                    />
                    <span className="text-xs text-slate-400">seg</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartBulkCampaign}
                  disabled={isCampaignRunning || !isConnected}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>Iniciar Campaña Masiva ({validContacts.length} Contactos)</span>
                </button>
              </div>

              {/* Live Preview Box */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Eye className="w-4 h-4 text-emerald-400" />
                      <span>Vista Previa en Tiempo Real</span>
                    </h3>

                    {/* Row navigator */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">Contacto:</span>
                      <button
                        type="button"
                        onClick={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
                        disabled={previewIndex === 0}
                        className="px-2 py-1 rounded bg-slate-800 text-white disabled:opacity-30"
                      >
                        &larr;
                      </button>
                      <span className="font-mono font-bold text-slate-200">
                        {previewIndex + 1} / {validContacts.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewIndex((prev) => Math.min(validContacts.length - 1, prev + 1))}
                        disabled={previewIndex >= validContacts.length - 1}
                        className="px-2 py-1 rounded bg-slate-800 text-white disabled:opacity-30"
                      >
                        &rarr;
                      </button>
                    </div>
                  </div>

                  {/* Simulated WhatsApp Bubble */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="text-[11px] text-slate-400 flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                      <span>Destinatario: +{validContacts[previewIndex]?.phone || '...'}</span>
                      <span>Nombre: {validContacts[previewIndex]?.name || 'N/A'}</span>
                    </div>

                    {bulkWebpPreview && (
                      <div className="rounded-xl overflow-hidden max-h-48 border border-slate-800">
                        <img src={bulkWebpPreview} alt="Adjunto" className="w-full object-cover" />
                      </div>
                    )}

                    <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/20 text-xs text-emerald-100 whitespace-pre-wrap leading-relaxed shadow-sm">
                      {currentPreviewMessage || '(Sin mensaje)'}
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>
                    El envío respeta una pausa variable con retardo inteligente entre cada mensaje para simular comportamiento humano y proteger tu número de WhatsApp.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campaign Progress Monitor Modal */}
      <Modal
        isOpen={showProgressModal}
        onClose={() => {
          if (!isCampaignRunning) setShowProgressModal(false);
        }}
        title={`Monitoreo de Campaña: ${campaignTitle}`}
        subtitle="Progreso en tiempo real con estadísticas y control de pausa/cancelación."
        maxWidth="lg"
        footer={
          <>
            {isCampaignRunning ? (
              <button
                onClick={handleCancelCampaign}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-500/30 transition flex items-center gap-2"
              >
                <StopCircle className="w-4 h-4" />
                <span>Cancelar Campaña</span>
              </button>
            ) : (
              <button
                onClick={() => setShowProgressModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition"
              >
                Cerrar Monitor
              </button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {progressData && (
            <>
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    Procesados: {progressData.current} de {progressData.total}
                  </span>
                  <span className="font-bold text-emerald-400">
                    {Math.round((progressData.current / progressData.total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                    style={{ width: `${(progressData.current / progressData.total) * 100}%` }}
                  />
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                  <span className="text-[11px] text-emerald-400 block font-semibold">Enviados</span>
                  <span className="text-xl font-extrabold text-emerald-200">{progressData.sent}</span>
                </div>
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30">
                  <span className="text-[11px] text-rose-400 block font-semibold">Fallidos</span>
                  <span className="text-xl font-extrabold text-rose-200">{progressData.failed}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-semibold">Pendientes</span>
                  <span className="text-xl font-extrabold text-slate-200">
                    {progressData.total - progressData.current}
                  </span>
                </div>
              </div>

              {/* Status footer */}
              <div className="p-3 rounded-xl bg-slate-950 text-xs text-slate-400 flex items-center justify-between">
                <span>Estado: {isCampaignRunning ? '🚀 Transmitiendo en curso...' : '🏁 Campaña finalizada'}</span>
                {isCampaignRunning && <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
