import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Database,
  Server,
  Cloud,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Save,
  MessageSquare,
  Search,
  User,
  Bot,
  Zap,
  Copy,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
  Sliders,
  Code2,
  UserCheck,
  Plus,
  Phone,
  Shield,
  Check,
  X,
  ShieldAlert,
} from 'lucide-react';
import {
  DatabaseHealthStatus,
  ConversationRecord,
  ChatMessageRecord,
  AdminContactRecord,
} from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui/Modal';
import { ConfirmModal } from '../ui/ConfirmModal';

export const MemoryView: React.FC = () => {
  const toast = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [health, setHealth] = useState<DatabaseHealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'conversations' | 'admins' | 'settings'>('conversations');

  // Conversations & Messages
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Admin Contacts state
  const [adminContacts, setAdminContacts] = useState<AdminContactRecord[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [adminContactToDelete, setAdminContactToDelete] = useState<AdminContactRecord | null>(null);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({
    phone: '',
    secondary_phones: '',
    name: '',
    role: 'admin' as 'superadmin' | 'admin' | 'operator',
    notes: '',
    can_view_finances: true,
    can_view_metrics: true,
    can_manage_bookings: true,
    is_active: true,
  });

  // Settings form state
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryLimitTurns, setMemoryLimitTurns] = useState(10);
  const [postgresUrl, setPostgresUrl] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseDbUrl, setSupabaseDbUrl] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Testing connection states
  const [testingPg, setTestingPg] = useState(false);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [initializingTables, setInitializingTables] = useState(false);

  // Modals
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [sqlDdl, setSqlDdl] = useState('');
  const [phoneToDelete, setPhoneToDelete] = useState<string | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);

  // Load health & config
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [h, conf, convs, admins] = await Promise.all([
        api.getDatabaseHealth(),
        api.getMemoryConfig(),
        api.getConversations(),
        api.getAdminContacts().catch(() => []),
      ]);
      setHealth(h);
      setMemoryEnabled(conf.memoryEnabled);
      setMemoryLimitTurns(conf.memoryLimitTurns);
      setPostgresUrl(conf.postgresUrl || '');
      setSupabaseUrl(conf.supabaseUrl || '');
      setSupabaseKey(conf.supabaseKey || '');
      setSupabaseDbUrl(conf.supabaseDbUrl || '');
      setConversations(convs);
      setAdminContacts(admins);

      // Auto-select first conversation if none selected
      if (!selectedPhone && convs.length > 0) {
        setSelectedPhone(convs[0].phone);
      }
    } catch (err: any) {
      console.error('Error loading memory data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPhone]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load messages when selected contact changes
  useEffect(() => {
    if (!selectedPhone) {
      setMessages([]);
      return;
    }
    const fetchMsgs = async () => {
      setLoadingMessages(true);
      try {
        const msgs = await api.getConversationMessages(selectedPhone, 100);
        setMessages(msgs);
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchMsgs();
  }, [selectedPhone]);

  // Auto-scroll to bottom of chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Admin contacts handlers
  const handleSaveAdminContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.phone.trim() || !adminForm.name.trim()) {
      toast.error('Número de WhatsApp y Nombre son obligatorios');
      return;
    }
    setSavingAdmin(true);
    try {
      await api.createAdminContact(adminForm);
      toast.success(`Contacto administrativo "${adminForm.name}" guardado exitosamente`);
      setShowAddAdminModal(false);
      setAdminForm({
        phone: '',
        secondary_phones: '',
        name: '',
        role: 'admin',
        notes: '',
        can_view_finances: true,
        can_view_metrics: true,
        can_manage_bookings: true,
        is_active: true,
      });
      const updatedAdmins = await api.getAdminContacts();
      setAdminContacts(updatedAdmins);
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar contacto administrativo');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleToggleAdminActive = async (admin: AdminContactRecord) => {
    try {
      await api.updateAdminContact(admin.id, { is_active: !admin.is_active });
      toast.success(`Estado de ${admin.name} actualizado`);
      const updatedAdmins = await api.getAdminContacts();
      setAdminContacts(updatedAdmins);
    } catch (err: any) {
      toast.error(err?.message || 'Error al cambiar estado');
    }
  };

  const handleDeleteAdminContact = async () => {
    if (!adminContactToDelete) return;
    try {
      await api.deleteAdminContact(adminContactToDelete.id);
      toast.success(`Contacto administrativo eliminado`);
      setAdminContactToDelete(null);
      const updatedAdmins = await api.getAdminContacts();
      setAdminContacts(updatedAdmins);
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar contacto');
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.saveMemoryConfig({
        memoryEnabled,
        memoryLimitTurns,
        postgresUrl,
        supabaseUrl,
        supabaseKey,
        supabaseDbUrl,
      });
      toast.success('Configuración de memoria y base de datos guardada');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar configuración');
    } finally {
      setSavingSettings(false);
    }
  };

  // Test PostgreSQL connection
  const handleTestPostgres = async () => {
    setTestingPg(true);
    try {
      const res = await api.testDatabaseConnection({
        provider: 'postgresql',
        url: postgresUrl,
      });
      if (res.success) {
        toast.success(`PostgreSQL Oracle: ${res.message} (${res.latencyMs}ms)`);
      } else {
        toast.error(`PostgreSQL: ${res.message}`);
      }
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Error al probar conexión con PostgreSQL');
    } finally {
      setTestingPg(false);
    }
  };

  // Test Supabase connection
  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    try {
      const res = await api.testDatabaseConnection({
        provider: 'supabase',
        url: supabaseUrl,
        key: supabaseKey,
        dbUrl: supabaseDbUrl,
      });
      if (res.success) {
        toast.success(`Supabase: ${res.message} (${res.latencyMs}ms)`);
      } else {
        toast.error(`Supabase: ${res.message}`);
      }
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Error al probar conexión con Supabase');
    } finally {
      setTestingSupabase(false);
    }
  };

  // Initialize DB tables
  const handleInitTables = async () => {
    setInitializingTables(true);
    try {
      const res = await api.initDatabaseTables();
      toast.success(
        `Tablas creadas. Primario: ${res.primarySuccess ? 'OK' : 'No'} | Fallback: ${
          res.fallbackSuccess ? 'OK' : 'No'
        }`
      );
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Error al inicializar tablas');
    } finally {
      setInitializingTables(false);
    }
  };

  // View DDL SQL
  const handleViewSql = async () => {
    try {
      const res = await api.getMemoryDdl();
      setSqlDdl(res.ddl);
      setShowSqlModal(true);
    } catch (err) {
      toast.error('Error al obtener script SQL');
    }
  };

  // Delete conversation memory
  const handleDeleteConversation = async () => {
    if (!phoneToDelete) return;
    try {
      await api.deleteConversation(phoneToDelete);
      toast.info(`Memoria del contacto ${phoneToDelete} eliminada`);
      setConversations((prev) => prev.filter((c) => c.phone !== phoneToDelete));
      if (selectedPhone === phoneToDelete) {
        setSelectedPhone(null);
        setMessages([]);
      }
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar conversación');
    } finally {
      setPhoneToDelete(null);
    }
  };

  // Clear all memory
  const handleClearAll = async () => {
    try {
      await api.clearAllMemory();
      toast.warning('Toda la memoria conversacional ha sido eliminada');
      setConversations([]);
      setSelectedPhone(null);
      setMessages([]);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Error al reiniciar memoria');
    } finally {
      setShowClearAllModal(false);
    }
  };

  // Filtered contacts
  const filteredConversations = conversations.filter(
    (c) =>
      c.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.contact_name && c.contact_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedConversation = conversations.find((c) => c.phone === selectedPhone);

  return (
    <div className="space-y-6">
      {/* Top Banner: Resilient Architecture Indicator */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-white tracking-tight">
                    Memoria Conversacional & Resiliencia
                  </h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Dual-DB Failover
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                  Gemini recuerda el contexto previo de cada cliente de WhatsApp usando PostgreSQL en tu Servidor Oracle con conmutación automática (Failover) a Supabase.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-2 border border-slate-700/60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar Estado</span>
            </button>

            <button
              type="button"
              onClick={handleViewSql}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition flex items-center gap-2 border border-emerald-500/30"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Ver Script DDL SQL</span>
            </button>
          </div>
        </div>

        {/* 3 Status Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* Card 1: PostgreSQL Oracle (Primary) */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    PostgreSQL (Oracle)
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-semibold">
                      Primario
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]">
                    {health?.primary?.hostOrUrl || 'No configurado'}
                  </p>
                </div>
              </div>

              {health?.primary?.status === 'connected' ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" /> Conectado
                </span>
              ) : health?.primary?.status === 'error' ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/30">
                  <AlertCircle className="w-3 h-3" /> Error
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  Sin Configurar
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
              <span className="text-slate-400">
                Latencia: {health?.primary?.latencyMs ? `${health.primary.latencyMs} ms` : '—'}
              </span>
              <button
                type="button"
                onClick={handleTestPostgres}
                disabled={testingPg}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
              >
                {testingPg ? 'Probando...' : 'Probar Ping'}
              </button>
            </div>
          </div>

          {/* Card 2: Supabase (Fallback) */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/15 text-teal-400">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    Supabase
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 font-semibold">
                      Fallback
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]">
                    {health?.fallback?.hostOrUrl || 'No configurado'}
                  </p>
                </div>
              </div>

              {health?.fallback?.status === 'connected' ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" /> Respaldo Listo
                </span>
              ) : health?.fallback?.status === 'error' ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/30">
                  <AlertCircle className="w-3 h-3" /> Error
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  Sin Configurar
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
              <span className="text-slate-400">
                Latencia: {health?.fallback?.latencyMs ? `${health.fallback.latencyMs} ms` : '—'}
              </span>
              <button
                type="button"
                onClick={handleTestSupabase}
                disabled={testingSupabase}
                className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition"
              >
                {testingSupabase ? 'Probando...' : 'Probar Ping'}
              </button>
            </div>
          </div>

          {/* Card 3: Active Engine in Real-Time */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/40 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300">Motor Activo en Tiempo Real</span>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400">
                  Operativo
                </span>
              </div>
            </div>

            <div className="my-1">
              <div className="text-base font-black text-white flex items-center gap-2">
                {health?.activeProvider === 'postgresql' && (
                  <span className="text-blue-400 flex items-center gap-1.5">
                    🐘 PostgreSQL (Servidor Oracle)
                  </span>
                )}
                {health?.activeProvider === 'supabase' && (
                  <span className="text-teal-400 flex items-center gap-1.5">
                    ⚡ Supabase (Fallback Activado)
                  </span>
                )}
                {health?.activeProvider === 'local_fallback' && (
                  <span className="text-amber-400 flex items-center gap-1.5">
                    💾 Contingencia Local
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {health?.stats?.totalConversations || 0} chats guardados · {health?.stats?.totalMessages || 0}{' '}
                mensajes persistentes
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Ventana de Contexto:</span>
              <span className="font-bold text-emerald-400">
                Últimos {health?.maxTurns || 10} turnos ({((health?.maxTurns || 10) * 2)} mensajes)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('conversations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'conversations'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Conversaciones & Historial ({conversations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('admins')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'admins'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Contactos Administrativos ({adminContacts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'settings'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Configuración & Credenciales</span>
        </button>
      </div>

      {/* TAB 1: CONVERSATIONS & CHAT HISTORY */}
      {activeTab === 'conversations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px]">
          {/* Left Column: Contact List */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col h-[650px] shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Contactos con Memoria</h3>
                <p className="text-[11px] text-slate-400">
                  Clientes atendidos por el bot con contexto guardado
                </p>
              </div>

              {conversations.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearAllModal(true)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  title="Vaciar toda la memoria"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por teléfono o nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Contact List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredConversations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <MessageSquare className="w-8 h-8 mb-2 stroke-1 text-slate-600" />
                  <p className="text-xs font-medium">No hay conversaciones registradas aún.</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Cuando un usuario escriba por WhatsApp o pruebes en el simulador, se registrará aquí.
                  </p>
                </div>
              ) : (
                filteredConversations.map((c) => {
                  const isSelected = selectedPhone === c.phone;
                  return (
                    <div
                      key={c.phone}
                      onClick={() => setSelectedPhone(c.phone)}
                      className={`p-3.5 rounded-2xl cursor-pointer transition flex items-center justify-between border group ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500/40 shadow-sm'
                          : 'bg-slate-950/60 hover:bg-slate-950 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950'
                              : 'bg-slate-800 text-slate-300 group-hover:bg-slate-700'
                          }`}
                        >
                          {c.contact_name ? c.contact_name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">
                            {c.contact_name && c.contact_name !== c.phone ? c.contact_name : `+${c.phone}`}
                          </h4>
                          <p className="text-[11px] text-slate-400 font-mono truncate">
                            {c.contact_name && c.contact_name !== c.phone ? `+${c.phone}` : 'Chat de WhatsApp'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[10px] text-slate-400">
                          {c.last_message_at
                            ? new Date(c.last_message_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {c.message_count || 0} msgs
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Selected Conversation History */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col h-[650px] shadow-lg">
            {selectedPhone ? (
              <>
                {/* Chat Header */}
                <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        {selectedConversation?.contact_name || `+${selectedPhone}`}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          En Memoria
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono">
                        +{selectedPhone} · {messages.length} mensajes guardados
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPhoneToDelete(selectedPhone)}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-semibold transition flex items-center gap-1.5 border border-rose-500/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Borrar Memoria</span>
                  </button>
                </div>

                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {loadingMessages ? (
                    <div className="h-full flex items-center justify-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center">
                      <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-xs">No hay mensajes guardados en el historial.</p>
                    </div>
                  ) : (
                    (() => {
                      const sortedMessages = [...messages].sort((a, b) => {
                        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
                        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
                        if (timeA !== timeB) return timeA - timeB;
                        if (a.role === 'user' && b.role === 'model') return -1;
                        if (a.role === 'model' && b.role === 'user') return 1;
                        return 0;
                      });

                      return (
                        <>
                          {sortedMessages.map((m, idx) => {
                            const isUser = m.role === 'user';
                            return (
                              <div
                                key={m.id || idx}
                                className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}
                              >
                                <div
                                  className={`max-w-[80%] rounded-2xl p-3.5 shadow-sm text-xs leading-relaxed ${
                                    isUser
                                      ? 'bg-slate-950 text-slate-200 border border-slate-800 rounded-bl-none'
                                      : 'bg-emerald-600 text-white rounded-br-none shadow-md shadow-emerald-950/20'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 mb-1 opacity-80 text-[10px] font-semibold">
                                    {isUser ? (
                                      <>
                                        <User className="w-3 h-3 text-slate-400" />
                                        <span className="text-slate-300">Cliente</span>
                                      </>
                                    ) : (
                                      <>
                                        <Bot className="w-3 h-3 text-emerald-100" />
                                        <span className="text-white font-bold">Nuestra Respuesta (Bot)</span>
                                      </>
                                    )}
                                    <span>·</span>
                                    <span>
                                      {m.created_at
                                        ? new Date(m.created_at).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })
                                        : ''}
                                    </span>
                                  </div>

                                  <p className="whitespace-pre-wrap">{m.content}</p>

                                  {m.media_id && (
                                    <div className="mt-2 pt-2 border-t border-emerald-500/50 text-[10px] font-semibold text-emerald-100 flex items-center gap-1">
                                      <span>📸 Imagen enviada del catálogo:</span>
                                      <code className="bg-emerald-700/60 px-1 py-0.5 rounded text-white font-mono">
                                        {m.media_id}
                                      </code>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </>
                      );
                    })()
                  )}
                </div>

                {/* Footer status notice */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Persistido en: <strong className="text-slate-200 uppercase">{health?.activeProvider}</strong>
                  </span>
                  <span>
                    Gemini inyecta los últimos{' '}
                    <strong className="text-emerald-400">{health?.maxTurns || 10} turnos</strong> en el prompt
                  </span>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center">
                <MessageSquare className="w-12 h-12 mb-3 stroke-1 text-slate-600" />
                <h4 className="text-sm font-bold text-slate-300">Selecciona una conversación</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Haz clic en cualquiera de los contactos de la lista de la izquierda para ver su memoria histórica completa.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ADMIN CONTACTS (PERMISOS ADMINISTRATIVOS & CONTROL DE ACCESO) */}
      {activeTab === 'admins' && (
        <div className="space-y-6">
          {/* Header Info Banner */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white">Contactos con Rol Administrativo</h3>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Seguridad Activa
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Solo los contactos y números registrados en esta lista tienen autorización para consultar métricas financieras globales de la empresa, recaudación del mes, saldos pendientes y el resumen ejecutivo vía WhatsApp o Simulador. Los clientes y alumnos ordinarios solo pueden ver sus propias citas y cuotas individuales.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddAdminModal(true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-950/30 self-start md:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Administrador</span>
              </button>
            </div>
          </div>

          {/* Admin Contacts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminContacts.length === 0 ? (
              <div className="col-span-full p-12 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-3">
                <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-300">No hay contactos administrativos configurados</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Agrega al menos un número de WhatsApp administrativo para que el dueño o directores del negocio puedan solicitar reportes financieros y estados de recaudación por chat.
                </p>
              </div>
            ) : (
              adminContacts.map((admin) => (
                <div
                  key={admin.id}
                  className={`p-5 rounded-3xl border transition flex flex-col justify-between ${
                    admin.is_active
                      ? 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800/60 opacity-60'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Name, Avatar & Role Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-800 text-emerald-400 border border-slate-700 flex items-center justify-center font-bold text-sm">
                          {admin.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                            {admin.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {admin.phone === 'admin-dashboard' ? 'Panel Web (Local)' : `+${admin.phone}`}
                          </p>
                          {admin.secondary_phones && (
                            <p className="text-[10px] text-emerald-400/80 font-mono mt-0.5 truncate max-w-[220px]" title={admin.secondary_phones}>
                              Alt: {admin.secondary_phones}
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                          admin.role === 'superadmin'
                            ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                            : admin.role === 'admin'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                        }`}
                      >
                        {admin.role}
                      </span>
                    </div>

                    {/* Permissions list */}
                    <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Ver Finanzas & Facturación:</span>
                        <span className={admin.can_view_finances ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                          {admin.can_view_finances ? 'Permitido' : 'No'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Consultar Métricas & Reportes:</span>
                        <span className={admin.can_view_metrics ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                          {admin.can_view_metrics ? 'Permitido' : 'No'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Gestionar Citas & Agenda:</span>
                        <span className={admin.can_manage_bookings ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                          {admin.can_manage_bookings ? 'Permitido' : 'No'}
                        </span>
                      </div>
                    </div>

                    {admin.notes && (
                      <p className="text-[11px] text-slate-500 bg-slate-950 p-2.5 rounded-xl border border-slate-800/60 italic">
                        "{admin.notes}"
                      </p>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleToggleAdminActive(admin)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition border flex items-center gap-1.5 ${
                        admin.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {admin.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      <span>{admin.is_active ? 'Activo' : 'Inactivo'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdminContactToDelete(admin)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Eliminar contacto administrativo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SETTINGS & CREDENTIALS FORM */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* General Memory Toggle & Turns */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-6 shadow-lg">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  Control de Memoria de Gemini
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Define si el bot recordará mensajes previos y el tamaño de la ventana de contexto
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={memoryEnabled}
                  onChange={(e) => setMemoryEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  Ventana de Turnos Conversacionales ({memoryLimitTurns} turnos = {memoryLimitTurns * 2} mensajes)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="2"
                    max="30"
                    step="1"
                    value={memoryLimitTurns}
                    onChange={(e) => setMemoryLimitTurns(parseInt(e.target.value, 10))}
                    className="flex-1 accent-emerald-500 cursor-pointer"
                  />
                  <span className="w-12 text-center px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-emerald-400">
                    {memoryLimitTurns}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Recomendado: 10 turnos (20 mensajes). Mantiene excelente contexto sin saturar la cuota de tokens.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
                <Zap className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <strong>Estrategia de Failover Automático:</strong>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Cada mensaje intenta guardarse en tu PostgreSQL de Oracle. Si el servidor de Oracle tiene latencia alta o desconexión, conmuta en milisegundos a Supabase de respaldo sin interrumpir al cliente en WhatsApp.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Database: PostgreSQL (Oracle Server) */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Base de Datos Primaria: PostgreSQL (Servidor Oracle)
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold">
                      Prioridad 1
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Conexión a tu instancia PostgreSQL en Oracle Cloud (OCI) o VM
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestPostgres}
                disabled={testingPg}
                className="px-3.5 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 text-xs font-semibold transition border border-blue-500/30 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingPg ? 'animate-spin' : ''}`} />
                <span>Probar Conexión</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Cadena de Conexión de PostgreSQL (DATABASE_URL)</span>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Base de Datos: whatsappbot_db
                </span>
              </label>
              <input
                type="text"
                placeholder="postgresql://usuario:password@oracle-ip:5432/whatsappbot_db?sslmode=disable"
                value={postgresUrl}
                onChange={(e) => setPostgresUrl(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:border-blue-500 transition"
              />
              <p className="text-[11px] text-slate-400 mt-1.5 flex flex-wrap items-center gap-1.5">
                <span>💡 Ejemplo:</span>
                <code className="text-emerald-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                  postgresql://postgres:tu_password@129.151.x.x:5432/whatsappbot_db?sslmode=disable
                </code>
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                ⚡ Si la base de datos <code className="text-slate-400">whatsappbot_db</code> aún no existe en tu servidor Oracle, el sistema se conectará a la instancia y la creará automáticamente.
              </p>
            </div>
          </div>

          {/* Fallback Database: Supabase */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Base de Datos Fallback: Supabase
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-bold">
                      Respaldo Automático
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Se activa instantáneamente si PostgreSQL de Oracle no responde
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestSupabase}
                disabled={testingSupabase}
                className="px-3.5 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 text-xs font-semibold transition border border-teal-500/30 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingSupabase ? 'animate-spin' : ''}`} />
                <span>Probar Supabase</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  placeholder="https://xyzproject.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:border-teal-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Supabase Key (Service Role o Anon)
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:border-teal-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                (Opcional) Supabase Direct PostgreSQL URL / Transaction Pooler
              </label>
              <input
                type="text"
                placeholder="postgresql://postgres.xyz:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
                value={supabaseDbUrl}
                onChange={(e) => setSupabaseDbUrl(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:border-teal-500 transition"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Permite ejecución directa de DDL automático también en Supabase.
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleInitTables}
                disabled={initializingTables}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-2 border border-slate-700"
              >
                <Database className="w-4 h-4 text-emerald-400" />
                <span>{initializingTables ? 'Creando Tablas...' : 'Auto-Crear Tablas en BD'}</span>
              </button>

              <button
                type="button"
                onClick={handleViewSql}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-2"
              >
                <Code2 className="w-4 h-4" />
                <span>Ver SQL</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
            >
              <Save className="w-4 h-4" />
              <span>{savingSettings ? 'Guardando...' : 'Guardar y Aplicar Cambios'}</span>
            </button>
          </div>
        </form>
      )}

      {/* SQL DDL Modal */}
      <Modal
        isOpen={showSqlModal}
        onClose={() => setShowSqlModal(false)}
        title="Script SQL de Tablas (DDL)"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed">
            Puedes copiar y pegar este script en tu cliente de PostgreSQL (pgAdmin, DBeaver, psql) en tu Servidor Oracle o en el <strong>SQL Editor</strong> de Supabase:
          </p>

          <div className="relative">
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-72">
              {sqlDdl}
            </pre>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(sqlDdl);
                toast.success('Script SQL copiado al portapapeles');
              }}
              className="absolute top-2 right-2 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar</span>
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowSqlModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Single Conversation Modal */}
      <ConfirmModal
        isOpen={Boolean(phoneToDelete)}
        onClose={() => setPhoneToDelete(null)}
        onConfirm={handleDeleteConversation}
        title="¿Borrar memoria de este contacto?"
        message={`Se eliminarán todos los mensajes guardados del número +${phoneToDelete} tanto en PostgreSQL como en Supabase. El bot volverá a iniciar como si no conociera al usuario.`}
        confirmText="Sí, borrar memoria"
        variant="danger"
      />

      {/* Clear All Memory Modal */}
      <ConfirmModal
        isOpen={showClearAllModal}
        onClose={() => setShowClearAllModal(false)}
        onConfirm={handleClearAll}
        title="¿Vaciar TODA la memoria conversacional?"
        message="Esta acción vaciará por completo las tablas de mensajes y conversaciones en PostgreSQL, Supabase y el respaldo local. Todos los usuarios empezarán de cero."
        confirmText="Sí, vaciar todo"
        variant="danger"
      />

      {/* Add / Register Admin Contact Modal */}
      <Modal
        isOpen={showAddAdminModal}
        onClose={() => setShowAddAdminModal(false)}
        title="Registrar Contacto Administrativo"
      >
        <form onSubmit={handleSaveAdminContact} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-bold mb-1.5">
              Número de WhatsApp (con código de país) *
            </label>
            <input
              type="text"
              placeholder="Ej: 51942629785 o 21122699509833"
              value={adminForm.phone}
              onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Ingresa el número tal como aparece en WhatsApp (sin espacios ni símbolos +).
            </p>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1.5">
              Números Secundarios / Alternativos (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: 51988887777, 51999991111 (separados por coma)"
              value={adminForm.secondary_phones}
              onChange={(e) => setAdminForm({ ...adminForm, secondary_phones: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Si este administrador usa varios números de WhatsApp, ingrésalos aquí para que todos tengan acceso.
            </p>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1.5">
              Nombre o Cargo del Administrador *
            </label>
            <input
              type="text"
              placeholder="Ej: Ing. David (Dueño) / Gerencia General"
              value={adminForm.name}
              onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                Rol
              </label>
              <select
                value={adminForm.role}
                onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value as any })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="superadmin">Superadmin (Acceso Total)</option>
                <option value="admin">Administrador Regular</option>
                <option value="operator">Operador</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                Estado
              </label>
              <select
                value={adminForm.is_active ? 'true' : 'false'}
                onChange={(e) => setAdminForm({ ...adminForm, is_active: e.target.value === 'true' })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="true">Activo (Habilitado)</option>
                <option value="false">Inactivo (Suspendido)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-2">
            <span className="font-bold text-slate-300 block mb-1">Permisos Especiales:</span>
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={adminForm.can_view_finances}
                onChange={(e) => setAdminForm({ ...adminForm, can_view_finances: e.target.checked })}
                className="rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-0"
              />
              <span>Consultar métricas de facturación y recaudación</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={adminForm.can_view_metrics}
                onChange={(e) => setAdminForm({ ...adminForm, can_view_metrics: e.target.checked })}
                className="rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-0"
              />
              <span>Consultar alumnos morosos y deudores</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={adminForm.can_manage_bookings}
                onChange={(e) => setAdminForm({ ...adminForm, can_manage_bookings: e.target.checked })}
                className="rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-0"
              />
              <span>Consultar resumen ejecutivo general</span>
            </label>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1.5">
              Notas Adicionales (Opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Ej: Celular corporativo de la dirección general..."
              value={adminForm.notes}
              onChange={(e) => setAdminForm({ ...adminForm, notes: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowAddAdminModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingAdmin}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition flex items-center gap-1.5"
            >
              {savingAdmin ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Guardar Contacto</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Admin Modal */}
      <ConfirmModal
        isOpen={Boolean(adminContactToDelete)}
        onClose={() => setAdminContactToDelete(null)}
        onConfirm={handleDeleteAdminContact}
        title="¿Eliminar contacto administrativo?"
        message={`¿Estás seguro de revocar el rol administrativo a "${adminContactToDelete?.name}" (+${adminContactToDelete?.phone})? Ya no podrá consultar métricas confidenciales ni reportes por chat.`}
        confirmText="Sí, revocar y eliminar"
        variant="danger"
      />
    </div>
  );
};
