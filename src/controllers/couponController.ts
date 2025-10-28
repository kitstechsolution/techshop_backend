import { Request, Response } from 'express';
import { Coupon } from '../models/Coupon.js';
import { CouponUsage } from '../models/CouponUsage.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

/**
 * @api {post} /api/coupons/validate Validate Coupon Code
 * @apiName ValidateCoupon
 * @apiGroup Coupons
 * @apiPermission user
 * 
 * @apiBody {String} code Coupon code
 * @apiBody {Number} cartTotal Cart total amount
 * @apiBody {Array} [items] Cart items with product IDs and categories
 * @apiSuccess {Object} coupon Valid coupon with discount info
 */
export const validateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { code, cartTotal, items = [] } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!code || !cartTotal) {
      res.status(400).json({ error: 'Coupon code and cart total are required' });
      return;
    }

    // Find coupon
    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    });

    if (!coupon) {
      res.status(404).json({ error: 'Invalid coupon code' });
      return;
    }

    // Check if coupon is valid
    if (!coupon.isValid) {
      if (coupon.status === 'expired' || new Date() > coupon.validUntil) {
        res.status(400).json({ error: 'This coupon has expired' });
      } else if (new Date() < coupon.validFrom) {
        res.status(400).json({ error: 'This coupon is not yet valid' });
      } else if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        res.status(400).json({ error: 'This coupon has reached its usage limit' });
      } else {
        res.status(400).json({ error: 'This coupon is not valid' });
      }
      return;
    }

    // Check user usage limit
    const userUsageCount = await CouponUsage.countDocuments({
      coupon: coupon._id,
      user: userId
    });

    if (coupon.perUserLimit && userUsageCount >= coupon.perUserLimit) {
      res.status(400).json({ 
        error: `You have already used this coupon ${coupon.perUserLimit} time(s)` 
      });
      return;
    }

    // Check minimum purchase amount
    if (coupon.minPurchaseAmount && cartTotal < coupon.minPurchaseAmount) {
      res.status(400).json({ 
        error: `Minimum purchase amount of ₹${coupon.minPurchaseAmount} required` 
      });
      return;
    }

    // Check category restrictions if items provided
    if (items.length > 0) {
      const categories = items.map((item: any) => item.category);
      
      // Check applicable categories
      if (coupon.applicableCategories && coupon.applicableCategories.length > 0) {
        const hasApplicable = categories.some((cat: string) => 
          coupon.applicableCategories!.includes(cat)
        );
        if (!hasApplicable) {
          res.status(400).json({ 
            error: 'This coupon is not applicable to items in your cart' 
          });
          return;
        }
      }

      // Check excluded categories
      if (coupon.excludedCategories && coupon.excludedCategories.length > 0) {
        const hasExcluded = categories.some((cat: string) => 
          coupon.excludedCategories!.includes(cat)
        );
        if (hasExcluded) {
          res.status(400).json({ 
            error: 'This coupon cannot be used with some items in your cart' 
          });
          return;
        }
      }
    }

    // Calculate discount
    const discountAmount = coupon.calculateDiscount(cartTotal);
    const finalAmount = cartTotal - discountAmount;

    res.json({
      valid: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      },
      discount: {
        amount: discountAmount,
        originalTotal: cartTotal,
        finalTotal: finalAmount,
        savings: discountAmount
      }
    });
  } catch (error) {
    logger.error('Error validating coupon:', error);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
};

/**
 * @api {get} /api/coupons/active Get Active Coupons
 * @apiName GetActiveCoupons
 * @apiGroup Coupons
 * @apiPermission user
 * 
 * @apiSuccess {Array} coupons List of active coupons
 */
export const getActiveCoupons = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    
    const coupons = await Coupon.find({
      isActive: true,
      status: 'active',
      validFrom: { $lte: now },
      validUntil: { $gte: now }
    })
    .select('code description discountType discountValue minPurchaseAmount maxDiscountAmount validUntil')
    .sort({ createdAt: -1 });

    res.json({ coupons });
  } catch (error) {
    logger.error('Error fetching active coupons:', error);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
};

/**
 * @api {post} /api/admin/coupons Create Coupon
 * @apiName CreateCoupon
 * @apiGroup Coupons
 * @apiPermission admin
 * 
 * @apiBody {Object} coupon Coupon data
 * @apiSuccess {Object} coupon Created coupon
 */
export const createCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const couponData = req.body;

    // Validate discount value
    if (couponData.discountType === 'percentage' && couponData.discountValue > 100) {
      res.status(400).json({ error: 'Percentage discount cannot exceed 100%' });
      return;
    }

    // Validate dates
    if (new Date(couponData.validUntil) <= new Date(couponData.validFrom)) {
      res.status(400).json({ error: 'Valid until date must be after valid from date' });
      return;
    }

    const coupon = await Coupon.create(couponData);

    res.status(201).json({ 
      message: 'Coupon created successfully',
      coupon 
    });
  } catch (error: any) {
    logger.error('Error creating coupon:', error);
    
    if (error.code === 11000) {
      res.status(400).json({ error: 'Coupon code already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create coupon' });
    }
  }
};

/**
 * @api {get} /api/admin/coupons Get All Coupons
 * @apiName GetAllCoupons
 * @apiGroup Coupons
 * @apiPermission admin
 * 
 * @apiQuery {Number} [page=1] Page number
 * @apiQuery {Number} [limit=20] Coupons per page
 * @apiSuccess {Object} coupons Paginated coupons
 */
export const getAllCoupons = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [coupons, total] = await Promise.all([
      Coupon.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Coupon.countDocuments()
    ]);

    res.json({
      coupons,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalCoupons: total,
        limit
      }
    });
  } catch (error) {
    logger.error('Error fetching coupons:', error);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
};

/**
 * @api {get} /api/admin/coupons/:id Get Coupon by ID
 * @apiName GetCoupon
 * @apiGroup Coupons
 * @apiPermission admin
 * 
 * @apiParam {String} id Coupon ID
 * @apiSuccess {Object} coupon Coupon details with usage stats
 */
export const getCouponById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid coupon ID' });
      return;
    }

    const coupon = await Coupon.findById(id);

    if (!coupon) {
      res.status(404).json({ error: 'Coupon not found' });
      return;
    }

    // Get usage statistics
    const usageStats = await CouponUsage.aggregate([
      { $match: { coupon: coupon._id } },
      {
        $group: {
          _id: null,
          totalUsage: { $sum: 1 },
          totalDiscount: { $sum: '$discountAmount' },
          uniqueUsers: { $addToSet: '$user' }
        }
      }
    ]);

    res.json({
      coupon,
      stats: usageStats[0] || {
        totalUsage: 0,
        totalDiscount: 0,
        uniqueUsers: []
      }
    });
  } catch (error) {
    logger.error('Error fetching coupon:', error);
    res.status(500).json({ error: 'Failed to fetch coupon' });
  }
};

/**
 * @api {patch} /api/admin/coupons/:id Update Coupon
 * @apiName UpdateCoupon
 * @apiGroup Coupons
 * @apiPermission admin
 * 
 * @apiParam {String} id Coupon ID
 * @apiBody {Object} updates Coupon updates
 * @apiSuccess {Object} coupon Updated coupon
 */
export const updateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid coupon ID' });
      return;
    }

    // Prevent updating usage count directly
    delete updates.usageCount;

    const coupon = await Coupon.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!coupon) {
      res.status(404).json({ error: 'Coupon not found' });
      return;
    }

    res.json({ 
      message: 'Coupon updated successfully',
      coupon 
    });
  } catch (error) {
    logger.error('Error updating coupon:', error);
    res.status(500).json({ error: 'Failed to update coupon' });
  }
};

/**
 * @api {delete} /api/admin/coupons/:id Delete Coupon
 * @apiName DeleteCoupon
 * @apiGroup Coupons
 * @apiPermission admin
 * 
 * @apiParam {String} id Coupon ID
 * @apiSuccess {Object} message Success message
 */
export const deleteCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid coupon ID' });
      return;
    }

    const coupon = await Coupon.findByIdAndDelete(id);

    if (!coupon) {
      res.status(404).json({ error: 'Coupon not found' });
      return;
    }

    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    logger.error('Error deleting coupon:', error);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
};

/**
 * @api {get} /api/admin/coupons/:id/usage Get Coupon Usage History
 * @apiName GetCouponUsage
 * @apiGroup Coupons
 * @apiPermission admin
 * 
 * @apiParam {String} id Coupon ID
 * @apiQuery {Number} [page=1] Page number
 * @apiQuery {Number} [limit=20] Records per page
 * @apiSuccess {Object} usage Usage history
 */
export const getCouponUsage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid coupon ID' });
      return;
    }

    const [usage, total] = await Promise.all([
      CouponUsage.find({ coupon: id })
        .populate('user', 'firstName lastName email')
        .populate('order', 'total createdAt')
        .sort({ usedAt: -1 })
        .skip(skip)
        .limit(limit),
      CouponUsage.countDocuments({ coupon: id })
    ]);

    res.json({
      usage,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit
      }
    });
  } catch (error) {
    logger.error('Error fetching coupon usage:', error);
    res.status(500).json({ error: 'Failed to fetch coupon usage' });
  }
};
