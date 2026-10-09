import { getDb } from './database.js';

/**
 * Seeds the database with demo data for testing
 */
export function seedDatabase() {
  const db = getDb();

  // Check if already seeded
  const existing = db.prepare('SELECT COUNT(*) as count FROM sites').get();
  if (existing.count > 0) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  console.log('🌱 Seeding database...');

  // ── Sites ──
  const insertSite = db.prepare(`
    INSERT INTO sites (name, location, owner_phone, supervisor_phone, status) VALUES (?, ?, ?, ?, ?)
  `);
  insertSite.run('Sunrise Residency', 'Baner, Pune', '919876543210', '919123456789', 'active');
  insertSite.run('Green Valley Villas', 'Wakad, Pune', '919876543210', '919234567890', 'active');
  insertSite.run('Metro Mall Phase-2', 'Hinjewadi, Pune', '919876543210', '919345678901', 'active');

  // ── Material Types ──
  const insertMaterial = db.prepare(`
    INSERT INTO material_types (name, unit, low_stock_threshold) VALUES (?, ?, ?)
  `);
  const materials = [
    ['Cement (OPC 53)', 'bags', 20],
    ['Cement (PPC)', 'bags', 20],
    ['TMT Steel 8mm', 'kg', 200],
    ['TMT Steel 10mm', 'kg', 200],
    ['TMT Steel 12mm', 'kg', 200],
    ['TMT Steel 16mm', 'kg', 150],
    ['River Sand', 'brass', 2],
    ['M-Sand', 'brass', 2],
    ['Crush (20mm)', 'brass', 2],
    ['Crush (40mm)', 'brass', 2],
    ['Bricks (Red)', 'nos', 500],
    ['AAC Blocks', 'nos', 200],
    ['Water', 'litres', 500],
    ['Binding Wire', 'kg', 20],
    ['Plywood (shuttering)', 'sheets', 10],
    ['Nails', 'kg', 5],
    ['PVC Pipes 4"', 'nos', 10],
    ['Electrical Wire', 'meters', 100],
    ['Paint (Primer)', 'litres', 20],
    ['Paint (Exterior)', 'litres', 20],
  ];
  materials.forEach(m => insertMaterial.run(...m));

  // ── Workers for Site 1 (Sunrise Residency) ──
  const insertWorker = db.prepare(`
    INSERT INTO workers (site_id, name, phone, role, daily_wage) VALUES (?, ?, ?, ?, ?)
  `);
  const site1Workers = [
    [1, 'Rajesh Kumar', '919111000001', 'mason', 800],
    [1, 'Suresh Yadav', '919111000002', 'mason', 800],
    [1, 'Manoj Singh', '919111000003', 'mason', 850],
    [1, 'Dinesh Patel', '919111000004', 'mason', 800],
    [1, 'Ramesh Sharma', '919111000005', 'carpenter', 900],
    [1, 'Ganesh Tiwari', '919111000006', 'carpenter', 900],
    [1, 'Mukesh Verma', '919111000007', 'carpenter', 850],
    [1, 'Sunil Gupta', '919111000008', 'plumber', 750],
    [1, 'Anil Mishra', '919111000009', 'electrician', 800],
    [1, 'Vijay Chauhan', '919111000010', 'electrician', 800],
    [1, 'Pappu Mandal', '919111000011', 'helper', 500],
    [1, 'Raju Paswan', '919111000012', 'helper', 500],
    [1, 'Mohan Das', '919111000013', 'helper', 500],
    [1, 'Sohan Lal', '919111000014', 'helper', 500],
    [1, 'Babu Ram', '919111000015', 'helper', 450],
    [1, 'Chotu Prasad', '919111000016', 'helper', 450],
    [1, 'Laxman Kewat', '919111000017', 'helper', 450],
    [1, 'Birju Thakur', '919111000018', 'helper', 500],
    [1, 'Kallu Nishad', '919111000019', 'helper', 450],
    [1, 'Munna Bind', '919111000020', 'helper', 450],
    [1, 'Shankar Pal', '919111000021', 'welder', 750],
    [1, 'Rakesh Kumhar', '919111000022', 'mason', 800],
    [1, 'Deepak Rawat', '919111000023', 'painter', 700],
    [1, 'Ashok Nai', '919111000024', 'helper', 450],
    [1, 'Pramod Kori', '919111000025', 'helper', 450],
    [1, 'Santosh Ahir', '919111000026', 'mason', 800],
    [1, 'Gopal Lodhi', '919111000027', 'carpenter', 850],
    [1, 'Hari Om', '919111000028', 'helper', 450],
    [1, 'Jagdish Sahu', '919111000029', 'plumber', 750],
    [1, 'Kishan Meena', '919111000030', 'helper', 500],
  ];
  site1Workers.forEach(w => insertWorker.run(...w));

  // ── Register supervisor session ──
  const insertSession = db.prepare(`
    INSERT INTO wa_sessions (phone, site_id, role) VALUES (?, ?, ?)
  `);
  insertSession.run('919123456789', 1, 'supervisor');
  insertSession.run('919876543210', null, 'owner');

  // ── Seed some petty cash ──
  const insertPettyCash = db.prepare(`
    INSERT INTO petty_cash (site_id, type, amount, category, description, date, logged_by) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertPettyCash.run(1, 'credit', 25000, 'fund_transfer', 'Monthly petty cash allocation', '2026-10-01', 'owner');
  insertPettyCash.run(1, 'debit', 350, 'tea_snacks', 'Tea & biscuits for workers', '2026-10-02', 'supervisor');
  insertPettyCash.run(1, 'debit', 1200, 'transport', 'Auto for material pickup', '2026-10-03', 'supervisor');
  insertPettyCash.run(1, 'debit', 800, 'hardware', 'Emergency nails & binding wire', '2026-10-04', 'supervisor');
  insertPettyCash.run(1, 'debit', 500, 'tea_snacks', 'Worker lunch allowance', '2026-10-05', 'supervisor');

  // ── Seed some GRN entries for inventory ──
  const insertGRN = db.prepare(`
    INSERT INTO grn (site_id, material_type_id, quantity_received, vendor_name, invoice_amount, quality_status, received_by, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertGRN.run(1, 1, 100, 'Ambuja Cement Dealer', 38000, 'accepted', 'supervisor', '2026-10-01');
  insertGRN.run(1, 3, 500, 'Tata Steel Distributor', 27500, 'accepted', 'supervisor', '2026-10-01');
  insertGRN.run(1, 7, 5, 'Local Sand Supplier', 35000, 'accepted', 'supervisor', '2026-10-02');
  insertGRN.run(1, 11, 2000, 'Brick Kiln - Wagholi', 14000, 'accepted', 'supervisor', '2026-10-03');
  insertGRN.run(1, 14, 50, 'Hardware Store', 4500, 'accepted', 'supervisor', '2026-10-03');

  // ── Seed consumption ──
  const insertConsumption = db.prepare(`
    INSERT INTO consumption (site_id, material_type_id, quantity_used, date, logged_by) VALUES (?, ?, ?, ?, ?)
  `);
  insertConsumption.run(1, 1, 15, '2026-10-02', 'supervisor');
  insertConsumption.run(1, 1, 18, '2026-10-03', 'supervisor');
  insertConsumption.run(1, 1, 12, '2026-10-04', 'supervisor');
  insertConsumption.run(1, 1, 20, '2026-10-05', 'supervisor');
  insertConsumption.run(1, 3, 80, '2026-10-02', 'supervisor');
  insertConsumption.run(1, 3, 95, '2026-10-03', 'supervisor');
  insertConsumption.run(1, 7, 0.8, '2026-10-03', 'supervisor');
  insertConsumption.run(1, 7, 1.0, '2026-10-04', 'supervisor');
  insertConsumption.run(1, 11, 350, '2026-10-03', 'supervisor');
  insertConsumption.run(1, 11, 400, '2026-10-04', 'supervisor');

  // ── Seed some attendance ──
  const insertAttendance = db.prepare(`
    INSERT INTO attendance (site_id, worker_id, date, status, marked_by) VALUES (?, ?, ?, ?, ?)
  `);
  const statuses = ['present', 'present', 'present', 'present', 'half_day', 'absent'];
  for (let day = 2; day <= 7; day++) {
    const date = `2026-10-0${day}`;
    for (let wid = 1; wid <= 30; wid++) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      insertAttendance.run(1, wid, date, status, 'supervisor');
    }
  }

  // ── Subcontractors ──
  const insertSub = db.prepare(`
    INSERT INTO subcontractors (site_id, name, phone, trade, rate_type, rate) VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertSub.run(1, 'Imran Tiling Works', '919555000001', 'Tiling', 'per_sqft', 45);
  insertSub.run(1, 'Sharma Waterproofing', '919555000002', 'Waterproofing', 'per_sqft', 35);
  insertSub.run(1, 'Patil Fabrication', '919555000003', 'MS Fabrication', 'per_unit', 1500);

  console.log('✅ Database seeded successfully!');
}

// Run directly
seedDatabase();
