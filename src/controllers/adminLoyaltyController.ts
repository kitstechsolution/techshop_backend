import { Request, Response } from 'express';
import { LoyaltyTier, UserLoyalty, LoyaltyTransaction, LoyaltyReward } from '../models/LoyaltyProgram.js';
import loyaltyService from '../services/loyaltyService.js';

// ==================== TIER MANAGEMENT ====================

/**
 * @desc    Get all loyalty tiers
 * @route   GET /api/admin/loyalty/tiers
 * @access  Admin
 */
export const getAllTiers = async (req: Request, res: Response) => {
  try {
    const tiers = await LoyaltyTier.find().sort({ level: 1 });

    res.json({
      success: true,
      count: tiers.length,
      data: tiers,
    });
  } catch (error) {
    console.error('Get all tiers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loyalty tiers',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Create new loyalty tier
 * @route   POST /api/admin/loyalty/tiers
 * @access  Admin
 */
export const createTier = async (req: Request, res: Response) => {
  try {
    const tier = await LoyaltyTier.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Tier created successfully',
      data: tier,
    });
  } catch (error) {
    console.error('Create tier error:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to create tier',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Update loyalty tier
 * @route   PUT /api/admin/loyalty/tiers/:tierId
 * @access  Admin
 */
export const updateTier = async (req: Request, res: Response) => {
  try {
    const { tierId } = req.params;

    const tier = await LoyaltyTier.findByIdAndUpdate(tierId, req.body, {
      new: true,
      runValidators: true,
    });

    if (!tier) {
      return res.status(404).json({
        success: false,
        message: 'Tier not found',
      });
    }

    res.json({
      success: true,
      message: 'Tier updated successfully',
      data: tier,
    });
  } catch (error) {
    console.error('Update tier error:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to update tier',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Delete loyalty tier
 * @route   DELETE /api/admin/loyalty/tiers/:tierId
 * @access  Admin
 */
export const deleteTier = async (req: Request, res: Response) => {
  try {
    const { tierId } = req.params;

    // Check if any users are in this tier
    const usersInTier = await UserLoyalty.countDocuments({ tier: tierId });

    if (usersInTier > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete tier. ${usersInTier} user(s) are currently in this tier.`,
      });
    }

    const tier = await LoyaltyTier.findByIdAndDelete(tierId);

    if (!tier) {
      return res.status(404).json({
        success: false,
        message: 'Tier not found',
      });
    }

    res.json({
      success: true,
      message: 'Tier deleted successfully',
    });
  } catch (error) {
    console.error('Delete tier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete tier',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ==================== REWARD MANAGEMENT ====================

/**
 * @desc    Get all rewards
 * @route   GET /api/admin/loyalty/rewards
 * @access  Admin
 */
export const getAllRewards = async (req: Request, res: Response) => {
  try {
    const { isActive, type } = req.query;

    const query: any = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    if (type) {
      query.type = type;
    }

    const rewards = await LoyaltyReward.find(query).sort({ pointsCost: 1 });

    res.json({
      success: true,
      count: rewards.length,
      data: rewards,
    });
  } catch (error) {
    console.error('Get all rewards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rewards',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Create new reward
 * @route   POST /api/admin/loyalty/rewards
 * @access  Admin
 */
export const createReward = async (req: Request, res: Response) => {
  try {
    const reward = await LoyaltyReward.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Reward created successfully',
      data: reward,
    });
  } catch (error) {
    console.error('Create reward error:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to create reward',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Update reward
 * @route   PUT /api/admin/loyalty/rewards/:rewardId
 * @access  Admin
 */
export const updateReward = async (req: Request, res: Response) => {
  try {
    const { rewardId } = req.params;

    const reward = await LoyaltyReward.findByIdAndUpdate(rewardId, req.body, {
      new: true,
      runValidators: true,
    });

    if (!reward) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found',
      });
    }

    res.json({
      success: true,
      message: 'Reward updated successfully',
      data: reward,
    });
  } catch (error) {
    console.error('Update reward error:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to update reward',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Delete reward
 * @route   DELETE /api/admin/loyalty/rewards/:rewardId
 * @access  Admin
 */
export const deleteReward = async (req: Request, res: Response) => {
  try {
    const { rewardId } = req.params;

    const reward = await LoyaltyReward.findByIdAndDelete(rewardId);

    if (!reward) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found',
      });
    }

    res.json({
      success: true,
      message: 'Reward deleted successfully',
    });
  } catch (error) {
    console.error('Delete reward error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete reward',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ==================== USER MANAGEMENT ====================

/**
 * @desc    Get all users with loyalty accounts
 * @route   GET /api/admin/loyalty/users
 * @access  Admin
 */
export const getAllUserLoyalty = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', tier, sortBy = 'lifetimePoints' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};
    if (tier) {
      query.tier = tier;
    }

    const sortOptions: any = {};
    if (sortBy === 'lifetimePoints') {
      sortOptions.lifetimePoints = -1;
    } else if (sortBy === 'currentPoints') {
      sortOptions.currentPoints = -1;
    } else if (sortBy === 'memberSince') {
      sortOptions.memberSince = -1;
    }

    const [users, total] = await Promise.all([
      UserLoyalty.find(query)
        .populate('user', 'name email')
        .populate('tier')
        .sort(sortOptions)
        .limit(limitNum)
        .skip(skip),
      UserLoyalty.countDocuments(query),
    ]);

    res.json({
      success: true,
      count: users.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      data: users,
    });
  } catch (error) {
    console.error('Get all user loyalty error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user loyalty data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Get user loyalty by user ID
 * @route   GET /api/admin/loyalty/users/:userId
 * @access  Admin
 */
export const getUserLoyalty = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const userLoyalty = await UserLoyalty.findOne({ user: userId })
      .populate('user', 'name email createdAt')
      .populate('tier');

    if (!userLoyalty) {
      return res.status(404).json({
        success: false,
        message: 'User loyalty account not found',
      });
    }

    // Get recent transactions
    const transactions = await LoyaltyTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        loyalty: userLoyalty,
        recentTransactions: transactions,
      },
    });
  } catch (error) {
    console.error('Get user loyalty error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user loyalty data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Adjust user points (admin)
 * @route   POST /api/admin/loyalty/users/:userId/adjust-points
 * @access  Admin
 */
export const adjustUserPoints = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { points, reason } = req.body;
    const adminId = req.user?._id;

    if (!points || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Points and reason are required',
      });
    }

    const updatedLoyalty = await loyaltyService.adjustPoints(userId, points, reason, adminId);

    res.json({
      success: true,
      message: 'Points adjusted successfully',
      data: updatedLoyalty,
    });
  } catch (error) {
    console.error('Adjust user points error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to adjust points',
    });
  }
};

/**
 * @desc    Award bonus points to user
 * @route   POST /api/admin/loyalty/users/:userId/bonus
 * @access  Admin
 */
export const awardBonusPoints = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { points, reason } = req.body;
    const adminId = req.user?._id;

    if (!points || points <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Points must be a positive number',
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required',
      });
    }

    const updatedLoyalty = await loyaltyService.awardBonusPoints(userId, points, reason, adminId);

    res.json({
      success: true,
      message: 'Bonus points awarded successfully',
      data: updatedLoyalty,
    });
  } catch (error) {
    console.error('Award bonus points error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to award bonus points',
    });
  }
};

// ==================== STATISTICS ====================

/**
 * @desc    Get loyalty program statistics
 * @route   GET /api/admin/loyalty/statistics
 * @access  Admin
 */
export const getLoyaltyStatistics = async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      totalPointsEarned,
      totalPointsRedeemed,
      tierDistribution,
      recentTransactions,
    ] = await Promise.all([
      UserLoyalty.countDocuments(),
      LoyaltyTransaction.aggregate([
        { $match: { type: 'earn' } },
        { $group: { _id: null, total: { $sum: '$points' } } },
      ]),
      LoyaltyTransaction.aggregate([
        { $match: { type: 'redeem' } },
        { $group: { _id: null, total: { $sum: { $abs: '$points' } } } },
      ]),
      UserLoyalty.aggregate([
        {
          $lookup: {
            from: 'loyaltytiers',
            localField: 'tier',
            foreignField: '_id',
            as: 'tierInfo',
          },
        },
        { $unwind: '$tierInfo' },
        {
          $group: {
            _id: '$tierInfo.name',
            count: { $sum: 1 },
            level: { $first: '$tierInfo.level' },
          },
        },
        { $sort: { level: 1 } },
      ]),
      LoyaltyTransaction.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('user', 'name email')
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalPointsEarned: totalPointsEarned[0]?.total || 0,
        totalPointsRedeemed: totalPointsRedeemed[0]?.total || 0,
        tierDistribution,
        recentTransactions,
      },
    });
  } catch (error) {
    console.error('Get loyalty statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loyalty statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
