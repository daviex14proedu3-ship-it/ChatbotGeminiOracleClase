import { Router } from 'express';
import { databaseService } from '../storage/databaseService.js';
import { storage } from '../storage/store.js';
import { eventBus } from '../utils/logger.js';

export const memoryRouter = Router();

/**
 * Get current memory health, active provider and DB status
 */
memoryRouter.get('/status', async (req, res) => {
  try {
    const health = await databaseService.getHealthStatus();
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al obtener estado de base de datos' });
  }
});

/**
 * Get configuration (masked)
 */
memoryRouter.get('/config', (req, res) => {
  try {
    const settings = storage.getSettings();
    res.json({
      memoryEnabled: settings.memoryEnabled !== false,
      memoryLimitTurns: settings.memoryLimitTurns || 10,
      postgresUrl: settings.postgresUrl ? maskUrl(settings.postgresUrl) : '',
      supabaseUrl: settings.supabaseUrl || '',
      supabaseKey: settings.supabaseKey ? '••••••••••••••••' : '',
      supabaseDbUrl: settings.supabaseDbUrl ? maskUrl(settings.supabaseDbUrl) : '',
      rawPostgresConfigured: Boolean(settings.postgresUrl || process.env.DATABASE_URL || process.env.PG_HOST),
      rawSupabaseConfigured: Boolean(settings.supabaseUrl || settings.supabaseDbUrl),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al obtener configuración' });
  }
});

/**
 * Update memory and database settings
 */
memoryRouter.post('/config', async (req, res) => {
  try {
    const {
      memoryEnabled,
      memoryLimitTurns,
      postgresUrl,
      supabaseUrl,
      supabaseKey,
      supabaseDbUrl,
    } = req.body;

    const current = storage.getSettings();
    const updatePayload: any = {};

    if (typeof memoryEnabled === 'boolean') updatePayload.memoryEnabled = memoryEnabled;
    if (typeof memoryLimitTurns === 'number') updatePayload.memoryLimitTurns = Math.max(1, Math.min(50, memoryLimitTurns));

    // Only update if provided and not the masked placeholder
    if (postgresUrl !== undefined && !postgresUrl.includes('****')) {
      updatePayload.postgresUrl = postgresUrl.trim();
    }
    if (supabaseUrl !== undefined) {
      updatePayload.supabaseUrl = supabaseUrl.trim();
    }
    if (supabaseKey !== undefined && !supabaseKey.includes('••••')) {
      updatePayload.supabaseKey = supabaseKey.trim();
    }
    if (supabaseDbUrl !== undefined && !supabaseDbUrl.includes('****')) {
      updatePayload.supabaseDbUrl = supabaseDbUrl.trim();
    }

    const updated = storage.updateSettings(updatePayload);

    // Reconfigure database connections
    databaseService.configurePrimary(updated.postgresUrl);
    databaseService.configureFallback(updated.supabaseUrl, updated.supabaseKey, updated.supabaseDbUrl);
    await databaseService.evaluateProviders();

    eventBus.log('info', 'system', 'Configuración de memoria y base de datos actualizada.');
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al guardar configuración' });
  }
});

/**
 * Test connection to PostgreSQL or Supabase
 */
memoryRouter.post('/test', async (req, res) => {
  try {
    const { provider, url, key, dbUrl } = req.body;
    if (provider !== 'postgresql' && provider !== 'supabase') {
      return res.status(400).json({ error: 'Proveedor inválido. Debe ser "postgresql" o "supabase".' });
    }

    const result = await databaseService.testProvider(provider, { url, key, dbUrl });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al probar conexión' });
  }
});

/**
 * Execute table initialization (DDL)
 */
memoryRouter.post('/init-tables', async (req, res) => {
  try {
    const result = await databaseService.executeInitTables();
    eventBus.log('info', 'system', 'Comando de inicialización de tablas ejecutado.');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al inicializar tablas' });
  }
});

/**
 * Get SQL DDL script for manual execution
 */
memoryRouter.get('/ddl', (req, res) => {
  res.json({ ddl: databaseService.getDdlScript() });
});

/**
 * Get list of conversations
 */
memoryRouter.get('/conversations', async (req, res) => {
  try {
    const conversations = await databaseService.getConversations();
    res.json(conversations);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al obtener conversaciones' });
  }
});

/**
 * Get message history for a conversation
 */
memoryRouter.get('/conversations/:phone/messages', async (req, res) => {
  try {
    const { phone } = req.params;
    const limit = parseInt(req.query.limit as string || '100', 10);
    const messages = await databaseService.getConversationMessages(phone, limit);
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al obtener mensajes' });
  }
});

/**
 * Clear memory for a specific contact
 */
memoryRouter.delete('/conversations/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    await databaseService.clearConversationMemory(phone);
    eventBus.log('info', 'system', `Memoria eliminada para el contacto: ${phone}`);
    res.json({ success: true, message: `Memoria de ${phone} borrada.` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al borrar memoria del contacto' });
  }
});

/**
 * Clear all memory
 */
memoryRouter.delete('/clear-all', async (req, res) => {
  try {
    await databaseService.clearAllMemory();
    eventBus.log('warn', 'system', 'Toda la memoria de conversaciones ha sido reiniciada.');
    res.json({ success: true, message: 'Toda la memoria conversacional ha sido eliminada.' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al reiniciar memoria' });
  }
});

function maskUrl(str: string): string {
  try {
    const url = new URL(str.replace(/^postgres(ql)?:\/\//, 'http://'));
    const user = url.username ? `${url.username}:****@` : '';
    return `postgres://${user}${url.hostname}:${url.port || '5432'}${url.pathname}`;
  } catch {
    return str.replace(/:([^@/]+)@/, ':****@');
  }
}
