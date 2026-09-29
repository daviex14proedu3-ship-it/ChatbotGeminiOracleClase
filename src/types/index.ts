export interface GeminiKeyConfig {
  id: string;
  key: string;
  name: string;
  status: 'active' | 'exhausted' | 'invalid' | 'untested';
  lastUsed?: string;
  errorCount: number;
  lastError?: string;
}

export interface GeminiModelInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  isFlashLite: boolean;
  recommended: boolean;
}

export interface AppSettings {
  geminiKeys: GeminiKeyConfig[];
  activeKeyIndex: number;
  selectedModel: string;
  systemPrompt: string;
  botEnabled: boolean;
  respondToGroups: boolean;
  antiBanDelayMin: number;
  antiBanDelayMax: number;
  memoryEnabled?: boolean;
  memoryLimitTurns?: number;
  postgresUrl?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  supabaseDbUrl?: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  isActive: boolean;
  updatedAt: string;
}

export interface MediaCatalogItem {
  id: string;
  name: string;
  originalName: string;
  description: string;
  tags: string[];
  mimeType: string;
  filename: string;
  sizeBytes: number;
  webpOptimized: boolean;
  createdAt: string;
}

export interface GroupInfo {
  id: string;
  subject: string;
  creation: number;
  owner?: string;
  desc?: string;
  participantsCount: number;
  canSend: boolean;
  isAdmin: boolean;
  announce: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'failover';
  source: 'whatsapp' | 'ai' | 'bulk' | 'groups' | 'system';
  message: string;
  details?: any;
}

export interface WhatsAppStatus {
  state: 'disconnected' | 'connecting' | 'waiting_qr' | 'connected' | 'reconnecting';
  botPhone: string | null;
  qrDataUrl: string | null;
  qrString: string | null;
}

export interface ExcelColumnMapping {
  originalHeader: string;
  detectedType: 'phone' | 'name' | 'variable' | 'ignore';
  assignedType: 'phone' | 'name' | 'variable' | 'ignore';
  variableName: string;
}

export interface ParsedContactRow {
  phone: string;
  name?: string;
  variables: Record<string, string>;
  raw: Record<string, any>;
}

export interface OptimizedWebPResult {
  file: File;
  blob: Blob;
  dataUrl: string;
  originalName: string;
  originalSize: number;
  newSize: number;
  savingsPercent: number;
  width: number;
  height: number;
}

export interface AuthUser {
  email: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
}

export interface ProviderDiagnostic {
  configured: boolean;
  status: 'connected' | 'error' | 'disconnected' | 'not_configured';
  latencyMs?: number;
  hostOrUrl?: string;
  error?: string;
  lastChecked?: string;
  details?: string;
}

export interface DatabaseHealthStatus {
  activeProvider: 'postgresql' | 'supabase' | 'local_fallback';
  memoryEnabled: boolean;
  maxTurns: number;
  primary: ProviderDiagnostic;
  fallback: ProviderDiagnostic;
  stats: {
    totalConversations: number;
    totalMessages: number;
  };
}

export interface ConversationRecord {
  phone: string;
  contact_name: string;
  last_message_at: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRecord {
  id: string | number;
  phone: string;
  role: 'user' | 'model' | 'system';
  content: string;
  media_id?: string | null;
  created_at: string;
}

export interface AppointmentRecord {
  id: number;
  booking_code: string;
  phone: string;
  client_name: string;
  service_id: number | null;
  service_name: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  notes: string;
  reminder_sent: boolean;
  reminder_sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduleRuleRecord {
  id: number;
  day_of_week: number;
  day_name: string;
  is_active: boolean;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  slot_duration_minutes: number;
  max_parallel_slots: number;
}

export interface BookingServiceRecord {
  id: number;
  name: string;
  duration_minutes: number;
  price: number;
  description: string;
  is_active: boolean;
}

export interface CourseRecord {
  id: number;
  code: string;
  title: string;
  description: string;
  instructor: string;
  schedule_days: string;
  start_time: string;
  end_time: string;
  location_or_link: string;
  max_capacity: number;
  enrolled_count?: number;
  is_active: boolean;
  created_at?: string;
}

export interface StudentRecord {
  id: number;
  phone: string;
  full_name: string;
  email: string;
  status: 'active' | 'inactive';
  notes: string;
  created_at?: string;
  courses?: CourseRecord[];
}

export interface BookingStats {
  todayAppointments: number;
  upcomingAppointments: number;
  activeStudents: number;
  activeCourses: number;
}

export interface PlanRecord {
  id: number;
  code: string;
  name: string;
  description: string;
  price: number;
  billing_cycle: 'monthly' | 'biweekly' | 'one_time' | 'annual';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StudentBillRecord {
  id: number;
  bill_code: string;
  student_phone: string;
  student_name: string;
  plan_id?: number | null;
  concept: string;
  amount: number;
  amount_paid: number;
  balance_pending: number;
  currency: string;
  due_date: string;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  reminder_sent: boolean;
  reminder_sent_at?: string | null;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentVoucherRecord {
  id: number;
  voucher_code: string;
  student_phone: string;
  student_name?: string;
  bill_id?: number | null;
  amount_detected: number;
  amount_approved: number;
  currency: string;
  bank_or_platform?: string;
  operation_number?: string;
  payment_date?: string;
  image_filename?: string;
  gemini_analysis?: any;
  status: 'validated' | 'pending_review' | 'rejected';
  rejection_reason?: string;
  validated_by: 'gemini_ai' | 'admin';
  created_at?: string;
  updated_at?: string;
}

export interface FinancialStatsRecord {
  totalCollectedMonth: number;
  totalPendingAmount: number;
  activeStudents: number;
  overdueBillsCount: number;
  vouchersValidatedToday: number;
  collectionRatePct: number;
}

export interface DebtorSummaryRecord {
  student_phone: string;
  student_name: string;
  total_debt: number;
  bills_count: number;
  oldest_due_date: string;
  concepts: string;
}

export interface AdminContactRecord {
  id: number;
  phone: string;
  secondary_phones?: string;
  name: string;
  role: 'superadmin' | 'admin' | 'operator';
  is_active: boolean;
  can_view_finances: boolean;
  can_view_metrics: boolean;
  can_manage_bookings: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}


