import mongoose from 'mongoose';
import {
  LoyaltyTier,
  UserLoyalty,
  LoyaltyTransaction,
  LoyaltyReward,
  UserRewardRedemption,
  ILoyaltyTier,
  IUserLoyalty,
} from '../models/LoyaltyProgram.js';
import { addDays } from 'date-fns';

interface EarnPointsParams {
  userId: string;
  points: number;
  reason: string;
  reference?: {
    model: string;
    id: string;
  };
  metadata?: any;
}

interface RedeemPointsParams {
  userId: string;
  points: number;
  reason: string;
  reference?: {
    model: string;
    id: string;
  };
  metadata?: any;
}

class LoyaltyService {
  /**
   * Initialize loyalty account for a new user
   */
  async initializeUserLoyalty(userId: string): Promise<IUserLoyalty> {
    // Get the lowest tier (Bronze/Entry level)
    const lowestTier = await LoyaltyTier.findOne({ isActive: true }).sort({ level: 1 });

    if (!lowestTier) {
      throw new Error('No active loyalty tiers found');
    }

    const userLoyalty = await UserLoyalty.create({
      user: userId,
      tier: lowestTier._id,
      currentPoints: 0,
      lifetimePoints: 0,
      pointsToNextTier: await this.getPointsToNextTier(0, lowestTier.level),
      memberSince: new Date(),
    });

    return userLoyalty;
  }

  /**
   * Get user loyalty account (create if doesn't exist)
   */
  async getUserLoyalty(userId: string): Promise<IUserLoyalty> {
    const userLoyalty = await UserLoyalty.findOne({ user: userId }).populate('tier');

    if (!userLoyalty) {
      return await this.initializeUserLoyalty(userId);
    }

    return userLoyalty;
  }

  /**
   * Calculate points earned from order amount
   */
  calculatePointsFromOrder(orderAmount: number, tierMultiplier: number = 1.0): number {
    // Base: 1 point per 100 rupees spent, multiplied by tier multiplier
    const basePoints = Math.floor(orderAmount / 100);
    return Math.floor(basePoints * tierMultiplier);
  }

  /**
   * Earn points
   */
  async earnPoints(params: EarnPointsParams): Promise<IUserLoyalty> {
    const { userId, points, reason, reference, metadata } = params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const userLoyalty = await this.getUserLoyalty(userId);
      const balanceBefore = userLoyalty.currentPoints;

      // Update points
      userLoyalty.currentPoints += points;
      userLoyalty.lifetimePoints += points;
      userLoyalty.lastPointsEarned = new Date();
      userLoyalty.statistics.totalEarned += points;

      // Check for tier upgrade
      await this.checkAndUpgradeTier(userLoyalty);

      await userLoyalty.save({ session });

      // Create transaction record
      await LoyaltyTransaction.create(
        [
          {
            user: userId,
            type: 'earn',
            points,
            balanceBefore,
            balanceAfter: userLoyalty.currentPoints,
            reason,
            reference: reference ? { model: reference.model, id: reference.id } : null,
            metadata,
            status: 'completed',
          },
        ],
        { session }
      );

      await session.commitTransaction();
      return userLoyalty;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Redeem points
   */
  async redeemPoints(params: RedeemPointsParams): Promise<IUserLoyalty> {
    const { userId, points, reason, reference, metadata } = params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const userLoyalty = await this.getUserLoyalty(userId);

      if (userLoyalty.currentPoints < points) {
        throw new Error('Insufficient points');
      }

      const balanceBefore = userLoyalty.currentPoints;

      // Deduct points
      userLoyalty.currentPoints -= points;
      userLoyalty.lastPointsRedeemed = new Date();
      userLoyalty.statistics.totalRedeemed += points;

      await userLoyalty.save({ session });

      // Create transaction record
      await LoyaltyTransaction.create(
        [
          {
            user: userId,
            type: 'redeem',
            points: -points, // negative for redemption
            balanceBefore,
            balanceAfter: userLoyalty.currentPoints,
            reason,
            reference: reference ? { model: reference.model, id: reference.id } : null,
            metadata,
            status: 'completed',
          },
        ],
        { session }
      );

      await session.commitTransaction();
      return userLoyalty;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Award bonus points (admin or system)
   */
  async awardBonusPoints(
    userId: string,
    points: number,
    reason: string,
    adminId?: string
  ): Promise<IUserLoyalty> {
    return this.earnPoints({
      userId,
      points,
      reason,
      metadata: { adminId, type: 'bonus' },
    });
  }

  /**
   * Adjust points (admin only)
   */
  async adjustPoints(
    userId: string,
    points: number,
    reason: string,
    adminId: string
  ): Promise<IUserLoyalty> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const userLoyalty = await this.getUserLoyalty(userId);
      const balanceBefore = userLoyalty.currentPoints;

      userLoyalty.currentPoints = Math.max(0, userLoyalty.currentPoints + points);

      if (points > 0) {
        userLoyalty.lifetimePoints += points;
        userLoyalty.statistics.totalEarned += points;
      } else {
        userLoyalty.statistics.totalRedeemed += Math.abs(points);
      }

      await this.checkAndUpgradeTier(userLoyalty);
      await userLoyalty.save({ session });

      await LoyaltyTransaction.create(
        [
          {
            user: userId,
            type: 'adjustment',
            points,
            balanceBefore,
            balanceAfter: userLoyalty.currentPoints,
            reason,
            status: 'completed',
            createdBy: adminId,
          },
        ],
        { session }
      );

      await session.commitTransaction();
      return userLoyalty;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Check and upgrade user tier if eligible
   */
  async checkAndUpgradeTier(userLoyalty: IUserLoyalty): Promise<boolean> {
    const currentTier = (await LoyaltyTier.findById(userLoyalty.tier)) as ILoyaltyTier;
    const lifetimePoints = userLoyalty.lifetimePoints;

    // Check if user qualifies for a higher tier
    const higherTier = await LoyaltyTier.findOne({
      isActive: true,
      level: { $gt: currentTier.level },
      minPoints: { $lte: lifetimePoints },
    }).sort({ level: 1 });

    if (higherTier) {
      userLoyalty.tier = higherTier._id as any;
      userLoyalty.pointsToNextTier = await this.getPointsToNextTier(
        lifetimePoints,
        higherTier.level
      );
      return true;
    }

    // Update points to next tier
    userLoyalty.pointsToNextTier = await this.getPointsToNextTier(lifetimePoints, currentTier.level);
    return false;
  }

  /**
   * Get points needed to reach next tier
   */
  async getPointsToNextTier(currentLifetimePoints: number, currentLevel: number): Promise<number> {
    const nextTier = await LoyaltyTier.findOne({
      isActive: true,
      level: { $gt: currentLevel },
    }).sort({ level: 1 });

    if (!nextTier) {
      return 0; // Already at max tier
    }

    return Math.max(0, nextTier.minPoints - currentLifetimePoints);
  }

  /**
   * Get available rewards
   */
  async getAvailableRewards(userId?: string): Promise<any[]> {
    const now = new Date();
    const query: any = {
      isActive: true,
      $and: [
        { $or: [{ startDate: { $lte: now } }, { startDate: null }] },
        { $or: [{ endDate: { $gte: now } }, { endDate: null }] },
        { $or: [{ stock: { $gt: 0 } }, { stock: null }] },
      ],
    };

    const rewards = await LoyaltyReward.find(query).sort({ pointsCost: 1 });

    // If userId provided, check user's redemption history
    if (userId) {
      const userLoyalty = await this.getUserLoyalty(userId);
      const redemptionCounts = await UserRewardRedemption.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(userId),
            status: { $in: ['active', 'used'] },
          },
        },
        {
          $group: {
            _id: '$reward',
            count: { $sum: 1 },
          },
        },
      ]);

      const redemptionMap = new Map(redemptionCounts.map((r) => [r._id.toString(), r.count]));

      return rewards.map((reward) => {
        const userRedemptions = redemptionMap.get(String(reward._id)) || 0;
        const canRedeem =
          userLoyalty.currentPoints >= reward.pointsCost &&
          (!reward.maxUsesPerUser || userRedemptions < reward.maxUsesPerUser);

        return {
          ...reward.toObject(),
          canRedeem,
          userRedemptions,
        };
      });
    }

    return rewards;
  }

  /**
   * Redeem a reward
   */
  async redeemReward(userId: string, rewardId: string): Promise<any> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const reward = await LoyaltyReward.findById(rewardId);
      if (!reward) {
        throw new Error('Reward not found');
      }

      if (!reward.isActive) {
        throw new Error('Reward is not active');
      }

      // Check stock
      if (reward.stock !== null && reward.stock <= 0) {
        throw new Error('Reward is out of stock');
      }

      // Check date validity
      const now = new Date();
      if (reward.startDate && reward.startDate > now) {
        throw new Error('Reward is not yet available');
      }
      if (reward.endDate && reward.endDate < now) {
        throw new Error('Reward has expired');
      }

      // Check user's max uses
      if (reward.maxUsesPerUser) {
        const userRedemptions = await UserRewardRedemption.countDocuments({
          user: userId,
          reward: rewardId,
          status: { $in: ['active', 'used'] },
        });

        if (userRedemptions >= reward.maxUsesPerUser) {
          throw new Error('Maximum redemptions reached for this reward');
        }
      }

      // Redeem points
      await this.redeemPoints({
        userId,
        points: reward.pointsCost,
        reason: `Redeemed reward: ${reward.name}`,
        reference: { model: 'LoyaltyReward', id: rewardId },
        metadata: { rewardType: reward.type, rewardValue: reward.value },
      });

      // Generate unique redemption code
      const code = this.generateRedemptionCode();

      // Create redemption record
      const redemption = await UserRewardRedemption.create(
        [
          {
            user: userId,
            reward: rewardId,
            pointsSpent: reward.pointsCost,
            code,
            status: 'active',
            redeemedAt: new Date(),
            expiresAt: addDays(new Date(), reward.validityDays),
          },
        ],
        { session }
      );

      // Update reward stock
      if (reward.stock !== null) {
        reward.stock -= 1;
      }
      reward.redemptionCount += 1;
      await reward.save({ session });

      await session.commitTransaction();
      return redemption[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Generate unique redemption code
   */
  generateRedemptionCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar looking chars
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Get user's transaction history
   */
  async getTransactionHistory(
    userId: string,
    limit: number = 50,
    skip: number = 0
  ): Promise<any[]> {
    const transactions = await LoyaltyTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    return transactions;
  }

  /**
   * Get user's redemption history
   */
  async getRedemptionHistory(
    userId: string,
    limit: number = 50,
    skip: number = 0
  ): Promise<any[]> {
    const redemptions = await UserRewardRedemption.find({ user: userId })
      .populate('reward')
      .sort({ redeemedAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    return redemptions;
  }

  /**
   * Get all tiers
   */
  async getAllTiers(): Promise<ILoyaltyTier[]> {
    const tiers = await LoyaltyTier.find({ isActive: true }).sort({ level: 1 });
    return tiers;
  }

  /**
   * Award points for completed order
   */
  async awardPointsForOrder(userId: string, orderId: string, orderAmount: number): Promise<void> {
    const userLoyalty = await this.getUserLoyalty(userId);
    const tier = (await LoyaltyTier.findById(userLoyalty.tier)) as ILoyaltyTier;

    const points = this.calculatePointsFromOrder(orderAmount, tier.benefits.pointsMultiplier);

    if (points > 0) {
      await this.earnPoints({
        userId,
        points,
        reason: 'Points earned from order',
        reference: { model: 'Order', id: orderId },
        metadata: { orderAmount },
      });

      // Increment order count
      userLoyalty.statistics.ordersCompleted += 1;
      await userLoyalty.save();
    }
  }

  /**
   * Refund points for cancelled/refunded order
   */
  async refundPointsForOrder(userId: string, orderId: string, points: number): Promise<void> {
    await this.earnPoints({
      userId,
      points,
      reason: 'Points refunded due to order cancellation/refund',
      reference: { model: 'Order', id: orderId },
      metadata: { type: 'refund' },
    });
  }
}

export default new LoyaltyService();
