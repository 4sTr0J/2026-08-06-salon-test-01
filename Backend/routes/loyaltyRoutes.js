import express from 'express';
import * as loyaltyController from '../controllers/loyaltyController.js';

const router = express.Router();

router.get('/account/:customerId', loyaltyController.getAccount);
router.get('/rewards', loyaltyController.getRewards);
router.post('/redeem', loyaltyController.redeemReward);
router.post('/use-voucher', loyaltyController.useVoucher);
router.post('/earn', loyaltyController.earnPoints);
router.post('/appointment-reward', loyaltyController.awardAppointmentPoints);

export default router;
