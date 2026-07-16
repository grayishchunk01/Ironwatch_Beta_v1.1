const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'ironwatch.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('admin','viewer')),
  display_role  TEXT NOT NULL DEFAULT '',
  access_label  TEXT NOT NULL DEFAULT '',
  last_login    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  collection  TEXT NOT NULL,
  ref_id      TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  payload     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(collection, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_records_collection ON records(collection, position);
`);

// Every collection the frontend dashboard reads/writes as part of its "db" blob.
const COLLECTIONS = [
  'machines', 'operators', 'mechanics', 'repairs', 'partsEta',
  'purchaseHistory', 'partsLayout', 'logons', 'fieldFeed', 'workshopFeed',
];

// ---------------------------------------------------------------------------
// Default seed data (mirrors the original demo data baked into index.html,
// so the app looks the same on first run but the data now genuinely lives
// server-side in SQLite instead of being hardcoded in the browser).
// ---------------------------------------------------------------------------
function defaultData() {
  return {
    machines: [
      { id: 'EX-204', type: 'Excavator · CAT 336', status: 'Active', hours: 9124, dest: 'Site Bravo — Pit 3', operator: 'T. Ngcobo', fuel: 78 },
      { id: 'DZ-112', type: 'Dozer · Komatsu D65', status: 'Active', hours: 6210, dest: 'Site Alpha — Haul Rd', operator: 'M. van Wyk', fuel: 54 },
      { id: 'HL-330', type: 'Haul Truck · Cat 773', status: 'In Repair', hours: 14802, dest: 'Workshop Bay 2', operator: '—', fuel: 12 },
      { id: 'GR-018', type: 'Grader · Cat 140M', status: 'Active', hours: 5310, dest: 'Site Charlie — Access Rd', operator: 'S. Dlamini', fuel: 61 },
      { id: 'LD-402', type: 'Wheel Loader · Volvo L120', status: 'Idle', hours: 8890, dest: 'Yard — Parked', operator: '—', fuel: 90 },
      { id: 'EX-207', type: 'Excavator · Komatsu PC210', status: 'Active', hours: 3012, dest: 'Site Bravo — Pit 1', operator: 'J. Botha', fuel: 44 },
      { id: 'DT-501', type: 'Dump Truck · CAT 745', status: 'Breakdown', hours: 11290, dest: 'Site Alpha — Ramp 4', operator: 'K. Mokoena', fuel: 8 },
      { id: 'DZ-115', type: 'Dozer · Cat D8T', status: 'Active', hours: 7654, dest: 'Site Charlie — Bench 2', operator: 'R. Naidoo', fuel: 67 },
    ],
    operators: [
      { name: 'T. Ngcobo', role: 'Excavator Operator', machine: 'EX-204', shift: 'Day', license: 'EO-3312', years: 6 },
      { name: 'M. van Wyk', role: 'Dozer Operator', machine: 'DZ-112', shift: 'Day', license: 'EO-2201', years: 11 },
      { name: 'S. Dlamini', role: 'Grader Operator', machine: 'GR-018', shift: 'Night', license: 'EO-4410', years: 4 },
      { name: 'J. Botha', role: 'Excavator Operator', machine: 'EX-207', shift: 'Day', license: 'EO-3399', years: 3 },
      { name: 'K. Mokoena', role: 'Haul Truck Driver', machine: 'DT-501', shift: 'Night', license: 'EO-1187', years: 8 },
      { name: 'R. Naidoo', role: 'Dozer Operator', machine: 'DZ-115', shift: 'Day', license: 'EO-2790', years: 9 },
    ],
    mechanics: [
      { name: 'P. Fourie', spec: 'Hydraulics', jobs: 'HL-330 brake system', status: 'On Job' },
      { name: 'A. Kekana', spec: 'Engine & Drivetrain', jobs: 'DT-501 field breakdown', status: 'Dispatched' },
      { name: 'L. Steyn', spec: 'Electrical', jobs: 'GR-018 sensor fault (queued)', status: 'Available' },
      { name: 'B. Mahlangu', spec: 'Undercarriage', jobs: 'LD-402 track inspection', status: 'On Job' },
      { name: 'C. Reyneke', spec: 'General Diesel', jobs: '', status: 'Available' },
    ],
    repairs: [
      { machine: 'HL-330', issue: 'Brake accumulator failure', bay: 'Bay 2', mechanic: 'P. Fourie', status: 'In Progress', priority: 'High', eta: 'Today 16:30' },
      { machine: 'GR-018', issue: 'Blade angle sensor fault', bay: 'Bay 4', mechanic: 'L. Steyn', status: 'Queued', priority: 'Medium', eta: 'Tomorrow 09:00' },
      { machine: 'LD-402', issue: 'Track tension inspection', bay: 'Bay 1', mechanic: 'B. Mahlangu', status: 'In Progress', priority: 'Low', eta: 'Today 14:00' },
      { machine: 'EX-207', issue: 'Hydraulic hose weep, boom cyl', bay: 'Bay 3', mechanic: '—', status: 'Awaiting Parts', priority: 'Medium', eta: 'Fri 11:00' },
      { machine: 'DT-501', issue: 'Engine overheat — field breakdown', bay: 'Field / Site Alpha', mechanic: 'A. Kekana', status: 'Dispatched', priority: 'Critical', eta: 'ETA on site 40 min' },
    ],
    partsEta: [
      { part: 'Hydraulic hose assy — boom cyl', machine: 'EX-207', supplier: 'Barloworld Cat', eta: 'Fri, 2 days', status: 'In Transit' },
      { part: 'Brake accumulator kit', machine: 'HL-330', supplier: 'Cat Parts Dist.', eta: 'Today, 4 hrs', status: 'Dispatched' },
      { part: 'Blade angle sensor', machine: 'GR-018', supplier: 'Komatsu SA', eta: 'Mon, 5 days', status: 'Ordered' },
      { part: 'Track shoe set (x2)', machine: 'LD-402', supplier: 'Volvo CE Parts', eta: 'In Stock', status: 'Available' },
      { part: 'Radiator core', machine: 'DT-501', supplier: 'Cat Parts Dist.', eta: 'Wed, 3 days', status: 'Ordered' },
    ],
    purchaseHistory: [
      { asset: 'EX-204', desc: 'CAT 336 Excavator', date: '2022-03-11', vendor: 'Barloworld Equipment', value: 'R 4,820,000' },
      { asset: 'DZ-112', desc: 'Komatsu D65 Dozer', date: '2021-08-02', vendor: 'Komatsu SA', value: 'R 3,150,000' },
      { asset: 'HL-330', desc: 'Cat 773 Haul Truck', date: '2020-11-19', vendor: 'Barloworld Equipment', value: 'R 6,940,000' },
      { asset: 'GR-018', desc: 'Cat 140M Grader', date: '2023-01-27', vendor: 'Barloworld Equipment', value: 'R 2,410,000' },
      { asset: 'LD-402', desc: 'Volvo L120 Loader', date: '2019-06-05', vendor: 'Volvo CE Dealer', value: 'R 1,980,000' },
      { asset: 'DT-501', desc: 'Cat 745 Dump Truck', date: '2022-09-30', vendor: 'Barloworld Equipment', value: 'R 5,330,000' },
      { asset: 'DZ-115', desc: 'Cat D8T Dozer', date: '2021-02-14', vendor: 'Barloworld Equipment', value: 'R 5,870,000' },
    ],
    partsLayout: [
      { code: 'A1', label: 'Filters', level: 'ok' }, { code: 'A2', label: 'Hydraulic Hose', level: 'mid' },
      { code: 'A3', label: 'Belts', level: 'ok' }, { code: 'A4', label: 'Undercarriage', level: 'low' },
      { code: 'B1', label: 'Engine Parts', level: 'ok' }, { code: 'B2', label: 'Electrical', level: 'mid' },
      { code: 'B3', label: 'Bearings', level: 'ok' }, { code: 'B4', label: 'Seals & Gaskets', level: 'low' },
      { code: 'C1', label: 'Brake Components', level: 'mid' }, { code: 'C2', label: 'Tyres & Tracks', level: 'ok' },
      { code: 'C3', label: 'Fluids & Lube', level: 'ok' }, { code: 'C4', label: 'Cabin/Glass', level: 'ok' },
      { code: 'D1', label: 'Fasteners', level: 'ok' }, { code: 'D2', label: 'Sensors', level: 'low' },
      { code: 'D3', label: 'Radiators', level: 'mid' }, { code: 'D4', label: 'PPE & Consumables', level: 'ok' },
    ],
    logons: [
      { user: 'admin', role: 'System Administrator', access: 'Full Access', last: 'Active now' },
      { user: 'p.fourie', role: 'Mechanic — Hydraulics', access: 'Workshop', last: 'Today 09:04' },
      { user: 'a.kekana', role: 'Mechanic — Engine', access: 'Workshop + Field', last: 'Today 08:15' },
      { user: 't.ngcobo', role: 'Operator — Excavator', access: 'Operator App', last: 'Today 06:40' },
      { user: 'foreman.site.a', role: 'Site Foreman', access: 'Fleet + Repairs (view)', last: 'Yesterday 17:20' },
    ],
    fieldFeed: [
      { t: '08:12', color: 'red', text: '<b>DT-501</b> reported engine overheat at Site Alpha — Ramp 4', sub: 'Mechanic A. Kekana dispatched' },
      { t: '07:44', color: 'orange', text: '<b>GR-018</b> blade sensor intermittent fault flagged by operator', sub: 'Logged for workshop queue' },
    ],
    workshopFeed: [
      { t: '09:02', color: 'orange', text: '<b>HL-330</b> brake accumulator removed for inspection — Bay 2', sub: 'P. Fourie' },
      { t: '08:20', color: 'green', text: '<b>LD-402</b> track tension check completed, within spec', sub: 'B. Mahlangu' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Seeding — only runs the first time (when tables are empty)
// ---------------------------------------------------------------------------
function seedIfEmpty() {
  const recordCount = db.prepare('SELECT COUNT(*) AS n FROM records').get().n;
  if (recordCount === 0) {
    const data = defaultData();
    const insert = db.prepare(
      'INSERT INTO records (collection, ref_id, position, payload) VALUES (?,?,?,?)'
    );
    const insertMany = db.transaction((collections) => {
      for (const [collection, items] of Object.entries(collections)) {
        items.forEach((item, i) => {
          insert.run(collection, `seed-${collection}-${i + 1}`, i, JSON.stringify(item));
        });
      }
    });
    insertMany(data);
    console.log('[db] seeded default IronWatch demo data');
  }

  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount === 0) {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'workshop2026';
    const viewerPass = process.env.VIEWER_DEFAULT_PASSWORD || 'view2026';

    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, role, display_role, access_label)
      VALUES (?,?,?,?,?)
    `);

    insertUser.run(adminUser, bcrypt.hashSync(adminPass, 10), 'admin', 'System Administrator', 'Full Access');

    const viewers = [
      ['p.fourie', 'Mechanic — Hydraulics', 'Workshop'],
      ['a.kekana', 'Mechanic — Engine', 'Workshop + Field'],
      ['t.ngcobo', 'Operator — Excavator', 'Operator App'],
      ['foreman.site.a', 'Site Foreman', 'Fleet + Repairs (view)'],
    ];
    for (const [username, displayRole, access] of viewers) {
      insertUser.run(username, bcrypt.hashSync(viewerPass, 10), 'viewer', displayRole, access);
    }
    console.log(`[db] seeded ${1 + viewers.length} user accounts (admin: "${adminUser}")`);
    if (adminPass === 'workshop2026' || viewerPass === 'view2026') {
      console.warn('[db] WARNING: you are using default demo passwords. Change them via the API before exposing this server to anyone else.');
    }
  }
}

module.exports = { db, COLLECTIONS, seedIfEmpty };
