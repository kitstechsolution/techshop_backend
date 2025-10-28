import mongoose, { Document } from 'mongoose';

export interface IRecentlyViewed extends Document {
  user: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  viewedAt: Date;
}

const recentlyViewedSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  viewedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: false, // We're using viewedAt instead
});

// Compound index for efficient user queries
recentlyViewedSchema.index({ user: 1, viewedAt: -1 });
recentlyViewedSchema.index({ user: 1, product: 1 }, { unique: true });

// TTL index to automatically delete old entries after 90 days
recentlyViewedSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

export const RecentlyViewed = mongoose.model<IRecentlyViewed>('RecentlyViewed', recentlyViewedSchema);
