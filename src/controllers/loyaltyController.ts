import { Request, Response } from 'express';
import loyaltyService from '../services/loyaltyService.js';

/**
 * @desc    Get user's loyalty account
 * @route   GET /api/loyalty/account
 * @access  Private
 */
export const getMyLoyaltyAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    const userLoyalty = await loyaltyService.getUserLoyalty(userId);

    res.json({
      success: true,
      data: userLoyalty,
    });
  } catch (error) {
    console.error('Get loyalty account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loyalty account',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Get all loyalty tiers
 * @route   GET /api/loyalty/tiers
 * @access  Public
 */
export const getLoyaltyTiers = async (req: Request, res: Response) => {
  try {
    const tiers = await loyaltyService.getAllTiers();

    res.json({
      success: true,
      count: tiers.length,
      data: tiers,
    });
  } catch (error) {
    console.error('Get loyalty tiers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loyalty tiers',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Get user's transaction history
 * @route   GET /api/loyalty/transactions
 * @access  Private
 */
export const getMyTransactions = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { limit = '50', page = '1' } = req.query;

    const limitNum = parseInt(limit as string);
    const skip = (parseInt(page as string) - 1) * limitNum;

    const transactions = await loyaltyService.getTransactionHistory(userId, limitNum, skip);

    res.json({
      success: true,
      count: transactions.length,
      page: parseInt(page as string),
      data: transactions,
    });
  } catch (error) {
    console.error('Get loyalty transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loyalty transactions',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Get available rewards
 * @route   GET /api/loyalty/rewards
 * @access  Private
 */
export const getAvailableRewards = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    const rewards = await loyaltyService.getAvailableRewards(userId);

    res.json({
      success: true,
      count: rewards.length,
      data: rewards,
    });
  } catch (error) {
    console.error('Get available rewards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available rewards',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Redeem a reward
 * @route   POST /api/loyalty/rewards/:rewardId/redeem
 * @access  Private
 */
export const redeemReward = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { rewardId } = req.params;

    const redemption = await loyaltyService.redeemReward(userId, rewardId);

    res.json({
      success: true,
      message: 'Reward redeemed successfully',
      data: redemption,
    });
  } catch (error) {
    console.error('Redeem reward error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to redeem reward',
    });
  }
};

/**
 * @desc    Get user's redemption history
 * @route   GET /api/loyalty/redemptions
 * @access  Private
 */
export const getMyRedemptions = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { limit = '50', page = '1' } = req.query;

    const limitNum = parseInt(limit as string);
    const skip = (parseInt(page as string) - 1) * limitNum;

    const redemptions = await loyaltyService.getRedemptionHistory(userId, limitNum, skip);

    res.json({
      success: true,
      count: redemptions.length,
      page: parseInt(page as string),
      data: redemptions,
    });
  } catch (error) {
    console.error('Get redemption history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch redemption history',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
