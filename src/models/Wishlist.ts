import mongoose, { Document, Types } from 'mongoose';

export interface IWishlist extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  products: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  // Instance methods
  addProduct(productId: Types.ObjectId): Promise<this>;
  removeProduct(productId: Types.ObjectId): Promise<this>;
  hasProduct(productId: Types.ObjectId): boolean;
  clear(): Promise<this>;
}

const wishlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // Each user can only have one wishlist
    index: true,
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  }],
}, {
  timestamps: true,
});

// Index for efficient queries
wishlistSchema.index({ user: 1, products: 1 });

// Methods
wishlistSchema.methods.addProduct = function(productId: Types.ObjectId) {
  if (!this.products.includes(productId)) {
    this.products.push(productId);
  }
  return this.save();
};

wishlistSchema.methods.removeProduct = function(productId: Types.ObjectId) {
  this.products = this.products.filter(
    (id: Types.ObjectId) => id.toString() !== productId.toString()
  );
  return this.save();
};

wishlistSchema.methods.hasProduct = function(productId: Types.ObjectId): boolean {
  return this.products.some(
    (id: Types.ObjectId) => id.toString() === productId.toString()
  );
};

wishlistSchema.methods.clear = function() {
  this.products = [];
  return this.save();
};

export const Wishlist = mongoose.model<IWishlist>('Wishlist', wishlistSchema);
