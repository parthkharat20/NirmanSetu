import { getDb } from '../db/database.js';

/**
 * Update Router
 * Takes the structured JSON output from the LLM extraction service
 * and routes each update to the correct database insert function.
 * 
 * Returns a summary of what was inserted for confirmation messages.
 */

/**
 * Process all updates from an extraction result
 * @param {number} siteId - The site ID
 * @param {string} loggedBy - Who logged this (phone number)
 * @param {Array} updates - Array of update objects from the LLM
 * @returns {object} Summary of processed updates
 */
export function processUpdates(siteId, loggedBy, updates) {
  const db = getDb();
  const results = [];
  const errors = [];

  for (const update of updates) {
    try {
      switch (update.type) {
        case 'attendance':
          results.push(processAttendance(db, siteId, loggedBy, update));
          break;
        case 'material_receipt':
          results.push(processMaterialReceipt(db, siteId, loggedBy, update));
          break;
        case 'material_request':
          results.push(processMaterialRequest(db, siteId, loggedBy, update));
          break;
        case 'material_consumption':
          results.push(processConsumption(db, siteId, loggedBy, update));
          break;
        case 'expense':
          results.push(processExpense(db, siteId, loggedBy, update));
          break;
        case 'advance':
          results.push(processAdvance(db, siteId, loggedBy, update));
          break;
        case 'daily_report':
          results.push(processDailyReport(db, siteId, loggedBy, update));
          break;
        case 'subcontractor_work':
          results.push(processSubcontractorWork(db, siteId, loggedBy, update));
          break;
        default:
          errors.push(`Unknown update type: ${update.type}`);
      }
    } catch (err) {
      console.error(`❌ Error processing ${update.type}:`, err.message);
      errors.push(`Failed to process ${update.type}: ${err.message}`);
    }
  }

  return { results, errors };
}

// ═══════════════════════════════════════════════════
// ATTENDANCE
// ═══════════════════════════════════════════════════
function processAttendance(db, siteId, loggedBy, update) {
  const date = update.date || new Date().toISOString().split('T')[0];
  let marked = 0;
  let notFound = [];

  const insertOrUpdate = db.prepare(`
    INSERT INTO attendance (site_id, worker_id, date, status, marked_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(worker_id, date) DO UPDATE SET status = excluded.status, marked_by = excluded.marked_by
  `);

  const findWorker = db.prepare(`
    SELECT id, name FROM workers 
    WHERE site_id = ? AND status = 'active' AND (
      LOWER(name) LIKE ? OR LOWER(name) LIKE ?
    )
  `);

  for (const w of update.workers) {
    const searchName = w.name.toLowerCase();
    // Try exact match first, then partial match
    const worker = findWorker.get(siteId, `%${searchName}%`, `${searchName}%`);
    
    if (worker) {
      insertOrUpdate.run(siteId, worker.id, date, w.status, loggedBy);
      marked++;
    } else {
      notFound.push(w.name);
    }
  }

  return {
    type: 'attendance',
    emoji: '📋',
    summary: `${marked} workers marked for ${date}` + 
             (notFound.length > 0 ? `. Not found: ${notFound.join(', ')}` : ''),
  };
}

// ═══════════════════════════════════════════════════
// MATERIAL RECEIPT (GRN)
// ═══════════════════════════════════════════════════
function processMaterialReceipt(db, siteId, loggedBy, update) {
  const materialType = findOrCreateMaterial(db, update.item, update.unit);
  const date = new Date().toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO grn (site_id, material_type_id, quantity_received, vendor_name, invoice_amount, received_by, date, quality_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'accepted')
  `).run(
    siteId,
    materialType.id,
    update.quantity,
    update.vendor || null,
    update.invoice_amount || null,
    loggedBy,
    date
  );

  return {
    type: 'material_receipt',
    emoji: '📦',
    summary: `${update.quantity} ${update.unit} ${update.item} received` +
             (update.vendor ? ` from ${update.vendor}` : '') +
             (update.invoice_amount ? ` (₹${update.invoice_amount.toLocaleString('en-IN')})` : ''),
  };
}

// ═══════════════════════════════════════════════════
// MATERIAL REQUEST (INDENT)
// ═══════════════════════════════════════════════════
function processMaterialRequest(db, siteId, loggedBy, update) {
  const materialType = findOrCreateMaterial(db, update.item, update.unit);

  db.prepare(`
    INSERT INTO indents (site_id, material_type_id, quantity, urgency, needed_by, requested_by, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    siteId,
    materialType.id,
    update.quantity,
    update.urgency || 'normal',
    update.needed_by || null,
    loggedBy
  );

  const urgencyEmoji = { urgent: '🔴', critical: '🚨', normal: '🟡' };

  return {
    type: 'material_request',
    emoji: '🛒',
    summary: `${urgencyEmoji[update.urgency] || '🟡'} Request: ${update.quantity} ${update.unit} ${update.item}` +
             (update.needed_by ? ` by ${update.needed_by}` : ''),
  };
}

// ═══════════════════════════════════════════════════
// MATERIAL CONSUMPTION
// ═══════════════════════════════════════════════════
function processConsumption(db, siteId, loggedBy, update) {
  const materialType = findOrCreateMaterial(db, update.item, update.unit);
  const date = new Date().toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO consumption (site_id, material_type_id, quantity_used, date, logged_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(siteId, materialType.id, update.quantity_used, date, loggedBy);

  // Calculate remaining stock
  const stock = db.prepare(`
    SELECT 
      COALESCE((SELECT SUM(quantity_received) FROM grn WHERE site_id = ? AND material_type_id = ?), 0) -
      COALESCE((SELECT SUM(quantity_used) FROM consumption WHERE site_id = ? AND material_type_id = ?), 0) as remaining
  `).get(siteId, materialType.id, siteId, materialType.id);

  return {
    type: 'material_consumption',
    emoji: '🔧',
    summary: `Used ${update.quantity_used} ${update.unit} ${update.item}. Remaining: ${stock.remaining} ${update.unit}`,
  };
}

// ═══════════════════════════════════════════════════
// EXPENSE (PETTY CASH DEBIT)
// ═══════════════════════════════════════════════════
function processExpense(db, siteId, loggedBy, update) {
  const date = new Date().toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO petty_cash (site_id, type, amount, category, description, date, logged_by)
    VALUES (?, 'debit', ?, ?, ?, ?, ?)
  `).run(siteId, update.amount, update.category, update.description, date, loggedBy);

  // Get remaining balance
  const balance = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
    FROM petty_cash WHERE site_id = ?
  `).get(siteId);

  return {
    type: 'expense',
    emoji: '💸',
    summary: `₹${update.amount.toLocaleString('en-IN')} spent on ${update.description}. Balance: ₹${balance.balance.toLocaleString('en-IN')}`,
  };
}

// ═══════════════════════════════════════════════════
// WORKER ADVANCE
// ═══════════════════════════════════════════════════
function processAdvance(db, siteId, loggedBy, update) {
  const date = new Date().toISOString().split('T')[0];

  // Find the worker
  const worker = db.prepare(`
    SELECT id, name FROM workers 
    WHERE site_id = ? AND status = 'active' AND LOWER(name) LIKE ?
  `).get(siteId, `%${update.worker_name.toLowerCase()}%`);

  if (!worker) {
    return {
      type: 'advance',
      emoji: '⚠️',
      summary: `Worker "${update.worker_name}" not found in roster. Advance NOT recorded.`,
    };
  }

  db.prepare(`
    INSERT INTO advances (site_id, worker_id, amount, purpose, date, logged_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(siteId, worker.id, update.amount, update.purpose || null, date, loggedBy);

  // Total advances for this worker
  const totalAdvance = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM advances WHERE worker_id = ?
  `).get(worker.id);

  return {
    type: 'advance',
    emoji: '🏧',
    summary: `₹${update.amount.toLocaleString('en-IN')} advance to ${worker.name}. Total advances: ₹${totalAdvance.total.toLocaleString('en-IN')}`,
  };
}

// ═══════════════════════════════════════════════════
// DAILY PROGRESS REPORT
// ═══════════════════════════════════════════════════
function processDailyReport(db, siteId, loggedBy, update) {
  const date = new Date().toISOString().split('T')[0];

  // Get today's attendance count
  const attendance = db.prepare(`
    SELECT COUNT(CASE WHEN status = 'present' THEN 1 END) as present
    FROM attendance WHERE site_id = ? AND date = ?
  `).get(siteId, date);

  db.prepare(`
    INSERT INTO daily_reports (site_id, date, summary, weather, workers_present, submitted_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(site_id, date) DO UPDATE SET 
      summary = excluded.summary, weather = excluded.weather, 
      workers_present = excluded.workers_present, submitted_by = excluded.submitted_by
  `).run(siteId, date, update.summary, update.weather || null, attendance.present || 0, loggedBy);

  return {
    type: 'daily_report',
    emoji: '📸',
    summary: `DPR submitted: "${update.summary}"`,
  };
}

// ═══════════════════════════════════════════════════
// SUBCONTRACTOR WORK
// ═══════════════════════════════════════════════════
function processSubcontractorWork(db, siteId, loggedBy, update) {
  // Try to find existing subcontractor
  let sub = db.prepare(`
    SELECT id, name, rate FROM subcontractors 
    WHERE site_id = ? AND LOWER(name) LIKE ?
  `).get(siteId, `%${update.subcontractor_name.toLowerCase()}%`);

  if (!sub) {
    // Auto-create subcontractor
    const result = db.prepare(`
      INSERT INTO subcontractors (site_id, name, trade) VALUES (?, ?, ?)
    `).run(siteId, update.subcontractor_name, update.description);
    sub = { id: result.lastInsertRowid, name: update.subcontractor_name, rate: null };
  }

  const rate = update.rate || sub.rate || 0;
  const amount = rate * update.quantity;

  db.prepare(`
    INSERT INTO subcontractor_work (subcontractor_id, site_id, description, quantity, unit, amount, date, payment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    sub.id, siteId, update.description,
    update.quantity, update.unit || 'sqft',
    amount, new Date().toISOString().split('T')[0]
  );

  return {
    type: 'subcontractor_work',
    emoji: '👷',
    summary: `${sub.name}: ${update.quantity} ${update.unit || 'units'} ${update.description}` +
             (amount > 0 ? ` (₹${amount.toLocaleString('en-IN')})` : ''),
  };
}

// ═══════════════════════════════════════════════════
// UTILITY: Find or create a material type
// ═══════════════════════════════════════════════════
function findOrCreateMaterial(db, itemName, unit) {
  // Normalize common Hindi/Hinglish material names
  const normalizeMap = {
    'sement': 'Cement (OPC 53)', 'cement': 'Cement (OPC 53)', 'opc': 'Cement (OPC 53)', 'ppc': 'Cement (PPC)',
    'sariya': 'TMT Steel 12mm', 'steel': 'TMT Steel 12mm', 'tmt': 'TMT Steel 12mm', 'loha': 'TMT Steel 12mm',
    'sand': 'River Sand', 'reti': 'River Sand', 'bajri': 'River Sand', 'balu': 'River Sand',
    'msand': 'M-Sand', 'm-sand': 'M-Sand',
    'crush': 'Crush (20mm)', 'gitti': 'Crush (20mm)', 'aggregate': 'Crush (20mm)',
    'brick': 'Bricks (Red)', 'int': 'Bricks (Red)', 'eent': 'Bricks (Red)',
    'block': 'AAC Blocks', 'aac': 'AAC Blocks',
    'wire': 'Binding Wire', 'taar': 'Binding Wire',
    'ply': 'Plywood (shuttering)', 'plywood': 'Plywood (shuttering)',
    'nail': 'Nails', 'keel': 'Nails',
    'paint': 'Paint (Exterior)', 'rang': 'Paint (Exterior)',
    'pipe': 'PVC Pipes 4"',
  };

  const searchKey = itemName.toLowerCase().split(' ')[0]; // First word
  const normalizedName = normalizeMap[searchKey] || itemName;

  // Try exact match
  let material = db.prepare(
    'SELECT id, name, unit FROM material_types WHERE LOWER(name) = ?'
  ).get(normalizedName.toLowerCase());

  if (!material) {
    // Try partial match
    material = db.prepare(
      'SELECT id, name, unit FROM material_types WHERE LOWER(name) LIKE ?'
    ).get(`%${searchKey}%`);
  }

  if (!material) {
    // Create new material type
    const result = db.prepare(
      'INSERT INTO material_types (name, unit, low_stock_threshold) VALUES (?, ?, ?)'
    ).run(itemName, unit || 'nos', 10);
    material = { id: result.lastInsertRowid, name: itemName, unit: unit || 'nos' };
  }

  return material;
}

export default { processUpdates };
