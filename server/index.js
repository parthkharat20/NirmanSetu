import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import { verifyWebhook, handleWebhook, verifySignature } from './controllers/webhookController.js';
import dashboardRoutes from './routes/dashboard.js';
import { getDb } from './db/database.js';
import { initTelegramBot } from './telegram/bot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({
  verify: (req, res, buf) => {
    // Store raw body for signature verification
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// ── Static files (uploads) ──
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── WhatsApp Webhook ──
app.get('/api/whatsapp-webhook', verifyWebhook);
app.post('/api/whatsapp-webhook', handleWebhook);

// ── Dashboard API ──
import { requireAuth } from './middleware/auth.js';
app.use('/api', requireAuth, dashboardRoutes);

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    name: 'SiteCommand API'
  });
});

// ── Serve React dashboard in production ──
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

// ── Initialize DB & Start ──
getDb(); // Initialize database and create tables
console.log('📦 Database initialized');

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🏗️  SiteCommand Server                         ║
║                                                  ║
║   API:       http://localhost:${PORT}              ║
║   Dashboard: http://localhost:5173 (dev)         ║
║                                                  ║
╚══════════════════════════════════════════════════╝
  `);

  // ── Start Telegram Bot ──
  initTelegramBot();
});

export default app;
