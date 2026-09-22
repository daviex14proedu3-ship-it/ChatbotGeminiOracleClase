import React, { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Sparkles,
  Trash2,
  Tag,
  Plus,
  Eye,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import { MediaCatalogItem } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { convertImageToWebP, formatBytes } from '../../services/webpConverter';
import { Modal } from '../ui/Modal';
import { ConfirmModal } from '../ui/ConfirmModal';

export const MediaCatalogView: React.FC = () => {
  const toast = useToast();
  const [catalog, setCatalog] = useState<MediaCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [mediaName, setMediaName] = useState('');
  const [mediaDescription, setMediaDescription] = useState('');
  const [mediaTags, setMediaTags] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [webpPreview, setWebpPreview] = useState<string | null>(null);
  const [webpStats, setWebpStats] = useState<{ orig: number; webp: number; pct: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Preview modal
  const [previewMedia, setPreviewMedia] = useState<MediaCatalogItem | null>(null);

  // Delete modal
  const [itemToDelete, setItemToDelete] = useState<MediaCatalogItem | null>(null);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const data = await api.getMediaCatalog();
      setCatalog(data);
    } catch (err) {
      console.error('Error fetching catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info('Convirtiendo a formato WebP optimizado en el navegador...');
      const converted = await convertImageToWebP(file);
      setSelectedFile(converted.file);
      setWebpPreview(converted.dataUrl);
      setWebpStats({
        orig: converted.originalSize,
        webp: converted.newSize,
        pct: converted.savingsPercent,
      });
      if (!mediaName) {
        setMediaName(file.name.substring(0, file.name.lastIndexOf('.')) || file.name);
      }
      toast.success(`WebP generado: Ahorro de espacio del ${converted.savingsPercent}%`);
    } catch (err: any) {
      toast.error(err?.message || 'Error convirtiendo la imagen');
    }
  };

  const handleUploadToCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.warning('Selecciona una imagen primero');
      return;
    }

    if (!mediaName.trim()) {
      toast.warning('Ingresa un nombre para la imagen');
      return;
    }

    setIsUploading(true);
    try {
      const tagsArray = mediaTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await api.uploadMedia(selectedFile, {
        name: mediaName.trim(),
        description: mediaDescription.trim(),
        tags: tagsArray,
        addToCatalog: true,
      });

      toast.success('Imagen registrada con éxito en el catálogo de la IA');
      setShowUploadModal(false);
      setSelectedFile(null);
      setWebpPreview(null);
      setWebpStats(null);
      setMediaName('');
      setMediaDescription('');
      setMediaTags('');
      fetchCatalog();
    } catch (err: any) {
      toast.error(err?.message || 'Error al subir la imagen al catálogo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await api.deleteMediaItem(itemToDelete.id);
      toast.success('Imagen eliminada del catálogo');
      fetchCatalog();
    } catch (err) {
      toast.error('Error al eliminar imagen');
    } finally {
      setItemToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-cyan-400" />
            <span>Catálogo de Medios & Optimizador WebP en Frontend</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Las imágenes registradas aquí pueden ser enviadas automáticamente por la IA cuando los usuarios las soliciten en WhatsApp.
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center gap-2 shadow-lg shadow-cyan-950/40"
        >
          <Plus className="w-4 h-4" />
          <span>Subir Imagen al Catálogo</span>
        </button>
      </div>

      {/* Catalog Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {catalog.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500">
            <ImageIcon className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-medium text-slate-400">No hay imágenes en el catálogo de IA.</p>
            <p className="text-xs text-slate-500 mt-1">
              Sube fotos de tus productos, catálogos o infografías para que la IA las envíe por WhatsApp.
            </p>
          </div>
        ) : (
          catalog.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between group hover:border-slate-700 transition"
            >
              {/* Media Image Preview */}
              <div
                onClick={() => setPreviewMedia(item)}
                className="h-44 bg-slate-950 relative cursor-pointer overflow-hidden flex items-center justify-center"
              >
                <img
                  src={`/api/media/file/${item.filename}`}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent flex items-end p-3">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> WebP ({formatBytes(item.sizeBytes)})
                  </span>
                </div>
              </div>

              {/* Media Details */}
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white truncate" title={item.name}>
                    {item.name}
                  </h4>
                  {item.description && (
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-[10px] text-slate-500">ID: {item.id}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewMedia(item)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                      title="Ver imagen completa"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setItemToDelete(item)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                      title="Eliminar del catálogo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Upload & Optimize Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          if (!isUploading) setShowUploadModal(false);
        }}
        title="Subir y Optimizar Imagen para el Catálogo"
        subtitle="Se convertirá a formato WebP en tu navegador antes de enviarse al servidor."
        maxWidth="md"
        footer={
          <>
            <button
              onClick={() => setShowUploadModal(false)}
              disabled={isUploading}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancelar
            </button>
            <button
              onClick={handleUploadToCatalog}
              disabled={isUploading || !selectedFile}
              className="px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl shadow-lg shadow-cyan-950/40 disabled:opacity-50"
            >
              {isUploading ? 'Guardando...' : 'Registrar en Catálogo'}
            </button>
          </>
        }
      >
        <form onSubmit={handleUploadToCatalog} className="space-y-4">
          {/* Dropzone */}
          <div className="p-4 border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl bg-slate-950/50 text-center relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelected}
              disabled={isUploading}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <Upload className="w-7 h-7 text-slate-500 mx-auto mb-1.5" />
            <p className="text-xs text-slate-200 font-semibold">
              {selectedFile ? selectedFile.name : 'Haz clic o arrastra tu imagen aquí'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              PNG, JPG, BMP &rarr; Conversor WebP Canvas instantáneo
            </p>
          </div>

          {/* WebP conversion comparison badge */}
          {webpStats && webpPreview && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={webpPreview}
                  alt="WebP"
                  className="w-12 h-12 rounded-lg object-cover border border-emerald-500/30"
                />
                <div>
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    WebP Optimizado (-{webpStats.pct}% ahorro)
                  </span>
                  <p className="text-[11px] text-emerald-400/80">
                    Original: {formatBytes(webpStats.orig)} &rarr; WebP: {formatBytes(webpStats.webp)}
                  </p>
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre del Medio</label>
            <input
              type="text"
              placeholder="Ej: Catálogo de Precios 2026"
              value={mediaName}
              onChange={(e) => setMediaName(e.target.value)}
              disabled={isUploading}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Descripción para la IA (Contexto)
            </label>
            <textarea
              rows={3}
              placeholder="Explica qué contiene la imagen para que la IA sepa cuándo enviarla al cliente..."
              value={mediaDescription}
              onChange={(e) => setMediaDescription(e.target.value)}
              disabled={isUploading}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              <span>Etiquetas Clave (separadas por coma)</span>
            </label>
            <input
              type="text"
              placeholder="catalogo, precios, promocion, combo"
              value={mediaTags}
              onChange={(e) => setMediaTags(e.target.value)}
              disabled={isUploading}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </form>
      </Modal>

      {/* Full Preview Modal */}
      {previewMedia && (
        <Modal
          isOpen={Boolean(previewMedia)}
          onClose={() => setPreviewMedia(null)}
          title={previewMedia.name}
          subtitle={`Formato WebP (${formatBytes(previewMedia.sizeBytes)})`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center max-h-[60vh]">
              <img
                src={`/api/media/file/${previewMedia.filename}`}
                alt={previewMedia.name}
                className="max-h-[60vh] w-auto object-contain"
              />
            </div>
            {previewMedia.description && (
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                {previewMedia.description}
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* Confirm Delete Modal (No alert) */}
      <ConfirmModal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar imagen del catálogo?"
        message={`¿Estás seguro de que deseas borrar "${itemToDelete?.name}"? La IA ya no podrá despachar este medio a los clientes.`}
        confirmText="Sí, borrar imagen"
        variant="danger"
      />
    </div>
  );
};
