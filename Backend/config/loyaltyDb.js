import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store database in the main Backend directory
const db = new Database(path.join(__dirname, '..', 'loyalty_database.sqlite'));

// Enable Foreign Keys
db.pragma('foreign_keys = ON');

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
