import mongoose, { Document } from 'mongoose';

export interface ICouponUsage extends Document {
  coupon: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  order: mongoose.Types.ObjectId;
  discountAmount: number;
  usedAt: Date;
}

const couponUsageSchema = new mongoose.Schema({
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    required: true,
    index: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  discountAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  usedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Compound index for efficient user-coupon queries
couponUsageSchema.index({ user: 1, coupon: 1 });
couponUsageSchema.index({ coupon: 1, usedAt: -1 });

export const CouponUsage = mongoose.model<ICouponUsage>('CouponUsage', couponUsageSchema);
