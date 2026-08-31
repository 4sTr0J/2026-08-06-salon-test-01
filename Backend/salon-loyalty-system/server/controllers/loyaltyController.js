const crypto = require('crypto');
const db = require('../config/db');
const { getTierInfo } = require('../utils/tier');

// ---------------------------------------------------------
// Utility: Calculate tier from lifetime points
// ---------------------------------------------------------
const calculateTier = (lifetimePoints) => {
  return getTierInfo(lifetimePoints).tier;
};

// ---------------------------------------------------------
// GET /api/loyalty/account/:customerId
// ---------------------------------------------------------
const getAccount = (req, res) => {
  try {
    const account = db.prepare("SELECT * FROM loyalty_accounts WHERE customer_id = ?").get(req.params.customerId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const history = db.prepare("SELECT * FROM reward_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10").all(req.params.customerId);
    const vouchers = db.prepare("SELECT * FROM reward_redemptions WHERE customer_id = ? ORDER BY redeemed_at DESC").all(req.params.customerId);

    res.json({ account, history, vouchers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ---------------------------------------------------------
// GET /api/loyalty/rewards
// ---------------------------------------------------------
const getRewards = (req, res) => {
  try {
    const rewards = db.prepare("SELECT * FROM rewards WHERE is_active = 1").all();
    res.json({ rewards });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ---------------------------------------------------------
// POST /api/loyalty/redeem
// ---------------------------------------------------------
const redeemReward = (req, res) => {
  const { customerId, rewardId } = req.body;

  try {
    const result = db.transaction(() => {
      const account = db.prepare("SELECT * FROM loyalty_accounts WHERE customer_id = ?").get(customerId);
      const reward = db.prepare("SELECT * FROM rewards WHERE id = ?").get(rewardId);

      if (!account || !reward) throw new Error('Invalid account or reward');
      if (account.available_points < reward.points_cost) throw new Error('Insufficient points');

      const newBalance = account.available_points - reward.points_cost;

      // Update balance
      db.prepare("UPDATE loyalty_accounts SET available_points = ? WHERE customer_id = ?").run(newBalance, customerId);

      // Record transaction
      db.prepare("INSERT INTO reward_transactions (id, customer_id, type, points, description) VALUES (?, ?, ?, ?, ?)").run(
        crypto.randomUUID(), customerId, 'REDEEM', -reward.points_cost, `Redeemed: ${reward.title}`
      );

      // Create voucher
      const voucherCode = `STY-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
      db.prepare("INSERT INTO reward_redemptions (id, customer_id, reward_id, points_used, voucher_code) VALUES (?, ?, ?, ?, ?)").run(
        crypto.randomUUID(), customerId, rewardId, reward.points_cost, voucherCode
      );

      return { success: true, newBalance, voucherCode };
    })();

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ---------------------------------------------------------
// POST /api/loyalty/use-voucher
// ---------------------------------------------------------
const useVoucher = (req, res) => {
  const { voucherCode } = req.body;
  try {
    const voucher = db.prepare("SELECT * FROM reward_redemptions WHERE voucher_code = ?").get(voucherCode);
    if (!voucher) throw new Error('Voucher not found');
    if (voucher.status !== 'ACTIVE') throw new Error(`Voucher is already ${voucher.status}`);

    db.prepare("UPDATE reward_redemptions SET status = 'USED' WHERE voucher_code = ?").run(voucherCode);

    res.json({ success: true, message: 'Voucher applied successfully!' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ---------------------------------------------------------
// POST /api/loyalty/earn (For testing purposes)
// ---------------------------------------------------------
const earnPoints = (req, res) => {
  const { customerId, points } = req.body;
  try {
    const result = db.transaction(() => {
      const account = db.prepare("SELECT * FROM loyalty_accounts WHERE customer_id = ?").get(customerId);
      if (!account) throw new Error('Account not found');

      const newAvailable = account.available_points + points;
      const newLifetime = account.lifetime_points + points;
      const newTier = calculateTier(newLifetime);

      db.prepare("UPDATE loyalty_accounts SET available_points = ?, lifetime_points = ?, current_tier = ? WHERE customer_id = ?").run(
        newAvailable, newLifetime, newTier, customerId
      );

      db.prepare("INSERT INTO reward_transactions (id, customer_id, type, points, description) VALUES (?, ?, ?, ?, ?)").run(
        crypto.randomUUID(), customerId, 'EARN', points, `Earned points from salon visit`
      );

      return { success: true, newAvailable, newTier };
    })();
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ---------------------------------------------------------
// POST /api/loyalty/appointment-reward
// ---------------------------------------------------------
const awardAppointmentPoints = (req, res) => {
  const { customerId, points, appointmentId } = req.body;
  try {
    const result = db.transaction(() => {
      // 1. Check if we already awarded points for this appointment
      const existingTx = db.prepare("SELECT * FROM reward_transactions WHERE reference_type = 'APPOINTMENT' AND reference_id = ?").get(appointmentId);
      if (existingTx) {
        return { success: true, message: 'Points already awarded for this appointment', alreadyAwarded: true };
      }

      const account = db.prepare("SELECT * FROM loyalty_accounts WHERE customer_id = ?").get(customerId);
      if (!account) throw new Error('Account not found');

      const newAvailable = account.available_points + points;
      const newLifetime = account.lifetime_points + points;
      const newTier = calculateTier(newLifetime);

      db.prepare("UPDATE loyalty_accounts SET available_points = ?, lifetime_points = ?, current_tier = ? WHERE customer_id = ?").run(
        newAvailable, newLifetime, newTier, customerId
      );

      db.prepare("INSERT INTO reward_transactions (id, customer_id, type, points, description, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        crypto.randomUUID(), customerId, 'EARN', points, `Earned points from appointment booking`, 'APPOINTMENT', appointmentId
      );

      return { success: true, newAvailable, newTier };
    })();
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getAccount,
  getRewards,
  redeemReward,
  useVoucher,
  earnPoints,
  awardAppointmentPoints
};
