import crypto from 'crypto';
import db from '../config/loyaltyDb.js';
import { getTierInfo } from '../utils/tier.js';

const calculateTier = (lifetimePoints) => {
  return getTierInfo(lifetimePoints).tier;
};

export const getAccount = (req, res) => {
  try {
    const identifier = req.params.customerId;
    
    // Find all profiles linked to this user by ID, user_id, or email
    let matchingProfiles = db.prepare("SELECT * FROM profiles WHERE id = ? OR user_id = ? OR (email != '' AND email = ?)").all(identifier, identifier, identifier);
    
    // If the identifier is an ID, also look up its email
    let userEmail = identifier.includes('@') ? identifier : '';
    matchingProfiles.forEach(p => {
      if (p.email && p.email.includes('@')) userEmail = p.email;
    });

    if (userEmail) {
      const emailProfiles = db.prepare("SELECT * FROM profiles WHERE email = ?").all(userEmail);
      emailProfiles.forEach(ep => {
        if (!matchingProfiles.some(p => p.id === ep.id)) {
          matchingProfiles.push(ep);
        }
      });
    }

    const customerIds = new Set([identifier]);
    matchingProfiles.forEach(p => {
      if (p.id) customerIds.add(p.id);
      if (p.user_id) customerIds.add(p.user_id);
    });

    const idList = Array.from(customerIds);
    const placeholders = idList.map(() => '?').join(',');

    let accounts = db.prepare(`SELECT * FROM loyalty_accounts WHERE customer_id IN (${placeholders})`).all(...idList);

    let available_points = 0;
    let lifetime_points = 0;

    accounts.forEach(a => {
      if ((a.available_points || 0) > available_points) available_points = a.available_points;
      if ((a.lifetime_points || 0) > lifetime_points) lifetime_points = a.lifetime_points;
    });

    const current_tier = calculateTier(lifetime_points);

    // Auto-provision if no account exists yet
    if (accounts.length === 0) {
      db.prepare("INSERT OR IGNORE INTO profiles (id, user_id, full_name, email) VALUES (?, ?, ?, ?)").run(
        identifier, identifier, 'Customer', userEmail || 'user@stylepulse.com'
      );
      db.prepare("INSERT OR REPLACE INTO loyalty_accounts (id, customer_id, available_points, lifetime_points, current_tier) VALUES (?, ?, ?, ?, ?)").run(
        crypto.randomUUID(), identifier, 0, 0, 'BRONZE'
      );
    }

    const history = db.prepare(`SELECT * FROM reward_transactions WHERE customer_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 15`).all(...idList);
    const vouchers = db.prepare(`SELECT * FROM reward_redemptions WHERE customer_id IN (${placeholders}) ORDER BY redeemed_at DESC`).all(...idList);

    const account = {
      customer_id: identifier,
      available_points,
      lifetime_points,
      current_tier
    };

    res.json({ account, history, vouchers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getRewards = (req, res) => {
  try {
    const rewards = db.prepare("SELECT * FROM rewards WHERE is_active = 1").all();
    res.json({ rewards });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const redeemReward = (req, res) => {
  const { customerId, rewardId } = req.body;

  try {
    const result = db.transaction(() => {
      const account = db.prepare("SELECT * FROM loyalty_accounts WHERE customer_id = ?").get(customerId);
      const reward = db.prepare("SELECT * FROM rewards WHERE id = ?").get(rewardId);

      if (!account || !reward) throw new Error('Invalid account or reward');
      if (account.available_points < reward.points_cost) throw new Error('Insufficient points');

      const newBalance = account.available_points - reward.points_cost;

      db.prepare("UPDATE loyalty_accounts SET available_points = ? WHERE customer_id = ?").run(newBalance, customerId);

      db.prepare("INSERT INTO reward_transactions (id, customer_id, type, points, description) VALUES (?, ?, ?, ?, ?)").run(
        crypto.randomUUID(), customerId, 'REDEEM', -reward.points_cost, `Redeemed: ${reward.title}`
      );

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

export const useVoucher = (req, res) => {
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

export const earnPoints = (req, res) => {
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

export const awardAppointmentPointsHelper = (customerData, points, appointmentId) => {
  const customerId = typeof customerData === 'string' ? customerData : (customerData.id || customerData.email || 'customer');
  const fullName = typeof customerData === 'string' ? 'Customer' : (customerData.name || customerData.full_name || 'Customer');
  const email = typeof customerData === 'string' ? (customerData.includes('@') ? customerData : '') : (customerData.email || '');

  return db.transaction(() => {
    const existingTx = db.prepare("SELECT * FROM reward_transactions WHERE reference_type = 'APPOINTMENT' AND reference_id = ?").get(appointmentId);
    if (existingTx) {
      return { success: true, message: 'Points already awarded for this appointment', alreadyAwarded: true };
    }

    // 1. Find or create profile by ID or email
    let profile = db.prepare("SELECT * FROM profiles WHERE id = ? OR (email != '' AND email = ?) OR user_id = ?").get(customerId, email, customerId);
    let targetId = customerId;

    if (!profile) {
      db.prepare("INSERT INTO profiles (id, user_id, full_name, email) VALUES (?, ?, ?, ?)").run(
        targetId, targetId, fullName, email
      );
    } else {
      targetId = profile.id;
      if (email && !profile.email) {
        db.prepare("UPDATE profiles SET email = ? WHERE id = ?").run(email, targetId);
      }
    }

    // 2. Find or create loyalty account
    let account = db.prepare("SELECT * FROM loyalty_accounts WHERE customer_id = ?").get(targetId);
    if (!account && email && email !== targetId) {
      account = db.prepare("SELECT * FROM loyalty_accounts WHERE customer_id = ?").get(email);
    }

    if (!account) {
      db.prepare("INSERT INTO loyalty_accounts (id, customer_id, available_points, lifetime_points, current_tier) VALUES (?, ?, ?, ?, ?)").run(
        crypto.randomUUID(), targetId, 0, 0, 'BRONZE'
      );
      account = { customer_id: targetId, available_points: 0, lifetime_points: 0 };
    }

    const newAvailable = (account.available_points || 0) + points;
    const newLifetime = (account.lifetime_points || 0) + points;
    const newTier = calculateTier(newLifetime);

    db.prepare("UPDATE loyalty_accounts SET available_points = ?, lifetime_points = ?, current_tier = ? WHERE customer_id = ?").run(
      newAvailable, newLifetime, newTier, account.customer_id
    );

    // If customerId is different from account.customer_id, also mirror or create linked record
    if (customerId !== account.customer_id) {
      try {
        const altAcc = db.prepare("SELECT * FROM loyalty_accounts WHERE customer_id = ?").get(customerId);
        if (altAcc) {
          db.prepare("UPDATE loyalty_accounts SET available_points = ?, lifetime_points = ?, current_tier = ? WHERE customer_id = ?").run(
            newAvailable, newLifetime, newTier, customerId
          );
        } else {
          // Link alias profile safely
          let altProf = db.prepare("SELECT * FROM profiles WHERE id = ?").get(customerId);
          if (!altProf) {
            db.prepare("INSERT OR IGNORE INTO profiles (id, user_id, full_name, email) VALUES (?, ?, ?, ?)").run(
              customerId, customerId, fullName, email
            );
          }
          db.prepare("INSERT OR REPLACE INTO loyalty_accounts (id, customer_id, available_points, lifetime_points, current_tier) VALUES (?, ?, ?, ?, ?)").run(
            crypto.randomUUID(), customerId, newAvailable, newLifetime, newTier
          );
        }
      } catch (mirrorErr) {
        console.warn('Mirror loyalty record notice:', mirrorErr.message);
      }
    }

    db.prepare("INSERT INTO reward_transactions (id, customer_id, type, points, description, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      crypto.randomUUID(), targetId, 'EARN', points, `Earned points from appointment booking`, 'APPOINTMENT', appointmentId
    );

    return { success: true, newAvailable, newTier, pointsAwarded: points };
  })();
};

export const awardAppointmentPoints = (req, res) => {
  const { customerId, points, appointmentId } = req.body;
  try {
    const result = awardAppointmentPointsHelper(customerId, points, appointmentId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
