import express from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  checkInWishlist,
  getWishlistItems,
  updateWishlistItem,
  getWishlistCount,
  moveToCart,
  shareWishlist,
  getPriceDrops,
  getWishlistStats,
  mergeWishlist,
  exportWishlist
} from '../controllers/wishlistController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// All wishlist routes require authentication
router.use(auth);

/**
 * @route   GET /api/wishlist
 * @desc    Get user's wishlist
 * @access  Private
 */
router.get('/', getWishlist);

/**
 * @route   GET /api/wishlist/items
 * @desc    Get wishlist items with pagination
 * @access  Private
 */
router.get('/items', getWishlistItems);

/**
 * @route   GET /api/wishlist/count
 * @desc    Get wishlist item count
 * @access  Private
 */
router.get('/count', getWishlistCount);

/**
 * @route   GET /api/wishlist/stats
 * @desc    Get wishlist statistics
 * @access  Private
 */
router.get('/stats', getWishlistStats);

/**
 * @route   GET /api/wishlist/price-drops
 * @desc    Get price drops for wishlist items
 * @access  Private
 */
router.get('/price-drops', getPriceDrops);

/**
 * @route   GET /api/wishlist/share
 * @desc    Generate shareable wishlist link
 * @access  Private
 */
router.get('/share', shareWishlist);

/**
 * @route   GET /api/wishlist/export
 * @desc    Export wishlist (JSON/CSV)
 * @access  Private
 */
router.get('/export', exportWishlist);

/**
 * @route   POST /api/wishlist/add/:productId
 * @desc    Add product to wishlist
 * @access  Private
 */
router.post('/add/:productId', addToWishlist);

/**
 * @route   POST /api/wishlist/merge
 * @desc    Merge wishlist items
 * @access  Private
 */
router.post('/merge', mergeWishlist);

/**
 * @route   POST /api/wishlist/move-to-cart/:productId
 * @desc    Move product from wishlist to cart
 * @access  Private
 */
router.post('/move-to-cart/:productId', moveToCart);

/**
 * @route   PATCH /api/wishlist/update/:productId
 * @desc    Update wishlist item
 * @access  Private
 */
router.patch('/update/:productId', updateWishlistItem);

/**
 * @route   DELETE /api/wishlist/remove/:productId
 * @desc    Remove product from wishlist
 * @access  Private
 */
router.delete('/remove/:productId', removeFromWishlist);

/**
 * @route   DELETE /api/wishlist/clear
 * @desc    Clear entire wishlist
 * @access  Private
 */
router.delete('/clear', clearWishlist);

/**
 * @route   GET /api/wishlist/check/:productId
 * @desc    Check if product is in wishlist
 * @access  Private
 */
router.get('/check/:productId', checkInWishlist);

export default router;
