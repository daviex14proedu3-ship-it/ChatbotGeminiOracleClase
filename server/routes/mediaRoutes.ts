import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { storage } from '../storage/store.js';
import { eventBus } from '../utils/logger.js';
import { requireAuth } from '../utils/auth.js';

export const mediaRouter = Router();

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storage.getUploadsDir());
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.webp';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `media-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// Upload media file (Frontend sends WebP image)
mediaRouter.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }

    const { name, description, tags, addToCatalog } = req.body;
    const filename = req.file.filename;
    const originalName = req.file.originalname;
    const sizeBytes = req.file.size;
    const mimeType = req.file.mimetype;
    const isWebp = mimeType.includes('webp') || originalName.toLowerCase().endsWith('.webp');

    let catalogItem: any = null;
    if (addToCatalog === 'true' || addToCatalog === true) {
      let parsedTags: string[] = [];
      if (typeof tags === 'string') {
        parsedTags = tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      } else if (Array.isArray(tags)) {
        parsedTags = tags;
      }

      catalogItem = storage.addMediaItem({
        name: name || originalName,
        originalName,
        description: description || '',
        tags: parsedTags,
        mimeType,
        filename,
        sizeBytes,
        webpOptimized: isWebp,
      });

      eventBus.log('success', 'system', `Nuevo medio agregado al catálogo de IA: "${catalogItem.name}"`);
    }

    res.json({
      success: true,
      filename,
      originalName,
      sizeBytes,
      isWebp,
      catalogItem,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al subir archivo' });
  }
});

mediaRouter.get('/catalog', requireAuth, (req, res) => {
  res.json(storage.getMediaCatalog());
});

mediaRouter.delete('/catalog/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const deleted = storage.deleteMediaItem(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Elemento multimedia no encontrado' });
    }
    eventBus.log('info', 'system', `Medio eliminado del catálogo (${id})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al eliminar medio' });
  }
});

mediaRouter.get('/file/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(storage.getUploadsDir(), filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Archivo no encontrado');
  }
  res.sendFile(filePath);
});
