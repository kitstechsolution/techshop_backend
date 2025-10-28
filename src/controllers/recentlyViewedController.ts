import { Request, Response } from 'express';
import { RecentlyViewed } from '../models/RecentlyViewed.js';
import { Product } from '../models/Product.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

/**
 * @api {post} /api/recently-viewed Track Product View
 * @apiName TrackProductView
 * @apiGroup RecentlyViewed
 * @apiPermission user
 * 
 * @apiBody {String} productId Product ID
 * @apiSuccess {Object} message Success message
 */
export const trackProductView = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { productId } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!productId) {
      res.status(400).json({ error: 'Product ID is required' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    // Check if product exists
    const productExists = await Product.exists({ _id: productId });
    if (!productExists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Use updateOne with upsert to either update viewedAt or create new entry
    await RecentlyViewed.updateOne(
      { user: userId, product: productId },
      { $set: { viewedAt: new Date() } },
      { upsert: true }
    );

    // Keep only the last 50 viewed products per user
    const recentlyViewed = await RecentlyViewed.find({ user: userId })
      .sort({ viewedAt: -1 })
      .skip(50)
      .select('_id');

    if (recentlyViewed.length > 0) {
      const idsToDelete = recentlyViewed.map(rv => rv._id);
      await RecentlyViewed.deleteMany({ _id: { $in: idsToDelete } });
    }

    res.json({ message: 'Product view tracked successfully' });
  } catch (error) {
    logger.error('Error tracking product view:', error);
    res.status(500).json({ error: 'Failed to track product view' });
  }
};

/**
 * @api {get} /api/recently-viewed Get Recently Viewed Products
 * @apiName GetRecentlyViewed
 * @apiGroup RecentlyViewed
 * @apiPermission user
 * 
 * @apiQuery {Number} [limit=20] Number of products to return
 * @apiSuccess {Array} products Recently viewed products
 */
export const getRecentlyViewed = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string), 50); // Max 50

    const recentlyViewed = await RecentlyViewed.find({ user: userId })
      .sort({ viewedAt: -1 })
      .limit(limitNum)
      .populate({
        path: 'product',
        select: 'name description price imageUrl category brand stock averageRating discount'
      })
      .lean();

    // Filter out any entries where product was deleted
    const products = recentlyViewed
      .filter(rv => rv.product)
      .map(rv => ({
        ...(rv.product as any),
        viewedAt: rv.viewedAt
      }));

    res.json({
      products,
      count: products.length
    });
  } catch (error) {
    logger.error('Error getting recently viewed products:', error);
    res.status(500).json({ error: 'Failed to get recently viewed products' });
  }
};

/**
 * @api {delete} /api/recently-viewed/:productId Remove from Recently Viewed
 * @apiName RemoveRecentlyViewed
 * @apiGroup RecentlyViewed
 * @apiPermission user
 * 
 * @apiParam {String} productId Product ID to remove
 * @apiSuccess {Object} message Success message
 */
export const removeRecentlyViewed = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { productId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const result = await RecentlyViewed.deleteOne({
      user: userId,
      product: productId
    });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Product not found in recently viewed' });
      return;
    }

    res.json({ message: 'Product removed from recently viewed' });
  } catch (error) {
    logger.error('Error removing recently viewed product:', error);
    res.status(500).json({ error: 'Failed to remove product' });
  }
};

/**
 * @api {delete} /api/recently-viewed Clear Recently Viewed
 * @apiName ClearRecentlyViewed
 * @apiGroup RecentlyViewed
 * @apiPermission user
 * 
 * @apiSuccess {Object} message Success message
 */
export const clearRecentlyViewed = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const result = await RecentlyViewed.deleteMany({ user: userId });

    res.json({
      message: 'Recently viewed history cleared',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    logger.error('Error clearing recently viewed:', error);
    res.status(500).json({ error: 'Failed to clear recently viewed' });
  }
};

/**
 * @api {get} /api/recently-viewed/stats Get View Statistics
 * @apiName GetViewStats
 * @apiGroup RecentlyViewed
 * @apiPermission user
 * 
 * @apiSuccess {Object} stats Viewing statistics
 */
export const getViewStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const stats = await RecentlyViewed.aggregate([
      { $match: { user: userId } },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      { $unwind: '$productDetails' },
      {
        $group: {
          _id: null,
          totalViewed: { $sum: 1 },
          categories: { $addToSet: '$productDetails.category' },
          brands: { $addToSet: '$productDetails.brand' },
          avgPrice: { $avg: '$productDetails.price' },
          lastViewed: { $max: '$viewedAt' }
        }
      }
    ]);

    if (stats.length === 0) {
      res.json({
        totalViewed: 0,
        categories: [],
        brands: [],
        avgPrice: 0,
        lastViewed: null
      });
      return;
    }

    res.json({
      totalViewed: stats[0].totalViewed,
      categoriesCount: stats[0].categories.filter((c: any) => c).length,
      brandsCount: stats[0].brands.filter((b: any) => b).length,
      avgPrice: Math.round(stats[0].avgPrice),
      lastViewed: stats[0].lastViewed
    });
  } catch (error) {
    logger.error('Error getting view stats:', error);
    res.status(500).json({ error: 'Failed to get view stats' });
  }
};
