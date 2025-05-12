import express from 'express';
import { 
  getDashboardStats, 
  getAllUsers, 
  getUserById,
  updateUserRole,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  getPaymentSettings,
  updatePaymentSettings
} from '../controllers/adminController.js';
import { 
  getShippingConfig,
  updateShippingConfig,
  testShippingConnection,
  getShippingAnalytics
} from '../controllers/adminShippingController.js';
import { adminAuth } from '../middleware/auth.js';

const router = express.Router();

// All routes in this file are protected by adminAuth middleware
router.use(adminAuth);

// Dashboard
router.get('/dashboard', getDashboardStats);

// User management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id/role', updateUserRole);

// Product management
router.post('/products', createProduct);
router.patch('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

// Order management
router.get('/orders', getAllOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/status', updateOrderStatus);

// Payment settings
router.get('/payment-settings', getPaymentSettings);
router.post('/payment-settings', updatePaymentSettings);

// Shipping configuration
router.get('/shipping/config', getShippingConfig);
router.put('/shipping/config', updateShippingConfig);
router.post('/shipping/test-connection/:providerId', testShippingConnection);
router.get('/shipping/analytics', getShippingAnalytics);

export default router; 