import express from 'express';
import {
  getCheckoutSession,
  createCheckoutSession,
  updateShippingAddress,
  addShippingAddress,
  updateBillingAddress,
  useSameAddress,
  getShippingMethods,
  selectShippingMethod,
  getPaymentMethods,
  addPaymentMethod,
  selectPaymentMethod,
  createPaymentIntent,
  verifyPayment,
  getOrderSummary,
  applyGiftCard,
  removeGiftCard,
  useWalletBalance,
  addOrderNotes,
  validateCheckout,
  createOrder,
  getOrderConfirmation,
  cancelOrder,
  calculateDeliveryDate,
  checkExpressCheckout,
  processExpressCheckout,
  saveCheckoutProgress,
  restoreCheckoutProgress,
  calculateTax
} from '../controllers/checkoutController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// All checkout routes require authentication
router.use(auth);

// Session management
router.get('/session', getCheckoutSession);
router.post('/session', createCheckoutSession);

// Address management
router.put('/shipping-address', updateShippingAddress);
router.post('/shipping-address', addShippingAddress);
router.put('/billing-address', updateBillingAddress);
router.put('/use-same-address', useSameAddress);

// Shipping methods
router.get('/shipping-methods', getShippingMethods);
router.put('/shipping-method', selectShippingMethod);

// Payment methods
router.get('/payment-methods', getPaymentMethods);
router.post('/payment-methods', addPaymentMethod);
router.put('/payment-method', selectPaymentMethod);

// Payment processing
router.post('/payment-intent', createPaymentIntent);
router.post('/verify-payment', verifyPayment);

// Order summary and validation
router.get('/order-summary', getOrderSummary);
router.post('/validate', validateCheckout);

// Gift cards and discounts
router.post('/gift-card', applyGiftCard);
router.delete('/gift-card', removeGiftCard);

// Wallet
router.post('/wallet-balance', useWalletBalance);

// Order notes
router.put('/notes', addOrderNotes);

// Order creation
router.post('/orders', createOrder);
router.get('/orders/:id/confirmation', getOrderConfirmation);
router.post('/orders/:id/cancel', cancelOrder);

// Delivery estimation
router.post('/delivery-estimate', calculateDeliveryDate);

// Express checkout
router.get('/express-checkout', checkExpressCheckout);
router.post('/express-checkout', processExpressCheckout);

// Session persistence
router.post('/save', saveCheckoutProgress);
router.post('/restore', restoreCheckoutProgress);

// Tax calculation
router.post('/calculate-tax', calculateTax);

export default router;
