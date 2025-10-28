import mongoose, { Document } from 'mongoose';

export interface IReview {
  _id?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userName?: string;
  rating: number;
  review?: string;
  approved: boolean;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBadge {
  type: 'new' | 'sale' | 'hot' | 'bestseller' | 'limited' | 'exclusive' | 'featured' | 'trending';
  label?: string; // Custom label, defaults to type
  color?: string; // Hex color
  startDate?: Date;
  endDate?: Date;
  priority?: number; // For ordering multiple badges
}

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  images?: string[]; // Additional product images
  category: string;
  subcategory?: string;
  brand?: string;
  tags?: string[];
  stock: number;
  badges?: IBadge[];
  ratings: IReview[];
  averageRating: number;
  totalReviews: number;
  approvedReviewsCount: number;
  isFeatured?: boolean;
  discount?: number;
  lowStockThreshold?: number;
  isActive?: boolean;
}

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  images: [{
    type: String,
  }],
  category: {
    type: String,
    required: true,
  },
  subcategory: {
    type: String,
    required: false,
  },
  brand: {
    type: String,
    trim: true,
    index: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  badges: [{
    type: {
      type: String,
      enum: ['new', 'sale', 'hot', 'bestseller', 'limited', 'exclusive', 'featured', 'trending'],
      required: true,
    },
    label: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    priority: {
      type: Number,
      default: 0,
    },
  }],
  lowStockThreshold: {
    type: Number,
    default: 10,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  isFeatured: {
    type: Boolean,
    default: false,
    index: true,
  },
  discount: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
  },
  ratings: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: {
      type: String,
      required: false,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    approved: {
      type: Boolean,
      default: false,
      index: true,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  totalReviews: {
    type: Number,
    default: 0,
    min: 0,
  },
  approvedReviewsCount: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true,
});

// Text index for search functionality
productSchema.index({ 
  name: 'text', 
  description: 'text', 
  category: 'text',
  subcategory: 'text',
  brand: 'text',
  tags: 'text'
});

// Indexes for filtering and sorting
productSchema.index({ category: 1, price: 1 });
productSchema.index({ price: 1 });
productSchema.index({ averageRating: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ stock: 1 });

// Calculate average rating and counts before saving
productSchema.pre('save', function(next) {
  // Calculate total reviews
  this.totalReviews = this.ratings.length;
  
  // Calculate approved reviews count
  const approvedReviews = this.ratings.filter(r => r.approved);
  this.approvedReviewsCount = approvedReviews.length;
  
  // Calculate average rating (only from approved reviews)
  if (approvedReviews.length > 0) {
    const totalRating = approvedReviews.reduce((sum, item) => sum + item.rating, 0);
    this.averageRating = Number((totalRating / approvedReviews.length).toFixed(1));
  } else {
    this.averageRating = 0;
  }
  
  next();
});

export const Product = mongoose.model<IProduct>('Product', productSchema); 