import mongoose, { Document } from 'mongoose';

export type DiscountType = 'percentage' | 'fixed';
export type CouponStatus = 'active' | 'inactive' | 'expired';

export interface ICoupon extends Document {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usageCount: number;
  perUserLimit?: number;
  validFrom: Date;
  validUntil: Date;
  status: CouponStatus;
  applicableCategories?: string[];
  excludedCategories?: string[];
  applicableProducts?: mongoose.Types.ObjectId[];
  excludedProducts?: mongoose.Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Virtuals
  isValid: boolean;
  isExpired: boolean;
  // Methods
  calculateDiscount(cartTotal: number): number;
  canUserUse(userId: mongoose.Types.ObjectId, userUsageCount: number): boolean;
}

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true,
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0,
  },
  minPurchaseAmount: {
    type: Number,
    min: 0,
    default: 0,
  },
  maxDiscountAmount: {
    type: Number,
    min: 0,
  },
  usageLimit: {
    type: Number,
    min: 0,
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  perUserLimit: {
    type: Number,
    min: 1,
    default: 1,
  },
  validFrom: {
    type: Date,
    required: true,
    default: Date.now,
  },
  validUntil: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired'],
    default: 'active',
  },
  applicableCategories: [{
    type: String,
  }],
  excludedCategories: [{
    type: String,
  }],
  applicableProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  }],
  excludedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
couponSchema.index({ code: 1, isActive: 1 });
couponSchema.index({ validFrom: 1, validUntil: 1 });
couponSchema.index({ status: 1, isActive: 1 });

// Virtual for checking if coupon is expired
couponSchema.virtual('isExpired').get(function() {
  return new Date() > this.validUntil;
});

// Virtual for checking if coupon is valid
couponSchema.virtual('isValid').get(function() {
  const now = new Date();
  return (
    this.isActive &&
    this.status === 'active' &&
    now >= this.validFrom &&
    now <= this.validUntil &&
    (!this.usageLimit || this.usageCount < this.usageLimit)
  );
});

// Method to check if user can use this coupon
couponSchema.methods.canUserUse = function(userId: mongoose.Types.ObjectId, userUsageCount: number): boolean {
  if (!this.isValid) return false;
  if (this.perUserLimit && userUsageCount >= this.perUserLimit) return false;
  return true;
};

// Method to calculate discount amount
couponSchema.methods.calculateDiscount = function(cartTotal: number): number {
  if (cartTotal < (this.minPurchaseAmount || 0)) {
    return 0;
  }

  let discount = 0;
  
  if (this.discountType === 'percentage') {
    discount = (cartTotal * this.discountValue) / 100;
    
    // Apply max discount cap if specified
    if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
      discount = this.maxDiscountAmount;
    }
  } else if (this.discountType === 'fixed') {
    discount = this.discountValue;
    
    // Discount cannot exceed cart total
    if (discount > cartTotal) {
      discount = cartTotal;
    }
  }

  return Math.round(discount * 100) / 100; // Round to 2 decimal places
};

// Update status based on date before each query
couponSchema.pre(/^find/, function(next) {
  const now = new Date();
  
  // Update expired coupons
  mongoose.model('Coupon').updateMany(
    {
      validUntil: { $lt: now },
      status: { $ne: 'expired' }
    },
    { status: 'expired' }
  ).exec().catch((err: any) => console.error('Error updating expired coupons:', err));
  
  next();
});

export const Coupon = mongoose.model<ICoupon>('Coupon', couponSchema);
