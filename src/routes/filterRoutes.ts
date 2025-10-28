import express from 'express';
import {
  getFilterFacets,
  getBrands,
  getPriceRange,
  getTags
} from '../controllers/filterController.js';
import { publicLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply rate limiting
router.use(publicLimiter);

/**
 * @route   GET /api/filters/facets
 * @desc    Get filter facets with counts
 * @access  Public
 */
router.get('/facets', getFilterFacets);

/**
 * @route   GET /api/filters/brands
 * @desc    Get all brands with product counts
 * @access  Public
 */
router.get('/brands', getBrands);

/**
 * @route   GET /api/filters/price-range
 * @desc    Get min/max price range
 * @access  Public
 */
router.get('/price-range', getPriceRange);

/**
 * @route   GET /api/filters/tags
 * @desc    Get popular product tags
 * @access  Public
 */
router.get('/tags', getTags);

export default router;
