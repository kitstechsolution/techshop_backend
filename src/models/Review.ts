import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IReview extends Document {
  product: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  order?: mongoose.Types.ObjectId;
  rating: number; // 1-5
  title: string;
  content: string;
  images: string[];
  verified: boolean; // Verified purchase
  
  // Moderation
  status: 'pending' | 'approved' | 'rejected';
  moderationNotes?: string;
  moderatedBy?: mongoose.Types.ObjectId;
  moderatedAt?: Date;
  
  // Seller/Admin response
  reply?: {
    content: string;
    repliedBy: mongoose.Types.ObjectId;
    repliedAt: Date;
  };
  
  // User engagement
  helpfulVotes: number;
  unhelpfulVotes: number;
  votedBy: mongoose.Types.ObjectId[]; // Users who voted
  
  // Reporting
  reported: boolean;
  reportCount: number;
  reportReasons: string[];
  
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  voteHelpful(userId: mongoose.Types.ObjectId, helpful: boolean): Promise<void>;
}

// Static methods interface
interface IReviewModel extends Model<IReview> {
  getProductReviews(
    productId: mongoose.Types.ObjectId,
    options?: {
      page?: number;
      limit?: number;
      sort?: string;
      minRating?: number;
      maxRating?: number;
      verified?: boolean;
    }
  ): Promise<{
    reviews: IReview[];
    pagination: {
      total: number;
      page: number;
      pages: number;
      limit: number;
    };
    stats: {
      averageRating: number;
      totalReviews: number;
      ratingDistribution: { rating: number; count: number }[];
      verifiedPurchaseCount: number;
    };
  }>;
  
  getProductStats(productId: mongoose.Types.ObjectId): Promise<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { rating: number; count: number }[];
    verifiedPurchaseCount: number;
  }>;
  
  canUserReview(
    userId: mongoose.Types.ObjectId,
    productId: mongoose.Types.ObjectId
  ): Promise<{ canReview: boolean; reason?: string }>;
}

const reviewSchema = new Schema<IReview, IReviewModel>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: false,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be an integer',
      },
    },
    title: {
      type: String,
      required: false,
      trim: true,
      maxlength: 100,
    },
    content: {
      type: String,
      required: false,
      trim: true,
      maxlength: 2000,
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (images: string[]) {
          return images.length <= 5;
        },
        message: 'Maximum 5 images allowed',
      },
    },
    verified: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    // Moderation
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    moderationNotes: {
      type: String,
      trim: true,
    },
    moderatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    moderatedAt: {
      type: Date,
    },
    
    // Seller/Admin response
    reply: {
      content: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
      repliedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      repliedAt: {
        type: Date,
      },
    },
    
    // User engagement
    helpfulVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    unhelpfulVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    votedBy: {
      type: [Schema.Types.ObjectId],
      default: [],
      ref: 'User',
    },
    
    // Reporting
    reported: {
      type: Boolean,
      default: false,
      index: true,
    },
    reportCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reportReasons: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ product: 1, rating: 1 });
reviewSchema.index({ user: 1, product: 1 }, { unique: true }); // One review per user per product
reviewSchema.index({ status: 1, createdAt: -1 });
reviewSchema.index({ reported: 1 });

// Instance method: Mark as helpful/unhelpful
reviewSchema.methods.voteHelpful = async function (
  userId: mongoose.Types.ObjectId,
  helpful: boolean
): Promise<void> {
  // Check if user already voted
  const hasVoted = this.votedBy.some((id: mongoose.Types.ObjectId) => id.equals(userId));
  
  if (!hasVoted) {
    if (helpful) {
      this.helpfulVotes += 1;
    } else {
      this.unhelpfulVotes += 1;
    }
    this.votedBy.push(userId);
    await this.save();
  }
};

// Static method: Get product reviews with pagination and filters
reviewSchema.statics.getProductReviews = async function (
  productId: mongoose.Types.ObjectId,
  options: {
    page?: number;
    limit?: number;
    sort?: string;
    minRating?: number;
    maxRating?: number;
    verified?: boolean;
  } = {}
) {
  const {
    page = 1,
    limit = 10,
    sort = '-createdAt',
    minRating,
    maxRating,
    verified,
  } = options;
  
  const skip = (page - 1) * limit;
  
  // Build query
  const query: any = {
    product: productId,
    status: 'approved',
  };
  
  if (minRating !== undefined) {
    query.rating = { ...query.rating, $gte: minRating };
  }
  
  if (maxRating !== undefined) {
    query.rating = { ...query.rating, $lte: maxRating };
  }
  
  if (verified !== undefined) {
    query.verified = verified;
  }
  
  // Get reviews
  const reviews = await this.find(query)
    .populate('user', 'firstName lastName')
    .populate('reply.repliedBy', 'firstName lastName role')
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
  
  const total = await this.countDocuments(query);
  
  // Get stats
  const stats = await this.getProductStats(productId);
  
  return {
    reviews,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    },
    stats,
  };
};

// Static method: Get product review statistics
reviewSchema.statics.getProductStats = async function (
  productId: mongoose.Types.ObjectId
) {
  const stats = await this.aggregate([
    {
      $match: {
        product: productId,
        status: 'approved',
      },
    },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              averageRating: { $avg: '$rating' },
              totalReviews: { $sum: 1 },
              verifiedPurchaseCount: {
                $sum: { $cond: ['$verified', 1, 0] },
              },
            },
          },
        ],
        distribution: [
          {
            $group: {
              _id: '$rating',
              count: { $sum: 1 },
            },
          },
          {
            $sort: { _id: -1 },
          },
        ],
      },
    },
  ]);
  
  const summary = stats[0]?.summary[0] || {
    averageRating: 0,
    totalReviews: 0,
    verifiedPurchaseCount: 0,
  };
  
  const distribution = stats[0]?.distribution || [];
  
  // Fill in missing ratings
  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => {
    const found = distribution.find((d: any) => d._id === rating);
    return {
      rating,
      count: found?.count || 0,
    };
  });
  
  return {
    averageRating: Math.round(summary.averageRating * 10) / 10,
    totalReviews: summary.totalReviews,
    ratingDistribution,
    verifiedPurchaseCount: summary.verifiedPurchaseCount,
  };
};

// Static method: Check if user can review product
reviewSchema.statics.canUserReview = async function (
  userId: mongoose.Types.ObjectId,
  productId: mongoose.Types.ObjectId
) {
  // Check if user already reviewed this product
  const existingReview = await this.findOne({ user: userId, product: productId });
  
  if (existingReview) {
    return {
      canReview: false,
      reason: 'You have already reviewed this product',
    };
  }
  
  // Check if user has purchased this product
  const Order = mongoose.model('Order');
  const purchasedOrder = await Order.findOne({
    user: userId,
    'items.product': productId,
    status: 'delivered',
  });
  
  if (!purchasedOrder) {
    return {
      canReview: false,
      reason: 'You can only review products you have purchased and received',
    };
  }
  
  return {
    canReview: true,
  };
};

// Post-save: update product aggregated rating fields when an approved review exists
reviewSchema.post('save', async function (doc) {
  if (doc.status === 'approved') {
    const Product = mongoose.model('Product');
    const stats = await Review.getProductStats(doc.product);
    await Product.findByIdAndUpdate(doc.product, {
      averageRating: stats.averageRating,
      totalReviews: stats.totalReviews,
      // maintain legacy fields if present
      rating: stats.averageRating,
      numReviews: stats.totalReviews,
    });
  }
});

// Post-delete: update product aggregates if an approved review was removed
reviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc && doc.status === 'approved') {
    const Product = mongoose.model('Product');
    const stats = await Review.getProductStats(doc.product);
    await Product.findByIdAndUpdate(doc.product, {
      averageRating: stats.averageRating,
      totalReviews: stats.totalReviews,
      rating: stats.averageRating,
      numReviews: stats.totalReviews,
    });
  }
});

export const Review = mongoose.model<IReview, IReviewModel>('Review', reviewSchema);
