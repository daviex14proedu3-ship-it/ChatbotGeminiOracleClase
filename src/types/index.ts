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

