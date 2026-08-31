const express = require('express');
const router = express.Router();
const loyaltyController = require('../controllers/loyaltyController');

// Customer endpoints
router.get('/account/:customerId', loyaltyController.getAccount);
router.get('/rewards', loyaltyController.getRewards);
router.post('/redeem', loyaltyController.redeemReward);
router.post('/use-voucher', loyaltyController.useVoucher);
router.post('/earn', loyaltyController.earnPoints);
router.post('/appointment-reward', loyaltyController.awardAppointmentPoints);

module.exports = router;
