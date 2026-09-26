import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  GraduationCap,
  Users,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bell,
  BookOpen,
  CalendarDays,
  Settings,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Phone,
  DollarSign,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { api } from '../../services/api';
import {
  AppointmentRecord,
  ScheduleRuleRecord,
  BookingServiceRecord,
  CourseRecord,
  StudentRecord,
  BookingStats,
} from '../../types';

export const BookingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'appointments' | 'schedule' | 'courses' | 'students'>('appointments');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<BookingStats>({
    todayAppointments: 0,
    upcomingAppointments: 0,
    activeStudents: 0,
    activeCourses: 0,
  });

  // Data collections
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [scheduleRules, setScheduleRules] = useState<ScheduleRuleRecord[]>([]);
  const [services, setServices] = useState<BookingServiceRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [selectedStudentForEnroll, setSelectedStudentForEnroll] = useState<StudentRecord | null>(null);

  // New Appointment Form State
  const [newAppPhone, setNewAppPhone] = useState('');
  const [newAppName, setNewAppName] = useState('');
  const [newAppDate, setNewAppDate] = useState(new Date().toISOString().split('T')[0]);
  const [newAppTime, setNewAppTime] = useState('');
  const [newAppService, setNewAppService] = useState('');
  const [newAppNotes, setNewAppNotes] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // New Course Form State
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [courseInstructor, setCourseInstructor] = useState('Ing. David');
  const [courseDays, setCourseDays] = useState('Lunes y Miércoles');
  const [courseStart, setCourseStart] = useState('19:00');
  const [courseEnd, setCourseEnd] = useState('21:00');
  const [courseCapacity, setCourseCapacity] = useState(30);

  // New Student Form State
  const [studentPhone, setStudentPhone] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentNotes, setStudentNotes] = useState('');

  // Enroll Form State
  const [enrollCourseId, setEnrollCourseId] = useState<number | ''>('');

  // Notifications
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [statsRes, appointmentsRes, scheduleRes, servicesRes, coursesRes, studentsRes] = await Promise.all([
        api.getBookingStats().catch(() => ({ todayAppointments: 0, upcomingAppointments: 0, activeStudents: 0, activeCourses: 0 })),
        api.getAppointments({ date: selectedDate || undefined, status: statusFilter || undefined, search: searchQuery || undefined }).catch(() => []),
        api.getScheduleRules().catch(() => []),
        api.getBookingServices().catch(() => []),
        api.getCourses().catch(() => []),
        api.getStudents().catch(() => []),
      ]);

      setStats(statsRes);
      setAppointments(appointmentsRes);
      setScheduleRules(scheduleRes);
      setServices(servicesRes);
      setCourses(coursesRes);
      setStudents(studentsRes);
    } catch (err: any) {
      showAlert('Error cargando datos del sistema de citas: ' + (err?.message || err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [selectedDate, statusFilter]);

  // Load available slots when modal date or service changes
  const fetchSlotsForDate = async (date: string) => {
    if (!date) return;
    setLoadingSlots(true);
    try {
      const res = await api.getAvailableSlots(date);
      setAvailableSlots(res.availableSlots || []);
      if (res.availableSlots && res.availableSlots.length > 0 && !newAppTime) {
        setNewAppTime(res.availableSlots[0]);
      }
    } catch (e) {
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (isAppointmentModalOpen && newAppDate) {
      fetchSlotsForDate(newAppDate);
    }
  }, [isAppointmentModalOpen, newAppDate]);

  // Actions
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppPhone || !newAppDate || !newAppTime) {
      showAlert('Teléfono, fecha y hora son obligatorios.', 'error');
      return;
    }

    try {
      await api.createAppointment({
        phone: newAppPhone,
        clientName: newAppName || 'Cliente WhatsApp',
        date: newAppDate,
        time: newAppTime,
        serviceName: newAppService || undefined,
        notes: newAppNotes,
      });

      showAlert('¡Cita agendada con éxito!', 'success');
      setIsAppointmentModalOpen(false);
      setNewAppPhone('');
      setNewAppName('');
      setNewAppTime('');
      setNewAppNotes('');
      loadAllData();
    } catch (err: any) {
      showAlert('Error al agendar cita: ' + (err?.message || err), 'error');
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    try {
      await api.updateAppointmentStatus(id, newStatus);
      showAlert(`Estado de la cita actualizado a ${newStatus}.`, 'success');
      loadAllData();
    } catch (err: any) {
      showAlert('Error al actualizar estado: ' + (err?.message || err), 'error');
    }
  };

  const handleSendReminder = async (id: number, clientName: string) => {
    try {
      const res = await api.sendAppointmentReminder(id);
      showAlert(`Recordatorio enviado a ${clientName} por WhatsApp.`, 'success');
      loadAllData();
    } catch (err: any) {
      showAlert('Error enviando recordatorio: ' + (err?.message || err), 'error');
    }
  };

  const handleToggleScheduleDay = async (rule: ScheduleRuleRecord) => {
    try {
      await api.updateScheduleRule(rule.id, { is_active: !rule.is_active });
      showAlert(`Horario de ${rule.day_name} actualizado.`, 'success');
      loadAllData();
    } catch (err: any) {
      showAlert('Error al actualizar horario: ' + (err?.message || err), 'error');
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode || !courseTitle) {
      showAlert('Código y Título son requeridos.', 'error');
      return;
    }

    try {
      await api.createCourse({
        code: courseCode,
        title: courseTitle,
        description: courseDesc,
        instructor: courseInstructor,
        schedule_days: courseDays,
        start_time: courseStart.length === 5 ? `${courseStart}:00` : courseStart,
        end_time: courseEnd.length === 5 ? `${courseEnd}:00` : courseEnd,
        max_capacity: courseCapacity,
        location_or_link: 'Aula Virtual / Google Meet',
        is_active: true,
      });
      showAlert('Curso creado exitosamente.', 'success');
      setIsCourseModalOpen(false);
      setCourseCode('');
      setCourseTitle('');
      setCourseDesc('');
      loadAllData();
    } catch (err: any) {
      showAlert('Error creando curso: ' + (err?.message || err), 'error');
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentPhone || !studentName) {
      showAlert('Teléfono y Nombre son requeridos.', 'error');
      return;
    }

    try {
      await api.createStudent({
        phone: studentPhone,
        full_name: studentName,
        email: studentEmail,
        notes: studentNotes,
      });
      showAlert('Alumno registrado exitosamente.', 'success');
      setIsStudentModalOpen(false);
      setStudentPhone('');
      setStudentName('');
      setStudentEmail('');
      setStudentNotes('');
      loadAllData();
    } catch (err: any) {
      showAlert('Error al registrar alumno: ' + (err?.message || err), 'error');
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForEnroll || !enrollCourseId) return;

    try {
      await api.enrollStudent(selectedStudentForEnroll.phone, Number(enrollCourseId), selectedStudentForEnroll.full_name);
      showAlert(`Alumno ${selectedStudentForEnroll.full_name} matriculado exitosamente.`, 'success');
      setIsEnrollModalOpen(false);
      setEnrollCourseId('');
      loadAllData();
    } catch (err: any) {
      showAlert('Error al matricular alumno: ' + (err?.message || err), 'error');
    }
  };

  const handleUnenrollStudent = async (phone: string, courseId: number) => {
    if (!confirm('¿Deseas desvincular a este alumno del curso?')) return;
    try {
      await api.unenrollStudent(phone, courseId);
      showAlert('Matrícula removida.', 'info');
      loadAllData();
    } catch (err: any) {
      showAlert('Error al desmatricular: ' + (err?.message || err), 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert toast */}
      {alert && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium border backdrop-blur-md animate-fade-in ${
            alert.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : alert.type === 'error'
              ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
              : 'bg-indigo-950/80 border-indigo-500/50 text-indigo-200'
          }`}
        >
          {alert.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {alert.type === 'error' && <XCircle className="w-5 h-5 text-rose-400" />}
          {alert.type === 'info' && <AlertCircle className="w-5 h-5 text-indigo-400" />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Automatización con Gemini & Base de Datos Dual</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Calendar className="w-7 h-7 text-indigo-400" />
            Agenda de Citas, Horarios y Clases
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestiona la disponibilidad en tiempo real, reservas automáticas por WhatsApp, recordatorios y cursos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/50 transition-all flex items-center gap-2 text-sm font-medium"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button
            onClick={() => setIsAppointmentModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium text-sm shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Agendar Cita</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Citas Hoy</p>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.todayAppointments}</h3>
            <p className="text-xs text-indigo-400 mt-0.5">En agenda hoy</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <CalendarDays className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Próximas Citas</p>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.upcomingAppointments}</h3>
            <p className="text-xs text-emerald-400 mt-0.5">Confirmadas / Pendientes</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Alumnos Activos</p>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.activeStudents}</h3>
            <p className="text-xs text-sky-400 mt-0.5">Matriculados</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Cursos y Clases</p>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.activeCourses}</h3>
            <p className="text-xs text-amber-400 mt-0.5">Talleres en curso</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800/80 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('appointments')}
          className={`px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${
            activeTab === 'appointments'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Agenda & Citas</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300">
            {appointments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${
            activeTab === 'schedule'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Reglas de Horario & Servicios</span>
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${
            activeTab === 'courses'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Clases & Cursos</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300">
            {courses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${
            activeTab === 'students'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Alumnos & Matrículas</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300">
            {students.length}
          </span>
        </button>
      </div>

      {/* TAB 1: AGENDA & CITAS */}
      {activeTab === 'appointments' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Fecha:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                Hoy
              </button>

              <button
                onClick={() => {
                  const tmr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                  setSelectedDate(tmr);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                Mañana
              </button>

              <button
                onClick={() => setSelectedDate('')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  !selectedDate ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Todas
              </button>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Todos los estados</option>
                <option value="confirmed">Confirmadas</option>
                <option value="pending">Pendientes</option>
                <option value="completed">Completadas</option>
                <option value="cancelled">Canceladas</option>
              </select>

              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadAllData()}
                  className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-9 pr-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Appointments List */}
          {appointments.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-300">No hay citas registradas para este filtro</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Los clientes pueden agendar directamente escribiendo por WhatsApp, o puedes crear una cita manualmente.
              </p>
              <button
                onClick={() => setIsAppointmentModalOpen(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Agendar Cita Manual</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {appointments.map((app) => (
                <div
                  key={app.id}
                  className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700/80 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                        {app.booking_code}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${
                          app.status === 'confirmed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : app.status === 'completed'
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            : app.status === 'cancelled'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {app.status === 'confirmed' ? 'Confirmada' : app.status === 'completed' ? 'Completada' : app.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white mb-1">{app.client_name}</h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>+{app.phone}</span>
                    </p>

                    <div className="bg-slate-800/40 rounded-xl p-3 space-y-1.5 border border-slate-800/80 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Servicio:</span>
                        <span className="font-semibold text-white">{app.service_name}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Fecha:</span>
                        <span className="font-semibold">{app.appointment_date}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Horario:</span>
                        <span className="font-semibold text-indigo-300">
                          {app.start_time.slice(0, 5)} - {app.end_time.slice(0, 5)}
                        </span>
                      </div>
                      {app.notes && (
                        <div className="pt-1 text-slate-400 italic text-[11px] border-t border-slate-700/50">
                          "{app.notes}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleSendReminder(app.id, app.client_name)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
                      title="Enviar recordatorio por WhatsApp"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      <span>Recordar</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {app.status !== 'completed' && app.status !== 'cancelled' && (
                        <button
                          onClick={() => handleUpdateStatus(app.id, 'completed')}
                          className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-colors"
                          title="Marcar como Completada"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}

                      {app.status !== 'cancelled' && (
                        <button
                          onClick={() => handleUpdateStatus(app.id, 'cancelled')}
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Cancelar Cita"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HORARIOS Y REGLAS DE ATENCIÓN */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-2xl p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
            <div className="text-xs text-indigo-200">
              <p className="font-semibold text-white mb-0.5">Motor de Disponibilidad Dinámica para Gemini</p>
              Cuando un cliente pregunte por WhatsApp "¿Qué horarios tienes mañana?" o "Reserva mi cita", Gemini consultará esta matriz de reglas para calcular los turnos libres reales descontando las citas ya tomadas.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Weekly Schedule Rules */}
            <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                Horarios Semanales de Atención
              </h3>

              <div className="divide-y divide-slate-800/80">
                {scheduleRules.map((rule) => (
                  <div key={rule.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleScheduleDay(rule)}
                        className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                          rule.is_active ? 'bg-indigo-600' : 'bg-slate-700'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            rule.is_active ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <div>
                        <p className={`text-sm font-semibold ${rule.is_active ? 'text-white' : 'text-slate-500'}`}>
                          {rule.day_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {rule.is_active ? 'Atención activa' : 'Cerrado / No laboral'}
                        </p>
                      </div>
                    </div>

                    {rule.is_active ? (
                      <div className="flex items-center gap-3 text-xs text-slate-300 font-mono">
                        <span className="bg-slate-800/60 px-2 py-1 rounded-md border border-slate-700/50">
                          {rule.start_time.slice(0, 5)} - {rule.end_time.slice(0, 5)}
                        </span>
                        {rule.break_start && (
                          <span className="text-slate-500 hidden sm:inline">
                            (Receso: {rule.break_start.slice(0, 5)} - {rule.break_end?.slice(0, 5)})
                          </span>
                        )}
                        <span className="text-slate-400 font-sans hidden sm:inline">
                          Turnos: {rule.slot_duration_minutes}m
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Sin atención</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Services List */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  Servicios y Citas
                </h3>
              </div>

              <div className="space-y-3">
                {services.map((srv) => (
                  <div key={srv.id} className="p-3 bg-slate-800/40 rounded-xl border border-slate-800/80">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-semibold text-white">{srv.name}</h4>
                      <span className="text-xs font-bold text-emerald-400">${srv.price}</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">{srv.description || 'Sin descripción'}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                      <span>⏱️ {srv.duration_minutes} min</span>
                      <span>•</span>
                      <span>Disponibilidad inmediata</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLASES Y CURSOS */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Cursos grupales con control de cupos. Los alumnos pueden preguntar a Gemini "¿A qué hora tengo clase?".
            </p>
            <button
              onClick={() => setIsCourseModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Curso</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => {
              const enrolled = course.enrolled_count || 0;
              const percent = Math.min(100, Math.round((enrolled / (course.max_capacity || 30)) * 100));

              return (
                <div
                  key={course.id}
                  className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700/80 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        {course.code}
                      </span>
                      <span className="text-xs text-slate-400">Cupo: {enrolled}/{course.max_capacity}</span>
                    </div>

                    <h4 className="text-base font-bold text-white mb-1.5">{course.title}</h4>
                    <p className="text-xs text-slate-400 mb-3">{course.description}</p>

                    {/* Capacity Bar */}
                    <div className="w-full bg-slate-800 rounded-full h-2 mb-4 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="bg-slate-800/40 rounded-xl p-3 space-y-1.5 text-xs border border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Profesor:</span>
                        <span className="font-semibold text-white">{course.instructor}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Días:</span>
                        <span className="font-semibold text-slate-200">{course.schedule_days}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Horario:</span>
                        <span className="font-semibold text-indigo-300">
                          {course.start_time.slice(0, 5)} - {course.end_time.slice(0, 5)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Lugar/Enlace:</span>
                        <span className="text-slate-300 truncate max-w-[140px]">{course.location_or_link}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: ALUMNOS Y MATRÍCULAS */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Directorio de alumnos. Cuando un alumno escriba desde su número de WhatsApp, Gemini sabrá qué materias cursa.
            </p>
            <button
              onClick={() => setIsStudentModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20"
            >
              <UserPlus className="w-4 h-4" />
              <span>Registrar Alumno</span>
            </button>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/50 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Alumno</th>
                    <th className="px-5 py-3.5">WhatsApp / Teléfono</th>
                    <th className="px-5 py-3.5">Cursos Asignados</th>
                    <th className="px-5 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                        No hay alumnos registrados aún. Agrega uno o espera a que interactúen por WhatsApp.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-white flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                            {student.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div>{student.full_name}</div>
                            {student.email && <div className="text-xs text-slate-500">{student.email}</div>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-300">
                          +{student.phone}
                        </td>
                        <td className="px-5 py-3.5">
                          {student.courses && student.courses.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {student.courses.map((c) => (
                                <span
                                  key={c.id}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs bg-slate-800 text-indigo-300 border border-slate-700/60"
                                >
                                  <span>{c.title}</span>
                                  <button
                                    onClick={() => handleUnenrollStudent(student.phone, c.id)}
                                    className="text-slate-500 hover:text-rose-400 transition-colors"
                                    title="Remover matrícula"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 italic">Sin cursos matriculados</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => {
                              setSelectedStudentForEnroll(student);
                              setIsEnrollModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-all inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Matricular</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGENDAR CITA MANUAL */}
      {isAppointmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative">
            <button
              onClick={() => setIsAppointmentModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
              <Calendar className="w-5 h-5 text-indigo-400" />
              Agendar Nueva Cita
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Calcula y valida disponibilidad de horarios automáticamente.
            </p>

            <form onSubmit={handleCreateAppointment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Teléfono (WhatsApp)</label>
                  <input
                    type="text"
                    required
                    placeholder="51999888777"
                    value={newAppPhone}
                    onChange={(e) => setNewAppPhone(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Nombre del Cliente</label>
                  <input
                    type="text"
                    required
                    placeholder="Juan Pérez"
                    value={newAppName}
                    onChange={(e) => setNewAppName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Servicio</label>
                  <select
                    value={newAppService}
                    onChange={(e) => setNewAppService(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Seleccionar servicio...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.duration_minutes}m - ${s.price})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={newAppDate}
                    onChange={(e) => setNewAppDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Slots selector */}
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Horarios Disponibles para esta fecha:
                </label>
                {loadingSlots ? (
                  <div className="text-xs text-slate-400 py-3 text-center flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    <span>Calculando disponibilidad...</span>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-xs text-amber-400 py-2 italic">
                    No hay turnos libres para esta fecha o el negocio no atiende.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setNewAppTime(slot)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                          newAppTime === slot
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Notas adicionales</label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre la reserva..."
                  value={newAppNotes}
                  onChange={(e) => setNewAppNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAppointmentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newAppTime}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium text-sm transition-all"
                >
                  Confirmar Reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO CURSO */}
      {isCourseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setIsCourseModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white">✕</button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              Nuevo Curso / Clase
            </h3>
            <p className="text-xs text-slate-400 mb-4">Añade un taller o curso al catálogo de la academia.</p>

            <form onSubmit={handleCreateCourse} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Código del Curso</label>
                <input
                  type="text"
                  required
                  placeholder="CUR-AI-01"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Título del Curso</label>
                <input
                  type="text"
                  required
                  placeholder="Desarrollo de Bots con IA"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Profesor / Instructor</label>
                <input
                  type="text"
                  value={courseInstructor}
                  onChange={(e) => setCourseInstructor(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Días de Clase</label>
                  <input
                    type="text"
                    value={courseDays}
                    onChange={(e) => setCourseDays(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Capacidad Máx.</label>
                  <input
                    type="number"
                    value={courseCapacity}
                    onChange={(e) => setCourseCapacity(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Hora Inicio</label>
                  <input
                    type="time"
                    value={courseStart}
                    onChange={(e) => setCourseStart(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Hora Fin</label>
                  <input
                    type="time"
                    value={courseEnd}
                    onChange={(e) => setCourseEnd(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsCourseModalOpen(false)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white">Cancelar</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all">Crear Curso</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR ALUMNO */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setIsStudentModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white">✕</button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
              <UserPlus className="w-5 h-5 text-indigo-400" />
              Registrar Nuevo Alumno
            </h3>
            <p className="text-xs text-slate-400 mb-4">El número de teléfono servirá como clave de identificación en WhatsApp.</p>

            <form onSubmit={handleCreateStudent} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Teléfono (WhatsApp)</label>
                <input
                  type="text"
                  required
                  placeholder="51999888777"
                  value={studentPhone}
                  onChange={(e) => setStudentPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="María Rodríguez"
                  value={studentName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Correo Electrónico (Opcional)</label>
                <input
                  type="email"
                  placeholder="maria@ejemplo.com"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsStudentModalOpen(false)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white">Cancelar</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all">Guardar Alumno</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MATRICULAR ALUMNO EN CURSO */}
      {isEnrollModalOpen && selectedStudentForEnroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setIsEnrollModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white">✕</button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
              <GraduationCap className="w-5 h-5 text-indigo-400" />
              Matricular Alumno en Curso
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Alumno: <span className="font-semibold text-white">{selectedStudentForEnroll.full_name}</span> (+{selectedStudentForEnroll.phone})
            </p>

            <form onSubmit={handleEnrollStudent} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Selecciona el Curso</label>
                <select
                  required
                  value={enrollCourseId}
                  onChange={(e) => setEnrollCourseId(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Selecciona un curso disponible...</option>
                  {courses.filter(c => c.is_active).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.title} ({c.schedule_days} {c.start_time.slice(0, 5)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsEnrollModalOpen(false)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white">Cancelar</button>
                <button type="submit" disabled={!enrollCourseId} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-medium text-sm transition-all">Matricular</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
