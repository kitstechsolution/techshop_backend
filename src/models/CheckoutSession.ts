import mongoose, { Schema, Document } from 'mongoose';

// Interface for checkout session items
interface ICheckoutItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  image: string;
  variantId?: string;
}

// Interface for address
interface IAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// Interface for shipping method
interface IShippingMethod {
  id: string;
  name: string;
  description: string;
  cost: number;
  estimatedDays: number;
  carrier: string;
}

// Interface for payment method
interface IPaymentMethod {
  id: string;
  type: 'credit_card' | 'debit_card' | 'upi' | 'net_banking' | 'wallet' | 'cod';
  provider: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

// Interface for CheckoutSession document
export interface ICheckoutSession extends Document {
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  cartId?: string;
  items: ICheckoutItem[];
  shippingAddress?: IAddress;
  billingAddress?: IAddress;
  useSameAddress: boolean;
  shippingMethod?: IShippingMethod;
  paymentMethod?: IPaymentMethod;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  giftCardCode?: string;
  giftCardDiscount: number;
  walletBalance: number;
  notes?: string;
  status: 'active' | 'completed' | 'expired' | 'cancelled';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  // Methods
  calculateTotals(): this;
  isValid(): boolean;
  validateForOrder(): { valid: boolean; errors: string[] };
}

// Schema for checkout items
const CheckoutItemSchema = new Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  image: { type: String, required: true },
  variantId: { type: String }
}, { _id: false });

// Schema for address
const AddressSchema = new Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true, default: 'India' }
}, { _id: false });

// Schema for shipping method
const ShippingMethodSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  cost: { type: Number, required: true, min: 0 },
  estimatedDays: { type: Number, required: true, min: 1 },
  carrier: { type: String, required: true }
}, { _id: false });

// Schema for payment method
const PaymentMethodSchema = new Schema({
  id: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet', 'cod']
  },
  provider: { type: String, required: true },
  last4: { type: String },
  expiryMonth: { type: Number },
  expiryYear: { type: Number }
}, { _id: false });

// Main CheckoutSession schema
const CheckoutSessionSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  cartId: { type: String },
  // Allow sessions to be created with an empty items array (user may add items later).
  // Order creation will perform strict validation (see validateForOrder).
  items: {
    type: [CheckoutItemSchema],
    default: []
  },
  shippingAddress: { type: AddressSchema },
  billingAddress: { type: AddressSchema },
  useSameAddress: { type: Boolean, default: true },
  shippingMethod: { type: ShippingMethodSchema },
  paymentMethod: { type: PaymentMethodSchema },
  subtotal: { type: Number, required: true, min: 0, default: 0 },
  tax: { type: Number, required: true, min: 0, default: 0 },
  shipping: { type: Number, required: true, min: 0, default: 0 },
  discount: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0, default: 0 },
  giftCardCode: { type: String },
  giftCardDiscount: { type: Number, min: 0, default: 0 },
  walletBalance: { type: Number, min: 0, default: 0 },
  notes: { type: String, maxlength: 500 },
  status: {
    type: String,
    enum: ['active', 'completed', 'expired', 'cancelled'],
    default: 'active',
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Index for finding active sessions
CheckoutSessionSchema.index({ userId: 1, status: 1 });
CheckoutSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to calculate totals
CheckoutSessionSchema.methods.calculateTotals = function() {
  // Calculate subtotal
  this.subtotal = this.items.reduce((sum: number, item: ICheckoutItem) => {
    return sum + (item.price * item.quantity);
  }, 0);

  // Calculate tax (18% GST for India)
  const taxRate = 0.18;
  this.tax = this.subtotal * taxRate;

  // Shipping cost (from selected method or default)
  this.shipping = this.shippingMethod?.cost || 0;

  // Apply discounts
  this.discount = this.giftCardDiscount;

  // Calculate total
  this.total = this.subtotal + this.tax + this.shipping - this.discount - this.walletBalance;

  // Ensure total is not negative
  if (this.total < 0) this.total = 0;

  return this;
};

// Method to check if session is valid
CheckoutSessionSchema.methods.isValid = function(): boolean {
  const now = new Date();
  return this.status === 'active' && this.expiresAt > now;
};

// Method to validate checkout is ready for order creation
CheckoutSessionSchema.methods.validateForOrder = function(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!this.items || this.items.length === 0) {
    errors.push('No items in checkout session');
  }

  if (!this.shippingAddress) {
    errors.push('Shipping address is required');
  }

  if (!this.shippingMethod) {
    errors.push('Shipping method is required');
  }

  if (!this.paymentMethod) {
    errors.push('Payment method is required');
  }

  if (this.status !== 'active') {
    errors.push('Checkout session is not active');
  }

  if (!this.isValid()) {
    errors.push('Checkout session has expired');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Static method to cleanup expired sessions
CheckoutSessionSchema.statics.cleanupExpired = async function() {
  const now = new Date();
  const result = await this.updateMany(
    { 
      status: 'active',
      expiresAt: { $lt: now }
    },
    { 
      status: 'expired'
    }
  );
  return result;
};

// Pre-save hook to calculate totals
CheckoutSessionSchema.pre('save', function(this: ICheckoutSession, next) {
  if (this.isModified('items') || 
      this.isModified('shippingMethod') || 
      this.isModified('giftCardDiscount') || 
      this.isModified('walletBalance')) {
    this.calculateTotals();
  }
  next();
});

export const CheckoutSession = mongoose.model<ICheckoutSession>('CheckoutSession', CheckoutSessionSchema);
