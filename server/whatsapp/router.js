import { getDb } from '../db/database.js';
import wa from './client.js';
import { handleAttendanceFlow } from './flows/attendance.js';
import { handleMaterialFlow } from './flows/materials.js';
import { handleExpenseFlow } from './flows/expense.js';
import { handleReportFlow } from './flows/report.js';
import { handleAdvanceFlow } from './flows/advance.js';
import { handleConsumptionFlow } from './flows/consumption.js';

/**
 * Message Router — The brain of the WhatsApp bot.
 * Routes incoming messages to the correct flow handler based on
 * the user's current conversation state or keyword detection.
 */

// ── Keyword mappings ──
const KEYWORDS = {
  attendance: ['attendance', 'hajri', 'hazri', 'हाजिरी', 'हाजरी', 'att'],
  material_request: ['material', 'indent', 'request', 'सामान', 'माल', 'cement', 'steel', 'sand', 'need'],
  grn: ['received', 'delivery', 'challan', 'bill', 'grn', 'maal aaya', 'माल आया'],
  expense: ['expense', 'spent', 'kharcha', 'खर्चा', 'खर्च', 'petty', 'cash'],
  advance: ['advance', 'peshi', 'पेशी', 'loan', 'udhar', 'उधार'],
  report: ['report', 'dpr', 'progress', 'रिपोर्ट', 'kaam', 'काम'],
  consumption: ['used', 'consumption', 'consumed', 'laga', 'लगा', 'istemal'],
  help: ['help', 'menu', 'hi', 'hello', 'start', 'मदद'],
  status: ['status', 'balance', 'inventory', 'stock', 'बैलेंस'],
};

/**
 * Detect the intent from a text message
 */
function detectIntent(text) {
  const lower = text.toLowerCase().trim();
  for (const [intent, keywords] of Object.entries(KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return intent;
    }
  }
  return null;
}

/**
 * Get or create a user session
 */
function getSession(phone) {
  const db = getDb();
  let session = db.prepare('SELECT * FROM wa_sessions WHERE phone = ?').get(phone);
  if (!session) {
    // New user — they need to register first
    return null;
  }
  return {
    ...session,
    flow_state: session.flow_state ? JSON.parse(session.flow_state) : null,
  };
}

/**
 * Update session flow state
 */
export function updateSession(phone, flowName, flowState) {
  const db = getDb();
  db.prepare(`
    UPDATE wa_sessions 
    SET current_flow = ?, flow_state = ?, updated_at = datetime('now')
    WHERE phone = ?
  `).run(flowName, flowState ? JSON.stringify(flowState) : null, phone);
}

/**
 * Clear the current flow (reset to idle)
 */
export function clearFlow(phone) {
  updateSession(phone, null, null);
}

/**
 * Main message handler — called for every incoming WhatsApp message
 */
export async function handleIncomingMessage(message) {
  const phone = message.from;
  const messageId = message.id;
  const session = getSession(phone);

  // Mark as read immediately
  await wa.markAsRead(messageId);

  // ── Unregistered user ──
  if (!session) {
    await wa.sendTextMessage(phone,
      `🏗️ *SiteCommand*\n\n` +
      `Welcome! You're not registered yet.\n` +
      `Please contact your contractor/owner to get registered in the system.\n\n` +
      `_If you're the owner, register via the dashboard._`
    );
    return;
  }

  // ── Extract message content ──
  let text = '';
  let mediaId = null;
  let interactiveResponse = null;

  if (message.type === 'text') {
    text = message.text.body;
  } else if (message.type === 'interactive') {
    if (message.interactive.type === 'button_reply') {
      interactiveResponse = message.interactive.button_reply;
      text = interactiveResponse.id;
    } else if (message.interactive.type === 'list_reply') {
      interactiveResponse = message.interactive.list_reply;
      text = interactiveResponse.id;
    }
  } else if (message.type === 'image') {
    mediaId = message.image.id;
    text = message.image.caption || '';
  } else if (message.type === 'document') {
    mediaId = message.document.id;
    text = message.document.caption || '';
  }

  // ── Cancel command — universal escape hatch ──
  if (text.toLowerCase() === 'cancel' || text.toLowerCase() === 'exit' || text === '0') {
    clearFlow(phone);
    await wa.sendTextMessage(phone, '✅ Cancelled. Type *menu* to see options.');
    return;
  }

  // ── If user is mid-flow, continue that flow ──
  if (session.current_flow) {
    const context = {
      phone,
      text,
      mediaId,
      interactiveResponse,
      session,
      messageId,
    };

    switch (session.current_flow) {
      case 'attendance':
        await handleAttendanceFlow(context);
        return;
      case 'material_request':
      case 'grn':
        await handleMaterialFlow(context);
        return;
      case 'expense':
        await handleExpenseFlow(context);
        return;
      case 'advance':
        await handleAdvanceFlow(context);
        return;
      case 'report':
        await handleReportFlow(context);
        return;
      case 'consumption':
        await handleConsumptionFlow(context);
        return;
    }
  }

  // ── Detect intent from new message ──
  const intent = detectIntent(text);

  if (!intent || intent === 'help') {
    await sendMainMenu(phone, session);
    return;
  }

  if (intent === 'status') {
    await sendQuickStatus(phone, session);
    return;
  }

  // ── Start the appropriate flow ──
  const context = { phone, text, mediaId, interactiveResponse, session, messageId };

  switch (intent) {
    case 'attendance':
      updateSession(phone, 'attendance', { step: 'start' });
      await handleAttendanceFlow(context);
      break;
    case 'material_request':
      updateSession(phone, 'material_request', { step: 'start' });
      await handleMaterialFlow(context);
      break;
    case 'grn':
      updateSession(phone, 'grn', { step: 'start' });
      await handleMaterialFlow(context);
      break;
    case 'expense':
      updateSession(phone, 'expense', { step: 'start' });
      await handleExpenseFlow(context);
      break;
    case 'advance':
      updateSession(phone, 'advance', { step: 'start' });
      await handleAdvanceFlow(context);
      break;
    case 'report':
      updateSession(phone, 'report', { step: 'start' });
      await handleReportFlow(context);
      break;
    case 'consumption':
      updateSession(phone, 'consumption', { step: 'start' });
      await handleConsumptionFlow(context);
      break;
    default:
      await sendMainMenu(phone, session);
  }
}

/**
 * Send the main menu with all available actions
 */
async function sendMainMenu(phone, session) {
  const greeting = getGreeting();
  const roleName = session.role === 'owner' ? 'Boss' : 'Supervisor';

  await wa.sendListMessage(
    phone,
    '🏗️ SiteCommand',
    `${greeting} ${roleName}! Choose an action:\n\n` +
    `_Or just type naturally:_\n` +
    `• "hajri lagao" for attendance\n` +
    `• "50 bag cement chahiye" for material\n` +
    `• "500 chai kharcha" for expense\n` +
    `• Send a bill photo for GRN`,
    'Select Action',
    [
      {
        title: '📋 Daily Operations',
        rows: [
          { id: 'attendance', title: '📋 Attendance / Hajri', description: 'Mark today\'s attendance for all workers' },
          { id: 'consumption', title: '📦 Material Used Today', description: 'Log cement, steel, sand used today' },
          { id: 'report', title: '📸 Daily Report (DPR)', description: 'Submit progress photos & summary' },
        ],
      },
      {
        title: '💰 Money & Materials',
        rows: [
          { id: 'material_request', title: '🛒 Request Material', description: 'Send indent to owner for approval' },
          { id: 'grn', title: '🧾 Material Received (GRN)', description: 'Log delivery with challan photo' },
          { id: 'expense', title: '💸 Petty Cash Expense', description: 'Log tea, transport, hardware spend' },
          { id: 'advance', title: '🏧 Worker Advance', description: 'Give advance/peshi to a worker' },
        ],
      },
      {
        title: '📊 Quick Status',
        rows: [
          { id: 'status', title: '📊 Today\'s Summary', description: 'Attendance, spend, and stock levels' },
        ],
      },
    ]
  );
}

/**
 * Send a quick status summary
 */
async function sendQuickStatus(phone, session) {
  const db = getDb();
  const siteId = session.site_id;
  const today = new Date().toISOString().split('T')[0];

  // Attendance summary
  const att = db.prepare(`
    SELECT 
      COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
      COUNT(CASE WHEN status = 'half_day' THEN 1 END) as half_day,
      COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent
    FROM attendance WHERE site_id = ? AND date = ?
  `).get(siteId, today);

  // Total workers
  const totalWorkers = db.prepare(`
    SELECT COUNT(*) as count FROM workers WHERE site_id = ? AND status = 'active'
  `).get(siteId);

  // Petty cash balance
  const cashBalance = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
    FROM petty_cash WHERE site_id = ?
  `).get(siteId);

  // Low stock materials
  const lowStock = db.prepare(`
    SELECT mt.name, mt.unit, mt.low_stock_threshold,
      COALESCE(SUM(CASE WHEN g.id IS NOT NULL THEN g.quantity_received ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN c.id IS NOT NULL THEN c.quantity_used ELSE 0 END), 0) as current_stock
    FROM material_types mt
    LEFT JOIN grn g ON g.material_type_id = mt.id AND g.site_id = ?
    LEFT JOIN consumption c ON c.material_type_id = mt.id AND c.site_id = ?
    GROUP BY mt.id
    HAVING current_stock <= mt.low_stock_threshold
  `).all(siteId, siteId);

  // Today's wages
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

  let statusMsg = `📊 *Today's Site Status*\n` +
    `📅 ${today}\n\n`;

  if (att && (att.present || att.half_day || att.absent)) {
    statusMsg += `👷 *Attendance:*\n` +
      `  ✅ Present: ${att.present || 0}\n` +
      `  🔶 Half-day: ${att.half_day || 0}\n` +
      `  ❌ Absent: ${att.absent || 0}\n` +
      `  📋 Total: ${totalWorkers.count}\n\n`;
  } else {
    statusMsg += `👷 *Attendance:* Not marked yet\n` +
      `  📋 Total workers: ${totalWorkers.count}\n\n`;
  }

  statusMsg += `💰 *Wages Today:* ₹${todayWages.total.toLocaleString('en-IN')}\n`;
  statusMsg += `💵 *Petty Cash Balance:* ₹${cashBalance.balance.toLocaleString('en-IN')}\n\n`;

  if (lowStock.length > 0) {
    statusMsg += `⚠️ *Low Stock Alerts:*\n`;
    lowStock.forEach(m => {
      statusMsg += `  🔴 ${m.name}: ${m.current_stock} ${m.unit}\n`;
    });
  } else {
    statusMsg += `✅ *Stock:* All materials adequate`;
  }

  await wa.sendTextMessage(phone, statusMsg);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return '🌅 Good morning';
  if (hour < 17) return '☀️ Good afternoon';
  return '🌆 Good evening';
}
