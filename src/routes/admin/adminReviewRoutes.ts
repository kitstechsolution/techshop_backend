import express from 'express';
import {
  getAllReviews,
  getPendingReviews,
  getReportedReviews,
  getReviewById,
  approveReview,
  rejectReview,
  replyToReview,
  updateReply,
  deleteReply,
  deleteReview,
  getReviewStatistics,
  bulkApproveReviews,
  bulkDeleteReviews,
} from '../../controllers/admin/adminReviewController.js';
import { protect, admin } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication and admin middleware to all routes
router.use(protect);
router.use(admin);

// Statistics (must be before :id routes)
router.get('/stats', getReviewStatistics);

// Pending reviews (must be before :id routes)
router.get('/pending', getPendingReviews);

// Reported reviews (must be before :id routes)
router.get('/reported', getReportedReviews);

// Bulk operations (must be before :id routes)
router.post('/bulk-approve', bulkApproveReviews);
router.post('/bulk-delete', bulkDeleteReviews);

// Get all reviews
router.get('/', getAllReviews);

// Single review operations
router.route('/:id')
  .get(getReviewById)
  .delete(deleteReview);

// Moderation actions
router.patch('/:id/approve', approveReview);
router.patch('/:id/reject', rejectReview);

// Reply management
router.route('/:id/reply')
  .post(replyToReview)
  .put(updateReply)
  .delete(deleteReply);

export default router;
