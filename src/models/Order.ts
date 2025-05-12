import mongoose, { Document } from 'mongoose';

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId;
  items: Array<{
    product: mongoose.Types.ObjectId;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'completed' | 'failed';
  trackingNumber?: string;
}

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  }],
  total: {
    type: Number,
    required: true,
  },
  shippingAddress: {
    street: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    pincode: {
      type: String,
      required: true,
    },
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  trackingNumber: {
    type: String,
  },
}, {
  timestamps: true,
});

// Calculate total before saving
orderSchema.pre('save', function(next) {
  if (this.items.length > 0) {
    this.total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }
  next();
});

export const Order = mongoose.model<IOrder>('Order', orderSchema); 