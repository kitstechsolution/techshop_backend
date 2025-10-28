import express from 'express';
import {
  getDashboardOverview,
  getSalesMetrics,
  getSalesTrends,
  getRevenueBreakdown,
  getTopProducts,
  getCategoryPerformance,
  getCustomerMetrics,
  getProductAnalytics,
  getLowStockProducts,
  exportSalesReport,
  exportProductsReport,
  exportCustomersReport,
} from '../controllers/adminAnalyticsController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication and admin middleware to all routes
router.use(protect);
router.use(admin);

// Dashboard overview
router.get('/dashboard', getDashboardOverview);

// Sales analytics
router.get('/sales', getSalesMetrics);
router.get('/sales/trends', getSalesTrends);

// Revenue analytics
router.get('/revenue', getRevenueBreakdown);

// Product analytics
router.get('/products/top', getTopProducts);
router.get('/products/:productId', getProductAnalytics);

// Category analytics
router.get('/categories', getCategoryPerformance);

// Customer analytics
router.get('/customers', getCustomerMetrics);

// Inventory analytics
router.get('/inventory/low-stock', getLowStockProducts);

// Export reports (CSV)
router.get('/export/sales', exportSalesReport);
router.get('/export/products', exportProductsReport);
router.get('/export/customers', exportCustomersReport);

export default router;
