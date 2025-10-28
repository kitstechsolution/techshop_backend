import express from 'express';
import {
  getInventoryOverview,
  updateProductStock,
  getProductInventoryHistory,
  getAllAlerts,
  acknowledgeInventoryAlert,
  getInventoryStats,
  bulkAdjustStock,
  getLowStockProducts,
  getOutOfStockProducts,
  getInventoryValueReport,
} from '../../controllers/admin/adminInventoryController.js';
import { protect, admin } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication and admin middleware to all routes
router.use(protect);
router.use(admin);

// Statistics and reports (must be before :id routes)
router.get('/stats', getInventoryStats);
router.get('/low-stock', getLowStockProducts);
router.get('/out-of-stock', getOutOfStockProducts);
router.get('/value-report', getInventoryValueReport);

// Alerts (must be before :id routes)
router.get('/alerts', getAllAlerts);
router.patch('/alerts/:alertId/acknowledge', acknowledgeInventoryAlert);

// Bulk operations (must be before :id routes)
router.post('/bulk-adjust', bulkAdjustStock);

// Get inventory overview
router.get('/', getInventoryOverview);

// Product-specific inventory operations
router.patch('/:productId/stock', updateProductStock);
router.get('/:productId/history', getProductInventoryHistory);

export default router;
