import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import { authRouter } from './routes/authRoutes.js';
import { requireAuth, verifyWsToken, getAdminEmail } from './utils/auth.js';
import { whatsappRouter } from './routes/whatsappRoutes.js';
import { groupRouter } from './routes/groupRoutes.js';
import { messageRouter } from './routes/messageRoutes.js';
import { aiRouter } from './routes/aiRoutes.js';
import { mediaRouter } from './routes/mediaRoutes.js';
import { logRouter } from './routes/logRoutes.js';
import { eventBus } from './utils/logger.js';
import { baileysManager } from './whatsapp/baileysClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const server = http.createServer(app);

// Setup WebSocket Server on the same HTTP server instance with token verification
const wss = new WebSocketServer({ server });
eventBus.setWss(wss);

wss.on('connection', (ws, req) => {
  // Verify token from query params: ?token=...
  let token: string | undefined;
  try {
    const parsedUrl = new URL(req.url || '', 'http://localhost');
    token = parsedUrl.searchParams.get('token') || undefined;
  } catch (e) {
    // ignore
  }

  if (!verifyWsToken(token)) {
    ws.send(JSON.stringify({
      type: 'auth_error',
      payload: { message: 'Token de autenticación no válido o ausente.' },
      timestamp: new Date().toISOString(),
    }));
    ws.close(1008, 'Unauthorized');
    return;
  }

  // Send initial WhatsApp status and recent logs to authorized connected client
  ws.send(JSON.stringify({
    type: 'whatsapp_status',
    payload: baileysManager.getStatus(),
    timestamp: new Date().toISOString(),
  }));

  ws.send(JSON.stringify({
    type: 'initial_logs',
    payload: eventBus.getRecentLogs(),
    timestamp: new Date().toISOString(),
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      }
    } catch (e) {
      // ignore
    }
  });
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Auth Route (Public)
app.use('/api/auth', authRouter);

// Protected API Routes (Requires valid session token)
app.use('/api/whatsapp', requireAuth, whatsappRouter);
app.use('/api/groups', requireAuth, groupRouter);
app.use('/api/messages', requireAuth, messageRouter);
app.use('/api/ai', requireAuth, aiRouter);
app.use('/api/media', mediaRouter);
app.use('/api/logs', requireAuth, logRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    whatsapp: baileysManager.getStatus().state,
    timestamp: new Date().toISOString(),
  });
});

// Mount Vite in dev mode or serve static build in production (Single-Port Monolith)
async function setupFrontend() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: rootDir,
      });

      app.use(vite.middlewares);
      console.log('🚀 Modo Desarrollo: Vite montado como middleware en el mismo puerto.');
    } catch (err) {
      console.warn('Vite dev middleware could not be loaded, fallback to dist:', err);
      serveDist();
    }
  } else {
    serveDist();
  }
}

function serveDist() {
  const distPath = path.resolve(rootDir, 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('📦 Modo Producción: Sirviendo archivos estáticos desde /dist');
  } else {
    app.get('*', (req, res) => {
      res.send(`
        <html>
          <body style="font-family:sans-serif; background:#0f172a; color:#f8fafc; padding:2rem; text-align:center;">
            <h1>OmniBot WhatsApp SaaS Server</h1>
            <p>API disponible en <code>/api</code>.</p>
            <p>Por favor ejecute <code>pnpm build:client</code> para compilar el frontend o inicie en modo desarrollo.</p>
          </body>
        </html>
      `);
    });
  }
}

const PORT = parseInt(process.env.PORT || '3000', 10);

setupFrontend().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=============================================================`);
    console.log(`🌟 OmniBot WhatsApp SaaS (Monolito en 1 Solo Puerto) activo!`);
    console.log(`🌐 Acceso Web:   http://localhost:${PORT}`);
    console.log(`📡 WebSocket:    ws://localhost:${PORT}`);
    console.log(`🔐 Admin User:   ${getAdminEmail()}`);
    console.log(`⚙️  Entorno:      ${process.env.NODE_ENV || 'development'}`);
    console.log(`=============================================================\n`);

    eventBus.log('info', 'system', `Servidor iniciado en el puerto ${PORT}`);

    // Automatically initialize WhatsApp Baileys connection
    baileysManager.initialize().catch(err => {
      console.error('Error starting Baileys:', err);
    });
  });
});
