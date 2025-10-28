import mongoose, { Document } from 'mongoose';

export interface IRefundRequest extends Document {
  order: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  reason: string;
  additionalDetails?: string;
  refundType: 'full' | 'partial';
  requestedAmount?: number;
  images?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  adminNotes?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  approvedAmount?: number;
  refundStatus?: 'not_initiated' | 'processing' | 'completed' | 'failed';
  refundReference?: string;
  refundMethod?: 'original_payment' | 'wallet' | 'bank_transfer';
  returnRequired: boolean;
  returnStatus?: 'not_required' | 'pending' | 'picked_up' | 'received' | 'verified';
  returnTrackingId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const refundRequestSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'defective_product',
      'wrong_item_received',
      'not_as_described',
      'damaged_in_shipping',
      'quality_issues',
      'size_fit_issues',
      'late_delivery',
      'missing_parts',
      'other'
    ],
  },
  additionalDetails: {
    type: String,
    maxlength: 1000,
    trim: true,
  },
  refundType: {
    type: String,
    enum: ['full', 'partial'],
    required: true,
  },
  requestedAmount: {
    type: Number,
    min: 0,
  },
  images: [{
    type: String,
    trim: true,
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending',
  },
  adminNotes: {
    type: String,
    maxlength: 1000,
    trim: true,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: {
    type: Date,
  },
  approvedAmount: {
    type: Number,
    min: 0,
  },
  refundStatus: {
    type: String,
    enum: ['not_initiated', 'processing', 'completed', 'failed'],
    default: 'not_initiated',
  },
  refundReference: {
    type: String,
    trim: true,
  },
  refundMethod: {
    type: String,
    enum: ['original_payment', 'wallet', 'bank_transfer'],
    default: 'original_payment',
  },
  returnRequired: {
    type: Boolean,
    default: true,
  },
  returnStatus: {
    type: String,
    enum: ['not_required', 'pending', 'picked_up', 'received', 'verified'],
    default: 'not_required',
  },
  returnTrackingId: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

// Compound indexes
refundRequestSchema.index({ user: 1, status: 1 });
refundRequestSchema.index({ order: 1, status: 1 });
refundRequestSchema.index({ status: 1, createdAt: -1 });
refundRequestSchema.index({ returnStatus: 1 });

// Prevent duplicate refund requests for same order
refundRequestSchema.index({ order: 1 }, { 
  unique: true,
  partialFilterExpression: { status: { $in: ['pending', 'approved'] } }
});

export const RefundRequest = mongoose.model<IRefundRequest>('RefundRequest', refundRequestSchema);
