const crypto = require('crypto');
const db = require('../config/db');

// POST /api/auth/register
const register = (req, res) => {
  const { fullName, email, password } = req.body;
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existingUser = db.prepare("SELECT * FROM profiles WHERE email = ?").get(email);
    if (existingUser) return res.status(400).json({ error: 'Email already in use' });

    const result = db.transaction(() => {
      const customerId = `cust-${crypto.randomUUID().split('-')[0]}`;
      const userId = `user-${crypto.randomUUID().split('-')[0]}`;

      // Insert Profile
      db.prepare("INSERT INTO profiles (id, user_id, full_name, email, password) VALUES (?, ?, ?, ?, ?)").run(
        customerId, userId, fullName, email, password // Storing plain text mock for now
      );

      // Create Loyalty Account
      const accId = `acc-${crypto.randomUUID().split('-')[0]}`;
      db.prepare("INSERT INTO loyalty_accounts (id, customer_id, available_points, lifetime_points, current_tier) VALUES (?, ?, 0, 0, 'BRONZE')").run(
        accId, customerId
      );

      return { customerId, fullName, email };
    })();

    res.json({ success: true, user: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/auth/login
const login = (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = db.prepare("SELECT * FROM profiles WHERE email = ?").get(email);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      success: true,
      user: {
        customerId: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  register,
  login
};
