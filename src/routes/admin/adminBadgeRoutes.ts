import express from 'express';
import {
  addBadgeToProduct,
  removeBadgeFromProduct,
  updateBadgeOnProduct,
  bulkAddBadges,
  bulkRemoveBadges,
  getProductsByBadge,
  autoAssignBadges,
} from '../../controllers/badgeController.js';
import { protect, admin } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication and admin middleware to all routes
router.use(protect);
router.use(admin);

// Badge management on specific products
router.post('/products/:productId/badges', addBadgeToProduct);
router.put('/products/:productId/badges/:badgeType', updateBadgeOnProduct);
router.delete('/products/:productId/badges/:badgeType', removeBadgeFromProduct);

// Bulk operations
router.post('/badges/bulk', bulkAddBadges);
router.delete('/badges/bulk', bulkRemoveBadges);

// Auto-assign badges
router.post('/badges/auto-assign', autoAssignBadges);

// Get products by badge
router.get('/badges/:badgeType/products', getProductsByBadge);

export default router;
