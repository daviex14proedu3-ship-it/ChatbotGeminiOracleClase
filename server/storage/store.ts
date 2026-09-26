import fs from 'fs';
import path from 'path';

export interface GeminiKeyConfig {
  id: string;
  key: string;
  name: string;
  status: 'active' | 'exhausted' | 'invalid' | 'untested';
  lastUsed?: string;
  errorCount: number;
  lastError?: string;
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

export interface CampaignRecord {
  id: string;
  title: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  status: 'completed' | 'in_progress' | 'cancelled' | 'paused';
  createdAt: string;
  completedAt?: string;
  logs: { phone: string; name?: string; status: 'sent' | 'failed'; error?: string; timestamp: string }[];
}

export interface AppDatabase {
  settings: {
    geminiKeys: GeminiKeyConfig[];
    activeKeyIndex: number;
    selectedModel: string;
    systemPrompt: string;
    botEnabled: boolean;
    respondToGroups: boolean;
    antiBanDelayMin: number;
    antiBanDelayMax: number;
    memoryEnabled: boolean;
    memoryLimitTurns: number;
    postgresUrl: string;
    supabaseUrl: string;
    supabaseKey: string;
    supabaseDbUrl: string;
  };
  knowledgeBase: KnowledgeItem[];
  mediaCatalog: MediaCatalogItem[];
  campaigns: CampaignRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const AUTH_DIR = path.resolve(DATA_DIR, 'auth_info_baileys');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

const DEFAULT_DB: AppDatabase = {
  settings: {
    geminiKeys: [
      {
        id: 'key-1',
        key: process.env.GEMINI_API_KEY || '',
        name: 'Clave Principal (Google AI Studio)',
        status: 'untested',
        errorCount: 0,
      },
    ],
    activeKeyIndex: 0,
    selectedModel: 'gemini-3.5-flash-lite',
    systemPrompt: `Eres el asistente virtual inteligente de nuestra empresa en WhatsApp.
Tu objetivo es responder de manera educada, concisa, profesional y útil a los clientes.
Utiliza únicamente la información provista en la Base de Conocimientos para responder dudas de servicios, precios y políticas.
Si el usuario solicita una imagen, catálogo o foto de un producto y dispones de ella en el catálogo multimedia registrado, incluye al final de tu respuesta la etiqueta especial: [SEND_MEDIA:ID_DE_LA_IMAGEN].
Nunca inventes información que no esté en la base de conocimientos. Si no conoces un dato, indica amablemente que un asesor humano lo atenderá a la brevedad.`,
    botEnabled: true,
    respondToGroups: false,
    antiBanDelayMin: 4,
    antiBanDelayMax: 8,
    memoryEnabled: process.env.BOT_MEMORY_ENABLED !== 'false',
    memoryLimitTurns: parseInt(process.env.BOT_MEMORY_TURNS || '10', 10),
    postgresUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    supabaseDbUrl: process.env.SUPABASE_DB_URL || '',
  },
  knowledgeBase: [
    {
      id: 'kb-1',
      title: 'Horarios de Atención',
      content: 'Nuestro horario de atención al público es de Lunes a Viernes de 8:00 AM a 6:00 PM y Sábados de 9:00 AM a 2:00 PM. Domingos no laboramos.',
      tags: ['horario', 'atencion', 'dias', 'apertura'],
      category: 'General',
      isActive: true,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'kb-2',
      title: 'Métodos de Pago',
      content: 'Aceptamos transferencias bancarias, tarjetas de crédito/débito (Visa, Mastercard), pagos móviles y efectivo en sucursal.',
      tags: ['pagos', 'transferencia', 'tarjetas', 'banco'],
      category: 'Ventas',
      isActive: true,
      updatedAt: new Date().toISOString(),
    },
  ],
  mediaCatalog: [],
  campaigns: [],
};

class StorageService {
  private db: AppDatabase;

  constructor() {
    this.db = this.load();
  }

  private load(): AppDatabase {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        const envKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
        const loaded: AppDatabase = {
          settings: { ...DEFAULT_DB.settings, ...parsed.settings },
          knowledgeBase: parsed.knowledgeBase || DEFAULT_DB.knowledgeBase,
          mediaCatalog: parsed.mediaCatalog || DEFAULT_DB.mediaCatalog,
          campaigns: parsed.campaigns || DEFAULT_DB.campaigns,
        };

        // If environment has a key and the first key is empty, sync it
        if (envKey && loaded.settings.geminiKeys.length > 0 && !loaded.settings.geminiKeys[0].key) {
          loaded.settings.geminiKeys[0].key = envKey;
          loaded.settings.geminiKeys[0].status = 'active';
          this.save(loaded);
        }

        return loaded;
      }
    } catch (err) {
      console.error('Error loading db.json, initializing default:', err);
    }
    this.save(DEFAULT_DB);
    return DEFAULT_DB;
  }

  public save(data?: AppDatabase): void {
    if (data) this.db = data;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.db, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing db.json:', err);
    }
  }

  public getSettings() {
    return this.db.settings;
  }

  public updateSettings(partial: Partial<AppDatabase['settings']>) {
    this.db.settings = { ...this.db.settings, ...partial };
    this.save();
    return this.db.settings;
  }

  public getKnowledgeBase(): KnowledgeItem[] {
    return this.db.knowledgeBase;
  }

  public setKnowledgeBase(items: KnowledgeItem[]): void {
    this.db.knowledgeBase = items;
    this.save();
  }

  public addKnowledgeItem(item: Omit<KnowledgeItem, 'id' | 'updatedAt'>): KnowledgeItem {
    const newItem: KnowledgeItem = {
      ...item,
      id: 'kb-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      updatedAt: new Date().toISOString(),
    };
    this.db.knowledgeBase.push(newItem);
    this.save();
    return newItem;
  }

  public updateKnowledgeItem(id: string, partial: Partial<KnowledgeItem>): KnowledgeItem | null {
    const index = this.db.knowledgeBase.findIndex(k => k.id === id);
    if (index === -1) return null;
    this.db.knowledgeBase[index] = {
      ...this.db.knowledgeBase[index],
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.db.knowledgeBase[index];
  }

  public deleteKnowledgeItem(id: string): boolean {
    const prevLen = this.db.knowledgeBase.length;
    this.db.knowledgeBase = this.db.knowledgeBase.filter(k => k.id !== id);
    if (this.db.knowledgeBase.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
  }

  public getMediaCatalog(): MediaCatalogItem[] {
    return this.db.mediaCatalog;
  }

  public addMediaItem(item: Omit<MediaCatalogItem, 'id' | 'createdAt'>): MediaCatalogItem {
    const newItem: MediaCatalogItem = {
      ...item,
      id: 'media-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
    };
    this.db.mediaCatalog.push(newItem);
    this.save();
    return newItem;
  }

  public updateMediaItem(id: string, partial: Partial<MediaCatalogItem>): MediaCatalogItem | null {
    const index = this.db.mediaCatalog.findIndex(m => m.id === id);
    if (index === -1) return null;
    this.db.mediaCatalog[index] = { ...this.db.mediaCatalog[index], ...partial };
    this.save();
    return this.db.mediaCatalog[index];
  }

  public deleteMediaItem(id: string): boolean {
    const index = this.db.mediaCatalog.findIndex(m => m.id === id);
    if (index === -1) return false;
    const item = this.db.mediaCatalog[index];
    // Delete file if exists
    const filePath = path.join(UPLOADS_DIR, item.filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Error deleting media file:', err);
      }
    }
    this.db.mediaCatalog.splice(index, 1);
    this.save();
    return true;
  }

  public getCampaigns(): CampaignRecord[] {
    return this.db.campaigns;
  }

  public addCampaign(campaign: CampaignRecord): void {
    this.db.campaigns.unshift(campaign);
    if (this.db.campaigns.length > 50) this.db.campaigns.pop(); // keep last 50
    this.save();
  }

  public updateCampaign(id: string, partial: Partial<CampaignRecord>): void {
    const index = this.db.campaigns.findIndex(c => c.id === id);
    if (index !== -1) {
      this.db.campaigns[index] = { ...this.db.campaigns[index], ...partial };
      this.save();
    }
  }

  public getUploadsDir(): string {
    return UPLOADS_DIR;
  }

  public getAuthDir(): string {
    return AUTH_DIR;
  }
}

export const storage = new StorageService();
