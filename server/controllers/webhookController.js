import crypto from 'crypto';
import { getDb } from '../db/database.js';
import wa from '../whatsapp/client.js';
import { transcribeAudio } from '../services/transcription.js';
import { extractEntities, getSiteContext } from '../services/extraction.js';
import { processUpdates } from '../services/updateRouter.js';

/**
 * WhatsApp Webhook Controller
 * 
 * Handles two endpoints:
 * 1. GET  /api/whatsapp-webhook  → Webhook verification (Meta handshake)
 * 2. POST /api/whatsapp-webhook  → Incoming message processing
 * 
 * Pipeline: Message → [Transcribe if audio] → LLM Extract → Route to DB → Confirm
 */

/**
 * GET — Webhook Verification
 * Meta sends a verification request when you register the webhook URL.
 */
export function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  console.warn('⚠️ Webhook verification failed. Token mismatch.');
  return res.status(403).send('Forbidden');
}

/**
 * POST — Incoming Message Handler
 * This is where every WhatsApp message arrives.
 */
export async function handleWebhook(req, res) {
  // Respond 200 immediately to prevent Meta from retrying
  res.status(200).send('OK');

  try {
    const body = req.body;

    // Validate it's a WhatsApp message event
    if (body.object !== 'whatsapp_business_account') return;

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const messages = value.messages || [];

        for (const message of messages) {
          await processIncomingMessage(message);
        }
      }
    }
  } catch (err) {
    console.error('❌ Webhook processing error:', err);
  }
}

/**
 * Core Pipeline: Process a single incoming message
 */
async function processIncomingMessage(message) {
  const phone = message.from;
  const messageId = message.id;
  const timestamp = message.timestamp;

  console.log(`📨 Message from ${phone}: type=${message.type}`);

  // ── Mark as read (blue ticks) ──
  await wa.markAsRead(messageId);

  // ── Look up the sender's session ──
  const db = getDb();
  const session = db.prepare('SELECT * FROM wa_sessions WHERE phone = ?').get(phone);

  if (!session) {
    await wa.sendTextMessage(phone,
      `🏗️ *SiteCommand*\n\n` +
      `You're not registered in the system.\n` +
      `Ask your contractor/owner to add you via the dashboard.\n\n` +
      `_If you're the owner, visit the web dashboard to register._`
    );
    return;
  }

  if (!session.site_id && session.role !== 'owner') {
    await wa.sendTextMessage(phone, '⚠️ No site assigned to your account. Contact the owner.');
    return;
  }

  // ── STEP 1: Extract text from the message ──
  let text = '';
  let hasMedia = false;

  switch (message.type) {
    case 'text':
      text = message.text.body;
      break;

    case 'audio':
      // Voice note → Whisper transcription
      await wa.sendReaction(phone, messageId, '🎙️');
      try {
        const mediaData = await wa.downloadMedia(message.audio.id);
        const transcription = await transcribeAudio(mediaData.buffer, mediaData.mimeType);
        text = transcription.text;
        console.log(`🎙️ Transcribed: "${text}"`);
      } catch (err) {
        console.error('Transcription failed:', err.message);
        await wa.sendTextMessage(phone,
          '❌ Audio sun nahi paaya. Kya aap text mein likh sakte hain?'
        );
        return;
      }
      break;

    case 'image':
      hasMedia = true;
      text = message.image.caption || 'Image received - please describe what this is for';
      // TODO: Save image for GRN/DPR attachments
      if (message.image.id) {
        try {
          const mediaData = await wa.downloadMedia(message.image.id);
          // Save to uploads directory
          const fs = await import('fs');
          const path = await import('path');
          const filename = `${phone}_${Date.now()}.jpg`;
          const filepath = path.join(process.cwd(), 'uploads', filename);
          fs.mkdirSync(path.dirname(filepath), { recursive: true });
          fs.writeFileSync(filepath, mediaData.buffer);
          console.log(`📸 Image saved: ${filename}`);
        } catch (err) {
          console.error('Image download failed:', err.message);
        }
      }
      break;

    case 'document':
      hasMedia = true;
      text = message.document.caption || 'Document received';
      break;

    case 'interactive':
      // Button or list reply
      if (message.interactive.type === 'button_reply') {
        text = message.interactive.button_reply.title;
      } else if (message.interactive.type === 'list_reply') {
        text = message.interactive.list_reply.title;
      }
      break;

    default:
      await wa.sendTextMessage(phone,
        'Is type ka message support nahi hota. Text ya voice note bhejiye.'
      );
      return;
  }

  if (!text || text.trim().length === 0) {
    await wa.sendTextMessage(phone, 'Kuch samajh nahi aaya. Dobara bhejiye.');
    return;
  }

  // ── Check for special commands ──
  const lower = text.toLowerCase().trim();
  if (['menu', 'help', 'hi', 'hello', 'start'].includes(lower)) {
    await sendMainMenu(phone, session);
    return;
  }

  if (['status', 'balance', 'stock', 'summary'].includes(lower)) {
    await sendQuickStatus(phone, session);
    return;
  }

  // ── STEP 2: LLM Entity Extraction ──
  await wa.sendReaction(phone, messageId, '⏳');

  const siteContext = getSiteContext(db, session.site_id);
  const extraction = await extractEntities(text, siteContext);

  // ── Handle unclear responses ──
  if (extraction.status === 'unclear') {
    await wa.sendReaction(phone, messageId, '❓');
    await wa.sendTextMessage(phone,
      `🤔 ${extraction.clarification_needed || 'Samajh nahi aaya. Kya aap dobara bata sakte hain?'}`
    );
    return;
  }

  if (extraction.status === 'error') {
    await wa.sendReaction(phone, messageId, '❌');
    await wa.sendTextMessage(phone,
      '⚠️ System error. Thodi der baad try karein.'
    );
    return;
  }

  if (!extraction.updates || extraction.updates.length === 0) {
    await wa.sendReaction(phone, messageId, '❓');
    await wa.sendTextMessage(phone,
      '🤔 Koi update detect nahi hua. Examples:\n' +
      '• "20 bag cement aaya"\n' +
      '• "500 rupaye chai kharcha"\n' +
      '• "Rajesh ko 2000 peshi diya"\n' +
      '• "Aaj column casting hua"'
    );
    return;
  }

  // ── STEP 3: Route to database ──
  const { results, errors } = processUpdates(session.site_id, phone, extraction.updates);

  // ── STEP 4: Send confirmation ──
  await wa.sendReaction(phone, messageId, '✅');

  let confirmMsg = '✅ *Logged Successfully:*\n\n';
  for (const r of results) {
    confirmMsg += `${r.emoji} ${r.summary}\n`;
  }

  if (errors.length > 0) {
    confirmMsg += `\n⚠️ *Issues:*\n`;
    for (const e of errors) {
      confirmMsg += `• ${e}\n`;
    }
  }

  confirmMsg += `\n_Type "status" for summary_`;

  await wa.sendTextMessage(phone, confirmMsg);

  // ── Notify owner for important events ──
  await notifyOwnerIfNeeded(db, session, extraction.updates, results);
}

/**
 * Notify the owner about critical updates
 */
async function notifyOwnerIfNeeded(db, session, updates, results) {
  // Find owner phone for this site
  const site = db.prepare('SELECT owner_phone, name FROM sites WHERE id = ?').get(session.site_id);
  if (!site || !site.owner_phone) return;

  const criticalTypes = ['material_request', 'advance'];
  const criticalUpdates = updates.filter(u => criticalTypes.includes(u.type));

  if (criticalUpdates.length === 0) return;

  let ownerMsg = `📢 *Alert from ${site.name}*\n\n`;
  for (const r of results.filter(r => criticalTypes.includes(r.type))) {
    ownerMsg += `${r.emoji} ${r.summary}\n`;
  }
  ownerMsg += `\n_Open dashboard for details_`;

  try {
    await wa.sendTextMessage(site.owner_phone, ownerMsg);
  } catch (err) {
    console.error('Could not notify owner:', err.message);
  }
}

/**
 * Send the main menu
 */
async function sendMainMenu(phone, session) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '🌅 Good morning' : hour < 17 ? '☀️ Good afternoon' : '🌆 Good evening';

  await wa.sendTextMessage(phone,
    `${greeting}! 🏗️ *SiteCommand*\n\n` +
    `Just type naturally — I understand Hindi & English:\n\n` +
    `📋 *Attendance:*\n` +
    `"Sab hajir hain" / "Ramesh absent, Suresh half day"\n\n` +
    `📦 *Material Received:*\n` +
    `"50 bag cement aaya ABC dealer se, 19000 ka bill"\n\n` +
    `🛒 *Material Request:*\n` +
    `"Kal tak 100 bag cement chahiye urgent"\n\n` +
    `🔧 *Material Used:*\n` +
    `"Aaj 15 bag cement aur 80 kg steel laga"\n\n` +
    `💸 *Expense:*\n` +
    `"500 rupaye chai nashta, 1200 auto ka kharcha"\n\n` +
    `🏧 *Worker Advance:*\n` +
    `"Rajesh ko 2000 peshi diya"\n\n` +
    `📸 *Daily Report:*\n` +
    `"Aaj first floor column casting complete hua"\n\n` +
    `📊 *Status:*\n` +
    `"status" / "balance" / "stock"\n\n` +
    `_You can also send voice notes! 🎙️_`
  );
}

/**
 * Send a quick status summary
 */
async function sendQuickStatus(phone, session) {
  const db = getDb();
  const siteId = session.site_id;
  const today = new Date().toISOString().split('T')[0];

  const att = db.prepare(`
    SELECT 
      COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
      COUNT(CASE WHEN status = 'half_day' THEN 1 END) as half_day,
      COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent
    FROM attendance WHERE site_id = ? AND date = ?
  `).get(siteId, today) || { present: 0, half_day: 0, absent: 0 };

  const totalWorkers = db.prepare(
    'SELECT COUNT(*) as count FROM workers WHERE site_id = ? AND status = ?'
  ).get(siteId, 'active');

  const cashBalance = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
    FROM petty_cash WHERE site_id = ?
  `).get(siteId);

  const todayWages = db.prepare(`
    SELECT COALESCE(SUM(
      CASE 
        WHEN a.status = 'present' THEN w.daily_wage
        WHEN a.status = 'half_day' THEN w.daily_wage * 0.5
        ELSE 0
      END
    ), 0) as total
    FROM attendance a
    JOIN workers w ON w.id = a.worker_id
    WHERE a.site_id = ? AND a.date = ?
  `).get(siteId, today);

  const todayExpenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM petty_cash WHERE site_id = ? AND type = 'debit' AND date = ?
  `).get(siteId, today);

  let msg = `📊 *${today} — Site Status*\n\n`;
  msg += `👷 *Workers:* ${att.present}P / ${att.half_day}H / ${att.absent}A (of ${totalWorkers.count})\n`;
  msg += `💰 *Wages Today:* ₹${todayWages.total.toLocaleString('en-IN')}\n`;
  msg += `💸 *Expenses Today:* ₹${todayExpenses.total.toLocaleString('en-IN')}\n`;
  msg += `💵 *Cash Balance:* ₹${cashBalance.balance.toLocaleString('en-IN')}\n`;

  // Low stock alerts
  const lowStock = db.prepare(`
    SELECT mt.name, mt.unit, mt.low_stock_threshold,
      COALESCE((SELECT SUM(quantity_received) FROM grn WHERE material_type_id = mt.id AND site_id = ?), 0) -
      COALESCE((SELECT SUM(quantity_used) FROM consumption WHERE material_type_id = mt.id AND site_id = ?), 0) as stock
    FROM material_types mt
    HAVING stock <= mt.low_stock_threshold AND stock >= 0
  `).all(siteId, siteId);

  if (lowStock.length > 0) {
    msg += `\n⚠️ *Low Stock:*\n`;
    lowStock.forEach(m => {
      msg += `  🔴 ${m.name}: ${m.stock} ${m.unit}\n`;
    });
  }

  await wa.sendTextMessage(phone, msg);
}

/**
 * Verify webhook signature (security)
 */
export function verifySignature(req, res, buf) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !process.env.WHATSAPP_APP_SECRET) return;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
    .update(buf)
    .digest('hex');

  if (signature !== expected) {
    console.warn('⚠️ Invalid webhook signature!');
    throw new Error('Invalid signature');
  }
}
