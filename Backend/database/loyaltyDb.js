import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store database in the database directory
const dbPath = path.join(__dirname, 'loyalty_database.sqlite');
const rawDb = new DatabaseSync(dbPath);

// Enable Foreign Keys
rawDb.exec('PRAGMA foreign_keys = ON;');

// Create a convenient wrapper that matches better-sqlite3 API
const db = {
  exec: (sql) => rawDb.exec(sql),
  pragma: (sql) => rawDb.exec(`PRAGMA ${sql};`),
  prepare: (sql) => {
    const stmt = rawDb.prepare(sql);
    return {
      get: (...params) => stmt.get(...params),
      all: (...params) => stmt.all(...params),
      run: (...params) => stmt.run(...params)
    };
  },
  transaction: (fn) => {
    return (...args) => {
      rawDb.exec('BEGIN TRANSACTION;');
      try {
        const result = fn(...args);
        rawDb.exec('COMMIT;');
        return result;
      } catch (err) {
        rawDb.exec('ROLLBACK;');
        throw err;
      }
    };
  }
};

// Init Schema
const initDb = () => {
  try {
    db.exec(`ALTER TABLE reward_transactions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;`);
  } catch (err) {}
  
  try {
    db.exec(`ALTER TABLE profiles ADD COLUMN password TEXT;`);
  } catch (err) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE,
      full_name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      phone TEXT,
      role TEXT DEFAULT 'CUSTOMER',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS loyalty_accounts (
      id TEXT PRIMARY KEY,
      customer_id TEXT UNIQUE,
      available_points INTEGER DEFAULT 0,
      lifetime_points INTEGER DEFAULT 0,
      current_tier TEXT DEFAULT 'BRONZE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES profiles(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reward_transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      type TEXT,
      points INTEGER,
      description TEXT,
      reference_type TEXT,
      reference_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES profiles(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS rewards (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      points_cost INTEGER,
      reward_type TEXT,
      reward_value INTEGER,
      minimum_tier TEXT DEFAULT 'BRONZE',
      expiration_days INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reward_redemptions (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      reward_id TEXT,
      points_used INTEGER,
      voucher_code TEXT UNIQUE,
      status TEXT DEFAULT 'ACTIVE',
      expires_at DATETIME,
      redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES profiles(id),
      FOREIGN KEY(reward_id) REFERENCES rewards(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS late_arrival_notifications (
      id TEXT PRIMARY KEY,
      appointment_id TEXT UNIQUE,
      salon_id TEXT,
      customer_name TEXT,
      customer_email TEXT,
      delay_minutes INTEGER,
      note TEXT,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS appointment_reschedules (
      id TEXT PRIMARY KEY,
      appointment_id TEXT,
      customer_email TEXT,
      previous_date TEXT,
      previous_time TEXT,
      new_date TEXT,
      new_time TEXT,
      reschedule_count INTEGER DEFAULT 1,
      fee_charged REAL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

const seedData = () => {
  const profileCount = db.prepare("SELECT COUNT(*) as count FROM profiles").get();
  if (profileCount.count === 0) {
    const customerId = 'cust-123';
    db.prepare("INSERT INTO profiles (id, user_id, full_name, email) VALUES (?, ?, ?, ?)").run(customerId, 'user-123', 'John Doe', 'john@example.com');
    db.prepare("INSERT INTO loyalty_accounts (id, customer_id, available_points, lifetime_points, current_tier) VALUES (?, ?, ?, ?, ?)").run('acc-1', customerId, 1200, 1200, 'BRONZE');
    db.prepare("INSERT INTO rewards (id, title, description, points_cost, reward_type, reward_value) VALUES (?, ?, ?, ?, ?, ?)").run(
      'rew-1', 'LKR 5.00 OFF', 'Get LKR 5.00 off your next appointment', 500, 'FIXED_DISCOUNT', 5
    );
    db.prepare("INSERT INTO rewards (id, title, description, points_cost, reward_type, reward_value) VALUES (?, ?, ?, ?, ?, ?)").run(
      'rew-2', 'LKR 10.00 OFF', 'Get LKR 10.00 off your next appointment', 1000, 'FIXED_DISCOUNT', 10
    );
    db.prepare("INSERT INTO rewards (id, title, description, points_cost, reward_type, reward_value) VALUES (?, ?, ?, ?, ?, ?)").run(
      'rew-3', 'LKR 50.00 OFF', 'Get LKR 50.00 off your next appointment', 5000, 'FIXED_DISCOUNT', 50
    );
    db.prepare("INSERT INTO rewards (id, title, description, points_cost, reward_type, reward_value) VALUES (?, ?, ?, ?, ?, ?)").run(
      'rew-4', 'LKR 100.00 OFF', 'Get LKR 100.00 off your next appointment', 10000, 'FIXED_DISCOUNT', 100
    );
  }
};

initDb();
seedData();

export default db;
