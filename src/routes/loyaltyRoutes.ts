import express from 'express';
import {
  getMyLoyaltyAccount,
  getLoyaltyTiers,
  getMyTransactions,
  getAvailableRewards,
  redeemReward,
  getMyRedemptions,
} from '../controllers/loyaltyController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/tiers', getLoyaltyTiers);

// Protected routes (require authentication)
router.use(protect);

router.get('/account', getMyLoyaltyAccount);
router.get('/transactions', getMyTransactions);
router.get('/rewards', getAvailableRewards);
router.post('/rewards/:rewardId/redeem', redeemReward);
router.get('/redemptions', getMyRedemptions);

export default router;
