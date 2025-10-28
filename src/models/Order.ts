import mongoose, { Document } from 'mongoose';

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId;
  items: Array<{
    product: mongoose.Types.ObjectId;
    name: string;
    price: number;
    quantity: number;
  }>;
  subtotal: number;
  discountAmount?: number;
  discount?: number; // Alias for discountAmount
  couponCode?: string;
  total: number;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  refundStatus?: 'none' | 'requested' | 'processing' | 'completed' | 'rejected';
  refundAmount?: number;
  paymentMethod?: 'razorpay' | 'cash' | 'standard';
  paymentId?: string;
  paymentOrderId?: string;
  paymentSignature?: string;
  paymentError?: string;
  paymentAttempts?: number;
  trackingNumber?: string;
  estimatedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  shippingProvider?: string;
  shippingCost?: number;
  tax?: number;
  totalAmount?: number;
  orderNumber?: string;
  notes?: string;
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
  subtotal: {
    type: Number,
    required: true,
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  couponCode: {
    type: String,
    uppercase: true,
  },
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
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'cash', 'standard'],
  },
  paymentId: {
    type: String,
  },
  paymentOrderId: {
    type: String,
  },
  paymentSignature: {
    type: String,
  },
  paymentError: {
    type: String,
  },
  paymentAttempts: {
    type: Number,
    default: 0,
  },
  trackingNumber: {
    type: String,
  },
  estimatedDeliveryDate: {
    type: Date,
  },
  actualDeliveryDate: {
    type: Date,
  },
  shippingProvider: {
    type: String,
    trim: true,
  },
  shippingCost: {
    type: Number,
    default: 0,
    min: 0,
  },
  tax: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  orderNumber: {
    type: String,
    unique: true,
    sparse: true,
  },
  notes: {
    type: String,
    trim: true,
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