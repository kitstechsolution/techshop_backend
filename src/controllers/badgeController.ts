import { Request, Response } from 'express';
import { Product } from '../models/Product.js';

/**
 * @desc    Add badge to product
 * @route   POST /api/admin/products/:productId/badges
 * @access  Admin
 */
export const addBadgeToProduct = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { type, label, color, startDate, endDate, priority } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Badge type is required',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check if badge type already exists
    const existingBadge = product.badges?.find((b) => b.type === type);
    if (existingBadge) {
      return res.status(400).json({
        success: false,
        message: `Badge type '${type}' already exists for this product`,
      });
    }

    const badge = {
      type,
      label: label || type.charAt(0).toUpperCase() + type.slice(1),
      color,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : undefined,
      priority: priority || 0,
    };

    if (!product.badges) {
      product.badges = [];
    }
    product.badges.push(badge);

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Badge added successfully',
      data: product,
    });
  } catch (error) {
    console.error('Add badge error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add badge',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Remove badge from product
 * @route   DELETE /api/admin/products/:productId/badges/:badgeType
 * @access  Admin
 */
export const removeBadgeFromProduct = async (req: Request, res: Response) => {
  try {
    const { productId, badgeType } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (!product.badges || product.badges.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No badges found for this product',
      });
    }

    const badgeIndex = product.badges.findIndex((b) => b.type === badgeType);
    if (badgeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Badge type '${badgeType}' not found`,
      });
    }

    product.badges.splice(badgeIndex, 1);
    await product.save();

    res.json({
      success: true,
      message: 'Badge removed successfully',
      data: product,
    });
  } catch (error) {
    console.error('Remove badge error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove badge',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Update badge on product
 * @route   PUT /api/admin/products/:productId/badges/:badgeType
 * @access  Admin
 */
export const updateBadgeOnProduct = async (req: Request, res: Response) => {
  try {
    const { productId, badgeType } = req.params;
    const { label, color, startDate, endDate, priority } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (!product.badges || product.badges.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No badges found for this product',
      });
    }

    const badge = product.badges.find((b) => b.type === badgeType);
    if (!badge) {
      return res.status(404).json({
        success: false,
        message: `Badge type '${badgeType}' not found`,
      });
    }

    // Update badge fields
    if (label !== undefined) badge.label = label;
    if (color !== undefined) badge.color = color;
    if (startDate !== undefined) badge.startDate = new Date(startDate);
    if (endDate !== undefined) badge.endDate = new Date(endDate);
    if (priority !== undefined) badge.priority = priority;

    await product.save();

    res.json({
      success: true,
      message: 'Badge updated successfully',
      data: product,
    });
  } catch (error) {
    console.error('Update badge error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update badge',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Bulk add badges to multiple products
 * @route   POST /api/admin/badges/bulk
 * @access  Admin
 */
export const bulkAddBadges = async (req: Request, res: Response) => {
  try {
    const { productIds, badge } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs array is required',
      });
    }

    if (!badge || !badge.type) {
      return res.status(400).json({
        success: false,
        message: 'Badge with type is required',
      });
    }

    const badgeData = {
      type: badge.type,
      label: badge.label || badge.type.charAt(0).toUpperCase() + badge.type.slice(1),
      color: badge.color,
      startDate: badge.startDate ? new Date(badge.startDate) : new Date(),
      endDate: badge.endDate ? new Date(badge.endDate) : undefined,
      priority: badge.priority || 0,
    };

    const result = await Product.updateMany(
      {
        _id: { $in: productIds },
        'badges.type': { $ne: badge.type }, // Don't add if already exists
      },
      {
        $push: { badges: badgeData },
      }
    );

    res.json({
      success: true,
      message: `Badge added to ${result.modifiedCount} products`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error('Bulk add badges error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk add badges',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Bulk remove badges from multiple products
 * @route   DELETE /api/admin/badges/bulk
 * @access  Admin
 */
export const bulkRemoveBadges = async (req: Request, res: Response) => {
  try {
    const { productIds, badgeType } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs array is required',
      });
    }

    if (!badgeType) {
      return res.status(400).json({
        success: false,
        message: 'Badge type is required',
      });
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $pull: { badges: { type: badgeType } } }
    );

    res.json({
      success: true,
      message: `Badge removed from ${result.modifiedCount} products`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error('Bulk remove badges error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk remove badges',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Get all products with a specific badge
 * @route   GET /api/admin/badges/:badgeType/products
 * @access  Admin
 */
export const getProductsByBadge = async (req: Request, res: Response) => {
  try {
    const { badgeType } = req.params;
    const { page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find({ 'badges.type': badgeType })
        .select('name price imageUrl category badges stock')
        .limit(limitNum)
        .skip(skip),
      Product.countDocuments({ 'badges.type': badgeType }),
    ]);

    res.json({
      success: true,
      count: products.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      data: products,
    });
  } catch (error) {
    console.error('Get products by badge error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products by badge',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Auto-assign badges based on product properties
 * @route   POST /api/admin/badges/auto-assign
 * @access  Admin
 */
export const autoAssignBadges = async (req: Request, res: Response) => {
  try {
    let updatedCount = 0;

    // Auto-assign "sale" badge to products with discount > 0
    const saleResult = await Product.updateMany(
      {
        discount: { $gt: 0 },
        'badges.type': { $ne: 'sale' },
      },
      {
        $push: {
          badges: {
            type: 'sale',
            label: 'Sale',
            color: '#FF0000',
            priority: 5,
          },
        },
      }
    );
    updatedCount += saleResult.modifiedCount;

    // Auto-assign "new" badge to products created in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const newResult = await Product.updateMany(
      {
        createdAt: { $gte: sevenDaysAgo },
        'badges.type': { $ne: 'new' },
      },
      {
        $push: {
          badges: {
            type: 'new',
            label: 'New',
            color: '#00FF00',
            priority: 3,
          },
        },
      }
    );
    updatedCount += newResult.modifiedCount;

    // Auto-assign "hot" badge to products with high ratings
    const hotResult = await Product.updateMany(
      {
        averageRating: { $gte: 4.5 },
        approvedReviewsCount: { $gte: 10 },
        'badges.type': { $ne: 'hot' },
      },
      {
        $push: {
          badges: {
            type: 'hot',
            label: 'Hot',
            color: '#FFA500',
            priority: 4,
          },
        },
      }
    );
    updatedCount += hotResult.modifiedCount;

    res.json({
      success: true,
      message: `Auto-assigned badges to ${updatedCount} products`,
      data: {
        sale: saleResult.modifiedCount,
        new: newResult.modifiedCount,
        hot: hotResult.modifiedCount,
        total: updatedCount,
      },
    });
  } catch (error) {
    console.error('Auto-assign badges error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to auto-assign badges',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
