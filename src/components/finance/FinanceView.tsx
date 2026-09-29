import React, { useState, useEffect, useRef } from 'react';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Receipt,
  FileCheck2,
  Users,
  Search,
  Plus,
  Send,
  Sparkles,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  Package,
  Bot,
  Filter,
  Eye,
  Upload,
} from 'lucide-react';
import { api } from '../../services/api';
import {
  StudentBillRecord,
  PaymentVoucherRecord,
  PlanRecord,
  FinancialStatsRecord,
  DebtorSummaryRecord,
  StudentRecord,
} from '../../types';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui/Modal';

export const FinanceView: React.FC = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'bills' | 'vouchers' | 'plans' | 'ai_assistant'>('bills');
  const [loading, setLoading] = useState(true);

  // Data states
  const [stats, setStats] = useState<FinancialStatsRecord | null>(null);
  const [bills, setBills] = useState<StudentBillRecord[]>([]);
  const [vouchers, setVouchers] = useState<PaymentVoucherRecord[]>([]);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);

  // Filter states for bills
  const [billStatusFilter, setBillStatusFilter] = useState<string>('all');
  const [billSearch, setBillSearch] = useState('');

  // Modals
  const [showNewBillModal, setShowNewBillModal] = useState(false);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [showUploadVoucherModal, setShowUploadVoucherModal] = useState(false);
  const [selectedVoucherForModal, setSelectedVoucherForModal] = useState<PaymentVoucherRecord | null>(null);

  // New Bill Form
  const [newBillForm, setNewBillForm] = useState({
    studentPhone: '',
    studentName: '',
    planId: '',
    concept: '',
    amount: '',
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    notes: '',
  });

  // New Plan Form
  const [newPlanForm, setNewPlanForm] = useState({
    name: '',
    code: '',
    description: '',
    price: '',
    billing_cycle: 'monthly' as const,
  });

  // Upload Voucher Test Form
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [voucherTestPhone, setVoucherTestPhone] = useState('51999888777');
  const [voucherTestName, setVoucherTestName] = useState('Carlos Mendez');
  const [uploadingVoucher, setUploadingVoucher] = useState(false);
  const [voucherTestResult, setVoucherTestResult] = useState<any>(null);

  // AI Assistant Chat State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChatHistory, setAiChatHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string; time: string }>>([
    {
      role: 'assistant',
      text: '¡Hola! Soy tu Asistente Ejecutivo Gemini. Pregúntame lo que necesites sobre tus finanzas, alumnos, citas o cobranzas en tiempo real.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load all data
  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, billsData, vouchersData, plansData, studentsData] = await Promise.all([
        api.getFinancialStats().catch(() => null),
        api.getBills().catch(() => []),
        api.getVouchers().catch(() => []),
        api.getPlans().catch(() => []),
        api.getStudents().catch(() => []),
      ]);

      if (statsData) setStats(statsData);
      setBills(billsData);
      setVouchers(vouchersData);
      setPlans(plansData);
      setStudents(studentsData);
    } catch (err: any) {
      addToast(err?.message || 'Error al cargar datos financieros', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiChatHistory]);

  // Handle Bill Creation
  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBillForm.studentPhone || !newBillForm.concept || !newBillForm.amount || !newBillForm.dueDate) {
      addToast('Por favor completa todos los campos requeridos', 'warning');
      return;
    }

    try {
      await api.createBill({
        studentPhone: newBillForm.studentPhone,
        studentName: newBillForm.studentName || `Alumno ${newBillForm.studentPhone.slice(-4)}`,
        planId: newBillForm.planId ? Number(newBillForm.planId) : undefined,
        concept: newBillForm.concept,
        amount: Number(newBillForm.amount),
        dueDate: newBillForm.dueDate,
        notes: newBillForm.notes,
      });

      addToast('Cuota generada exitosamente', 'success');
      setShowNewBillModal(false);
      setNewBillForm({
        studentPhone: '',
        studentName: '',
        planId: '',
        concept: '',
        amount: '',
        dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        notes: '',
      });
      loadData();
    } catch (err: any) {
      addToast(err?.message || 'Error al generar cuota', 'error');
    }
  };

  // Handle Plan Creation
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanForm.name || !newPlanForm.price) {
      addToast('Nombre y precio son obligatorios', 'warning');
      return;
    }

    try {
      await api.createPlan({
        name: newPlanForm.name,
        code: newPlanForm.code || `PLAN-${Date.now().toString().slice(-4)}`,
        description: newPlanForm.description,
        price: Number(newPlanForm.price),
        billing_cycle: newPlanForm.billing_cycle,
        is_active: true,
      });

      addToast('Plan creado exitosamente', 'success');
      setShowNewPlanModal(false);
      setNewPlanForm({
        name: '',
        code: '',
        description: '',
        price: '',
        billing_cycle: 'monthly',
      });
      loadData();
    } catch (err: any) {
      addToast(err?.message || 'Error al crear plan', 'error');
    }
  };

  // Send WhatsApp Payment Reminder
  const handleSendReminder = async (billId: number | string) => {
    try {
      addToast('Enviando recordatorio preventivo por WhatsApp...', 'info');
      const res = await api.sendBillReminder(billId);
      addToast(res.message, 'success');
      loadData();
    } catch (err: any) {
      addToast(err?.message || 'Error al enviar recordatorio', 'error');
    }
  };

  // Update Bill Status
  const handleStatusChange = async (billId: number | string, newStatus: string) => {
    try {
      await api.updateBillStatus(billId, newStatus);
      addToast('Estado actualizado', 'success');
      loadData();
    } catch (err: any) {
      addToast(err?.message || 'Error al actualizar estado', 'error');
    }
  };

  // Upload/Simulate Voucher Test
  const handleUploadVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherFile) {
      addToast('Selecciona una imagen de comprobante', 'warning');
      return;
    }

    try {
      setUploadingVoucher(true);
      setVoucherTestResult(null);
      addToast('Analizando comprobante con Gemini Vision...', 'info');

      const result = await api.simulateVoucherUpload(voucherFile, voucherTestPhone, voucherTestName);
      setVoucherTestResult(result);

      if (result.analysis?.isValidVoucher) {
        addToast(`¡Comprobante validado! Monto: $${result.analysis.amount} (${result.analysis.bankOrPlatform})`, 'success');
      } else {
        addToast('Gemini Vision determinó que la imagen no es un voucher bancario válido', 'warning');
      }

      loadData();
    } catch (err: any) {
      addToast(err?.message || 'Error al procesar comprobante con IA Vision', 'error');
    } finally {
      setUploadingVoucher(false);
    }
  };

  // Ask Executive AI Assistant
  const handleSendAiPrompt = async (promptToSend?: string) => {
    const query = (promptToSend || aiPrompt).trim();
    if (!query || aiLoading) return;

    const userMessage = {
      role: 'user' as const,
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setAiChatHistory(prev => [...prev, userMessage]);
    setAiPrompt('');
    setAiLoading(true);

    try {
      const res = await api.consultExecutiveAI(query);
      const assistantMessage = {
        role: 'assistant' as const,
        text: res.response || 'No se obtuvo respuesta analítica.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setAiChatHistory(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage = {
        role: 'assistant' as const,
        text: `⚠️ Error al procesar consulta: ${err?.message || 'Error de conexión con Gemini'}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setAiChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setAiLoading(false);
    }
  };

  // Filter bills
  const filteredBills = bills.filter(bill => {
    const matchesStatus = billStatusFilter === 'all' || bill.status === billStatusFilter;
    const matchesSearch =
      billSearch === '' ||
      bill.student_name.toLowerCase().includes(billSearch.toLowerCase()) ||
      bill.student_phone.includes(billSearch) ||
      bill.bill_code.toLowerCase().includes(billSearch.toLowerCase()) ||
      bill.concept.toLowerCase().includes(billSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-emerald-400" />
            Finanzas & Pagos Inteligentes con IA
          </h1>
          <p className="text-slate-400 text-sm">
            Control de mensualidades, deudas, validación de vouchers con Gemini Vision y analítica ejecutiva en tiempo real.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition border border-slate-700"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowUploadVoucherModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-white font-medium text-sm transition shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            Probar Voucher con IA
          </button>
          <button
            onClick={() => setShowNewBillModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nueva Cuota
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Recaudación del Mes</div>
            <div className="text-xl font-bold text-slate-100">
              ${stats?.totalCollectedMonth?.toFixed(2) || '0.00'}
            </div>
            <div className="text-xs text-emerald-400 font-medium">Ingresos validados</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Saldo por Cobrar</div>
            <div className="text-xl font-bold text-amber-400">
              ${stats?.totalPendingAmount?.toFixed(2) || '0.00'}
            </div>
            <div className="text-xs text-slate-400">Por cobrar este ciclo</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center font-bold">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Cuotas Vencidas</div>
            <div className="text-xl font-bold text-red-400">
              {stats?.overdueBillsCount || 0}
            </div>
            <div className="text-xs text-red-400 font-medium">Requieren recordatorio</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Vouchers IA Hoy</div>
            <div className="text-xl font-bold text-indigo-400">
              {stats?.vouchersValidatedToday || 0}
            </div>
            <div className="text-xs text-indigo-400 font-medium">Auto-validados</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Tasa de Cobranza</div>
            <div className="text-xl font-bold text-blue-400">
              {stats?.collectionRatePct || 100}%
            </div>
            <div className="text-xs text-slate-400">{stats?.activeStudents || 0} alumnos activos</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('bills')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition whitespace-nowrap ${
            activeTab === 'bills'
              ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Mensualidades & Estados de Cuenta ({bills.length})
        </button>

        <button
          onClick={() => setActiveTab('vouchers')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition whitespace-nowrap ${
            activeTab === 'vouchers'
              ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Comprobantes & Vouchers IA ({vouchers.length})
        </button>

        <button
          onClick={() => setActiveTab('plans')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition whitespace-nowrap ${
            activeTab === 'plans'
              ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          Planes & Tarifas ({plans.length})
        </button>

        <button
          onClick={() => setActiveTab('ai_assistant')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition whitespace-nowrap ${
            activeTab === 'ai_assistant'
              ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bot className="w-4 h-4" />
          Asistente Ejecutivo IA (Analítica en Vivo)
        </button>
      </div>

      {/* TAB 1: MENSUALIDADES & ESTADOS DE CUENTA */}
      {activeTab === 'bills' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center gap-2 w-full sm:w-80 bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-1.5">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por alumno, teléfono, código..."
                value={billSearch}
                onChange={e => setBillSearch(e.target.value)}
                className="bg-transparent text-sm text-slate-100 outline-none w-full placeholder-slate-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Estado:
              </span>
              {[
                { id: 'all', label: 'Todos' },
                { id: 'pending', label: 'Pendientes' },
                { id: 'partial', label: 'Parciales' },
                { id: 'paid', label: 'Pagados' },
                { id: 'overdue', label: 'Vencidos' },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setBillStatusFilter(st.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                    billStatusFilter === st.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bills Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Código</th>
                    <th className="py-3.5 px-4">Alumno / Contacto</th>
                    <th className="py-3.5 px-4">Concepto</th>
                    <th className="py-3.5 px-4">Monto Total</th>
                    <th className="py-3.5 px-4">Saldo Pendiente</th>
                    <th className="py-3.5 px-4">Vencimiento</th>
                    <th className="py-3.5 px-4">Estado</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredBills.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No se encontraron cuotas o mensualidades con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredBills.map(bill => {
                      const isOverdue = new Date(bill.due_date) < new Date() && bill.status !== 'paid';
                      return (
                        <tr key={bill.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-200 text-xs">
                            {bill.bill_code}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-100">{bill.student_name}</div>
                            <div className="text-xs text-slate-400 font-mono">+{bill.student_phone}</div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">
                            {bill.concept}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-200">
                            ${Number(bill.amount).toFixed(2)} {bill.currency}
                          </td>
                          <td className="py-3.5 px-4 font-bold">
                            {Number(bill.balance_pending) > 0 ? (
                              <span className="text-amber-400">${Number(bill.balance_pending).toFixed(2)}</span>
                            ) : (
                              <span className="text-emerald-400">$0.00</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-mono">
                            <span className={isOverdue ? 'text-red-400 font-bold flex items-center gap-1' : 'text-slate-300'}>
                              {isOverdue && <AlertTriangle className="w-3.5 h-3.5" />}
                              {bill.due_date}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <select
                              value={bill.status}
                              onChange={e => handleStatusChange(bill.id, e.target.value)}
                              className={`text-xs font-medium px-2.5 py-1 rounded-full border outline-none cursor-pointer ${
                                bill.status === 'paid'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : bill.status === 'partial'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  : isOverdue || bill.status === 'overdue'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}
                            >
                              <option value="pending" className="bg-slate-900 text-amber-400">Pendiente</option>
                              <option value="partial" className="bg-slate-900 text-blue-400">Parcial</option>
                              <option value="paid" className="bg-slate-900 text-emerald-400">Pagado</option>
                              <option value="overdue" className="bg-slate-900 text-red-400">Vencido</option>
                              <option value="cancelled" className="bg-slate-900 text-slate-400">Cancelado</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {bill.status !== 'paid' && (
                              <button
                                onClick={() => handleSendReminder(bill.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium transition border border-emerald-500/30"
                                title="Enviar recordatorio de cobro por WhatsApp"
                              >
                                <Send className="w-3 h-3" />
                                Recordar WhatsApp
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMPROBANTES & VOUCHERS (IA VISION) */}
      {activeTab === 'vouchers' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Vouchers Procesados con Visión Artificial (Gemini Multimodal)
              </h3>
              <p className="text-xs text-slate-400">
                Cada comprobante enviado por WhatsApp es inspeccionado automáticamente por Gemini para validar monto, banco, referencia y fecha.
              </p>
            </div>
            <button
              onClick={() => setShowUploadVoucherModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition"
            >
              <Upload className="w-3.5 h-3.5" />
              Probar o Subir Comprobante
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vouchers.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
                Aún no se han recibido comprobantes de pago. Cuando los alumnos envíen fotos a WhatsApp, aparecerán aquí al instante.
              </div>
            ) : (
              vouchers.map(v => (
                <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-200">
                      {v.voucher_code}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        v.status === 'validated'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : v.status === 'rejected'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {v.status === 'validated' ? 'Validado por IA' : v.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {v.image_filename ? (
                      <img
                        src={`/api/vouchers/view/${v.image_filename}`}
                        alt="Voucher"
                        className="w-16 h-16 object-cover rounded-lg border border-slate-700 bg-slate-950 cursor-pointer hover:opacity-80 transition"
                        onClick={() => setSelectedVoucherForModal(v)}
                        onError={(e: any) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                        <Receipt className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-slate-100 text-sm">{v.student_name}</div>
                      <div className="text-xs text-slate-400 font-mono">+{v.student_phone}</div>
                      <div className="text-xs font-semibold text-emerald-400 mt-1">
                        ${Number(v.amount_detected).toFixed(2)} {v.currency}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-slate-300">
                    <div>
                      <span className="text-slate-500">Banco / App:</span> <strong className="text-slate-200">{v.bank_or_platform || 'Transferencia'}</strong>
                    </div>
                    {v.operation_number && (
                      <div>
                        <span className="text-slate-500">N° Operación:</span> <span className="font-mono text-slate-200">{v.operation_number}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500">Fecha Pago:</span> {v.payment_date || 'Registrado'}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedVoucherForModal(v)}
                    className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex items-center justify-center gap-1.5 border border-slate-700"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ver Detalle & Análisis IA
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PLANES & TARIFAS */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-100 text-sm">Catálogo de Planes y Membresías</h3>
            <button
              onClick={() => setShowNewPlanModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Plan
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map(p => (
              <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {p.code}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-medium">
                    {p.billing_cycle === 'monthly' ? 'Mensual' : p.billing_cycle}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-100 text-base">{p.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">{p.description || 'Sin descripción adicional.'}</p>
                </div>
                <div className="text-2xl font-black text-slate-100">
                  ${Number(p.price).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ASISTENTE EJECUTIVO IA (ANALÍTICA EN VIVO) */}
      {activeTab === 'ai_assistant' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-[650px]">
          {/* Header */}
          <div className="bg-slate-800/80 border-b border-slate-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                  Asistente Ejecutivo Gemini (Business Intelligence)
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                    En Vivo
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Consulta métricas vivas, alumnos activos, citas del día y cobros pendientes en lenguaje natural.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Questions Pills */}
          <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-slate-500 font-medium whitespace-nowrap">Consultas rápidas:</span>
            {[
              '¿Cuántos alumnos activos tengo?',
              '¿Cuántas citas tengo mañana?',
              '¿Quiénes tienen pagos pendientes?',
              '¿Cuánto hemos recaudado este mes?',
              'Dame un resumen ejecutivo del negocio',
            ].map((qp, i) => (
              <button
                key={i}
                onClick={() => handleSendAiPrompt(qp)}
                className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {aiChatHistory.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center flex-shrink-0 mt-1 border border-indigo-500/30">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-none shadow-sm'
                      : 'bg-slate-800/80 text-slate-100 rounded-bl-none border border-slate-700 shadow-sm whitespace-pre-wrap'
                  }`}
                >
                  <div>{msg.text}</div>
                  <div
                    className={`text-[10px] mt-1 text-right ${
                      msg.role === 'user' ? 'text-emerald-200' : 'text-slate-400'
                    }`}
                  >
                    {msg.time}
                  </div>
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20 max-w-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Gemini está analizando la base de datos en tiempo real...
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Box */}
          <div className="p-4 bg-slate-800/60 border-t border-slate-800">
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendAiPrompt();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="Escribe tu pregunta ejecutiva (ej: ¿Quiénes deben este mes?, ¿Qué citas hay hoy?)..."
                disabled={aiLoading}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 transition placeholder-slate-500"
              />
              <button
                type="submit"
                disabled={aiLoading || !aiPrompt.trim()}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm flex items-center gap-2 transition shadow-sm"
              >
                <Send className="w-4 h-4" />
                Consultar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA CUOTA */}
      <Modal isOpen={showNewBillModal} onClose={() => setShowNewBillModal(false)} title="Generar Nueva Cuota / Mensualidad">
        <form onSubmit={handleCreateBill} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Alumno Registrado</label>
            <select
              value={newBillForm.studentPhone}
              onChange={e => {
                const phone = e.target.value;
                const found = students.find(s => s.phone === phone);
                setNewBillForm(prev => ({
                  ...prev,
                  studentPhone: phone,
                  studentName: found ? found.full_name : prev.studentName,
                }));
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
              required
            >
              <option value="">-- Selecciona un alumno o ingresa manual --</option>
              {students.map(s => (
                <option key={s.id} value={s.phone}>
                  {s.full_name} (+{s.phone})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Teléfono WhatsApp</label>
              <input
                type="text"
                placeholder="Ej: 51999888777"
                value={newBillForm.studentPhone}
                onChange={e => setNewBillForm({ ...newBillForm, studentPhone: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Nombre del Alumno</label>
              <input
                type="text"
                placeholder="Ej: Carlos Mendez"
                value={newBillForm.studentName}
                onChange={e => setNewBillForm({ ...newBillForm, studentName: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Concepto de Cobro</label>
            <input
              type="text"
              placeholder="Ej: Mensualidad Octubre 2026 - Curso Chatbots IA"
              value={newBillForm.concept}
              onChange={e => setNewBillForm({ ...newBillForm, concept: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Monto ($ USD)</label>
              <input
                type="number"
                step="0.01"
                placeholder="50.00"
                value={newBillForm.amount}
                onChange={e => setNewBillForm({ ...newBillForm, amount: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Fecha de Vencimiento</label>
              <input
                type="date"
                value={newBillForm.dueDate}
                onChange={e => setNewBillForm({ ...newBillForm, dueDate: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowNewBillModal(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
            >
              Generar Cuota
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: PROBAR VOUCHER CON IA VISION */}
      <Modal isOpen={showUploadVoucherModal} onClose={() => setShowUploadVoucherModal(false)} title="Validar Comprobante de Pago con Gemini Vision">
        <form onSubmit={handleUploadVoucher} className="space-y-4">
          <p className="text-xs text-slate-400">
            Sube una foto o captura de un comprobante bancario (Yape, Plin, BCP, BBVA, etc.) para someterlo al análisis multimodal de Gemini.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Teléfono del Alumno</label>
              <input
                type="text"
                value={voucherTestPhone}
                onChange={e => setVoucherTestPhone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Nombre</label>
              <input
                type="text"
                value={voucherTestName}
                onChange={e => setVoucherTestName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Imagen del Comprobante (Voucher)</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setVoucherFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
              required
            />
          </div>

          {voucherTestResult && (
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1.5 font-mono text-slate-300">
              <div className="font-sans font-bold text-indigo-400 text-sm">Resultado Gemini Vision:</div>
              <div><strong>Válido:</strong> {voucherTestResult.analysis?.isValidVoucher ? 'SÍ ✅' : 'NO ❌'}</div>
              <div><strong>Banco/App:</strong> {voucherTestResult.analysis?.bankOrPlatform}</div>
              <div><strong>Monto:</strong> ${voucherTestResult.analysis?.amount} {voucherTestResult.analysis?.currency}</div>
              <div><strong>N° Operación:</strong> {voucherTestResult.analysis?.operationNumber || 'N/A'}</div>
              <div><strong>Fecha:</strong> {voucherTestResult.analysis?.paymentDate}</div>
              <div className="text-slate-400">{voucherTestResult.analysis?.summary}</div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowUploadVoucherModal(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={uploadingVoucher || !voucherFile}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition flex items-center gap-2"
            >
              {uploadingVoucher ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {uploadingVoucher ? 'Analizando con IA...' : 'Analizar y Validar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: VER DETALLE DEL VOUCHER */}
      {selectedVoucherForModal && (
        <Modal
          isOpen={Boolean(selectedVoucherForModal)}
          onClose={() => setSelectedVoucherForModal(null)}
          title={`Detalle de Comprobante: ${selectedVoucherForModal.voucher_code}`}
        >
          <div className="space-y-4">
            {selectedVoucherForModal.image_filename && (
              <div className="flex justify-center bg-slate-950 p-2 rounded-xl border border-slate-800">
                <img
                  src={`/api/vouchers/view/${selectedVoucherForModal.image_filename}`}
                  alt="Comprobante"
                  className="max-h-72 object-contain rounded-lg"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-900 p-3 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-500">Alumno:</span> <strong className="text-slate-200">{selectedVoucherForModal.student_name}</strong>
              </div>
              <div>
                <span className="text-slate-500">Teléfono:</span> <span className="font-mono text-slate-200">+{selectedVoucherForModal.student_phone}</span>
              </div>
              <div>
                <span className="text-slate-500">Monto Aprobado:</span> <strong className="text-emerald-400 text-sm">${Number(selectedVoucherForModal.amount_approved).toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-slate-500">Canal:</span> <span className="text-slate-200">{selectedVoucherForModal.bank_or_platform}</span>
              </div>
              <div>
                <span className="text-slate-500">N° Operación:</span> <span className="font-mono text-slate-200">{selectedVoucherForModal.operation_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500">Fecha:</span> <span className="text-slate-200">{selectedVoucherForModal.payment_date}</span>
              </div>
            </div>

            {selectedVoucherForModal.gemini_analysis && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-400">Análisis Gemini Vision:</div>
                <div className="bg-slate-950 p-3 rounded-lg text-xs font-mono text-slate-300 max-h-36 overflow-y-auto">
                  {typeof selectedVoucherForModal.gemini_analysis === 'string'
                    ? selectedVoucherForModal.gemini_analysis
                    : JSON.stringify(selectedVoucherForModal.gemini_analysis, null, 2)}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL: NUEVO PLAN */}
      <Modal isOpen={showNewPlanModal} onClose={() => setShowNewPlanModal(false)} title="Crear Plan o Tarifa">
        <form onSubmit={handleCreatePlan} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Nombre del Plan</label>
            <input
              type="text"
              placeholder="Ej: Mensualidad Curso IA y Chatbots"
              value={newPlanForm.name}
              onChange={e => setNewPlanForm({ ...newPlanForm, name: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Precio ($ USD)</label>
              <input
                type="number"
                step="0.01"
                placeholder="50.00"
                value={newPlanForm.price}
                onChange={e => setNewPlanForm({ ...newPlanForm, price: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Periodicidad</label>
              <select
                value={newPlanForm.billing_cycle}
                onChange={e => setNewPlanForm({ ...newPlanForm, billing_cycle: e.target.value as any })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
              >
                <option value="monthly">Mensual</option>
                <option value="biweekly">Quincenal</option>
                <option value="one_time">Pago Único</option>
                <option value="annual">Anual</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Descripción</label>
            <textarea
              rows={2}
              placeholder="Detalles de la membresía o beneficios..."
              value={newPlanForm.description}
              onChange={e => setNewPlanForm({ ...newPlanForm, description: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowNewPlanModal(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
            >
              Crear Plan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
