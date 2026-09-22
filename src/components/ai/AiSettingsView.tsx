import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Key,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Save,
  BookOpen,
  Edit2,
  Tag,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Clock,
  ShieldCheck,
  ExternalLink,
  Zap,
  Eye,
  EyeOff,
} from 'lucide-react';
import { AppSettings, GeminiKeyConfig, KnowledgeItem, GeminiModelInfo } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui/Modal';
import { ConfirmModal } from '../ui/ConfirmModal';

interface AiSettingsProps {
  settings: AppSettings | null;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

export const AiSettingsView: React.FC<AiSettingsProps> = ({ settings, onUpdateSettings }) => {
  const toast = useToast();
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(settings);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Dynamic models state
  const [dynamicModels, setDynamicModels] = useState<GeminiModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // New key form modal
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);

  // Edit existing key modal
  const [showEditKeyModal, setShowEditKeyModal] = useState(false);
  const [editingKeyConfig, setEditingKeyConfig] = useState<GeminiKeyConfig | null>(null);
  const [editKeyName, setEditKeyName] = useState('');
  const [editKeyValue, setEditKeyValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Knowledge base item modal
  const [showKbModal, setShowKbModal] = useState(false);
  const [editingKbItem, setEditingKbItem] = useState<KnowledgeItem | null>(null);
  const [kbTitle, setKbTitle] = useState('');
  const [kbContent, setKbContent] = useState('');
  const [kbCategory, setKbCategory] = useState('General');
  const [kbTags, setKbTags] = useState('');

  // Delete KB confirm modal
  const [itemToDelete, setItemToDelete] = useState<KnowledgeItem | null>(null);

  const fetchModels = useCallback(async (activeKey?: string) => {
    setLoadingModels(true);
    try {
      const data = await api.getDynamicModels(activeKey);
      setDynamicModels(data);
    } catch (err) {
      console.error('Error fetching dynamic models:', err);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    setLocalSettings(settings);
    const key = settings?.geminiKeys?.[settings.activeKeyIndex]?.key;
    fetchModels(key);
  }, [settings, fetchModels]);

  const fetchKb = async () => {
    try {
      const data = await api.getKnowledgeBase();
      setKnowledgeItems(data);
    } catch (err) {
      console.error('Error fetching KB:', err);
    }
  };

  useEffect(() => {
    fetchKb();
  }, []);

  const handleSaveSettings = async () => {
    if (!localSettings) return;
    setIsSaving(true);
    try {
      const updated = await api.saveAiSettings(localSettings);
      onUpdateSettings(updated);
      toast.success('Configuraciones de Inteligencia Artificial guardadas');
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar configuración');
    } finally {
      setIsSaving(false);
    }
  };

  // Test an individual API Key
  const handleTestKey = async (keyConfig: GeminiKeyConfig) => {
    if (!keyConfig.key || !keyConfig.key.trim()) {
      toast.warning('Esta clave no tiene un valor configurado. Haz clic en "Configurar Clave" primero.');
      return;
    }
    setTestingKeyId(keyConfig.id);
    try {
      const res = await api.testGeminiKey(keyConfig.key, localSettings?.selectedModel);
      if (res.success) {
        toast.success(`${keyConfig.name}: Clave válida (${res.latencyMs}ms)`);
        // update local status and auto-save
        if (localSettings) {
          const updatedKeys = localSettings.geminiKeys.map((k) =>
            k.id === keyConfig.id ? { ...k, status: 'active' as const, errorCount: 0, lastError: undefined } : k
          );
          const updated = { ...localSettings, geminiKeys: updatedKeys };
          setLocalSettings(updated);
          await api.saveAiSettings(updated);
          onUpdateSettings(updated);
        }
      } else {
        toast.error(`${keyConfig.name}: ${res.message}`);
      }
    } catch (err: any) {
      toast.error(`Error probando clave: ${err?.message || err}`);
    } finally {
      setTestingKeyId(null);
    }
  };

  // Open Edit Modal for a Key
  const handleOpenEditKey = (keyConfig: GeminiKeyConfig) => {
    setEditingKeyConfig(keyConfig);
    setEditKeyName(keyConfig.name);
    setEditKeyValue(keyConfig.key);
    setShowPassword(false);
    setShowEditKeyModal(true);
  };

  // Save changes to edited key (Immediate Auto-Save)
  const handleSaveEditKey = async () => {
    if (!editingKeyConfig || !localSettings) return;
    const cleanKey = editKeyValue.trim();
    if (!cleanKey) {
      toast.warning('La clave API no puede estar vacía. Pega tu API Key de Google AI Studio.');
      return;
    }

    const updatedKeys = localSettings.geminiKeys.map((k) =>
      k.id === editingKeyConfig.id
        ? {
            ...k,
            name: editKeyName.trim() || k.name,
            key: cleanKey,
            status: 'untested' as const,
            errorCount: 0,
            lastError: undefined,
          }
        : k
    );

    // If current active key is empty or this was the active key, make sure it is active
    let newActiveIndex = localSettings.activeKeyIndex;
    if (!localSettings.geminiKeys[newActiveIndex]?.key) {
      const thisIndex = updatedKeys.findIndex((k) => k.id === editingKeyConfig.id);
      if (thisIndex !== -1) newActiveIndex = thisIndex;
    }

    const updated = {
      ...localSettings,
      geminiKeys: updatedKeys,
      activeKeyIndex: newActiveIndex,
    };

    setLocalSettings(updated);
    setShowEditKeyModal(false);

    try {
      const saved = await api.saveAiSettings(updated);
      onUpdateSettings(saved);
      toast.success(`Clave "${editKeyName.trim() || editingKeyConfig.name}" guardada y configurada`);
      // Refresh models dynamically with the newly configured key
      fetchModels(cleanKey);
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar la clave API');
    }
  };

  // Add new API Key (Immediate Auto-Save)
  const handleAddKey = async () => {
    const cleanKey = newKeyValue.trim();
    if (!cleanKey) {
      toast.warning('Ingresa el valor de la clave API de Google AI Studio');
      return;
    }

    if (!localSettings) return;

    let updatedKeys: GeminiKeyConfig[];
    let newActiveIndex = localSettings.activeKeyIndex;

    // If there is only 1 key and it was empty (the default template), update it directly
    if (localSettings.geminiKeys.length === 1 && !localSettings.geminiKeys[0].key) {
      updatedKeys = [
        {
          ...localSettings.geminiKeys[0],
          name: newKeyName.trim() || localSettings.geminiKeys[0].name,
          key: cleanKey,
          status: 'untested',
          errorCount: 0,
        },
      ];
      newActiveIndex = 0;
    } else {
      const newKey: GeminiKeyConfig = {
        id: 'key-' + Date.now(),
        name: newKeyName.trim() || `Clave Gemini ${localSettings.geminiKeys.length + 1}`,
        key: cleanKey,
        status: 'untested',
        errorCount: 0,
      };
      updatedKeys = [...localSettings.geminiKeys, newKey];
      // If current active key is unconfigured, activate this new key
      if (!localSettings.geminiKeys[localSettings.activeKeyIndex]?.key) {
        newActiveIndex = updatedKeys.length - 1;
      }
    }

    const updated = {
      ...localSettings,
      geminiKeys: updatedKeys,
      activeKeyIndex: newActiveIndex,
    };

    setLocalSettings(updated);
    setShowNewKeyModal(false);
    setNewKeyName('');
    setNewKeyValue('');

    try {
      const saved = await api.saveAiSettings(updated);
      onUpdateSettings(saved);
      toast.success('Nueva clave API agregada y guardada en el pool de failover');
      fetchModels(cleanKey);
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar clave');
    }
  };

  // Remove Key (Immediate Auto-Save)
  const handleRemoveKey = async (keyId: string) => {
    if (!localSettings) return;
    if (localSettings.geminiKeys.length <= 1) {
      toast.warning('Debes mantener al menos una entrada de clave en la configuración');
      return;
    }

    const updatedKeys = localSettings.geminiKeys.filter((k) => k.id !== keyId);
    const updated = {
      ...localSettings,
      geminiKeys: updatedKeys,
      activeKeyIndex: 0,
    };

    setLocalSettings(updated);
    try {
      const saved = await api.saveAiSettings(updated);
      onUpdateSettings(saved);
      toast.info('Clave eliminada del pool');
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar clave');
    }
  };

  // Set Active Key (Immediate Auto-Save)
  const handleSetActiveKey = async (index: number) => {
    if (!localSettings) return;
    const keyTarget = localSettings.geminiKeys[index];
    if (!keyTarget.key) {
      toast.warning('No puedes activar una clave vacía. Haz clic en "Configurar" para ingresar tu API Key.');
      return;
    }
    const updated = { ...localSettings, activeKeyIndex: index };
    setLocalSettings(updated);
    try {
      const saved = await api.saveAiSettings(updated);
      onUpdateSettings(saved);
      toast.info(`Clave activa establecida a: ${keyTarget.name}`);
      fetchModels(keyTarget.key);
    } catch (err: any) {
      toast.error(err?.message || 'Error al cambiar clave activa');
    }
  };

  // Save or Update Knowledge Item
  const handleSaveKbItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbTitle.trim() || !kbContent.trim()) {
      toast.warning('El título y contenido son obligatorios');
      return;
    }

    const tagsArray = kbTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (editingKbItem) {
        await api.updateKnowledgeItem(editingKbItem.id, {
          title: kbTitle,
          content: kbContent,
          category: kbCategory,
          tags: tagsArray,
        });
        toast.success('Artículo de conocimiento actualizado');
      } else {
        await api.createKnowledgeItem({
          title: kbTitle,
          content: kbContent,
          category: kbCategory,
          tags: tagsArray,
          isActive: true,
        });
        toast.success('Nuevo artículo agregado a la base de conocimientos');
      }

      setShowKbModal(false);
      setEditingKbItem(null);
      setKbTitle('');
      setKbContent('');
      setKbTags('');
      fetchKb();
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar conocimiento');
    }
  };

  // Toggle KB active status
  const handleToggleKbActive = async (item: KnowledgeItem) => {
    try {
      await api.updateKnowledgeItem(item.id, { isActive: !item.isActive });
      fetchKb();
    } catch (err) {
      toast.error('Error al actualizar estado del artículo');
    }
  };

  // Delete KB Item
  const handleConfirmDeleteKb = async () => {
    if (!itemToDelete) return;
    try {
      await api.deleteKnowledgeItem(itemToDelete.id);
      toast.success('Artículo eliminado');
      fetchKb();
    } catch (err) {
      toast.error('Error al eliminar artículo');
    } finally {
      setItemToDelete(null);
    }
  };

  if (!localSettings) return null;

  return (
    <div className="space-y-8">
      {/* Top Header & Save Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span>Configuración de Google AI Studio & Base de Conocimientos</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Múltiples claves con failover automático ante cuotas agotadas y respuestas basadas en tus documentos.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-purple-950/40 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
        </button>
      </div>

      {/* SECTION 1: MULTI-API KEY MANAGER WITH FAILOVER */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              <span>Pool de Claves API de Google AI Studio (Failover Automático)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Si una clave alcanza el límite de tasa (error 429) o agota su cuota, el sistema rotará transparentemente a la siguiente.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
              title="Ir a la consola de Google AI Studio para crear o copiar tu API Key"
            >
              <span>Obtener API Key en Google AI Studio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={() => setShowNewKeyModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Agregar Clave</span>
            </button>
          </div>
        </div>

        {/* Informative direct link banner */}
        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 flex-shrink-0 mt-0.5">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                Acceso Directo a tus Claves en Google AI Studio
              </span>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Las claves son 100% gratuitas en el plan Free Tier de Google y combinadas con los modelos <strong>Flash-Lite (3.5 / 3.1)</strong> ofrecen altísima velocidad sin costos de consumo.
              </p>
            </div>
          </div>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 flex-shrink-0"
          >
            <span>aistudio.google.com/app/apikey</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Empty Keys Warning Banner */}
        {!localSettings.geminiKeys.some((k) => k.key && k.key.trim() !== '') && (
          <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-amber-200">
                  ⚠️ No hay ninguna Clave API de Google AI Studio configurada
                </span>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  El bot de WhatsApp no podrá responder a tus clientes hasta que ingreses y guardes tu API Key de Gemini.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleOpenEditKey(localSettings.geminiKeys[0])}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-md flex-shrink-0"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Configurar Clave Ahora</span>
            </button>
          </div>
        )}

        {/* Keys List */}
        <div className="space-y-3">
          {localSettings.geminiKeys.map((keyConfig, index) => {
            const isCurrentActive = localSettings.activeKeyIndex === index;
            const isKeyEmpty = !keyConfig.key || keyConfig.key.trim() === '';

            return (
              <div
                key={keyConfig.id}
                className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                  isKeyEmpty
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                    : isCurrentActive
                    ? 'bg-emerald-950/25 border-emerald-500/40 shadow-sm shadow-emerald-950/30'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isKeyEmpty
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : isCurrentActive
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Key className="w-4 h-4" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white">{keyConfig.name}</span>
                      {isKeyEmpty ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                          ⚠️ CLAVE NO INGRESADA
                        </span>
                      ) : isCurrentActive ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                          ACTIVA AHORA
                        </span>
                      ) : null}

                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                          isKeyEmpty
                            ? 'bg-slate-800 text-slate-400'
                            : keyConfig.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : keyConfig.status === 'exhausted'
                            ? 'bg-rose-500/20 text-rose-300'
                            : keyConfig.status === 'invalid'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isKeyEmpty
                          ? 'Inactiva (Sin valor)'
                          : keyConfig.status === 'active'
                          ? 'Operativa'
                          : keyConfig.status === 'exhausted'
                          ? 'Cuota Excedida / 429'
                          : keyConfig.status === 'invalid'
                          ? 'Inválida'
                          : 'Sin probar'}
                      </span>
                    </div>

                    <div className="font-mono text-xs mt-1">
                      {isKeyEmpty ? (
                        <span className="text-amber-400/90 font-medium">
                          ⚠️ Sin API Key asignada. Haz clic en "Configurar Clave" para pegar tu clave.
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          {keyConfig.key.substring(0, 8) + '••••••••••••••••' + keyConfig.key.slice(-4)}
                        </span>
                      )}
                    </div>

                    {keyConfig.lastError && !isKeyEmpty && (
                      <p className="text-[11px] text-rose-400/90 mt-1 font-mono">
                        Último error: {keyConfig.lastError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
                  {/* Configure / Edit Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditKey(keyConfig)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                      isKeyEmpty
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-950/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{isKeyEmpty ? 'Configurar Clave' : 'Editar'}</span>
                  </button>

                  {!isKeyEmpty && (
                    <button
                      type="button"
                      onClick={() => handleTestKey(keyConfig)}
                      disabled={testingKeyId === keyConfig.id}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3 h-3 ${testingKeyId === keyConfig.id ? 'animate-spin' : ''}`} />
                      <span>{testingKeyId === keyConfig.id ? 'Probando...' : 'Probar'}</span>
                    </button>
                  )}

                  {!isCurrentActive && !isKeyEmpty && (
                    <button
                      type="button"
                      onClick={() => handleSetActiveKey(index)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 transition"
                    >
                      Establecer Activa
                    </button>
                  )}

                  {localSettings.geminiKeys.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveKey(keyConfig.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                      title="Eliminar clave"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: MODEL SELECTION & SYSTEM INSTRUCTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Modelos Disponibles</span>
            </h4>

            <button
              type="button"
              onClick={() => {
                const key = localSettings.geminiKeys?.[localSettings.activeKeyIndex]?.key;
                fetchModels(key);
                toast.info('Actualizando catálogo de modelos en vivo...');
              }}
              disabled={loadingModels}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Recargar modelos desde Google AI Studio"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingModels ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            Se priorizan siempre las versiones <strong>Flash-Lite (3.5 y 3.1)</strong> para operar sin costo de tokens y con respuesta instantánea.
          </p>

          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
            {dynamicModels.map((model) => {
              const isSelected = localSettings.selectedModel === model.id;
              return (
                <div
                  key={model.id}
                  onClick={() => setLocalSettings({ ...localSettings, selectedModel: model.id })}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? model.isFlashLite
                        ? 'bg-emerald-950/40 border-emerald-500/50 shadow-sm shadow-emerald-950/40'
                        : 'bg-purple-950/40 border-purple-500/50 shadow-sm shadow-purple-950/40'
                      : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      {model.displayName}
                    </span>
                    {isSelected && (
                      <span className={`w-2 h-2 rounded-full shadow-glow ${model.isFlashLite ? 'bg-emerald-400' : 'bg-purple-400'}`} />
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 my-1">
                    {model.isFlashLite && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" /> Flash-Lite (Gratuito)
                      </span>
                    )}
                    {model.recommended && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30">
                        ⭐ Recomendado
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                    {model.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Responder en Grupos:</span>
              <button
                type="button"
                onClick={() =>
                  setLocalSettings({ ...localSettings, respondToGroups: !localSettings.respondToGroups })
                }
                className="text-slate-300 hover:text-white"
              >
                {localSettings.respondToGroups ? (
                  <ToggleRight className="w-6 h-6 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-slate-600" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Desactivado por defecto para evitar responder a todos los mensajes de los grupos.
            </p>
          </div>
        </div>

        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>Instrucciones Generales del Asistente (System Prompt)</span>
          </h4>
          <p className="text-xs text-slate-400">
            Define la personalidad, tono y reglas que el chatbot debe seguir rigurosamente en WhatsApp.
          </p>

          <textarea
            rows={8}
            value={localSettings.systemPrompt}
            onChange={(e) => setLocalSettings({ ...localSettings, systemPrompt: e.target.value })}
            className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50 leading-relaxed font-sans resize-none"
          />

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400">
            💡 <strong>Nota:</strong> Los artículos activos de la Base de Conocimientos y las imágenes registradas en el Catálogo se inyectan automáticamente en cada prompt generado para Gemini.
          </div>
        </div>
      </div>

      {/* SECTION 3: KNOWLEDGE BASE (BASE DE CONOCIMIENTOS) */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span>Base de Conocimientos (Documentos & FAQs para la IA)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Agrega preguntas frecuentes, listas de precios, políticas de garantía y datos de la empresa.
            </p>
          </div>

          <button
            onClick={() => {
              setEditingKbItem(null);
              setKbTitle('');
              setKbContent('');
              setKbCategory('General');
              setKbTags('');
              setShowKbModal(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Artículo</span>
          </button>
        </div>

        {/* KB Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {knowledgeItems.length === 0 ? (
            <div className="col-span-2 text-center py-8 text-slate-500">
              No hay artículos en la base de conocimientos. Haz clic en "Nuevo Artículo".
            </div>
          ) : (
            knowledgeItems.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                  item.isActive
                    ? 'bg-slate-950/60 border-slate-800'
                    : 'bg-slate-950/30 border-slate-800/40 opacity-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white truncate max-w-[200px]">
                      {item.title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                      {item.category}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-3 mb-3">
                    {item.content}
                  </p>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {item.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggleKbActive(item)}
                    className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white"
                  >
                    {item.isActive ? (
                      <ToggleRight className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-slate-600" />
                    )}
                    <span>{item.isActive ? 'Activo' : 'Desactivado'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingKbItem(item);
                        setKbTitle(item.title);
                        setKbContent(item.content);
                        setKbCategory(item.category);
                        setKbTags((item.tags || []).join(', '));
                        setShowKbModal(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setItemToDelete(item)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add New Key Modal */}
      <Modal
        isOpen={showNewKeyModal}
        onClose={() => setShowNewKeyModal(false)}
        title="Agregar Clave API de Google AI Studio"
        subtitle="Obtén tu clave gratis desde aistudio.google.com"
        maxWidth="md"
        footer={
          <>
            <button
              onClick={() => setShowNewKeyModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddKey}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-950/40"
            >
              Agregar Clave
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-200">
            <span>¿Aún no tienes tu clave API de Gemini?</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline flex items-center gap-1 hover:text-white"
            >
              <span>Obtener Gratis</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nombre de la Clave (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Cuenta Respaldo 1"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Clave API (Gemini API Key)
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </Modal>

      {/* Edit / Configure Existing Key Modal */}
      <Modal
        isOpen={showEditKeyModal}
        onClose={() => setShowEditKeyModal(false)}
        title="Configurar Clave API de Google AI Studio"
        subtitle="Pega tu API Key de Gemini obtenida gratuitamente desde Google AI Studio"
        maxWidth="md"
        footer={
          <>
            <button
              onClick={() => setShowEditKeyModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveEditKey}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-950/40 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Clave</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-200">
            <span>¿Dónde obtener tu clave gratuita?</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline flex items-center gap-1 hover:text-white"
            >
              <span>aistudio.google.com/app/apikey</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nombre o Etiqueta de la Clave
            </label>
            <input
              type="text"
              placeholder="Ej: Clave Principal (Google AI Studio)"
              value={editKeyName}
              onChange={(e) => setEditKeyName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Clave API (Gemini API Key)
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPassword ? 'Ocultar' : 'Mostrar'}</span>
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="AIzaSy..."
              value={editKeyValue}
              onChange={(e) => setEditKeyValue(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Las claves de Google AI Studio suelen iniciar con <code>AIzaSy...</code>
            </p>
          </div>
        </div>
      </Modal>

      {/* Knowledge Base Modal (Create / Edit) */}
      <Modal
        isOpen={showKbModal}
        onClose={() => setShowKbModal(false)}
        title={editingKbItem ? 'Editar Artículo de Conocimiento' : 'Nuevo Artículo de Conocimiento'}
        subtitle="La IA utilizará este contenido para responder a los clientes en WhatsApp."
        maxWidth="lg"
        footer={
          <>
            <button
              onClick={() => setShowKbModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveKbItem}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-950/40"
            >
              Guardar Artículo
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveKbItem} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Título del Artículo
              </label>
              <input
                type="text"
                placeholder="Ej: Política de Envíos y Entregas"
                value={kbTitle}
                onChange={(e) => setKbTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría</label>
              <input
                type="text"
                placeholder="Ej: Ventas, Soporte"
                value={kbCategory}
                onChange={(e) => setKbCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Contenido de la Información
            </label>
            <textarea
              rows={6}
              placeholder="Explica detalladamente la respuesta, precios, horarios o información que el bot debe proporcionar..."
              value={kbContent}
              onChange={(e) => setKbContent(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              <span>Etiquetas Clave (separadas por comas)</span>
            </label>
            <input
              type="text"
              placeholder="envios, costo, delivery, flete, tiempos"
              value={kbTags}
              onChange={(e) => setKbTags(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </form>
      </Modal>

      {/* Delete KB Confirm Modal (replaces window.confirm) */}
      <ConfirmModal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDeleteKb}
        title="¿Eliminar artículo de conocimiento?"
        message={`Estás a punto de borrar "${itemToDelete?.title}". La IA ya no tendrá acceso a esta información para responder.`}
        confirmText="Sí, eliminar"
        variant="danger"
      />
    </div>
  );
};
