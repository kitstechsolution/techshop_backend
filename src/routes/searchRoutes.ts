import express from 'express';
import {
  searchProducts,
  autosuggest,
  getPopularSearches,
  searchCategories,
  trackSearch,
} from '../controllers/searchController.js';
import { searchLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply search rate limiter to all routes
router.use(searchLimiter);

/**
 * @route   GET /api/search
 * @desc    Search products with filters
 * @access  Public
 */
router.get('/', searchProducts);

/**
 * @route   GET /api/search/suggest
 * @desc    Get autosuggest results
 * @access  Public
 */
router.get('/suggest', autosuggest);

/**
 * @route   GET /api/search/popular
 * @desc    Get popular search terms
 * @access  Public
 */
router.get('/popular', getPopularSearches);

/**
 * @route   GET /api/search/categories
 * @desc    Search categories
 * @access  Public
 */
router.get('/categories', searchCategories);

/**
 * @route   POST /api/search/track
 * @desc    Track search query (for analytics)
 * @access  Public
 */
router.post('/track', trackSearch);

export default router;
