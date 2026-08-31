const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'database.sqlite'));

// Enable Foreign Keys
db.pragma('foreign_keys = ON');

// Init Schema
const initDb = () => {
  // Try to patch missing columns if tables were created in earlier draft
  try {
    db.exec(`ALTER TABLE reward_transactions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;`);
  } catch (err) {}
  
  try {
    db.exec(`ALTER TABLE profiles ADD COLUMN password TEXT;`);
  } catch (err) {}

  // Profiles
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

  // Loyalty Accounts
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

  // Transactions
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

  // Rewards
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

  // Redemptions
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

// Seed initial demonstration data
const seedData = () => {
  const profileCount = db.prepare("SELECT COUNT(*) as count FROM profiles").get();
  if (profileCount.count === 0) {
    const customerId = 'cust-123';
    db.prepare("INSERT INTO profiles (id, user_id, full_name, email) VALUES (?, ?, ?, ?)").run(customerId, 'user-123', 'John Doe', 'john@example.com');
    db.prepare("INSERT INTO loyalty_accounts (id, customer_id, available_points, lifetime_points, current_tier) VALUES (?, ?, ?, ?, ?)").run('acc-123', customerId, 1250, 2500, 'GOLD');

    const insertReward = db.prepare("INSERT INTO rewards (id, title, description, points_cost, reward_type, reward_value, minimum_tier) VALUES (?, ?, ?, ?, ?, ?, ?)");
    insertReward.run('rew-1', 'LKR 5.00 OFF', 'Get LKR 5.00 off your next appointment', 500, 'FIXED_DISCOUNT', 5, 'BRONZE');
    insertReward.run('rew-2', 'LKR 10.00 OFF', 'Get LKR 10.00 off your next appointment', 1000, 'FIXED_DISCOUNT', 10, 'BRONZE');
    insertReward.run('rew-3', 'LKR 50.00 OFF', 'Get LKR 50.00 off your next appointment', 5000, 'FIXED_DISCOUNT', 50, 'SILVER');
    insertReward.run('rew-4', 'LKR 100.00 OFF', 'Get LKR 100.00 off your next appointment', 10000, 'FIXED_DISCOUNT', 100, 'GOLD');
  }
};

initDb();
seedData();

module.exports = db;
