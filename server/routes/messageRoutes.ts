import { Router } from 'express';
import { baileysManager } from '../whatsapp/baileysClient.js';
import { storage, CampaignRecord } from '../storage/store.js';
import { eventBus } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';

export const messageRouter = Router();

messageRouter.post('/send-direct', async (req, res) => {
  try {
    const { phone, message, mediaFilename } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'El número de teléfono es requerido.' });
    }

    if (!message && !mediaFilename) {
      return res.status(400).json({ error: 'Debe ingresar un mensaje o adjuntar un archivo.' });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;

    if (mediaFilename) {
      const filePath = path.join(storage.getUploadsDir(), mediaFilename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'El archivo adjunto no existe en el servidor.' });
      }

      const buffer = fs.readFileSync(filePath);
      await baileysManager.sendMessage(jid, {
        image: buffer,
        caption: message || undefined,
        mimetype: 'image/webp',
      });
    } else {
      await baileysManager.sendMessage(jid, { text: message });
    }

    eventBus.log('success', 'whatsapp', `Mensaje directo enviado a ${phone}`);
    res.json({ success: true, message: `Mensaje enviado a ${phone}` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al enviar mensaje directo' });
  }
});

let isBulkCancelled = false;
let isBulkActive = false;

messageRouter.post('/bulk-send', async (req, res) => {
  try {
    const { title = 'Campaña Masiva', contacts, mediaFilename, delaySeconds = 5 } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'La lista de contactos no puede estar vacía.' });
    }

    if (isBulkActive) {
      return res.status(409).json({ error: 'Ya hay una campaña de envíos masivos en curso.' });
    }

    isBulkActive = true;
    isBulkCancelled = false;

    const campaignId = 'camp-' + Date.now();
    const campaignRecord: CampaignRecord = {
      id: campaignId,
      title,
      totalRecipients: contacts.length,
      sentCount: 0,
      failedCount: 0,
      status: 'in_progress',
      createdAt: new Date().toISOString(),
      logs: [],
    };

    storage.addCampaign(campaignRecord);
    res.json({ success: true, campaignId, message: `Campaña iniciada para ${contacts.length} contactos.` });

    // Run asynchronously
    (async () => {
      let sent = 0;
      let failed = 0;
      const total = contacts.length;

      eventBus.log('info', 'bulk', `Iniciando campaña "${title}" para ${total} destinatarios...`);

      let mediaBuffer: Buffer | null = null;
      if (mediaFilename) {
        const filePath = path.join(storage.getUploadsDir(), mediaFilename);
        if (fs.existsSync(filePath)) {
          mediaBuffer = fs.readFileSync(filePath);
        }
      }

      for (let i = 0; i < contacts.length; i++) {
        if (isBulkCancelled) {
          eventBus.log('warn', 'bulk', `Campaña "${title}" cancelada por el usuario.`);
          storage.updateCampaign(campaignId, { status: 'cancelled' });
          break;
        }

        const item = contacts[i];
        const cleanPhone = (item.phone || '').replace(/[^0-9]/g, '');

        if (!cleanPhone || cleanPhone.length < 8) {
          failed++;
          campaignRecord.logs.push({
            phone: item.phone,
            name: item.name,
            status: 'failed',
            error: 'Número telefónico inválido',
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        const jid = `${cleanPhone}@s.whatsapp.net`;
        const text = item.message || '';

        try {
          if (mediaBuffer) {
            await baileysManager.sendMessage(jid, {
              image: mediaBuffer,
              caption: text || undefined,
              mimetype: 'image/webp',
            });
          } else {
            await baileysManager.sendMessage(jid, { text });
          }

          sent++;
          campaignRecord.logs.push({
            phone: item.phone,
            name: item.name,
            status: 'sent',
            timestamp: new Date().toISOString(),
          });
          eventBus.log('success', 'bulk', `Mensaje enviado a ${item.name ? item.name + ' (' + item.phone + ')' : item.phone} (${i + 1}/${total})`);
        } catch (err: any) {
          failed++;
          campaignRecord.logs.push({
            phone: item.phone,
            name: item.name,
            status: 'failed',
            error: err?.message || 'Error al enviar',
            timestamp: new Date().toISOString(),
          });
          eventBus.log('error', 'bulk', `Error al enviar a ${item.phone}: ${err?.message || err}`);
        }

        storage.updateCampaign(campaignId, {
          sentCount: sent,
          failedCount: failed,
          logs: campaignRecord.logs,
        });

        eventBus.broadcast('bulk_progress', {
          campaignId,
          current: i + 1,
          total,
          sent,
          failed,
          contact: item,
        });

        // Anti-ban delay with jitter
        if (i < contacts.length - 1 && !isBulkCancelled) {
          const jitter = Math.floor(Math.random() * 1500);
          await new Promise(resolve => setTimeout(resolve, Math.max(2, delaySeconds) * 1000 + jitter));
        }
      }

      isBulkActive = false;
      const finalStatus = isBulkCancelled ? 'cancelled' : 'completed';
      storage.updateCampaign(campaignId, {
        status: finalStatus,
        completedAt: new Date().toISOString(),
      });

      eventBus.log(
        'success',
        'bulk',
        `Campaña finalizada. Enviados: ${sent}, Fallidos: ${failed} de ${total}`
      );

      eventBus.broadcast('bulk_completed', {
        campaignId,
        sent,
        failed,
        total,
        status: finalStatus,
      });
    })().catch(err => {
      isBulkActive = false;
      eventBus.log('error', 'bulk', `Fallo crítico en campaña: ${err?.message || err}`);
    });
  } catch (err: any) {
    isBulkActive = false;
    res.status(500).json({ error: err?.message || 'Error al procesar campaña masiva' });
  }
});

messageRouter.post('/bulk-cancel', (req, res) => {
  if (!isBulkActive) {
    return res.json({ message: 'No hay ninguna campaña masiva activa para cancelar.' });
  }
  isBulkCancelled = true;
  res.json({ success: true, message: 'Señal de cancelación enviada a la campaña.' });
});

messageRouter.get('/campaigns', (req, res) => {
  res.json(storage.getCampaigns());
});
