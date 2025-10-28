import express from 'express';
import {
  getAllTiers,
  createTier,
  updateTier,
  deleteTier,
  getAllRewards,
  createReward,
  updateReward,
  deleteReward,
  getAllUserLoyalty,
  getUserLoyalty,
  adjustUserPoints,
  awardBonusPoints,
  getLoyaltyStatistics,
} from '../../controllers/adminLoyaltyController.js';
import { protect, admin } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication and admin middleware to all routes
router.use(protect);
router.use(admin);

// Tier management
router.get('/tiers', getAllTiers);
router.post('/tiers', createTier);
router.put('/tiers/:tierId', updateTier);
router.delete('/tiers/:tierId', deleteTier);

// Reward management
router.get('/rewards', getAllRewards);
router.post('/rewards', createReward);
router.put('/rewards/:rewardId', updateReward);
router.delete('/rewards/:rewardId', deleteReward);

// User management
router.get('/users', getAllUserLoyalty);
router.get('/users/:userId', getUserLoyalty);
router.post('/users/:userId/adjust-points', adjustUserPoints);
router.post('/users/:userId/bonus', awardBonusPoints);

// Statistics
router.get('/statistics', getLoyaltyStatistics);

export default router;
