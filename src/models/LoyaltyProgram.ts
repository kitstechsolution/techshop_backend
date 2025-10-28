import mongoose, { Document, Schema } from 'mongoose';

// ==================== LOYALTY TIER ====================
export interface ILoyaltyTier extends Document {
  name: string;
  level: number;
  minPoints: number;
  maxPoints: number | null; // null for highest tier
  benefits: {
    pointsMultiplier: number; // e.g., 1.5x points on purchases
    discountPercentage: number; // e.g., 5% discount on all purchases
    freeShipping: boolean;
    earlyAccess: boolean; // early access to sales/new products
    specialSupport: boolean;
    birthdayBonus: number; // extra points on birthday
  };
  badgeColor: string; // hex color for display
  badgeIcon: string; // icon or emoji
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const loyaltyTierSchema = new Schema<ILoyaltyTier>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    level: {
      type: Number,
      required: true,
      unique: true,
    },
    minPoints: {
      type: Number,
      required: true,
      default: 0,
    },
    maxPoints: {
      type: Number,
      default: null, // null means unlimited (highest tier)
    },
    benefits: {
      pointsMultiplier: {
        type: Number,
        default: 1.0,
        min: 1.0,
      },
      discountPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      freeShipping: {
        type: Boolean,
        default: false,
      },
      earlyAccess: {
        type: Boolean,
        default: false,
      },
      specialSupport: {
        type: Boolean,
        default: false,
      },
      birthdayBonus: {
        type: Number,
        default: 0,
      },
    },
    badgeColor: {
      type: String,
      default: '#808080',
    },
    badgeIcon: {
      type: String,
      default: '⭐',
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for sorting by level
loyaltyTierSchema.index({ level: 1 });

export const LoyaltyTier = mongoose.model<ILoyaltyTier>('LoyaltyTier', loyaltyTierSchema);

// ==================== USER LOYALTY ====================
export interface IUserLoyalty extends Document {
  user: mongoose.Types.ObjectId;
  currentPoints: number;
  lifetimePoints: number; // total points earned ever
  tier: mongoose.Types.ObjectId;
  pointsToNextTier: number;
  memberSince: Date;
  lastPointsEarned: Date;
  lastPointsRedeemed: Date;
  statistics: {
    totalEarned: number;
    totalRedeemed: number;
    totalExpired: number;
    ordersCompleted: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userLoyaltySchema = new Schema<IUserLoyalty>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    currentPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    lifetimePoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    tier: {
      type: Schema.Types.ObjectId,
      ref: 'LoyaltyTier',
      required: true,
    },
    pointsToNextTier: {
      type: Number,
      default: 0,
    },
    memberSince: {
      type: Date,
      default: Date.now,
    },
    lastPointsEarned: {
      type: Date,
    },
    lastPointsRedeemed: {
      type: Date,
    },
    statistics: {
      totalEarned: {
        type: Number,
        default: 0,
      },
      totalRedeemed: {
        type: Number,
        default: 0,
      },
      totalExpired: {
        type: Number,
        default: 0,
      },
      ordersCompleted: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for querying by user
userLoyaltySchema.index({ user: 1 });
userLoyaltySchema.index({ tier: 1 });

export const UserLoyalty = mongoose.model<IUserLoyalty>('UserLoyalty', userLoyaltySchema);

// ==================== LOYALTY TRANSACTION ====================
export interface ILoyaltyTransaction extends Document {
  user: mongoose.Types.ObjectId;
  type: 'earn' | 'redeem' | 'expire' | 'bonus' | 'refund' | 'adjustment';
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  reference: {
    model: string; // 'Order', 'Review', 'Referral', etc.
    id: mongoose.Types.ObjectId;
  } | null;
  metadata: {
    orderId?: string;
    orderAmount?: number;
    discountApplied?: number;
    expiryDate?: Date;
    notes?: string;
  };
  status: 'pending' | 'completed' | 'cancelled';
  createdBy: mongoose.Types.ObjectId | null; // admin who created (for manual adjustments)
  createdAt: Date;
  updatedAt: Date;
}

const loyaltyTransactionSchema = new Schema<ILoyaltyTransaction>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['earn', 'redeem', 'expire', 'bonus', 'refund', 'adjustment'],
      required: true,
    },
    points: {
      type: Number,
      required: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    reference: {
      model: {
        type: String,
      },
      id: {
        type: Schema.Types.ObjectId,
      },
    },
    metadata: {
      orderId: String,
      orderAmount: Number,
      discountApplied: Number,
      expiryDate: Date,
      notes: String,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'completed',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for querying
loyaltyTransactionSchema.index({ user: 1, createdAt: -1 });
loyaltyTransactionSchema.index({ type: 1 });
loyaltyTransactionSchema.index({ status: 1 });
loyaltyTransactionSchema.index({ 'reference.model': 1, 'reference.id': 1 });

export const LoyaltyTransaction = mongoose.model<ILoyaltyTransaction>(
  'LoyaltyTransaction',
  loyaltyTransactionSchema
);

// ==================== LOYALTY REWARD ====================
export interface ILoyaltyReward extends Document {
  name: string;
  description: string;
  type: 'discount' | 'freeProduct' | 'freeShipping' | 'giftCard' | 'custom';
  pointsCost: number;
  value: number; // monetary value or percentage
  stock: number | null; // null for unlimited
  validityDays: number; // days the reward is valid after redemption
  minOrderAmount: number; // minimum order amount to use reward
  maxUsesPerUser: number | null; // null for unlimited
  termsAndConditions: string;
  image: string;
  isActive: boolean;
  startDate: Date;
  endDate: Date | null;
  redemptionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const loyaltyRewardSchema = new Schema<ILoyaltyReward>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['discount', 'freeProduct', 'freeShipping', 'giftCard', 'custom'],
      required: true,
    },
    pointsCost: {
      type: Number,
      required: true,
      min: 1,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      default: null, // null = unlimited
      min: 0,
    },
    validityDays: {
      type: Number,
      default: 30,
      min: 1,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxUsesPerUser: {
      type: Number,
      default: null, // null = unlimited
      min: 1,
    },
    termsAndConditions: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null, // null = no end date
    },
    redemptionCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
loyaltyRewardSchema.index({ isActive: 1, pointsCost: 1 });
loyaltyRewardSchema.index({ type: 1 });

export const LoyaltyReward = mongoose.model<ILoyaltyReward>('LoyaltyReward', loyaltyRewardSchema);

// ==================== USER REWARD REDEMPTION ====================
export interface IUserRewardRedemption extends Document {
  user: mongoose.Types.ObjectId;
  reward: mongoose.Types.ObjectId;
  pointsSpent: number;
  code: string; // unique redemption code
  status: 'active' | 'used' | 'expired' | 'cancelled';
  redeemedAt: Date;
  usedAt: Date | null;
  expiresAt: Date;
  order: mongoose.Types.ObjectId | null; // order where reward was used
  createdAt: Date;
  updatedAt: Date;
}

const userRewardRedemptionSchema = new Schema<IUserRewardRedemption>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reward: {
      type: Schema.Types.ObjectId,
      ref: 'LoyaltyReward',
      required: true,
    },
    pointsSpent: {
      type: Number,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['active', 'used', 'expired', 'cancelled'],
      default: 'active',
    },
    redeemedAt: {
      type: Date,
      default: Date.now,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userRewardRedemptionSchema.index({ user: 1, status: 1 });
userRewardRedemptionSchema.index({ code: 1 });
userRewardRedemptionSchema.index({ expiresAt: 1 });

export const UserRewardRedemption = mongoose.model<IUserRewardRedemption>(
  'UserRewardRedemption',
  userRewardRedemptionSchema
);
