import { Response } from 'express';
import { Review } from '../../models/Review.js';
import { AuthRequest } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import { notifyReviewApproved, notifyReviewRejected } from '../../services/notificationService.js';
import mongoose from 'mongoose';

// @desc    Get all reviews (admin view)
// @route   GET /api/admin/reviews
// @access  Private/Admin
export const getAllReviews = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    // Filters
    const status = req.query.status as string;
    const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
    const reported = req.query.reported === 'true';
    const productId = req.query.productId as string;
    const userId = req.query.userId as string;
    
    // Build query
    const query: any = {};
    
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }
    
    if (rating !== undefined && rating >= 1 && rating <= 5) {
      query.rating = rating;
    }
    
    if (reported) {
      query.reported = true;
    }
    
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      query.product = productId;
    }
    
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.user = userId;
    }
    
    // Get reviews
    const reviews = await Review.find(query)
      .populate('user', 'firstName lastName email')
      .populate('product', 'name images')
      .populate('moderatedBy', 'firstName lastName')
      .populate('reply.repliedBy', 'firstName lastName role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Review.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching reviews (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
    });
  }
};

// @desc    Get pending reviews
// @route   GET /api/admin/reviews/pending
// @access  Private/Admin
export const getPendingReviews = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    const reviews = await Review.find({ status: 'pending' })
      .populate('user', 'firstName lastName email')
      .populate('product', 'name images')
      .sort({ createdAt: 1 }) // Oldest first
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Review.countDocuments({ status: 'pending' });
    
    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching pending reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending reviews',
    });
  }
};

// @desc    Get reported reviews
// @route   GET /api/admin/reviews/reported
// @access  Private/Admin
export const getReportedReviews = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    const reviews = await Review.find({ reported: true })
      .populate('user', 'firstName lastName email')
      .populate('product', 'name images')
      .sort({ reportCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Review.countDocuments({ reported: true });
    
    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching reported reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reported reviews',
    });
  }
};

// @desc    Get review by ID
// @route   GET /api/admin/reviews/:id
// @access  Private/Admin
export const getReviewById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }
    
    const review = await Review.findById(id)
      .populate('user', 'firstName lastName email')
      .populate('product', 'name images price')
      .populate('order', 'orderNumber createdAt')
      .populate('moderatedBy', 'firstName lastName')
      .populate('reply.repliedBy', 'firstName lastName role')
      .lean();
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    logger.error('Error fetching review:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching review',
    });
  }
};

// @desc    Approve review
// @route   PATCH /api/admin/reviews/:id/approve
// @access  Private/Admin
export const approveReview = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }
    
    const review = await Review.findById(id).populate('product', 'name');
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }
    
    if (review.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Review is already approved',
      });
    }
    
    // Update review status
    review.status = 'approved';
    review.moderatedBy = adminId;
    review.moderatedAt = new Date();
    await review.save();
    
    // Send notification to user
    try {
      await notifyReviewApproved(
        review.user,
        review.product._id,
        (review.product as any).name
      );
    } catch (notifError) {
      logger.error('Error sending review approval notification:', notifError);
    }
    
    logger.info(`Review ${id} approved by admin ${adminId}`);
    
    res.status(200).json({
      success: true,
      message: 'Review approved successfully',
      data: review,
    });
  } catch (error) {
    logger.error('Error approving review:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving review',
    });
  }
};

// @desc    Reject review
// @route   PATCH /api/admin/reviews/:id/reject
// @access  Private/Admin
export const rejectReview = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const { id } = req.params;
    const { moderationNotes } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }
    
    const review = await Review.findById(id).populate('product', 'name');
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }
    
    if (review.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Review is already rejected',
      });
    }
    
    // Update review status
    review.status = 'rejected';
    review.moderatedBy = adminId;
    review.moderatedAt = new Date();
    review.moderationNotes = moderationNotes || 'Review does not meet our guidelines';
    await review.save();
    
    // Send notification to user
    try {
      await notifyReviewRejected(
        review.user,
        review.product._id,
        (review.product as any).name
      );
    } catch (notifError) {
      logger.error('Error sending review rejection notification:', notifError);
    }
    
    logger.info(`Review ${id} rejected by admin ${adminId}`);
    
    res.status(200).json({
      success: true,
      message: 'Review rejected',
      data: review,
    });
  } catch (error) {
    logger.error('Error rejecting review:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting review',
    });
  }
};

// @desc    Add reply to review (seller/admin response)
// @route   POST /api/admin/reviews/:id/reply
// @access  Private/Admin
export const replyToReview = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const { id } = req.params;
    const { content } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reply content is required',
      });
    }
    
    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Reply content cannot exceed 1000 characters',
      });
    }
    
    const review = await Review.findById(id);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }
    
    if (review.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Can only reply to approved reviews',
      });
    }
    
    if (review.reply) {
      return res.status(400).json({
        success: false,
        message: 'Review already has a reply. Update the existing reply instead.',
      });
    }
    
    // Add reply
    review.reply = {
      content: content.trim(),
      repliedBy: adminId,
      repliedAt: new Date(),
    };
    
    await review.save();
    await review.populate('reply.repliedBy', 'firstName lastName role');
    
    logger.info(`Reply added to review ${id} by admin ${adminId}`);
    
    res.status(200).json({
      success: true,
      message: 'Reply added successfully',
      data: review,
    });
  } catch (error) {
    logger.error('Error adding reply to review:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding reply',
    });
  }
};

// @desc    Update reply to review
// @route   PUT /api/admin/reviews/:id/reply
// @access  Private/Admin
export const updateReply = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const { id } = req.params;
    const { content } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reply content is required',
      });
    }
    
    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Reply content cannot exceed 1000 characters',
      });
    }
    
    const review = await Review.findById(id);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }
    
    if (!review.reply) {
      return res.status(404).json({
        success: false,
        message: 'No reply found to update',
      });
    }
    
    // Update reply
    review.reply.content = content.trim();
    review.reply.repliedAt = new Date();
    
    await review.save();
    await review.populate('reply.repliedBy', 'firstName lastName role');
    
    logger.info(`Reply updated for review ${id} by admin ${adminId}`);
    
    res.status(200).json({
      success: true,
      message: 'Reply updated successfully',
      data: review,
    });
  } catch (error) {
    logger.error('Error updating reply:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating reply',
    });
  }
};

// @desc    Delete reply from review
// @route   DELETE /api/admin/reviews/:id/reply
// @access  Private/Admin
export const deleteReply = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }
    
    const review = await Review.findById(id);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }
    
    if (!review.reply) {
      return res.status(404).json({
        success: false,
        message: 'No reply found to delete',
      });
    }
    
    // Delete reply
    review.reply = undefined;
    await review.save();
    
    logger.info(`Reply deleted from review ${id} by admin ${adminId}`);
    
    res.status(200).json({
      success: true,
      message: 'Reply deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting reply:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting reply',
    });
  }
};

// @desc    Delete review
// @route   DELETE /api/admin/reviews/:id
// @access  Private/Admin
export const deleteReview = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }
    
    const review = await Review.findByIdAndDelete(id);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }
    
    logger.info(`Review ${id} deleted by admin ${adminId}`);
    
    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting review',
    });
  }
};

// @desc    Get review statistics
// @route   GET /api/admin/reviews/stats
// @access  Private/Admin
export const getReviewStatistics = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await Review.aggregate([
      {
        $facet: {
          statusCounts: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
              },
            },
          ],
          ratingDistribution: [
            {
              $group: {
                _id: '$rating',
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: -1 } },
          ],
          recentActivity: [
            {
              $match: {
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            { $limit: 30 },
          ],
          summary: [
            {
              $group: {
                _id: null,
                totalReviews: { $sum: 1 },
                averageRating: { $avg: '$rating' },
                reportedReviews: {
                  $sum: { $cond: ['$reported', 1, 0] },
                },
                verifiedPurchases: {
                  $sum: { $cond: ['$verified', 1, 0] },
                },
              },
            },
          ],
        },
      },
    ]);
    
    const result = stats[0];
    
    res.status(200).json({
      success: true,
      data: {
        statusCounts: result.statusCounts,
        ratingDistribution: result.ratingDistribution,
        recentActivity: result.recentActivity,
        summary: result.summary[0] || {
          totalReviews: 0,
          averageRating: 0,
          reportedReviews: 0,
          verifiedPurchases: 0,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching review statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
    });
  }
};

// @desc    Bulk approve reviews
// @route   POST /api/admin/reviews/bulk-approve
// @access  Private/Admin
export const bulkApproveReviews = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const { reviewIds } = req.body;
    
    if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Review IDs array is required',
      });
    }
    
    // Validate IDs
    const validIds = reviewIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid review IDs provided',
      });
    }
    
    const result = await Review.updateMany(
      { _id: { $in: validIds }, status: { $ne: 'approved' } },
      {
        $set: {
          status: 'approved',
          moderatedBy: adminId,
          moderatedAt: new Date(),
        },
      }
    );
    
    logger.info(`${result.modifiedCount} reviews bulk approved by admin ${adminId}`);
    
    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} reviews approved successfully`,
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    logger.error('Error bulk approving reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving reviews',
    });
  }
};

// @desc    Bulk delete reviews
// @route   POST /api/admin/reviews/bulk-delete
// @access  Private/Admin
export const bulkDeleteReviews = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const { reviewIds } = req.body;
    
    if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Review IDs array is required',
      });
    }
    
    // Validate IDs
    const validIds = reviewIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid review IDs provided',
      });
    }
    
    const result = await Review.deleteMany({ _id: { $in: validIds } });
    
    logger.info(`${result.deletedCount} reviews bulk deleted by admin ${adminId}`);
    
    res.status(200).json({
      success: true,
      message: `${result.deletedCount} reviews deleted successfully`,
      data: {
        deletedCount: result.deletedCount,
      },
    });
  } catch (error) {
    logger.error('Error bulk deleting reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting reviews',
    });
  }
};

export default {
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
};
