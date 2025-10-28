import express from 'express';
import {
  createReview,
  getProductReviews,
  getProductReviewStats,
  getMyReviews,
  updateReview,
  deleteReview,
  voteOnReview,
  reportReview,
  canUserReviewProduct,
} from '../controllers/reviewController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/products/:productId/reviews', getProductReviews);
router.get('/products/:productId/reviews/stats', getProductReviewStats);

// Protected routes
router.use(protect);

// Check if user can review
router.get('/products/:productId/can-review', canUserReviewProduct);

// Create review for a product
router.post('/products/:productId/reviews', createReview);

// User's own reviews
router.get('/my-reviews', getMyReviews);

// Single review operations
router.route('/:id')
  .put(updateReview)
  .delete(deleteReview);

// Review interactions
router.post('/:id/vote', voteOnReview);
router.post('/:id/report', reportReview);

export default router;
