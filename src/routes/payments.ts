import { Router } from 'express';
import { createRazorPayOrder, verifyRazorPayPayment, getRazorPayKey, retryPayment, handleRazorPayWebhook } from '../controllers/paymentController.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// Public routes
router.get('/razorpay/key', getRazorPayKey);

// Webhook route (public, but secured with signature verification)
router.post('/razorpay/webhook', handleRazorPayWebhook);

// Protected routes - require authentication
router.post('/razorpay/create-order', auth, createRazorPayOrder);
router.post('/razorpay/verify', verifyRazorPayPayment);
router.post('/retry/:orderId', auth, retryPayment);

export default router; 