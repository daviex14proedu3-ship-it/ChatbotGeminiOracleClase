import {
  AppSettings,
  KnowledgeItem,
  MediaCatalogItem,
  GroupInfo,
  WhatsAppStatus,
  LogEntry,
  GeminiModelInfo,
  AuthUser,
  DatabaseHealthStatus,
  ConversationRecord,
  ChatMessageRecord,
} from '../types';

const BASE_URL = '/api';
const TOKEN_KEY = 'omni_auth_token';

export const authStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  },
  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
      // ignore
    }
  },
  clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      // ignore
    }
  },
};

/**
 * Custom fetch wrapper that injects Authorization Bearer header
 * and dispatches unauthorized event if session expires
 */
async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = authStorage.getToken();
  const headers = new Headers(init.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    const urlStr = input.toString();
    if (!urlStr.includes('/api/auth/login')) {
      authStorage.clearToken();
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
  }

  return response;
}

export const api = {
  // Authentication
  async login(email: string, password: string): Promise<{ success: boolean; token: string; user: AuthUser }> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Credenciales incorrectas');
    }

    authStorage.setToken(data.token);
    return data;
  },

  async verifyAuth(): Promise<{ authenticated: boolean; user: AuthUser | null }> {
    const token = authStorage.getToken();
    if (!token) {
      return { authenticated: false, user: null };
    }

    try {
      const res = await authFetch(`${BASE_URL}/auth/verify`);
      if (!res.ok) {
        authStorage.clearToken();
        return { authenticated: false, user: null };
      }
      const data = await res.json();
      return {
        authenticated: true,
        user: data.user,
      };
    } catch (err) {
      return { authenticated: false, user: null };
    }
  },

  async logout(): Promise<void> {
    try {
      await authFetch(`${BASE_URL}/auth/logout`, { method: 'POST' });
    } catch (e) {
      // ignore
    } finally {
      authStorage.clearToken();
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
  },

  // WhatsApp
  async getWhatsAppStatus(): Promise<WhatsAppStatus> {
    const res = await authFetch(`${BASE_URL}/whatsapp/status`);
    return res.json();
  },

  async requestPairingCode(phoneNumber: string): Promise<{ code: string }> {
    const res = await authFetch(`${BASE_URL}/whatsapp/pairing-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al solicitar código');
    }
    return res.json();
  },

  async reconnectWhatsApp(): Promise<any> {
    const res = await authFetch(`${BASE_URL}/whatsapp/reconnect`, { method: 'POST' });
    return res.json();
  },

  async disconnectWhatsApp(): Promise<any> {
    const res = await authFetch(`${BASE_URL}/whatsapp/disconnect`, { method: 'POST' });
    return res.json();
  },

  // Groups
  async getGroups(): Promise<GroupInfo[]> {
    const res = await authFetch(`${BASE_URL}/groups`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al obtener grupos');
    }
    return res.json();
  },

  async sendGroupBulk(payload: {
    groupIds: string[];
    message: string;
    mediaFilename?: string;
    delaySeconds?: number;
  }): Promise<any> {
    const res = await authFetch(`${BASE_URL}/groups/bulk-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al enviar a grupos');
    }
    return res.json();
  },

  // Direct & Bulk Messages
  async sendDirectMessage(payload: {
    phone: string;
    message?: string;
    mediaFilename?: string;
  }): Promise<any> {
    const res = await authFetch(`${BASE_URL}/messages/send-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al enviar mensaje');
    }
    return res.json();
  },

  async startBulkCampaign(payload: {
    title: string;
    contacts: { phone: string; message: string; name?: string }[];
    mediaFilename?: string;
    delaySeconds?: number;
  }): Promise<any> {
    const res = await authFetch(`${BASE_URL}/messages/bulk-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al iniciar campaña masiva');
    }
    return res.json();
  },

  async cancelBulkCampaign(): Promise<any> {
    const res = await authFetch(`${BASE_URL}/messages/bulk-cancel`, { method: 'POST' });
    return res.json();
  },

  // AI & Settings
  async getAiSettings(): Promise<AppSettings> {
    const res = await authFetch(`${BASE_URL}/ai/settings`);
    return res.json();
  },

  async getDynamicModels(key?: string): Promise<GeminiModelInfo[]> {
    const url = key ? `${BASE_URL}/ai/models?key=${encodeURIComponent(key)}` : `${BASE_URL}/ai/models`;
    const res = await authFetch(url);
    return res.json();
  },

  async saveAiSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const res = await authFetch(`${BASE_URL}/ai/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  async testGeminiKey(key: string, model?: string): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const res = await authFetch(`${BASE_URL}/ai/test-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, model }),
    });
    return res.json();
  },

  async simulateChat(message: string): Promise<any> {
    const res = await authFetch(`${BASE_URL}/ai/simulate-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error en simulador');
    }
    return res.json();
  },

  async clearSimulationHistory(): Promise<any> {
    const res = await authFetch(`${BASE_URL}/ai/clear-chat-history`, { method: 'POST' });
    return res.json();
  },

  // Knowledge Base
  async getKnowledgeBase(): Promise<KnowledgeItem[]> {
    const res = await authFetch(`${BASE_URL}/ai/knowledge-base`);
    return res.json();
  },

  async createKnowledgeItem(item: Omit<KnowledgeItem, 'id' | 'updatedAt'>): Promise<KnowledgeItem> {
    const res = await authFetch(`${BASE_URL}/ai/knowledge-base`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return res.json();
  },

  async updateKnowledgeItem(id: string, partial: Partial<KnowledgeItem>): Promise<KnowledgeItem> {
    const res = await authFetch(`${BASE_URL}/ai/knowledge-base/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    return res.json();
  },

  async deleteKnowledgeItem(id: string): Promise<any> {
    const res = await authFetch(`${BASE_URL}/ai/knowledge-base/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Media
  async getMediaCatalog(): Promise<MediaCatalogItem[]> {
    const res = await authFetch(`${BASE_URL}/media/catalog`);
    return res.json();
  },

  async uploadMedia(
    file: File,
    meta?: { name?: string; description?: string; tags?: string[]; addToCatalog?: boolean }
  ): Promise<{ filename: string; originalName: string; sizeBytes: number; isWebp: boolean; catalogItem?: MediaCatalogItem }> {
    const formData = new FormData();
    formData.append('file', file);
    if (meta?.name) formData.append('name', meta.name);
    if (meta?.description) formData.append('description', meta.description);
    if (meta?.tags) formData.append('tags', meta.tags.join(','));
    if (meta?.addToCatalog) formData.append('addToCatalog', 'true');

    const res = await authFetch(`${BASE_URL}/media/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al subir archivo');
    }
    return res.json();
  },

  async deleteMediaItem(id: string): Promise<any> {
    const res = await authFetch(`${BASE_URL}/media/catalog/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Logs
  async getLogs(): Promise<LogEntry[]> {
    const res = await authFetch(`${BASE_URL}/logs`);
    return res.json();
  },

  async clearLogs(): Promise<any> {
    const res = await authFetch(`${BASE_URL}/logs`, { method: 'DELETE' });
    return res.json();
  },

  // Memory & Database (PostgreSQL Oracle + Supabase Fallback)
  async getDatabaseHealth(): Promise<DatabaseHealthStatus> {
    const res = await authFetch(`${BASE_URL}/memory/status`);
    if (!res.ok) throw new Error('Error al obtener estado de base de datos');
    return res.json();
  },

  async getMemoryConfig(): Promise<any> {
    const res = await authFetch(`${BASE_URL}/memory/config`);
    if (!res.ok) throw new Error('Error al obtener configuración de memoria');
    return res.json();
  },

  async saveMemoryConfig(config: {
    memoryEnabled?: boolean;
    memoryLimitTurns?: number;
    postgresUrl?: string;
    supabaseUrl?: string;
    supabaseKey?: string;
    supabaseDbUrl?: string;
  }): Promise<any> {
    const res = await authFetch(`${BASE_URL}/memory/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al guardar configuración');
    }
    return res.json();
  },

  async testDatabaseConnection(params: {
    provider: 'postgresql' | 'supabase';
    url?: string;
    key?: string;
    dbUrl?: string;
  }): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const res = await authFetch(`${BASE_URL}/memory/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al probar conexión');
    }
    return res.json();
  },

  async initDatabaseTables(): Promise<{
    primarySuccess: boolean;
    primaryMessage?: string;
    fallbackSuccess: boolean;
    fallbackMessage?: string;
  }> {
    const res = await authFetch(`${BASE_URL}/memory/init-tables`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al inicializar tablas');
    }
    return res.json();
  },

  async getMemoryDdl(): Promise<{ ddl: string }> {
    const res = await authFetch(`${BASE_URL}/memory/ddl`);
    return res.json();
  },

  async getConversations(): Promise<ConversationRecord[]> {
    const res = await authFetch(`${BASE_URL}/memory/conversations`);
    if (!res.ok) throw new Error('Error al cargar conversaciones');
    return res.json();
  },

  async getConversationMessages(phone: string, limit = 100): Promise<ChatMessageRecord[]> {
    const res = await authFetch(`${BASE_URL}/memory/conversations/${encodeURIComponent(phone)}/messages?limit=${limit}`);
    if (!res.ok) throw new Error('Error al cargar mensajes');
    return res.json();
  },

  async deleteConversation(phone: string): Promise<any> {
    const res = await authFetch(`${BASE_URL}/memory/conversations/${encodeURIComponent(phone)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Error al eliminar conversación');
    return res.json();
  },

  async clearAllMemory(): Promise<any> {
    const res = await authFetch(`${BASE_URL}/memory/clear-all`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Error al reiniciar memoria');
    return res.json();
  },
};
