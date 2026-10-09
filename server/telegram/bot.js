import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const TelegramBot = require('node-telegram-bot-api');
import { getDb } from '../db/database.js';
import { extractEntities, getSiteContext } from '../services/extraction.js';
import { processUpdates } from '../services/updateRouter.js';
import { transcribeAudio } from '../services/transcription.js';

let bot = null;

export function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN not found. Telegram bot is disabled.');
    return;
  }

  bot = new TelegramBot(token, { polling: true });
  console.log('🤖 Telegram Bot started and polling for messages...');

  // Suppress polling errors from flooding the console
  bot.on('polling_error', (err) => {
    if (err.code !== 'EFATAL') {
      console.error('Polling error:', err.code);
    }
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const db = getDb();
    
    try {
      const phone = msg.contact?.phone_number || msg.from.username || msg.from.id.toString();
      const senderName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || phone;
      const messageId = msg.message_id;

      console.log(`📨 Telegram message from ${senderName} (${phone}):`, msg.text || '<media>');

      // ── Check if user exists in database ──
      const session = db.prepare(
        'SELECT * FROM wa_sessions WHERE phone = ? OR phone = ?'
      ).get(phone, msg.from.username);

      if (!session) {
        await bot.sendMessage(chatId, 
          `🏗️ *SiteCommand AI*\n\n` +
          `You're not registered in the system.\n` +
          `Ask your contractor/owner to add your Telegram username (@${msg.from.username || 'username'}) to the dashboard.\n\n` +
          `_Your ID for registration:_ \`${msg.from.username || msg.from.id}\``, 
          { parse_mode: 'Markdown' }
        );
        return;
      }

      if (!session.site_id && session.role !== 'owner') {
        await bot.sendMessage(chatId, '⚠️ No site assigned to your account. Contact the owner.');
        return;
      }

      let text = '';

      // ── Handle different message types ──
      if (msg.text) {
        text = msg.text;
      } else if (msg.voice || msg.audio) {
        await bot.sendMessage(chatId, '🎙️ Processing voice note...', { reply_to_message_id: messageId });
        try {
          const fileId = msg.voice ? msg.voice.file_id : msg.audio.file_id;
          const fileLink = await bot.getFileLink(fileId);
          const response = await fetch(fileLink);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const transcription = await transcribeAudio(buffer, 'audio/ogg');
          text = transcription.text;
          console.log(`🎙️ Transcribed: "${text}"`);
          await bot.sendMessage(chatId, `_Transcribed:_ "${text}"`, { parse_mode: 'Markdown' });
        } catch (err) {
          console.error('Transcription failed:', err);
          await bot.sendMessage(chatId, '❌ Audio sun nahi paaya. Kya aap text mein likh sakte hain?');
          return;
        }
      } else if (msg.photo) {
        text = msg.caption || 'Image received - please describe what this is for';
        console.log('📸 Photo received');
      } else {
        await bot.sendMessage(chatId, 'Is type ka message support nahi hota. Text ya voice note bhejiye.');
        return;
      }

      if (!text || text.trim().length === 0) {
        await bot.sendMessage(chatId, 'Kuch samajh nahi aaya. Dobara bhejiye.');
        return;
      }

      // ── Special commands ──
      const lower = text.toLowerCase().trim();
      if (['menu', 'help', 'hi', 'hello', 'start', '/start'].includes(lower)) {
        await sendMainMenu(chatId);
        return;
      }

      if (['status', 'balance', 'stock', 'summary'].includes(lower)) {
        await sendQuickStatus(chatId, session, db);
        return;
      }

      // ── LLM Entity Extraction ──
      let waitMsg;
      try {
        waitMsg = await bot.sendMessage(chatId, '⏳ Processing your update...', { reply_to_message_id: messageId });
      } catch (e) {
        waitMsg = await bot.sendMessage(chatId, '⏳ Processing your update...');
      }

      const siteContext = getSiteContext(db, session.site_id);
      const extraction = await extractEntities(text, siteContext);

      // ── Log activity ──
      logActivity(db, session.site_id, phone, senderName, text, extraction);

      // ── Handle LLM Responses ──
      if (extraction.status === 'unclear') {
        await safeEditMessage(chatId, waitMsg.message_id, 
          `🤔 ${extraction.clarification_needed || 'Samajh nahi aaya. Kya aap dobara bata sakte hain?'}`
        );
        return;
      }

      if (extraction.status === 'error') {
        await safeEditMessage(chatId, waitMsg.message_id, '⚠️ System error. Thodi der baad try karein.');
        return;
      }

      if (!extraction.updates || extraction.updates.length === 0) {
        await safeEditMessage(chatId, waitMsg.message_id,
          '🤔 Koi update detect nahi hua. Examples:\n' +
          '• "20 bag cement aaya"\n' +
          '• "500 rupaye chai kharcha"\n' +
          '• "Rajesh ko 2000 peshi diya"'
        );
        return;
      }

      // ── Route to database ──
      const { results, errors } = processUpdates(session.site_id, phone, extraction.updates);

      // ── Send confirmation ──
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

      await safeEditMessage(chatId, waitMsg.message_id, confirmMsg, 'Markdown');

    } catch (e) {
      console.error('❌ Error handling message:', e);
      try {
        await bot.sendMessage(chatId, '❌ Internal error. Please try again.');
      } catch (_) { /* swallow send errors */ }
    }
  });
}

/**
 * Safely edit a message — falls back to sending a new one if edit fails
 */
async function safeEditMessage(chatId, messageId, text, parseMode = null) {
  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      ...(parseMode ? { parse_mode: parseMode } : {}),
    });
  } catch (e) {
    // Message may have been deleted or is too old to edit
    try {
      await bot.sendMessage(chatId, text, parseMode ? { parse_mode: parseMode } : {});
    } catch (_) { /* swallow */ }
  }
}

/**
 * Log every message to the activity_log table for audit trail
 */
function logActivity(db, siteId, senderId, senderName, rawText, extraction) {
  try {
    db.prepare(`
      INSERT INTO activity_log (site_id, source, sender_id, sender_name, raw_text, extraction_json, processing_status)
      VALUES (?, 'telegram', ?, ?, ?, ?, ?)
    `).run(
      siteId,
      senderId,
      senderName,
      rawText,
      JSON.stringify(extraction),
      extraction.status === 'success' ? 'success' : 
      extraction.status === 'unclear' ? 'unclear' : 'failed'
    );
  } catch (e) {
    console.error('Activity log failed:', e.message);
  }
}

async function sendMainMenu(chatId) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '🌅 Good morning' : hour < 17 ? '☀️ Good afternoon' : '🌆 Good evening';

  await bot.sendMessage(chatId,
    `${greeting}! 🏗️ *SiteCommand*\n\n` +
    `Just type naturally — I understand Hindi & English:\n\n` +
    `📋 *Attendance:*\n` +
    `"Sab hajir hain" / "Ramesh absent"\n\n` +
    `📦 *Material Received:*\n` +
    `"50 bag cement aaya ABC dealer se"\n\n` +
    `🛒 *Material Request:*\n` +
    `"Kal tak 100 bag cement chahiye urgent"\n\n` +
    `🔧 *Material Used:*\n` +
    `"Aaj 15 bag cement laga"\n\n` +
    `💸 *Expense:*\n` +
    `"500 rupaye chai nashta"\n\n` +
    `🏧 *Worker Advance:*\n` +
    `"Rajesh ko 2000 peshi diya"\n\n` +
    `📸 *Daily Report:*\n` +
    `"Aaj first floor column casting complete hua"\n\n` +
    `_You can also send voice notes! 🎙️_`,
    { parse_mode: 'Markdown' }
  );
}

async function sendQuickStatus(chatId, session, db) {
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

  const todayExpenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM petty_cash WHERE site_id = ? AND type = 'debit' AND date = ?
  `).get(siteId, today);

  const pendingIndents = db.prepare(
    'SELECT COUNT(*) as count FROM indents WHERE site_id = ? AND status = ?'
  ).get(siteId, 'pending');

  const lowStock = db.prepare(`
    SELECT COUNT(*) as count FROM (
      SELECT mt.id,
        COALESCE((SELECT SUM(quantity_received) FROM grn WHERE material_type_id = mt.id AND site_id = ?), 0) -
        COALESCE((SELECT SUM(quantity_used) FROM consumption WHERE material_type_id = mt.id AND site_id = ?), 0) as stock,
        mt.low_stock_threshold
      FROM material_types mt
    ) WHERE stock <= low_stock_threshold AND stock >= 0
  `).get(siteId, siteId);

  let msg = `📊 *${today} — Site Status*\n\n`;
  msg += `👷 *Workers:* ${att.present}P / ${att.half_day}H / ${att.absent}A`;
  if (totalWorkers.count > 0) {
    msg += ` (of ${totalWorkers.count})`;
  }
  msg += `\n`;
  msg += `💵 *Cash Balance:* ₹${cashBalance.balance.toLocaleString('en-IN')}\n`;
  msg += `💸 *Today's Expenses:* ₹${todayExpenses.total.toLocaleString('en-IN')}\n`;
  
  if (pendingIndents.count > 0) {
    msg += `📦 *Pending Indents:* ${pendingIndents.count}\n`;
  }
  if (lowStock.count > 0) {
    msg += `⚠️ *Low Stock Items:* ${lowStock.count}\n`;
  }

  await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

export default bot;
