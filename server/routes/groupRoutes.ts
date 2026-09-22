import { Router } from 'express';
import { baileysManager } from '../whatsapp/baileysClient.js';
import { storage } from '../storage/store.js';
import { eventBus } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';

export const groupRouter = Router();

groupRouter.get('/', async (req, res) => {
  try {
    const groups = await baileysManager.getGroups();
    res.json(groups);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al obtener grupos' });
  }
});

let isGroupBulkRunning = false;

groupRouter.post('/bulk-send', async (req, res) => {
  try {
    const { groupIds, message, mediaFilename, delaySeconds = 4 } = req.body;

    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos un grupo.' });
    }

    if (!message && !mediaFilename) {
      return res.status(400).json({ error: 'Debes incluir un mensaje de texto o un archivo multimedia.' });
    }

    if (isGroupBulkRunning) {
      return res.status(409).json({ error: 'Ya hay un envío masivo a grupos en ejecución.' });
    }

    // Start sending in background
    isGroupBulkRunning = true;
    res.json({ success: true, message: `Iniciando envío a ${groupIds.length} grupos.` });

    // Background processing
    (async () => {
      let sentCount = 0;
      let failedCount = 0;
      const total = groupIds.length;

      eventBus.log('info', 'groups', `Iniciando campaña de envío a ${total} grupos...`);

      // Prepare media buffer if specified
      let mediaBuffer: Buffer | null = null;
      if (mediaFilename) {
        const filePath = path.join(storage.getUploadsDir(), mediaFilename);
        if (fs.existsSync(filePath)) {
          mediaBuffer = fs.readFileSync(filePath);
        }
      }

      for (let i = 0; i < groupIds.length; i++) {
        const gid = groupIds[i];
        try {
          if (mediaBuffer) {
            await baileysManager.sendMessage(gid, {
              image: mediaBuffer,
              caption: message || undefined,
              mimetype: 'image/webp',
            });
          } else {
            await baileysManager.sendMessage(gid, { text: message });
          }

          sentCount++;
          eventBus.log('success', 'groups', `Mensaje enviado al grupo ${gid} (${i + 1}/${total})`);
        } catch (err: any) {
          failedCount++;
          eventBus.log('error', 'groups', `Fallo al enviar al grupo ${gid}: ${err?.message || err}`);
        }

        eventBus.broadcast('group_bulk_progress', {
          current: i + 1,
          total,
          sentCount,
          failedCount,
          currentGroup: gid,
        });

        // Delay between sends to prevent bans
        if (i < groupIds.length - 1) {
          const jitter = Math.floor(Math.random() * 1000);
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000 + jitter));
        }
      }

      isGroupBulkRunning = false;
      eventBus.log('success', 'groups', `Campaña a grupos completada: ${sentCount} exitosos, ${failedCount} fallidos.`);
      eventBus.broadcast('group_bulk_completed', {
        sentCount,
        failedCount,
        total,
      });
    })().catch(err => {
      isGroupBulkRunning = false;
      eventBus.log('error', 'groups', `Error crítico en campaña masiva a grupos: ${err?.message || err}`);
    });
  } catch (err: any) {
    isGroupBulkRunning = false;
    res.status(500).json({ error: err?.message || 'Error al procesar envío masivo a grupos' });
  }
});
