import mongoose, { Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  subcategory?: string;
  stock: number;
  ratings: Array<{
    userId: mongoose.Types.ObjectId;
    rating: number;
    review?: string;
  }>;
  averageRating: number;
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
  category: {
    type: String,
    required: true,
  },
  subcategory: {
    type: String,
    required: false,
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
    },
  }],
  averageRating: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Calculate average rating before saving
productSchema.pre('save', function(next) {
  if (this.ratings.length > 0) {
    const totalRating = this.ratings.reduce((sum, item) => sum + item.rating, 0);
    this.averageRating = totalRating / this.ratings.length;
  }
  next();
});

export const Product = mongoose.model<IProduct>('Product', productSchema); 