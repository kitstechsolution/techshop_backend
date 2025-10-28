import mongoose, { Document } from 'mongoose';

export interface ICancelRequest extends Document {
  order: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  reason: string;
  additionalDetails?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  adminNotes?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  refundAmount?: number;
  refundStatus?: 'not_initiated' | 'processing' | 'completed' | 'failed';
  refundReference?: string;
  createdAt: Date;
  updatedAt: Date;
}

const cancelRequestSchema = new mongoose.Schema({
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
      'changed_mind',
      'found_better_price',
      'ordered_by_mistake',
      'delivery_time_too_long',
      'product_not_needed',
      'duplicate_order',
      'other'
    ],
  },
  additionalDetails: {
    type: String,
    maxlength: 500,
    trim: true,
  },
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
  refundAmount: {
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
}, {
  timestamps: true,
});

// Compound indexes
cancelRequestSchema.index({ user: 1, status: 1 });
cancelRequestSchema.index({ order: 1, status: 1 });
cancelRequestSchema.index({ status: 1, createdAt: -1 });

// Prevent duplicate cancel requests for same order
cancelRequestSchema.index({ order: 1 }, { 
  unique: true,
  partialFilterExpression: { status: { $in: ['pending', 'approved'] } }
});

export const CancelRequest = mongoose.model<ICancelRequest>('CancelRequest', cancelRequestSchema);
