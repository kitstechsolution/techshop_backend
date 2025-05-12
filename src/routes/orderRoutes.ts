import express from 'express';
import { getUserOrders, getUserOrderById, createOrder, getOrderPaymentStatus, completeOrderPayment } from '../controllers/orderController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// All routes in this file are protected by auth middleware (user must be logged in)
router.use(auth);

// Get all orders for the current user
router.get('/', getUserOrders);

// Get a specific order by ID for the current user
router.get('/:id', getUserOrderById);

// Get payment status for a specific order
router.get('/:id/payment-status', getOrderPaymentStatus);

// Complete payment for a specific order (for standard/cash payments)
router.post('/:id/complete-payment', completeOrderPayment);

// Create a new order
router.post('/', createOrder);

export default router; 