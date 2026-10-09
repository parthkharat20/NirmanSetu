import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'sitecommand.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    -- ═══════════════════════════════════════════════════
    -- SITES
    -- ═══════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      owner_phone TEXT,
      supervisor_phone TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','paused')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════════════
    -- WORKERS (the 30-person roster per site)
    -- ═══════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id),
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL CHECK(role IN ('mason','carpenter','helper','plumber','electrician','painter','welder','other')),
      daily_wage REAL NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════════════
    -- ATTENDANCE
    -- ═══════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id),
      worker_id INTEGER NOT NULL REFERENCES workers(id),
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present','absent','half_day','overtime')),
      overtime_hours REAL DEFAULT 0,
      marked_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(worker_id, date)
    );

    -- ═══════════════════════════════════════════════════
    -- ADVANCES (petty cash given to workers)
    -- ═══════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS advances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id),
      worker_id INTEGER NOT NULL REFERENCES workers(id),
      amount REAL NOT NULL,
      purpose TEXT,
      date TEXT NOT NULL,
      logged_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════════════
    -- MATERIAL CATEGORIES
    -- ═══════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS material_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      low_stock_threshold REAL DEFAULT 10
    );

    -- ═══════════════════════════════════════════════════
    -- MATERIAL INDENTS (requests from supervisor)
    -- ═══════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS indents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id),
      material_type_id INTEGER NOT NULL REFERENCES material_types(id),
      quantity REAL NOT NULL,
      urgency TEXT DEFAULT 'normal' CHECK(urgency IN ('low','normal','urgent','critical')),
      needed_by TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','dispatched','received','rejected')),
      requested_by TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════════════
    -- GOODS RECEIPT NOTES
    -- ═══════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS grn (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id),
      indent_id INTEGER REFERENCES indents(id),
      material_type_id INTEGER NOT NULL REFERENCES material_types(id),
      quantity_received REAL NOT NULL,
      vendor_name TEXT,
      invoice_number TEXT,
      invoice_amount REAL,
      invoice_photo TEXT,
      quality_status TEXT DEFAULT 'accepted' CHECK(quality_status IN ('accepted','rejected','partial')),
      received_by TEXT,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════════════
    -- DAILY MATERIAL CONSUMPTION
    -- ═══════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS consumption (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id),
      material_type_id INTEGER NOT NULL REFERENCES material_types(id),
      quantity_used REAL NOT NULL,
      date TEXT NOT NULL,
      logged_by TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════════════
    -- PETTY CASH LEDGER
    -- ═══════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS petty_cash (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id),
      type TEXT NOT NULL CHECK(type IN ('credit','debit')),
      amount REAL NOT NULL,
      category TEXT,
      description TEXT,
      date TEXT NOT NULL,
      logged_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════════════
    -- SUBCONTRACTORS
    -- ═══════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS subcontractors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id),
      name TEXT NOT NULL,
      phone TEXT,
      trade TEXT,
      rate_type TEXT CHECK(rate_type IN ('per_sqft','per_rft','per_unit','lumpsum')),
      rate REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════════════
    -- SUBCONTRACTOR WORK LOG
    -- ═══════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS subcontractor_work (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subcontractor_id INTEGER NOT NULL REFERENCES subcontractors(id),
      site_id INTEGER NOT NULL REFERENCES sites(id),
      description TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','partial')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════════════
    -- DAILY PROGRESS REPORTS
    -- ═══════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id),
      date TEXT NOT NULL,
      summary TEXT,
      weather TEXT,
      workers_present INTEGER DEFAULT 0,
      photos TEXT,
      submitted_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(site_id, date)
    );

    -- ═══════════════════════════════════════════════════
    -- WHATSAPP SESSION STATE (conversation context)
    -- ═══════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS wa_sessions (
      phone TEXT PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id),
      role TEXT CHECK(role IN ('supervisor','owner')),
      current_flow TEXT,
      flow_state TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════════════
    -- INDEXES for performance
    -- ═══════════════════════════════════════════════════
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_site ON attendance(site_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendance_worker ON attendance(worker_id, date);
    CREATE INDEX IF NOT EXISTS idx_workers_site ON workers(site_id);
    CREATE INDEX IF NOT EXISTS idx_workers_site_status ON workers(site_id, status);
    CREATE INDEX IF NOT EXISTS idx_grn_site ON grn(site_id);
    CREATE INDEX IF NOT EXISTS idx_grn_material ON grn(site_id, material_type_id);
    CREATE INDEX IF NOT EXISTS idx_consumption_site ON consumption(site_id, date);
    CREATE INDEX IF NOT EXISTS idx_consumption_material ON consumption(site_id, material_type_id);
    CREATE INDEX IF NOT EXISTS idx_petty_cash_site ON petty_cash(site_id, date);
    CREATE INDEX IF NOT EXISTS idx_indents_site ON indents(site_id);
    CREATE INDEX IF NOT EXISTS idx_indents_status ON indents(site_id, status);
    CREATE INDEX IF NOT EXISTS idx_advances_worker ON advances(worker_id);
    CREATE INDEX IF NOT EXISTS idx_advances_site ON advances(site_id, date);

    -- ═══════════════════════════════════════════════════
    -- ACTIVITY LOG (audit trail for every Telegram message)
    -- ═══════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER REFERENCES sites(id),
      source TEXT NOT NULL DEFAULT 'telegram',
      sender_id TEXT,
      sender_name TEXT,
      raw_text TEXT,
      extraction_json TEXT,
      processing_status TEXT DEFAULT 'success' CHECK(processing_status IN ('success','partial','failed','unclear')),
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_activity_site ON activity_log(site_id, created_at);
  `);
}

export default getDb;
