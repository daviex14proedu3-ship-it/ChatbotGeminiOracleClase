import { Router } from 'express';
import { baileysManager } from '../whatsapp/baileysClient.js';

export const whatsappRouter = Router();

whatsappRouter.get('/status', (req, res) => {
  res.json(baileysManager.getStatus());
});

whatsappRouter.post('/pairing-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'El número de teléfono es obligatorio.' });
    }
    const code = await baileysManager.requestPairingCode(phoneNumber);
    res.json({ code });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al generar código de emparejamiento' });
  }
});

whatsappRouter.post('/reconnect', async (req, res) => {
  try {
    await baileysManager.initialize();
    res.json({ success: true, message: 'Inicialización disparada' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al reiniciar' });
  }
});

whatsappRouter.post('/disconnect', async (req, res) => {
  try {
    await baileysManager.disconnect();
    res.json({ success: true, message: 'WhatsApp desconectado' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al desconectar' });
  }
});
