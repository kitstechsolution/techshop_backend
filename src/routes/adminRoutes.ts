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
import {
  getPendingReviews,
  approveReview,
  rejectReview,
  deleteReview
} from '../controllers/admin/adminReviewController.js';
import {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  getCouponUsage
} from '../controllers/couponController.js';
import {
  getAllCancelRequests,
  getAllRefundRequests,
  approveCancelRequest,
  rejectCancelRequest,
  approveRefundRequest,
  rejectRefundRequest,
  completeRefund,
  updateReturnStatus
} from '../controllers/adminCancelRefundController.js';
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

// Review moderation
router.get('/reviews/pending', getPendingReviews);
router.patch('/reviews/:productId/:reviewId/approve', approveReview);
router.patch('/reviews/:productId/:reviewId/reject', rejectReview);
router.delete('/reviews/:productId/:reviewId', deleteReview);

// Coupon management
router.post('/coupons', createCoupon);
router.get('/coupons', getAllCoupons);
router.get('/coupons/:id', getCouponById);
router.patch('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);
router.get('/coupons/:id/usage', getCouponUsage);

// Cancel request management
router.get('/cancel-requests', getAllCancelRequests);
router.patch('/cancel-requests/:id/approve', approveCancelRequest);
router.patch('/cancel-requests/:id/reject', rejectCancelRequest);

// Refund request management
router.get('/refund-requests', getAllRefundRequests);
router.patch('/refund-requests/:id/approve', approveRefundRequest);
router.patch('/refund-requests/:id/reject', rejectRefundRequest);
router.patch('/refund-requests/:id/complete', completeRefund);
router.patch('/refund-requests/:id/return-status', updateReturnStatus);

export default router;
