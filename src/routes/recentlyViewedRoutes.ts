import express from 'express';
import {
  trackProductView,
  getRecentlyViewed,
  removeRecentlyViewed,
  clearRecentlyViewed,
  getViewStats
} from '../controllers/recentlyViewedController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

/**
 * @route   POST /api/recently-viewed
 * @desc    Track a product view
 * @access  Private
 */
router.post('/', trackProductView);

/**
 * @route   GET /api/recently-viewed
 * @desc    Get user's recently viewed products
 * @access  Private
 */
router.get('/', getRecentlyViewed);

/**
 * @route   GET /api/recently-viewed/stats
 * @desc    Get viewing statistics
 * @access  Private
 */
router.get('/stats', getViewStats);

/**
 * @route   DELETE /api/recently-viewed/clear
 * @desc    Clear all recently viewed products
 * @access  Private
 */
router.delete('/clear', clearRecentlyViewed);

/**
 * @route   DELETE /api/recently-viewed/:productId
 * @desc    Remove a product from recently viewed
 * @access  Private
 */
router.delete('/:productId', removeRecentlyViewed);

export default router;
