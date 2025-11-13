import express from 'express';
import {
  getProducts,
  getProductsByCategory,
  getProductById,
  getFilterOptions,
  getFeaturedProducts,
  getNewProducts,
  getProductBySlug,
  getBestSellers,
  getRelatedProducts,
  getRecommendations,
  checkAvailability,
  getProductVariants,
  trackProductView,
  isInWishlist
} from '../controllers/productController.js';
import { searchProducts } from '../controllers/searchController.js';
import { createReview, getProductReviews, getProductReviewStats, voteOnReview, canUserReviewProduct } from '../controllers/reviewController.js';
import { auth, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Get filter options (must come before other routes to avoid conflicts)
router.get('/filters/options', getFilterOptions);

// Product search alias (aligns with frontend /products/search)
router.get('/search', searchProducts);

// Get featured products
router.get('/featured/list', getFeaturedProducts);

// Get new products
router.get('/new/list', getNewProducts);

// Get best sellers
router.get('/bestsellers/list', getBestSellers);

// Get personalized recommendations (optional auth - personalized if logged in, popular otherwise)
router.get('/recommendations/list', optionalAuth, getRecommendations);

// Get products by category (must come before /:id)
router.get('/category/:category', getProductsByCategory);

// Get product by slug
router.get('/slug/:slug', getProductBySlug);

// Get all products with filters
router.get('/', getProducts);

// Get product by ID
router.get('/:id', getProductById);

// Check product availability
router.get('/:id/availability', checkAvailability);

// Get product variants
router.get('/:id/variants', getProductVariants);

// Get related products
router.get('/:id/related', getRelatedProducts);

// Check if product is in wishlist (protected)
router.get('/:id/wishlist-status', auth, isInWishlist);

// Track product view
router.post('/:id/track-view', optionalAuth, trackProductView);

// Review routes
// Get product reviews (public)
router.get('/:productId/reviews', getProductReviews);
// Get product review stats (public)
router.get('/:productId/reviews/stats', getProductReviewStats);
// Can user review (protected)
router.get('/:productId/can-review', auth, canUserReviewProduct);
// Submit review (protected)
router.post('/:productId/reviews', auth, createReview);
// Vote on review (protected) - helpful/not helpful
router.post('/:productId/reviews/:reviewId/vote', auth, voteOnReview);

export default router;
