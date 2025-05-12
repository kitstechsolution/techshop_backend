import { Router } from 'express';
import { createRazorPayOrder, verifyRazorPayPayment, getRazorPayKey, retryPayment, handleRazorPayWebhook } from '../controllers/paymentController.js';
import { getStripeKey, createPaymentIntent, verifyStripePayment, handleStripeWebhook } from '../controllers/stripeController.js';
import { 
  getPayPalConfig, createPayPalOrder, capturePayPalPayment, handlePayPalWebhook 
} from '../controllers/paypalController.js';
import { 
  getCashfreeConfig, createCashfreeOrder, verifyCashfreePayment, 
  handleCashfreeReturn, handleCashfreeWebhook 
} from '../controllers/cashfreeController.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// Public routes - gateway configuration
router.get('/razorpay/key', getRazorPayKey);
router.get('/stripe/key', getStripeKey);
router.get('/paypal/config', getPayPalConfig);
router.get('/cashfree/config', getCashfreeConfig);

// Webhook routes (must be public and receive raw body)
router.post('/razorpay/webhook', handleRazorPayWebhook);
router.post('/stripe/webhook', handleStripeWebhook);
router.post('/paypal/webhook', handlePayPalWebhook);
router.post('/cashfree/webhook', handleCashfreeWebhook);

// Return URL handlers for payment gateways that use redirects
router.get('/cashfree/return', handleCashfreeReturn);

// Protected routes (require authentication)
// RazorPay
router.post('/razorpay/create-order', auth, createRazorPayOrder);
router.post('/razorpay/verify', auth, verifyRazorPayPayment);
router.post('/retry/:orderId', auth, retryPayment);

// Stripe
router.post('/stripe/create-payment-intent', auth, createPaymentIntent);
router.post('/stripe/verify', auth, verifyStripePayment);

// PayPal
router.post('/paypal/create-order', auth, createPayPalOrder);
router.post('/paypal/capture', auth, capturePayPalPayment);

// Cashfree
router.post('/cashfree/create-order', auth, createCashfreeOrder);
router.post('/cashfree/verify', auth, verifyCashfreePayment);

export default router; 