import express from 'express';
import { 
  getUserOrders, 
  getUserOrderById, 
  createOrder, 
  getOrderPaymentStatus, 
  completeOrderPayment,
  cancelOrder,
  getOrderStats,
  downloadInvoice,
  trackOrder,
  reorder,
  requestReturn
} from '../controllers/orderController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// All routes in this file are protected by auth middleware (user must be logged in)
router.use(auth);

// Get all orders for the current user
router.get('/', getUserOrders);

// Get order statistics for the current user
router.get('/stats/summary', getOrderStats);

// Create a new order
router.post('/', createOrder);

// Get a specific order by ID for the current user
router.get('/:id', getUserOrderById);

// Get payment status for a specific order
router.get('/:id/payment-status', getOrderPaymentStatus);

// Complete payment for a specific order (for standard/cash payments)
router.post('/:id/complete-payment', completeOrderPayment);

// Cancel an order
router.post('/:id/cancel', cancelOrder);

// Track order status
router.get('/:id/track', trackOrder);

// Download invoice for an order
router.get('/:id/invoice', downloadInvoice);

// Reorder from an existing order
router.post('/:id/reorder', reorder);

// Request return for a delivered order
router.post('/:id/return', requestReturn);

export default router; 