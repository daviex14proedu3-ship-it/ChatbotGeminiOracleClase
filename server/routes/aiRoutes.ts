import { Router } from 'express';
import { storage } from '../storage/store.js';
import { geminiService } from '../ai/geminiService.js';
import { eventBus } from '../utils/logger.js';

export const aiRouter = Router();

aiRouter.get('/settings', (req, res) => {
  res.json(storage.getSettings());
});

aiRouter.get('/models', async (req, res) => {
  try {
    const key = req.query.key as string | undefined;
    const models = await geminiService.listDynamicModels(key);
    res.json(models);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al listar modelos' });
  }
});

aiRouter.post('/settings', (req, res) => {
  try {
    const updated = storage.updateSettings(req.body);
    eventBus.log('info', 'ai', 'Configuraciones de IA actualizadas correctamente.');
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al actualizar configuración de IA' });
  }
});

aiRouter.post('/test-key', async (req, res) => {
  try {
    const { key, model } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'Debes proporcionar una clave API.' });
    }
    const result = await geminiService.testKey(key, model);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al validar clave' });
  }
});

aiRouter.post('/simulate-chat', async (req, res) => {
  try {
    const { message, simulatedPhone = '5491122334455' } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
    }
    const result = await geminiService.generateResponse(simulatedPhone, message);
    
    // If media was recommended by AI, attach its details
    let mediaItem: any = null;
    if (result.mediaIdToSend) {
      mediaItem = storage.getMediaCatalog().find(m => m.id === result.mediaIdToSend) || null;
    }

    res.json({
      ...result,
      mediaItem,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al simular respuesta de IA' });
  }
});

aiRouter.post('/clear-chat-history', (req, res) => {
  const { phone = '5491122334455' } = req.body;
  geminiService.clearUserHistory(phone);
  res.json({ success: true, message: 'Historial del simulador reiniciado' });
});

// Knowledge Base endpoints
aiRouter.get('/knowledge-base', (req, res) => {
  res.json(storage.getKnowledgeBase());
});

aiRouter.post('/knowledge-base', (req, res) => {
  try {
    const { title, content, tags = [], category = 'General', isActive = true } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Título y contenido son requeridos.' });
    }
    const created = storage.addKnowledgeItem({ title, content, tags, category, isActive });
    eventBus.log('info', 'ai', `Nuevo artículo de conocimiento creado: "${title}"`);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al crear artículo' });
  }
});

aiRouter.put('/knowledge-base/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updated = storage.updateKnowledgeItem(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Artículo no encontrado.' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al actualizar artículo' });
  }
});

aiRouter.delete('/knowledge-base/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = storage.deleteKnowledgeItem(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Artículo no encontrado.' });
    }
    eventBus.log('info', 'ai', `Artículo de conocimiento eliminado (${id})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al eliminar artículo' });
  }
});
