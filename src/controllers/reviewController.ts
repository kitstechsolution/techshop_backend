import { Response } from 'express';
import { Review } from '../models/Review.js';
import { Product } from '../models/Product.js';
import { AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';
import { product as productConfig } from '../config/config.js';

// @desc    Create a review
// @route   POST /api/products/:productId/reviews
// @access  Private
export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { productId } = req.params;
    const { rating, title, content, orderId, images, comment } = req.body;
    
    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }
    
    // Normalize content/comment (optional)
    const bodyContent = (content ?? '').trim() || (comment ?? '').trim();

    // Validate required fields (title and content optional)
    if (!rating) {
      return res.status(400).json({
        success: false,
        message: 'Rating is required',
      });
    }
    
    // Validate rating
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5',
      });
    }
    
    // If configured, require verified purchase to allow reviewing
    if (productConfig.requirePurchaseForReview) {
      const eligibility = await Review.canUserReview(
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(productId)
      );
      if (!eligibility.canReview) {
        return res.status(403).json({
          success: false,
          message: eligibility.reason,
        });
      }
    }
    
    // Determine order (optional) and verification status
    const Order = mongoose.model('Order');
    let verified = false;
    let resolvedOrderId: mongoose.Types.ObjectId | undefined = undefined;

    if (orderId) {
      const order = await Order.findOne({
        _id: orderId,
        user: userId,
        'items.product': productId,
        status: 'delivered',
      });
      if (!order) {
        return res.status(403).json({
          success: false,
          message: 'Invalid order or product not in order',
        });
      }
      verified = true;
      resolvedOrderId = order._id as mongoose.Types.ObjectId;
    } else {
      // Try to auto-resolve a delivered order for this user and product
      const deliveredOrder = await Order.findOne({
        user: userId,
        'items.product': productId,
        status: 'delivered',
      });
      if (deliveredOrder) {
        verified = true;
        resolvedOrderId = deliveredOrder._id as mongoose.Types.ObjectId;
      }
    }

    // Create review
    const review = await Review.create({
      product: productId,
      user: userId,
      ...(resolvedOrderId ? { order: resolvedOrderId } : {}),
      rating,
      title,
      ...(bodyContent ? { content: bodyContent } : {}),
      images: images || [],
      verified, // Verified if we found a delivered order
      status: productConfig.autoApproveReviews ? 'approved' : 'pending',
    });
    
    await review.populate('user', 'firstName lastName');
    
    logger.info(`Review created: ${review._id} by user ${userId} for product ${productId}`);
    
    res.status(201).json({
      success: true,
      message: 'Review submitted successfully and is pending moderation',
      data: review,
    });
  } catch (error: any) {
    logger.error('Error creating review:', error);
    
    // Handle duplicate review error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating review',
    });
  }
};

// @desc    Get reviews for a product
// @route   GET /api/products/:productId/reviews
// @access  Public
export const getProductReviews = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sort = (req.query.sort as string) || '-createdAt';
    const minRating = req.query.minRating ? parseInt(req.query.minRating as string) : undefined;
    const maxRating = req.query.maxRating ? parseInt(req.query.maxRating as string) : undefined;
    const verified = req.query.verified === 'true' ? true : undefined;
    
    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    
    const result = await Review.getProductReviews(
      new mongoose.Types.ObjectId(productId),
      {
      page,
      limit,
      sort,
      minRating,
      maxRating,
      verified,
    });
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error fetching product reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
    });
  }
};

// @desc    Get review statistics for a product
// @route   GET /api/products/:productId/reviews/stats
// @access  Public
export const getProductReviewStats = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    
    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    
    const stats = await Review.getProductStats(new mongoose.Types.ObjectId(productId));
    
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching review stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching review statistics',
    });
  }
};

// @desc    Get user's own reviews
// @route   GET /api/reviews/my-reviews
// @access  Private
export const getMyReviews = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    const reviews = await Review.find({ user: userId })
      .populate('product', 'name images price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Review.countDocuments({ user: userId });
    
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
    logger.error('Error fetching user reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your reviews',
    });
  }
};

// @desc    Update a review
// @route   PUT /api/reviews/:id
// @access  Private
export const updateReview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { rating, title, content, images } = req.body;
    
    // Validate review ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }
    
    // Find review
    const review = await Review.findOne({ _id: id, user: userId });
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or you do not have permission to update it',
      });
    }
    
    // Can only update pending or rejected reviews
    if (review.status === 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Cannot update an approved review',
      });
    }
    
    // Update fields
    if (rating !== undefined) {
      if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be an integer between 1 and 5',
        });
      }
      review.rating = rating;
    }
    
    if (title) review.title = title;
    if (content) review.content = content;
    if (images) review.images = images;
    
    // Reset status to pending if rejected
    if (review.status === 'rejected') {
      review.status = 'pending';
      review.moderationNotes = undefined;
    }
    
    await review.save();
    
    logger.info(`Review updated: ${review._id} by user ${userId}`);
    
    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: review,
    });
  } catch (error) {
    logger.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating review',
    });
  }
};

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private
export const deleteReview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    // Validate review ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }
    
    // Find and delete review
    const review = await Review.findOneAndDelete({ _id: id, user: userId });
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or you do not have permission to delete it',
      });
    }
    
    logger.info(`Review deleted: ${id} by user ${userId}`);
    
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

// @desc    Vote on a review (helpful/unhelpful)
// @route   POST /api/reviews/:id/vote
// @access  Private
export const voteOnReview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { helpful } = req.body;
    
    // Validate review ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }
    
    // Validate helpful parameter
    if (typeof helpful !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'helpful parameter must be a boolean',
      });
    }
    
    // Find review
    const review = await Review.findById(id);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }
    
    // Check if user already voted
    const hasVoted = review.votedBy.some((voterId) => voterId.equals(userId));
    
    if (hasVoted) {
      return res.status(400).json({
        success: false,
        message: 'You have already voted on this review',
      });
    }
    
    // Vote
    await review.voteHelpful(new mongoose.Types.ObjectId(userId), helpful);
    
    res.status(200).json({
      success: true,
      message: 'Vote recorded successfully',
      data: {
        helpfulVotes: review.helpfulVotes,
        unhelpfulVotes: review.unhelpfulVotes,
      },
    });
  } catch (error) {
    logger.error('Error voting on review:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording vote',
    });
  }
};

// @desc    Report a review
// @route   POST /api/reviews/:id/report
// @access  Private
export const reportReview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { reason } = req.body;
    
    // Validate review ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }
    
    // Validate reason
    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Report reason is required',
      });
    }
    
    const validReasons = [
      'spam',
      'inappropriate',
      'offensive',
      'fake',
      'misleading',
      'other',
    ];
    
    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report reason',
      });
    }
    
    // Find review
    const review = await Review.findById(id);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }
    
    // Update review
    review.reported = true;
    review.reportCount += 1;
    review.reportReasons.push(reason);
    await review.save();
    
    logger.info(`Review ${id} reported by user ${userId} for reason: ${reason}`);
    
    res.status(200).json({
      success: true,
      message: 'Review reported successfully. Our team will review it.',
    });
  } catch (error) {
    logger.error('Error reporting review:', error);
    res.status(500).json({
      success: false,
      message: 'Error reporting review',
    });
  }
};

// @desc    Check if user can review a product
// @route   GET /api/products/:productId/can-review
// @access  Private
export const canUserReviewProduct = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { productId } = req.params;
    
    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    // If purchase is NOT required, only block duplicates
    if (!productConfig.requirePurchaseForReview) {
      const existing = await Review.findOne({ user: userId, product: productId });
      if (existing) {
        return res.status(200).json({ success: true, data: { canReview: false, reason: 'You have already reviewed this product' } });
      }
      return res.status(200).json({ success: true, data: { canReview: true } });
    }
    
    // Otherwise, enforce purchase check
    const eligibility = await Review.canUserReview(
      new mongoose.Types.ObjectId(userId),
      new mongoose.Types.ObjectId(productId)
    );
    
    res.status(200).json({
      success: true,
      data: eligibility,
    });
  } catch (error) {
    logger.error('Error checking review eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking review eligibility',
    });
  }
};

export default {
  createReview,
  getProductReviews,
  getProductReviewStats,
  getMyReviews,
  updateReview,
  deleteReview,
  voteOnReview,
  reportReview,
  canUserReviewProduct,
};
