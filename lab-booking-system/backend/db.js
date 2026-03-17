const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'lab_booking.db');

let db;

// Save DB to disk
function persist() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Run a write statement and auto-persist
function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

// Get all rows
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// Get single row
function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

// Get last inserted rowid
function lastId() {
  return get('SELECT last_insert_rowid() as id').id;
}

async function init() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT,
      roll_number TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      quantity INTEGER DEFAULT 1,
      available INTEGER DEFAULT 1,
      lab_location TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      equipment_id INTEGER NOT NULL,
      booking_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      purpose TEXT,
      status TEXT DEFAULT 'pending',
      approved_by INTEGER,
      remarks TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  persist();
  seedData();
}

function seedData() {
  const existing = get('SELECT COUNT(*) as count FROM users');
  if (existing.count > 0) return;

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const ins = (n, e, p, r, d, roll) =>
    run('INSERT INTO users (name,email,password,role,department,roll_number) VALUES (?,?,?,?,?,?)',
      [n, e, hash(p), r, d, roll]);

  ins('Admin User',  'sprevanthreddy@gmail.com', 'admin123', 'admin', 'Administration', null);
  ins('Dr. Smith',   'faculty@lab.edu', 'faculty123', 'faculty', 'Computer Science', null);
  ins('John Doe',    'student@lab.edu', 'student123', 'student', 'Computer Science', 'CS2021001');

  const eq = (n, c, d, q, l) =>
    run('INSERT INTO equipment (name,category,description,quantity,available,lab_location) VALUES (?,?,?,?,?,?)',
      [n, c, d, q, q, l]);

  eq('Oscilloscope',     'Electronics', 'Digital oscilloscope for signal analysis',        5,  'Lab 101');
  eq('Multimeter',       'Electronics', 'Digital multimeter for voltage/current',          10, 'Lab 101');
  eq('Microscope',       'Biology',     'Compound light microscope',                       8,  'Lab 202');
  eq('Centrifuge',       'Biology',     'High-speed centrifuge machine',                   3,  'Lab 202');
  eq('Spectrum Analyzer','Physics',     'RF spectrum analyzer',                            2,  'Lab 303');
  eq('3D Printer',       'Engineering', 'FDM 3D printer',                                  4,  'Lab 104');
  eq('Soldering Station','Electronics', 'Temperature-controlled soldering station',        15, 'Lab 101');
  eq('Arduino Kit',      'Electronics', 'Arduino Uno starter kit with components',         20, 'Lab 105');
}

module.exports = { init, run, all, get, lastId, persist };
