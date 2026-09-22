import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  proto,
  WAMessage,
  GroupMetadata,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import { storage } from '../storage/store.js';
import { eventBus } from '../utils/logger.js';
import { geminiService } from '../ai/geminiService.js';

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

export type WhatsAppConnectionState = 'disconnected' | 'connecting' | 'waiting_qr' | 'connected' | 'reconnecting';

class BaileysManager {
  private sock: any = null;
  private qrCodeString: string | null = null;
  private qrDataUrl: string | null = null;
  private connectionState: WhatsAppConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private botJid: string | null = null;
  private botPhone: string | null = null;

  public async initialize(): Promise<void> {
    try {
      eventBus.log('info', 'whatsapp', 'Iniciando cliente Baileys...');
      this.connectionState = 'connecting';
      this.broadcastStatus();

      const authDir = storage.getAuthDir();
      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const { version, isLatest } = await fetchLatestBaileysVersion();
      eventBus.log('info', 'whatsapp', `Versión de Baileys: v${version.join('.')} (Última: ${isLatest})`);

      const logger = pino({ level: 'silent' });

      this.sock = makeWASocket({
        version,
        logger,
        auth: state,
        printQRInTerminal: false,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCodeString = qr;
          try {
            this.qrDataUrl = await qrcode.toDataURL(qr);
            this.connectionState = 'waiting_qr';
            eventBus.log('info', 'whatsapp', 'Nuevo código QR generado. Escanee desde WhatsApp.');
            eventBus.broadcast('whatsapp_qr', {
              qr: this.qrCodeString,
              qrDataUrl: this.qrDataUrl,
            });
            this.broadcastStatus();
          } catch (err) {
            console.error('Error generating QR DataURL:', err);
          }
        }

        if (connection === 'connecting') {
          this.connectionState = 'connecting';
          this.broadcastStatus();
        }

        if (connection === 'open') {
          this.connectionState = 'connected';
          this.qrCodeString = null;
          this.qrDataUrl = null;
          this.reconnectAttempts = 0;

          const user = this.sock.user;
          this.botJid = user?.id || null;
          this.botPhone = user?.id ? user.id.split(':')[0] : null;

          eventBus.log('success', 'whatsapp', `WhatsApp conectado exitosamente como ${this.botPhone || 'Bot'}!`);
          this.broadcastStatus();
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          eventBus.log(
            'warn',
            'whatsapp',
            `Conexión cerrada. Código: ${statusCode}. Reconectar: ${shouldReconnect}`
          );

          if (statusCode === DisconnectReason.loggedOut) {
            this.connectionState = 'disconnected';
            this.qrCodeString = null;
            this.qrDataUrl = null;
            this.sock = null;
            this.botJid = null;
            this.botPhone = null;

            // Clean auth session
            try {
              if (fs.existsSync(authDir)) {
                fs.rmSync(authDir, { recursive: true, force: true });
                fs.mkdirSync(authDir, { recursive: true });
              }
            } catch (cleanErr) {
              console.error('Error cleaning auth folder:', cleanErr);
            }

            eventBus.log('warn', 'whatsapp', 'Sesión cerrada por WhatsApp. Debe escanear nuevo QR.');
            this.broadcastStatus();
          } else if (shouldReconnect) {
            this.connectionState = 'reconnecting';
            this.broadcastStatus();

            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              const delayMs = Math.min(this.reconnectAttempts * 3000, 15000);
              eventBus.log('info', 'whatsapp', `Reintentando conexión en ${delayMs / 1000}s (Intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
              setTimeout(() => this.initialize(), delayMs);
            } else {
              eventBus.log('error', 'whatsapp', 'Límite de reconexiones alcanzado.');
              this.connectionState = 'disconnected';
              this.broadcastStatus();
            }
          } else {
            this.connectionState = 'disconnected';
            this.broadcastStatus();
          }
        }
      });

      // Listen for incoming messages
      this.sock.ev.on('messages.upsert', async (m: { messages: WAMessage[]; type: string }) => {
        if (m.type !== 'notify') return;
        for (const msg of m.messages) {
          await this.handleIncomingMessage(msg);
        }
      });
    } catch (err: any) {
      eventBus.log('error', 'whatsapp', `Error al inicializar Baileys: ${err?.message || err}`);
      this.connectionState = 'disconnected';
      this.broadcastStatus();
    }
  }

  private async handleIncomingMessage(msg: WAMessage): Promise<void> {
    try {
      if (!msg.message) return;
      if (msg.key.fromMe) return; // Ignore messages sent by the bot
      if (msg.key.remoteJid === 'status@broadcast') return; // Ignore status updates

      const remoteJid = msg.key.remoteJid;
      if (!remoteJid) return;

      const isGroup = remoteJid.endsWith('@g.us');
      const settings = storage.getSettings();

      // Check group filter
      if (isGroup && !settings.respondToGroups) {
        return;
      }

      // Check if bot is enabled
      if (!settings.botEnabled) {
        return;
      }

      // Extract message text
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        '';

      if (!text || text.trim() === '') return;

      const senderPhone = remoteJid
        .replace('@s.whatsapp.net', '')
        .replace('@g.us', '')
        .replace('@lid', '');
      const pushName = msg.pushName || senderPhone;

      eventBus.log('info', 'whatsapp', `Mensaje recibido de ${pushName} (${senderPhone}): "${text.slice(0, 50)}..."`);

      // Invoke Gemini with Failover
      const aiResult = await geminiService.generateResponse(senderPhone, text);

      // Send text response if available
      if (aiResult.text) {
        await this.sendMessage(remoteJid, { text: aiResult.text });
      }

      // Send media image if AI requested it
      if (aiResult.mediaIdToSend) {
        const mediaItem = storage.getMediaCatalog().find(m => m.id === aiResult.mediaIdToSend);
        if (mediaItem) {
          const filePath = path.join(storage.getUploadsDir(), mediaItem.filename);
          if (fs.existsSync(filePath)) {
            const buffer = fs.readFileSync(filePath);
            eventBus.log('info', 'whatsapp', `Enviando imagen del catálogo "${mediaItem.name}" a ${remoteJid}...`);
            await this.sendMessage(remoteJid, {
              image: buffer,
              caption: mediaItem.description || mediaItem.name,
              mimetype: 'image/webp',
            });
            eventBus.log('success', 'whatsapp', `Imagen del catálogo enviada con éxito.`);
          } else {
            eventBus.log('warn', 'whatsapp', `El archivo ${mediaItem.filename} no existe en el disco.`);
          }
        }
      }
    } catch (err: any) {
      eventBus.log('error', 'whatsapp', `Error procesando mensaje entrante: ${err?.message || err}`);
    }
  }

  public async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.sock) {
      throw new Error('El cliente de WhatsApp no está inicializado.');
    }
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleanNumber) {
      throw new Error('Número de teléfono inválido.');
    }

    try {
      eventBus.log('info', 'whatsapp', `Solicitando código de emparejamiento para: ${cleanNumber}`);
      const code = await this.sock.requestPairingCode(cleanNumber);
      eventBus.log('success', 'whatsapp', `Código de emparejamiento obtenido: ${code}`);
      return code;
    } catch (err: any) {
      eventBus.log('error', 'whatsapp', `Error al solicitar código: ${err?.message || err}`);
      throw err;
    }
  }

  public async sendMessage(jid: string, content: any): Promise<any> {
    if (!this.sock) {
      throw new Error('WhatsApp no está conectado');
    }

    // Format destination JID if phone number without domain was passed
    let targetJid = jid;
    if (!targetJid.includes('@')) {
      const clean = jid.replace(/[^0-9]/g, '');
      targetJid = `${clean}@s.whatsapp.net`;
    }

    return await this.sock.sendMessage(targetJid, content);
  }

  public async getGroups(): Promise<GroupInfo[]> {
    if (!this.sock || this.connectionState !== 'connected') {
      throw new Error('WhatsApp debe estar conectado para extraer los grupos.');
    }

    eventBus.log('info', 'groups', 'Extrayendo lista de grupos de WhatsApp...');
    const rawGroups = await this.sock.groupFetchAllParticipating();
    const groupList: GroupInfo[] = [];

    const myJidRaw = this.sock.user?.id || '';
    const myNumber = myJidRaw.split(':')[0].replace(/[^0-9]/g, '');

    for (const [id, meta] of Object.entries(rawGroups) as [string, GroupMetadata][]) {
      const participants = meta.participants || [];
      const myParticipant = participants.find(p => {
        const pNumber = p.id.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        return pNumber === myNumber;
      });

      const isBotAdmin = myParticipant?.admin === 'admin' || myParticipant?.admin === 'superadmin';
      const isAnnounce = meta.announce || false;
      // If announce is true, only admins can send. If false, everyone can send.
      const canSend = !isAnnounce || isBotAdmin;

      groupList.push({
        id: meta.id,
        subject: meta.subject || 'Sin nombre',
        creation: meta.creation || 0,
        owner: meta.owner,
        desc: meta.desc,
        participantsCount: participants.length,
        canSend,
        isAdmin: isBotAdmin,
        announce: isAnnounce,
      });
    }

    eventBus.log('success', 'groups', `Se extrajeron ${groupList.length} grupos exitosamente.`);
    return groupList;
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch (e) {
      // ignore
    }
    this.connectionState = 'disconnected';
    this.qrCodeString = null;
    this.qrDataUrl = null;
    this.botJid = null;
    this.botPhone = null;
    this.broadcastStatus();
  }

  public getStatus() {
    return {
      state: this.connectionState,
      botPhone: this.botPhone,
      qrDataUrl: this.qrDataUrl,
      qrString: this.qrCodeString,
    };
  }

  private broadcastStatus(): void {
    eventBus.broadcast('whatsapp_status', this.getStatus());
  }
}

export const baileysManager = new BaileysManager();
