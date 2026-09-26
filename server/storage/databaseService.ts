import pg from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { storage } from './store.js';
import { eventBus } from '../utils/logger.js';

const { Pool } = pg;

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

export interface GeminiHistoryTurn {
  role: 'user' | 'model';
  parts: { text: string }[];
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

const LOCAL_FALLBACK_FILE = path.resolve(process.cwd(), 'data', 'memory_fallback.json');

export class DatabaseService {
  private pgPool: pg.Pool | null = null;
  private supabaseClient: SupabaseClient | null = null;
  private supabasePool: pg.Pool | null = null;

  private primaryStatus: ProviderDiagnostic = {
    configured: false,
    status: 'not_configured',
  };

  private currentPgConnectionString: string = '';

  private fallbackStatus: ProviderDiagnostic = {
    configured: false,
    status: 'not_configured',
  };

  private activeProvider: 'postgresql' | 'supabase' | 'local_fallback' = 'local_fallback';
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Local in-memory cache for fallback
  private localConversations: Map<string, ConversationRecord> = new Map();
  private localMessages: ChatMessageRecord[] = [];

  constructor() {
    this.loadLocalFallback();
  }

  public getPgPool(): pg.Pool | null {
    return this.pgPool;
  }

  public getSupabasePool(): pg.Pool | null {
    return this.supabasePool;
  }

  public getSupabaseClient(): SupabaseClient | null {
    return this.supabaseClient;
  }

  /**
   * Load local backup file into memory
   */
  private loadLocalFallback(): void {
    try {
      if (fs.existsSync(LOCAL_FALLBACK_FILE)) {
        const raw = fs.readFileSync(LOCAL_FALLBACK_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (data.conversations && Array.isArray(data.conversations)) {
          for (const c of data.conversations) {
            this.localConversations.set(c.phone, c);
          }
        }
        if (data.messages && Array.isArray(data.messages)) {
          this.localMessages = data.messages;
        }
      }
    } catch (err) {
      console.warn('Could not load local memory fallback, starting fresh:', err);
    }
  }

  /**
   * Save local backup file
   */
  private saveLocalFallback(): void {
    try {
      const data = {
        conversations: Array.from(this.localConversations.values()),
        messages: this.localMessages.slice(-2000), // Keep last 2000 messages in local file
      };
      fs.writeFileSync(LOCAL_FALLBACK_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Could not save local memory fallback:', err);
    }
  }

  /**
   * Initialize connections and check health
   */
  public async initialize(): Promise<void> {
    const settings = storage.getSettings();
    this.configurePrimary(settings.postgresUrl);
    this.configureFallback(settings.supabaseUrl, settings.supabaseKey, settings.supabaseDbUrl);

    // Initial check
    await this.evaluateProviders();

    // Start background health check (probes Primary every 60 seconds if in fallback)
    if (!this.healthCheckInterval) {
      this.healthCheckInterval = setInterval(() => {
        this.evaluateProviders().catch(err => {
          console.warn('Error during periodic DB evaluation:', err);
        });
      }, 60000);
    }
  }

  /**
   * Configures primary PostgreSQL pool (Oracle server)
   */
  public configurePrimary(customUrl?: string): void {
    const url = (customUrl || process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();

    // Also support individual environment variables if URL is not provided
    const pgHost = process.env.PG_HOST || '';
    const pgUser = process.env.PG_USER || '';
    const pgPass = process.env.PG_PASSWORD || '';
    const pgDb = process.env.PG_DATABASE || 'whatsappbot_db';
    const pgPort = parseInt(process.env.PG_PORT || '5432', 10);

    let connectionString = url;
    if (!connectionString && pgHost) {
      connectionString = `postgresql://${pgUser}:${encodeURIComponent(pgPass)}@${pgHost}:${pgPort}/${pgDb}`;
    }

    // If connection string was provided but without database name, default to /whatsappbot_db
    if (connectionString) {
      try {
        const parsed = new URL(connectionString.replace(/^postgres(ql)?:\/\//, 'http://'));
        if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname === '') {
          const search = parsed.search || '';
          connectionString = connectionString.split('?')[0].replace(/\/+$/, '') + '/whatsappbot_db' + search;
        }
      } catch (e) {
        if (!connectionString.match(/\/[a-zA-Z0-9_-]+(\?|$)/)) {
          connectionString = connectionString.replace(/(\?|$)/, '/whatsappbot_db$1');
        }
      }
    }

    this.currentPgConnectionString = connectionString;

    if (this.pgPool) {
      this.pgPool.end().catch(() => {});
      this.pgPool = null;
    }

    if (!connectionString) {
      this.primaryStatus = {
        configured: false,
        status: 'not_configured',
        details: 'No se ha configurado DATABASE_URL ni variables PG_* para PostgreSQL de Oracle.',
      };
      return;
    }

    try {
      const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
      const sslDisabled = connectionString.includes('sslmode=disable') || process.env.PG_SSL === 'false';

      this.pgPool = new Pool({
        connectionString,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
        max: 8,
        ssl: isLocal || sslDisabled ? false : { rejectUnauthorized: false },
      });

      // Mask URL for display
      const masked = this.maskConnectionString(connectionString);
      this.primaryStatus = {
        configured: true,
        status: 'disconnected',
        hostOrUrl: masked,
        details: 'Configurado para base de datos whatsappbot_db. Pendiente de verificación.',
      };
    } catch (err: any) {
      this.primaryStatus = {
        configured: true,
        status: 'error',
        error: err?.message || 'Error al instanciar pool de PostgreSQL',
      };
    }
  }

  /**
   * Automatically creates the database whatsappbot_db if it does not exist yet on PostgreSQL
   */
  public async ensureDatabaseExists(connectionString?: string): Promise<boolean> {
    const connStr = connectionString || this.currentPgConnectionString;
    if (!connStr) return false;

    try {
      const parsedUrl = new URL(connStr.replace(/^postgres(ql)?:\/\//, 'http://'));
      let dbName = parsedUrl.pathname.replace(/^\//, '');
      if (!dbName) {
        dbName = 'whatsappbot_db';
      }

      if (dbName === 'postgres') return true;

      // Validate dbName format (must be valid safe SQL identifier)
      if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
        return false;
      }

      // Connect to 'postgres' maintenance database
      const maintenanceUrl = connStr.replace(
        new RegExp(`/${dbName}(\\?|$)`),
        `/postgres$1`
      );

      const isLocal = maintenanceUrl.includes('localhost') || maintenanceUrl.includes('127.0.0.1');
      const sslDisabled = maintenanceUrl.includes('sslmode=disable') || process.env.PG_SSL === 'false';

      const tempPool = new Pool({
        connectionString: maintenanceUrl,
        connectionTimeoutMillis: 5000,
        ssl: isLocal || sslDisabled ? false : { rejectUnauthorized: false },
      });

      try {
        const client = await tempPool.connect();
        try {
          const checkRes = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
          if (checkRes.rows.length === 0) {
            eventBus.log('info', 'system', `Creando base de datos "${dbName}" en PostgreSQL Oracle...`);
            await client.query(`CREATE DATABASE "${dbName}"`);
            eventBus.log('success', 'system', `Base de datos "${dbName}" creada con éxito en el servidor Oracle.`);
          }
          return true;
        } finally {
          client.release();
        }
      } finally {
        await tempPool.end().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Could not auto-create database:', err?.message || err);
      return false;
    }
  }

  /**
   * Configures Supabase fallback (REST client and/or direct DB URL)
   */
  public configureFallback(customUrl?: string, customKey?: string, customDbUrl?: string): void {
    const supabaseUrl = (customUrl || process.env.SUPABASE_URL || '').trim();
    const supabaseKey = (
      customKey ||
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      ''
    ).trim();
    const supabaseDbUrl = (customDbUrl || process.env.SUPABASE_DB_URL || '').trim();

    if (this.supabasePool) {
      this.supabasePool.end().catch(() => {});
      this.supabasePool = null;
    }

    // Direct pool connection if provided
    if (supabaseDbUrl) {
      try {
        this.supabasePool = new Pool({
          connectionString: supabaseDbUrl,
          connectionTimeoutMillis: 5000,
          idleTimeoutMillis: 10000,
          max: 5,
          ssl: { rejectUnauthorized: false },
        });
      } catch (e) {
        console.warn('Error setting up Supabase pool:', e);
      }
    }

    if (supabaseUrl && supabaseKey) {
      try {
        this.supabaseClient = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false },
        });
      } catch (err) {
        console.warn('Error creating Supabase client:', err);
      }
    } else {
      this.supabaseClient = null;
    }

    const isConfigured = Boolean(this.supabaseClient || this.supabasePool);
    this.fallbackStatus = {
      configured: isConfigured,
      status: isConfigured ? 'disconnected' : 'not_configured',
      hostOrUrl: supabaseUrl || (supabaseDbUrl ? this.maskConnectionString(supabaseDbUrl) : undefined),
      details: isConfigured ? 'Configurado. Listo como respaldo.' : 'No configurado.',
    };
  }

  /**
   * Mask connection strings for safe display
   */
  private maskConnectionString(str: string): string {
    try {
      const url = new URL(str.replace(/^postgres(ql)?:\/\//, 'http://'));
      const pass = url.password ? '****' : '';
      const user = url.username ? `${url.username}:${pass}@` : '';
      return `postgres://${user}${url.hostname}:${url.port || '5432'}${url.pathname}`;
    } catch {
      return str.replace(/:([^@/]+)@/, ':****@');
    }
  }

  /**
   * Evaluates providers and updates activeProvider
   */
  public async evaluateProviders(): Promise<void> {
    // 1. Test Primary (Postgres on Oracle)
    let primaryHealthy = false;
    if (this.pgPool) {
      const start = Date.now();
      try {
        let client: pg.PoolClient;
        try {
          client = await this.pgPool.connect();
        } catch (connErr: any) {
          if (connErr?.code === '3D000' || connErr?.message?.toLowerCase().includes('does not exist')) {
            const created = await this.ensureDatabaseExists(this.currentPgConnectionString);
            if (created) {
              client = await this.pgPool.connect();
            } else {
              throw connErr;
            }
          } else {
            throw connErr;
          }
        }

        try {
          await client.query('SELECT 1');
          const latency = Date.now() - start;
          this.primaryStatus.status = 'connected';
          this.primaryStatus.latencyMs = latency;
          this.primaryStatus.lastChecked = new Date().toISOString();
          this.primaryStatus.error = undefined;
          primaryHealthy = true;

          // Attempt to auto-initialize schema if not done
          await this.initSchemaOnPool(client);
        } finally {
          client.release();
        }
      } catch (err: any) {
        this.primaryStatus.status = 'error';
        this.primaryStatus.error = err?.message || 'Error de conexión con PostgreSQL Oracle';
        this.primaryStatus.lastChecked = new Date().toISOString();
      }
    }

    // 2. Test Fallback (Supabase)
    let fallbackHealthy = false;
    if (this.supabasePool) {
      const start = Date.now();
      try {
        const client = await this.supabasePool.connect();
        try {
          await client.query('SELECT 1');
          this.fallbackStatus.status = 'connected';
          this.fallbackStatus.latencyMs = Date.now() - start;
          this.fallbackStatus.lastChecked = new Date().toISOString();
          this.fallbackStatus.error = undefined;
          fallbackHealthy = true;
          await this.initSchemaOnPool(client);
        } finally {
          client.release();
        }
      } catch (err: any) {
        this.fallbackStatus.status = 'error';
        this.fallbackStatus.error = err?.message || 'Error de conexión con pool de Supabase';
        this.fallbackStatus.lastChecked = new Date().toISOString();
      }
    } else if (this.supabaseClient) {
      const start = Date.now();
      try {
        const { error } = await this.supabaseClient
          .from('whatsapp_conversations')
          .select('phone')
          .limit(1);

        const latency = Date.now() - start;
        this.fallbackStatus.lastChecked = new Date().toISOString();
        this.fallbackStatus.latencyMs = latency;

        if (!error) {
          this.fallbackStatus.status = 'connected';
          this.fallbackStatus.error = undefined;
          fallbackHealthy = true;
        } else if (error.code === '42P01' || error.message?.includes('does not exist')) {
          // Relation does not exist yet
          this.fallbackStatus.status = 'connected';
          this.fallbackStatus.error = 'Tablas pendientes de crear en Supabase SQL Editor.';
          fallbackHealthy = true;
        } else {
          this.fallbackStatus.status = 'error';
          this.fallbackStatus.error = error.message;
        }
      } catch (err: any) {
        this.fallbackStatus.status = 'error';
        this.fallbackStatus.error = err?.message || 'Error al conectar con Supabase REST';
        this.fallbackStatus.lastChecked = new Date().toISOString();
      }
    }

    // Determine active provider
    const previous = this.activeProvider;
    if (primaryHealthy) {
      this.activeProvider = 'postgresql';
      if (previous !== 'postgresql' && previous !== 'local_fallback') {
        eventBus.log('success', 'system', 'PostgreSQL (Oracle) recuperado. Se restablece como base de datos primaria.');
      }
    } else if (fallbackHealthy) {
      this.activeProvider = 'supabase';
      if (previous !== 'supabase') {
        eventBus.log(
          'warn',
          'system',
          'PostgreSQL (Oracle) no disponible. Conmutando automáticamente a Supabase Fallback.'
        );
      }
    } else {
      this.activeProvider = 'local_fallback';
      if (previous !== 'local_fallback') {
        eventBus.log(
          'warn',
          'system',
          'Ni PostgreSQL ni Supabase disponibles. Utilizando almacenamiento local de contingencia para memoria.'
        );
      }
    }
  }

  /**
   * Auto-execute DDL schema on a postgres client
   */
  private async initSchemaOnPool(client: pg.PoolClient): Promise<void> {
    const ddl = `
      CREATE TABLE IF NOT EXISTS whatsapp_conversations (
        phone VARCHAR(64) PRIMARY KEY,
        contact_name VARCHAR(255) DEFAULT '',
        last_message_at TIMESTAMPTZ DEFAULT NOW(),
        message_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id BIGSERIAL PRIMARY KEY,
        phone VARCHAR(64) NOT NULL,
        role VARCHAR(16) NOT NULL,
        content TEXT NOT NULL,
        media_id VARCHAR(128) DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_wa_messages_phone_created ON whatsapp_messages (phone, created_at DESC);
    `;
    await client.query(ddl);
  }

  /**
   * Get DDL Script as string for manual execution (e.g. Supabase SQL Editor)
   */
  public getDdlScript(): string {
    return `-- ==============================================================
-- SCHEMA PARA MEMORIA DE WHATSAPP (PostgreSQL / Supabase)
-- Base de datos objetivo en Servidor Oracle: whatsappbot_db
-- ==============================================================

-- 1. Crear base de datos en PostgreSQL (ejecutar conectado como postgres):
CREATE DATABASE whatsappbot_db;

-- 2. Conectarse a la base de datos whatsappbot_db:
\\c whatsappbot_db;

-- 3. Crear tabla de conversaciones de WhatsApp:
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  phone VARCHAR(64) PRIMARY KEY,
  contact_name VARCHAR(255) DEFAULT '',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Crear tabla de mensajes y memoria histórica:
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id BIGSERIAL PRIMARY KEY,
  phone VARCHAR(64) NOT NULL,
  role VARCHAR(16) NOT NULL,
  content TEXT NOT NULL,
  media_id VARCHAR(128) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Crear índice para recuperación ultrarrápida de turnos:
CREATE INDEX IF NOT EXISTS idx_wa_messages_phone_created ON whatsapp_messages (phone, created_at DESC);
`;
  }

  /**
   * Manually execute table initialization
   */
  public async executeInitTables(): Promise<{
    primarySuccess: boolean;
    primaryMessage?: string;
    fallbackSuccess: boolean;
    fallbackMessage?: string;
  }> {
    let primarySuccess = false;
    let primaryMessage = 'No configurado';
    let fallbackSuccess = false;
    let fallbackMessage = 'No configurado';

    if (this.pgPool) {
      try {
        if (this.currentPgConnectionString) {
          await this.ensureDatabaseExists(this.currentPgConnectionString);
        }

        let client: pg.PoolClient;
        try {
          client = await this.pgPool.connect();
        } catch (connErr: any) {
          if (connErr?.code === '3D000' || connErr?.message?.toLowerCase().includes('does not exist')) {
            await this.ensureDatabaseExists(this.currentPgConnectionString);
            client = await this.pgPool.connect();
          } else {
            throw connErr;
          }
        }

        try {
          await this.initSchemaOnPool(client);
          primarySuccess = true;
          primaryMessage = 'Tablas y esquema creados exitosamente en PostgreSQL (Oracle) en la base de datos whatsappbot_db.';
        } finally {
          client.release();
        }
      } catch (err: any) {
        primarySuccess = false;
        primaryMessage = `Error en PostgreSQL: ${err?.message || err}`;
      }
    }

    if (this.supabasePool) {
      try {
        const client = await this.supabasePool.connect();
        try {
          await this.initSchemaOnPool(client);
          fallbackSuccess = true;
          fallbackMessage = 'Tablas creadas exitosamente en Supabase (vía DB Pool).';
        } finally {
          client.release();
        }
      } catch (err: any) {
        fallbackSuccess = false;
        fallbackMessage = `Error en Supabase Pool: ${err?.message || err}`;
      }
    } else if (this.supabaseClient) {
      fallbackSuccess = true;
      fallbackMessage =
        'Supabase está conectado por REST. Si no has ejecutado el SQL aún, por favor pega el DDL en el SQL Editor de Supabase.';
    }

    return { primarySuccess, primaryMessage, fallbackSuccess, fallbackMessage };
  }

  /**
   * Retrieve conversation history formatted for Gemini chat session
   * Sanitizes turns to strictly alternate user -> model -> user -> model
   */
  public async getConversationHistoryForGemini(
    phone: string,
    maxTurns = 10
  ): Promise<GeminiHistoryTurn[]> {
    const rawMessages = await this.getRecentRawMessages(phone, maxTurns * 2);
    if (!rawMessages || rawMessages.length === 0) {
      return [];
    }

    // Chronological order (oldest to newest)
    const turns: GeminiHistoryTurn[] = [];

    for (const msg of rawMessages) {
      const role = msg.role === 'model' ? 'model' : 'user';
      const text = (msg.content || '').trim();
      if (!text) continue;

      if (turns.length === 0) {
        // Gemini history MUST start with 'user'
        if (role === 'user') {
          turns.push({ role: 'user', parts: [{ text }] });
        }
      } else {
        const lastRole = turns[turns.length - 1].role;
        if (lastRole === role) {
          // If consecutive turns have the same role, append to the last turn's text
          turns[turns.length - 1].parts[0].text += `\n${text}`;
        } else {
          turns.push({ role, parts: [{ text }] });
        }
      }
    }

    // Ensure the history doesn't end with an unresponded user turn (since Gemini will take incomingMessage)
    if (turns.length > 0 && turns[turns.length - 1].role === 'user') {
      // The current incoming message is also from the user, so we drop the trailing user message or merge
      // It's safest to keep turns up to the last model response:
      turns.pop();
    }

    return turns;
  }

  /**
   * Fetches recent raw messages for a phone
   */
  private async getRecentRawMessages(phone: string, limit: number): Promise<ChatMessageRecord[]> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // Try Primary (PostgreSQL)
    if (this.pgPool && (this.activeProvider === 'postgresql' || this.primaryStatus.status === 'connected')) {
      try {
        const res = await this.pgPool.query(
          `SELECT id, phone, role, content, media_id, created_at 
           FROM whatsapp_messages 
           WHERE phone = $1 
           ORDER BY created_at DESC 
           LIMIT $2`,
          [cleanPhone, limit]
        );
        // Reverse to get chronological order (ASC)
        return res.rows.reverse();
      } catch (err: any) {
        eventBus.log('warn', 'system', `Error al leer memoria de PostgreSQL: ${err?.message}. Intentando fallback.`);
        this.primaryStatus.status = 'error';
        this.activeProvider = this.fallbackStatus.configured ? 'supabase' : 'local_fallback';
      }
    }

    // Try Fallback (Supabase Pool or REST)
    if (this.supabasePool) {
      try {
        const res = await this.supabasePool.query(
          `SELECT id, phone, role, content, media_id, created_at 
           FROM whatsapp_messages 
           WHERE phone = $1 
           ORDER BY created_at DESC 
           LIMIT $2`,
          [cleanPhone, limit]
        );
        return res.rows.reverse();
      } catch (err) {
        console.warn('Error reading from Supabase Pool:', err);
      }
    } else if (this.supabaseClient) {
      try {
        const { data, error } = await this.supabaseClient
          .from('whatsapp_messages')
          .select('id, phone, role, content, media_id, created_at')
          .eq('phone', cleanPhone)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!error && data) {
          return data.reverse() as ChatMessageRecord[];
        }
      } catch (err) {
        console.warn('Error reading from Supabase REST:', err);
      }
    }

    // Local Fallback
    const local = this.localMessages
      .filter(m => m.phone === cleanPhone)
      .slice(-limit);
    return local;
  }

  /**
   * Save a conversation turn (User message + Model response)
   */
  public async saveTurn(
    phone: string,
    userText: string,
    modelText: string,
    contactName?: string,
    mediaId?: string
  ): Promise<void> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const nowIso = new Date().toISOString();

    const userMsg: ChatMessageRecord = {
      id: 'usr-' + Date.now(),
      phone: cleanPhone,
      role: 'user',
      content: userText,
      created_at: nowIso,
    };

    const modelMsg: ChatMessageRecord = {
      id: 'bot-' + Date.now() + 1,
      phone: cleanPhone,
      role: 'model',
      content: modelText,
      media_id: mediaId || null,
      created_at: nowIso,
    };

    // Always mirror to local store as safety copy
    this.localMessages.push(userMsg, modelMsg);
    if (this.localMessages.length > 5000) {
      this.localMessages = this.localMessages.slice(-5000);
    }

    const existingConv = this.localConversations.get(cleanPhone);
    const newCount = (existingConv?.message_count || 0) + 2;
    this.localConversations.set(cleanPhone, {
      phone: cleanPhone,
      contact_name: contactName || existingConv?.contact_name || cleanPhone,
      last_message_at: nowIso,
      message_count: newCount,
      created_at: existingConv?.created_at || nowIso,
      updated_at: nowIso,
    });
    this.saveLocalFallback();

    // 1. Try Primary (PostgreSQL Oracle)
    let savedToPrimary = false;
    if (this.pgPool && (this.activeProvider === 'postgresql' || this.primaryStatus.status === 'connected')) {
      try {
        const client = await this.pgPool.connect();
        try {
          await client.query('BEGIN');

          // Insert messages
          await client.query(
            `INSERT INTO whatsapp_messages (phone, role, content, media_id, created_at) VALUES 
             ($1, $2, $3, $4, $5),
             ($6, $7, $8, $9, $10)`,
            [
              cleanPhone, 'user', userText, null, nowIso,
              cleanPhone, 'model', modelText, mediaId || null, nowIso,
            ]
          );

          // Upsert conversation
          await client.query(
            `INSERT INTO whatsapp_conversations (phone, contact_name, last_message_at, message_count, created_at, updated_at)
             VALUES ($1, $2, $3, 2, $4, $5)
             ON CONFLICT (phone) DO UPDATE SET
               contact_name = CASE WHEN $2 <> '' AND $2 <> EXCLUDED.phone THEN $2 ELSE whatsapp_conversations.contact_name END,
               last_message_at = EXCLUDED.last_message_at,
               message_count = whatsapp_conversations.message_count + 2,
               updated_at = EXCLUDED.updated_at`,
            [cleanPhone, contactName || '', nowIso, nowIso, nowIso]
          );

          await client.query('COMMIT');
          savedToPrimary = true;
          this.activeProvider = 'postgresql';
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        } finally {
          client.release();
        }
      } catch (err: any) {
        eventBus.log(
          'failover',
          'system',
          `Fallo al escribir en PostgreSQL Oracle: ${err?.message}. Conmutando a Supabase Fallback.`
        );
        this.primaryStatus.status = 'error';
        this.primaryStatus.error = err?.message;
        this.activeProvider = 'supabase';
      }
    }

    if (savedToPrimary) return;

    // 2. Try Fallback (Supabase Pool or Supabase REST)
    if (this.supabasePool) {
      try {
        const client = await this.supabasePool.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            `INSERT INTO whatsapp_messages (phone, role, content, media_id, created_at) VALUES 
             ($1, $2, $3, $4, $5),
             ($6, $7, $8, $9, $10)`,
            [
              cleanPhone, 'user', userText, null, nowIso,
              cleanPhone, 'model', modelText, mediaId || null, nowIso,
            ]
          );
          await client.query(
            `INSERT INTO whatsapp_conversations (phone, contact_name, last_message_at, message_count, created_at, updated_at)
             VALUES ($1, $2, $3, 2, $4, $5)
             ON CONFLICT (phone) DO UPDATE SET
               contact_name = CASE WHEN $2 <> '' AND $2 <> EXCLUDED.phone THEN $2 ELSE whatsapp_conversations.contact_name END,
               last_message_at = EXCLUDED.last_message_at,
               message_count = whatsapp_conversations.message_count + 2,
               updated_at = EXCLUDED.updated_at`,
            [cleanPhone, contactName || '', nowIso, nowIso, nowIso]
          );
          await client.query('COMMIT');
          this.activeProvider = 'supabase';
          return;
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        } finally {
          client.release();
        }
      } catch (e: any) {
        console.warn('Error saving to Supabase Pool:', e);
      }
    }

    if (this.supabaseClient) {
      try {
        // Insert messages
        await this.supabaseClient.from('whatsapp_messages').insert([
          { phone: cleanPhone, role: 'user', content: userText, created_at: nowIso },
          { phone: cleanPhone, role: 'model', content: modelText, media_id: mediaId || null, created_at: nowIso },
        ]);

        // Upsert conversation
        await this.supabaseClient.from('whatsapp_conversations').upsert({
          phone: cleanPhone,
          contact_name: contactName || cleanPhone,
          last_message_at: nowIso,
          updated_at: nowIso,
        });

        this.activeProvider = 'supabase';
        return;
      } catch (err: any) {
        console.warn('Error saving to Supabase REST:', err);
      }
    }

    // Default to local fallback
    this.activeProvider = 'local_fallback';
  }

  /**
   * Get list of conversations
   */
  public async getConversations(): Promise<ConversationRecord[]> {
    // 1. Try Primary
    if (this.pgPool && (this.activeProvider === 'postgresql' || this.primaryStatus.status === 'connected')) {
      try {
        const res = await this.pgPool.query(
          `SELECT phone, contact_name, last_message_at, message_count, created_at, updated_at 
           FROM whatsapp_conversations 
           ORDER BY last_message_at DESC 
           LIMIT 100`
        );
        return res.rows;
      } catch (err) {
        console.warn('Error fetching conversations from Postgres:', err);
      }
    }

    // 2. Try Supabase
    if (this.supabasePool) {
      try {
        const res = await this.supabasePool.query(
          `SELECT phone, contact_name, last_message_at, message_count, created_at, updated_at 
           FROM whatsapp_conversations 
           ORDER BY last_message_at DESC 
           LIMIT 100`
        );
        return res.rows;
      } catch (err) {
        console.warn('Error fetching conversations from Supabase Pool:', err);
      }
    } else if (this.supabaseClient) {
      try {
        const { data, error } = await this.supabaseClient
          .from('whatsapp_conversations')
          .select('*')
          .order('last_message_at', { ascending: false })
          .limit(100);

        if (!error && data) {
          return data as ConversationRecord[];
        }
      } catch (err) {
        console.warn('Error fetching conversations from Supabase REST:', err);
      }
    }

    // 3. Fallback to Local
    return Array.from(this.localConversations.values()).sort(
      (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );
  }

  /**
   * Get messages for a specific conversation
   */
  public async getConversationMessages(phone: string, limit = 100): Promise<ChatMessageRecord[]> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // 1. Try Primary
    if (this.pgPool && (this.activeProvider === 'postgresql' || this.primaryStatus.status === 'connected')) {
      try {
        const res = await this.pgPool.query(
          `SELECT id, phone, role, content, media_id, created_at 
           FROM whatsapp_messages 
           WHERE phone = $1 
           ORDER BY created_at ASC 
           LIMIT $2`,
          [cleanPhone, limit]
        );
        return res.rows;
      } catch (err) {
        console.warn('Error fetching messages from Postgres:', err);
      }
    }

    // 2. Try Supabase
    if (this.supabasePool) {
      try {
        const res = await this.supabasePool.query(
          `SELECT id, phone, role, content, media_id, created_at 
           FROM whatsapp_messages 
           WHERE phone = $1 
           ORDER BY created_at ASC 
           LIMIT $2`,
          [cleanPhone, limit]
        );
        return res.rows;
      } catch (err) {
        console.warn('Error fetching messages from Supabase Pool:', err);
      }
    } else if (this.supabaseClient) {
      try {
        const { data, error } = await this.supabaseClient
          .from('whatsapp_messages')
          .select('id, phone, role, content, media_id, created_at')
          .eq('phone', cleanPhone)
          .order('created_at', { ascending: true })
          .limit(limit);

        if (!error && data) {
          return data as ChatMessageRecord[];
        }
      } catch (err) {
        console.warn('Error fetching messages from Supabase REST:', err);
      }
    }

    // 3. Local fallback
    return this.localMessages.filter(m => m.phone === cleanPhone).slice(-limit);
  }

  /**
   * Clear memory/messages for a specific contact
   */
  public async clearConversationMemory(phone: string): Promise<boolean> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // Clear local mirror
    this.localMessages = this.localMessages.filter(m => m.phone !== cleanPhone);
    this.localConversations.delete(cleanPhone);
    this.saveLocalFallback();

    // Primary
    if (this.pgPool) {
      try {
        await this.pgPool.query(`DELETE FROM whatsapp_messages WHERE phone = $1`, [cleanPhone]);
        await this.pgPool.query(`DELETE FROM whatsapp_conversations WHERE phone = $1`, [cleanPhone]);
      } catch (err) {
        console.warn('Error clearing messages in Postgres:', err);
      }
    }

    // Supabase
    if (this.supabasePool) {
      try {
        await this.supabasePool.query(`DELETE FROM whatsapp_messages WHERE phone = $1`, [cleanPhone]);
        await this.supabasePool.query(`DELETE FROM whatsapp_conversations WHERE phone = $1`, [cleanPhone]);
      } catch (err) {
        console.warn('Error clearing messages in Supabase Pool:', err);
      }
    } else if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('whatsapp_messages').delete().eq('phone', cleanPhone);
        await this.supabaseClient.from('whatsapp_conversations').delete().eq('phone', cleanPhone);
      } catch (err) {
        console.warn('Error clearing messages in Supabase REST:', err);
      }
    }

    return true;
  }

  /**
   * Clear all memory (full reset)
   */
  public async clearAllMemory(): Promise<void> {
    this.localMessages = [];
    this.localConversations.clear();
    this.saveLocalFallback();

    if (this.pgPool) {
      try {
        await this.pgPool.query('TRUNCATE TABLE whatsapp_messages, whatsapp_conversations');
      } catch (err) {
        console.warn('Error truncating Postgres tables:', err);
      }
    }

    if (this.supabasePool) {
      try {
        await this.supabasePool.query('TRUNCATE TABLE whatsapp_messages, whatsapp_conversations');
      } catch (err) {
        console.warn('Error truncating Supabase tables:', err);
      }
    } else if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('whatsapp_messages').delete().neq('phone', '');
        await this.supabaseClient.from('whatsapp_conversations').delete().neq('phone', '');
      } catch (err) {
        console.warn('Error clearing Supabase tables:', err);
      }
    }
  }

  /**
   * Test specific connection on demand
   */
  public async testProvider(
    provider: 'postgresql' | 'supabase',
    params?: { url?: string; key?: string; dbUrl?: string }
  ): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const start = Date.now();

    if (provider === 'postgresql') {
      let url = (params?.url || storage.getSettings().postgresUrl || process.env.DATABASE_URL || '').trim();
      if (!url) {
        return { success: false, latencyMs: 0, message: 'No hay URL de PostgreSQL especificada.' };
      }

      // If connection string does not specify database, default to whatsappbot_db
      try {
        const parsed = new URL(url.replace(/^postgres(ql)?:\/\//, 'http://'));
        if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname === '') {
          const search = parsed.search || '';
          url = url.split('?')[0].replace(/\/+$/, '') + '/whatsappbot_db' + search;
        }
      } catch (e) {
        if (!url.match(/\/[a-zA-Z0-9_-]+(\?|$)/)) {
          url = url.replace(/(\?|$)/, '/whatsappbot_db$1');
        }
      }

      let testPool: pg.Pool | null = null;
      try {
        const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
        const sslDisabled = url.includes('sslmode=disable');
        testPool = new Pool({
          connectionString: url,
          connectionTimeoutMillis: 5000,
          ssl: isLocal || sslDisabled ? false : { rejectUnauthorized: false },
        });

        let client: pg.PoolClient;
        try {
          client = await testPool.connect();
        } catch (connErr: any) {
          if (connErr?.code === '3D000' || connErr?.message?.toLowerCase().includes('does not exist')) {
            const created = await this.ensureDatabaseExists(url);
            if (created) {
              client = await testPool.connect();
            } else {
              throw connErr;
            }
          } else {
            throw connErr;
          }
        }

        try {
          const res = await client.query('SELECT current_database(), version()');
          const latency = Date.now() - start;
          const currentDb = res.rows[0]?.current_database || 'whatsappbot_db';
          const version = res.rows[0]?.version || 'PostgreSQL';
          return {
            success: true,
            latencyMs: latency,
            message: `Conexión exitosa a PostgreSQL en base de datos "${currentDb}" (${version.split(' ')[0]} ${version.split(' ')[1] || ''})`,
          };
        } finally {
          client.release();
        }
      } catch (err: any) {
        return {
          success: false,
          latencyMs: Date.now() - start,
          message: `Error de conexión: ${err?.message || err}`,
        };
      } finally {
        if (testPool) testPool.end().catch(() => {});
      }
    }

    if (provider === 'supabase') {
      const supaUrl = (params?.url || storage.getSettings().supabaseUrl || process.env.SUPABASE_URL || '').trim();
      const supaKey = (
        params?.key ||
        storage.getSettings().supabaseKey ||
        process.env.SUPABASE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        ''
      ).trim();
      const supaDbUrl = (params?.dbUrl || storage.getSettings().supabaseDbUrl || process.env.SUPABASE_DB_URL || '').trim();

      // If DB URL is provided, test postgres pool connection
      if (supaDbUrl) {
        let testPool: pg.Pool | null = null;
        try {
          testPool = new Pool({
            connectionString: supaDbUrl,
            connectionTimeoutMillis: 5000,
            ssl: { rejectUnauthorized: false },
          });
          const client = await testPool.connect();
          try {
            await client.query('SELECT 1');
            const latency = Date.now() - start;
            return {
              success: true,
              latencyMs: latency,
              message: 'Conexión exitosa a Supabase vía PostgreSQL Pooler.',
            };
          } finally {
            client.release();
          }
        } catch (err: any) {
          return {
            success: false,
            latencyMs: Date.now() - start,
            message: `Error en conexión a Supabase DB: ${err?.message || err}`,
          };
        } finally {
          if (testPool) testPool.end().catch(() => {});
        }
      }

      if (!supaUrl || !supaKey) {
        return { success: false, latencyMs: 0, message: 'URL o Clave de API de Supabase ausente.' };
      }

      try {
        const client = createClient(supaUrl, supaKey, { auth: { persistSession: false } });
        const { error } = await client.from('whatsapp_conversations').select('phone').limit(1);
        const latency = Date.now() - start;

        if (!error || error.code === '42P01' || error.message?.includes('does not exist')) {
          return {
            success: true,
            latencyMs: latency,
            message: error ? 'Conexión a Supabase válida (tablas pendientes de crear).' : 'Conexión exitosa a Supabase REST API.',
          };
        }

        return {
          success: false,
          latencyMs: latency,
          message: `Error de API Supabase: ${error.message}`,
        };
      } catch (err: any) {
        return {
          success: false,
          latencyMs: Date.now() - start,
          message: `Error inesperado: ${err?.message || err}`,
        };
      }
    }

    return { success: false, latencyMs: 0, message: 'Proveedor no reconocido' };
  }

  /**
   * Get overall health status
   */
  public async getHealthStatus(): Promise<DatabaseHealthStatus> {
    const settings = storage.getSettings();
    const convs = await this.getConversations();

    let totalMessages = 0;
    for (const c of convs) {
      totalMessages += c.message_count || 0;
    }

    return {
      activeProvider: this.activeProvider,
      memoryEnabled: settings.memoryEnabled !== false,
      maxTurns: settings.memoryLimitTurns || 10,
      primary: this.primaryStatus,
      fallback: this.fallbackStatus,
      stats: {
        totalConversations: convs.length,
        totalMessages: totalMessages || this.localMessages.length,
      },
    };
  }

  public getActiveProviderName(): string {
    return this.activeProvider;
  }
}

export const databaseService = new DatabaseService();
