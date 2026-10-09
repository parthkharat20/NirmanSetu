import { Router } from 'express';
import { getDb } from '../db/database.js';

/**
 * Dashboard API Routes
 * Serves data to the owner's web dashboard (React frontend)
 */

const router = Router();

// ═══════════════════════════════════════════════════
// SITES
// ═══════════════════════════════════════════════════
router.get('/sites', (req, res) => {
  const db = getDb();
  const sites = db.prepare(`
    SELECT s.*, 
      (SELECT COUNT(*) FROM workers w WHERE w.site_id = s.id AND w.status = 'active') as worker_count
    FROM sites s ORDER BY s.created_at DESC
  `).all();
  res.json(sites);
});

router.get('/sites/:id', (req, res) => {
  const db = getDb();
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  res.json(site);
});

router.post('/sites', (req, res) => {
  const db = getDb();
  const { name, location, owner_phone, supervisor_phone } = req.body;
  const result = db.prepare(
    'INSERT INTO sites (name, location, owner_phone, supervisor_phone) VALUES (?, ?, ?, ?)'
  ).run(name, location, owner_phone, supervisor_phone);

  // Auto-register supervisor session
  if (supervisor_phone) {
    db.prepare(`
      INSERT OR REPLACE INTO wa_sessions (phone, site_id, role) VALUES (?, ?, 'supervisor')
    `).run(supervisor_phone, result.lastInsertRowid);
  }

  res.status(201).json({ id: result.lastInsertRowid });
});

// ═══════════════════════════════════════════════════
// WORKERS
// ═══════════════════════════════════════════════════
router.get('/sites/:siteId/workers', (req, res) => {
  const db = getDb();
  const workers = db.prepare(`
    SELECT w.*,
      COALESCE((SELECT SUM(amount) FROM advances WHERE worker_id = w.id), 0) as total_advances,
      (SELECT COUNT(*) FROM attendance WHERE worker_id = w.id AND status = 'present') as days_present,
      (SELECT COUNT(*) FROM attendance WHERE worker_id = w.id AND status = 'half_day') as days_half
    FROM workers w
    WHERE w.site_id = ? AND w.status = 'active'
    ORDER BY w.role, w.name
  `).all(req.params.siteId);
  res.json(workers);
});

router.post('/sites/:siteId/workers', (req, res) => {
  const db = getDb();
  const { name, phone, role, daily_wage } = req.body;
  const result = db.prepare(
    'INSERT INTO workers (site_id, name, phone, role, daily_wage) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.siteId, name, phone, role, daily_wage);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/workers/:id', (req, res) => {
  const db = getDb();
  const { name, phone, role, daily_wage, status } = req.body;
  db.prepare(`
    UPDATE workers SET name = COALESCE(?, name), phone = COALESCE(?, phone), 
    role = COALESCE(?, role), daily_wage = COALESCE(?, daily_wage), 
    status = COALESCE(?, status) WHERE id = ?
  `).run(name, phone, role, daily_wage, status, req.params.id);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════
// ATTENDANCE
// ═══════════════════════════════════════════════════
router.get('/sites/:siteId/attendance', (req, res) => {
  const db = getDb();
  const { date, from, to } = req.query;
  
  if (date) {
    const records = db.prepare(`
      SELECT a.*, w.name as worker_name, w.role as worker_role, w.daily_wage
      FROM attendance a
      JOIN workers w ON w.id = a.worker_id
      WHERE a.site_id = ? AND a.date = ?
      ORDER BY w.role, w.name
    `).all(req.params.siteId, date);
    return res.json(records);
  }

  // Date range summary
  const summary = db.prepare(`
    SELECT a.date,
      COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
      COUNT(CASE WHEN a.status = 'half_day' THEN 1 END) as half_day,
      COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
      SUM(CASE 
        WHEN a.status = 'present' THEN w.daily_wage
        WHEN a.status = 'half_day' THEN w.daily_wage * 0.5
        ELSE 0
      END) as total_wages
    FROM attendance a
    JOIN workers w ON w.id = a.worker_id
    WHERE a.site_id = ? AND a.date BETWEEN ? AND ?
    GROUP BY a.date
    ORDER BY a.date DESC
  `).all(req.params.siteId, from || '2020-01-01', to || '2030-12-31');
  res.json(summary);
});

// ═══════════════════════════════════════════════════
// MATERIALS & INVENTORY
// ═══════════════════════════════════════════════════
router.get('/sites/:siteId/inventory', (req, res) => {
  const db = getDb();
  const siteId = req.params.siteId;

  const inventory = db.prepare(`
    SELECT mt.id, mt.name, mt.unit, mt.low_stock_threshold,
      COALESCE((SELECT SUM(quantity_received) FROM grn WHERE material_type_id = mt.id AND site_id = ?), 0) as total_received,
      COALESCE((SELECT SUM(quantity_used) FROM consumption WHERE material_type_id = mt.id AND site_id = ?), 0) as total_used,
      COALESCE((SELECT SUM(quantity_received) FROM grn WHERE material_type_id = mt.id AND site_id = ?), 0) -
      COALESCE((SELECT SUM(quantity_used) FROM consumption WHERE material_type_id = mt.id AND site_id = ?), 0) as current_stock,
      COALESCE((SELECT SUM(invoice_amount) FROM grn WHERE material_type_id = mt.id AND site_id = ?), 0) as total_cost
    FROM material_types mt
    ORDER BY mt.name
  `).all(siteId, siteId, siteId, siteId, siteId);

  res.json(inventory.filter(i => i.total_received > 0 || i.total_used > 0));
});

router.get('/sites/:siteId/indents', (req, res) => {
  const db = getDb();
  const indents = db.prepare(`
    SELECT i.*, mt.name as material_name, mt.unit
    FROM indents i
    JOIN material_types mt ON mt.id = i.material_type_id
    WHERE i.site_id = ?
    ORDER BY i.created_at DESC
  `).all(req.params.siteId);
  res.json(indents);
});

router.put('/indents/:id/status', (req, res) => {
  const db = getDb();
  const { status } = req.body;
  db.prepare("UPDATE indents SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, req.params.id);
  res.json({ success: true });
});

router.get('/sites/:siteId/grn', (req, res) => {
  const db = getDb();
  const records = db.prepare(`
    SELECT g.*, mt.name as material_name, mt.unit
    FROM grn g
    JOIN material_types mt ON mt.id = g.material_type_id
    WHERE g.site_id = ?
    ORDER BY g.date DESC, g.created_at DESC
  `).all(req.params.siteId);
  res.json(records);
});

router.get('/sites/:siteId/consumption', (req, res) => {
  const db = getDb();
  const { from, to } = req.query;
  const records = db.prepare(`
    SELECT c.*, mt.name as material_name, mt.unit
    FROM consumption c
    JOIN material_types mt ON mt.id = c.material_type_id
    WHERE c.site_id = ? AND c.date BETWEEN ? AND ?
    ORDER BY c.date DESC
  `).all(req.params.siteId, from || '2020-01-01', to || '2030-12-31');
  res.json(records);
});

// ═══════════════════════════════════════════════════
// FINANCE — PETTY CASH
// ═══════════════════════════════════════════════════
router.get('/sites/:siteId/petty-cash', (req, res) => {
  const db = getDb();
  const ledger = db.prepare(`
    SELECT * FROM petty_cash WHERE site_id = ? ORDER BY date DESC, created_at DESC
  `).all(req.params.siteId);

  const balance = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
    FROM petty_cash WHERE site_id = ?
  `).get(req.params.siteId);

  res.json({ ledger, balance: balance.balance });
});

router.post('/sites/:siteId/petty-cash', (req, res) => {
  const db = getDb();
  const { type, amount, category, description } = req.body;
  const date = new Date().toISOString().split('T')[0];
  db.prepare(
    'INSERT INTO petty_cash (site_id, type, amount, category, description, date, logged_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.params.siteId, type, amount, category, description, date, 'dashboard');
  res.status(201).json({ success: true });
});

// ═══════════════════════════════════════════════════
// FINANCE — ADVANCES & WAGES
// ═══════════════════════════════════════════════════
router.get('/sites/:siteId/advances', (req, res) => {
  const db = getDb();
  const advances = db.prepare(`
    SELECT a.*, w.name as worker_name, w.role as worker_role
    FROM advances a
    JOIN workers w ON w.id = a.worker_id
    WHERE a.site_id = ?
    ORDER BY a.date DESC
  `).all(req.params.siteId);
  res.json(advances);
});

router.get('/sites/:siteId/wages', (req, res) => {
  const db = getDb();
  const { from, to } = req.query;
  const siteId = req.params.siteId;

  const wages = db.prepare(`
    SELECT w.id, w.name, w.role, w.daily_wage,
      COUNT(CASE WHEN a.status = 'present' THEN 1 END) as days_present,
      COUNT(CASE WHEN a.status = 'half_day' THEN 1 END) as days_half,
      COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as days_absent,
      (COUNT(CASE WHEN a.status = 'present' THEN 1 END) * w.daily_wage +
       COUNT(CASE WHEN a.status = 'half_day' THEN 1 END) * w.daily_wage * 0.5) as total_earned,
      COALESCE((SELECT SUM(amount) FROM advances WHERE worker_id = w.id AND date BETWEEN ? AND ?), 0) as total_advances,
      (COUNT(CASE WHEN a.status = 'present' THEN 1 END) * w.daily_wage +
       COUNT(CASE WHEN a.status = 'half_day' THEN 1 END) * w.daily_wage * 0.5) -
      COALESCE((SELECT SUM(amount) FROM advances WHERE worker_id = w.id AND date BETWEEN ? AND ?), 0) as net_payable
    FROM workers w
    LEFT JOIN attendance a ON a.worker_id = w.id AND a.date BETWEEN ? AND ?
    WHERE w.site_id = ? AND w.status = 'active'
    GROUP BY w.id
    ORDER BY w.role, w.name
  `).all(from || '2020-01-01', to || '2030-12-31', from || '2020-01-01', to || '2030-12-31', from || '2020-01-01', to || '2030-12-31', siteId);

  res.json(wages);
});

// ═══════════════════════════════════════════════════
// SUBCONTRACTORS
// ═══════════════════════════════════════════════════
router.get('/sites/:siteId/subcontractors', (req, res) => {
  const db = getDb();
  const subs = db.prepare(`
    SELECT s.*,
      COALESCE((SELECT SUM(amount) FROM subcontractor_work WHERE subcontractor_id = s.id), 0) as total_work_value,
      COALESCE((SELECT SUM(amount) FROM subcontractor_work WHERE subcontractor_id = s.id AND payment_status = 'paid'), 0) as total_paid,
      COALESCE((SELECT SUM(amount) FROM subcontractor_work WHERE subcontractor_id = s.id AND payment_status != 'paid'), 0) as pending_payment
    FROM subcontractors s
    WHERE s.site_id = ?
  `).all(req.params.siteId);
  res.json(subs);
});

// ═══════════════════════════════════════════════════
// DAILY REPORTS
// ═══════════════════════════════════════════════════
router.get('/sites/:siteId/reports', (req, res) => {
  const db = getDb();
  const reports = db.prepare(`
    SELECT * FROM daily_reports WHERE site_id = ? ORDER BY date DESC LIMIT 30
  `).all(req.params.siteId);
  res.json(reports);
});

// ═══════════════════════════════════════════════════
// DASHBOARD OVERVIEW (aggregated KPIs for owner)
// ═══════════════════════════════════════════════════
router.get('/dashboard/overview', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const sites = db.prepare('SELECT * FROM sites WHERE status = ?').all('active');

  const overview = sites.map(site => {
    const att = db.prepare(`
      SELECT 
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
        COUNT(CASE WHEN status = 'half_day' THEN 1 END) as half_day,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent
      FROM attendance WHERE site_id = ? AND date = ?
    `).get(site.id, today) || { present: 0, half_day: 0, absent: 0 };

    const totalWorkers = db.prepare(
      'SELECT COUNT(*) as count FROM workers WHERE site_id = ? AND status = ?'
    ).get(site.id, 'active');

    const todayWages = db.prepare(`
      SELECT COALESCE(SUM(
        CASE 
          WHEN a.status = 'present' THEN w.daily_wage
          WHEN a.status = 'half_day' THEN w.daily_wage * 0.5
          ELSE 0
        END
      ), 0) as total
      FROM attendance a JOIN workers w ON w.id = a.worker_id
      WHERE a.site_id = ? AND a.date = ?
    `).get(site.id, today);

    const cashBalance = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
      FROM petty_cash WHERE site_id = ?
    `).get(site.id);

    const pendingIndents = db.prepare(
      'SELECT COUNT(*) as count FROM indents WHERE site_id = ? AND status = ?'
    ).get(site.id, 'pending');

    const lowStockCount = db.prepare(`
      SELECT COUNT(*) as count FROM (
        SELECT mt.id,
          COALESCE((SELECT SUM(quantity_received) FROM grn WHERE material_type_id = mt.id AND site_id = ?), 0) -
          COALESCE((SELECT SUM(quantity_used) FROM consumption WHERE material_type_id = mt.id AND site_id = ?), 0) as stock,
          mt.low_stock_threshold
        FROM material_types mt
      ) WHERE stock <= low_stock_threshold AND stock >= 0
    `).get(site.id, site.id);

    const dpr = db.prepare(
      'SELECT * FROM daily_reports WHERE site_id = ? AND date = ?'
    ).get(site.id, today);

    return {
      ...site,
      attendance: { ...att, total: totalWorkers.count },
      todayWages: todayWages.total,
      cashBalance: cashBalance.balance,
      pendingIndents: pendingIndents.count,
      lowStockCount: lowStockCount.count,
      dprSubmitted: !!dpr,
    };
  });

  // Aggregate totals
  const totals = {
    totalSites: sites.length,
    totalWorkers: overview.reduce((sum, s) => sum + s.attendance.total, 0),
    totalPresent: overview.reduce((sum, s) => sum + s.attendance.present, 0),
    totalDailyBurn: overview.reduce((sum, s) => sum + s.todayWages, 0),
    totalCashBalance: overview.reduce((sum, s) => sum + s.cashBalance, 0),
    totalPendingIndents: overview.reduce((sum, s) => sum + s.pendingIndents, 0),
    totalLowStock: overview.reduce((sum, s) => sum + s.lowStockCount, 0),
  };

  res.json({ sites: overview, totals, date: today });
});

// ═══════════════════════════════════════════════════
// SIMULATED CHAT (Bypass WhatsApp API for testing)
// ═══════════════════════════════════════════════════
router.post('/simulate-chat', async (req, res) => {
  try {
    const { extractEntities, getSiteContext } = await import('../services/extraction.js');
    const { processUpdates } = await import('../services/updateRouter.js');
    const { text, phone = '1234567890', siteId = 1 } = req.body;
    const db = getDb();
    
    // Ensure session exists
    db.prepare('INSERT OR IGNORE INTO wa_sessions (phone, site_id, role) VALUES (?, ?, ?)')
      .run(phone, siteId, 'supervisor');

    // Special commands
    const lower = text.toLowerCase().trim();
    if (['status', 'balance', 'stock', 'summary'].includes(lower)) {
      return res.json({ reply: "Status command recognized. (See Dashboard Overview for stats)." });
    }

    // Step 1: LLM Entity Extraction
    const siteContext = getSiteContext(db, siteId);
    const extraction = await extractEntities(text, siteContext);

    if (extraction.status === 'unclear') {
      return res.json({ reply: `🤔 ${extraction.clarification_needed || 'Samajh nahi aaya.'}` });
    }
    if (extraction.status === 'error') {
      return res.json({ reply: '⚠️ System error. Thodi der baad try karein.' });
    }
    if (!extraction.updates || extraction.updates.length === 0) {
      return res.json({ reply: '🤔 Koi update detect nahi hua. (e.g. "20 bag cement aaya")' });
    }

    // Step 2: Route to database
    const { results, errors } = processUpdates(siteId, phone, extraction.updates);

    // Step 3: Format confirmation
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

    res.json({ reply: confirmMsg });
  } catch (err) {
    console.error('Simulation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// ACTIVITY FEED (real-time updates from Telegram)
// ═══════════════════════════════════════════════════
router.get('/activity', (req, res) => {
  const db = getDb();
  const { limit = 20, siteId } = req.query;
  
  let query = `
    SELECT al.*, s.name as site_name
    FROM activity_log al
    LEFT JOIN sites s ON s.id = al.site_id
  `;
  const params = [];
  
  if (siteId) {
    query += ' WHERE al.site_id = ?';
    params.push(siteId);
  }
  
  query += ' ORDER BY al.created_at DESC LIMIT ?';
  params.push(Number(limit));
  
  try {
    const activities = db.prepare(query).all(...params);
    res.json(activities);
  } catch (e) {
    res.json([]);
  }
});

export default router;

