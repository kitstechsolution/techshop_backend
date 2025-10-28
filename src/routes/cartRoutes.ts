import express from 'express';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyCoupon,
  removeCoupon,
  validateCoupon,
  getCartSummary,
  getCartItemCount,
  mergeCart,
  validateCart,
  getRecommendations,
  moveToWishlist,
  saveCartForLater,
  restoreCart,
  calculateShipping,
  applyGiftWrapping,
  addGiftMessage,
  canAddToCart,
  getAbandonedCart,
  updateNotes,
} from '../controllers/cartController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// All cart routes require authentication
router.use(auth);

/**
 * Cart Management Routes
 */

// Get user's cart
router.get('/', getCart);

// Clear entire cart
router.delete('/', clearCart);

/**
 * Cart Items Routes
 */

// Add item to cart
router.post('/items', addToCart);

// Update cart item quantity
router.put('/items/:itemId', updateCartItem);

// Remove item from cart
router.delete('/items/:itemId', removeFromCart);

// Move item to wishlist
router.post('/items/:itemId/move-to-wishlist', moveToWishlist);

// Apply gift wrapping to item
router.put('/items/:itemId/gift-wrap', applyGiftWrapping);

/**
 * Coupon Management Routes
 */

// Apply coupon code
router.post('/coupon', applyCoupon);

// Remove coupon
router.delete('/coupon', removeCoupon);

// Validate coupon code
router.post('/coupon/validate', validateCoupon);

/**
 * Cart Information Routes
 */

// Get cart summary
router.get('/summary', getCartSummary);

// Get cart item count
router.get('/count', getCartItemCount);

/**
 * Cart Operations Routes
 */

// Merge guest cart with user cart
router.post('/merge', mergeCart);

// Validate cart (stock check)
router.post('/validate', validateCart);

// Get product recommendations based on cart
router.get('/recommendations', getRecommendations);

// Check if product can be added to cart
router.post('/can-add', canAddToCart);

/**
 * Cart Persistence Routes
 */

// Save cart for later (guest users)
router.post('/save', saveCartForLater);

// Restore saved cart
router.post('/restore', restoreCart);

// Get abandoned cart
router.get('/abandoned/:cartId', getAbandonedCart);

/**
 * Shipping Routes
 */

// Calculate shipping cost
router.post('/shipping/calculate', calculateShipping);

/**
 * Gift Options Routes
 */

// Add gift message to cart
router.put('/gift-message', addGiftMessage);

/**
 * Cart Notes Routes
 */

// Update cart notes
router.put('/notes', updateNotes);

export default router;
