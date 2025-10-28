import mongoose, { Document, Schema } from 'mongoose';

export interface IInventoryAlert extends Document {
  product: mongoose.Types.ObjectId;
  variantId?: string;
  
  alertType: 'low_stock' | 'out_of_stock' | 'overstock';
  threshold: number; // The threshold that triggered this alert
  currentStock: number;
  
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy?: mongoose.Types.ObjectId;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const inventoryAlertSchema = new Schema<IInventoryAlert>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantId: {
      type: String,
    },
    alertType: {
      type: String,
      enum: ['low_stock', 'out_of_stock', 'overstock'],
      required: true,
    },
    threshold: {
      type: Number,
      required: true,
      min: 0,
    },
    currentStock: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'resolved'],
      default: 'active',
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    acknowledgedAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
inventoryAlertSchema.index({ product: 1, status: 1, createdAt: -1 });
inventoryAlertSchema.index({ alertType: 1, status: 1, createdAt: -1 });
inventoryAlertSchema.index({ status: 1, createdAt: -1 });

// Prevent duplicate active alerts for the same product
inventoryAlertSchema.index(
  { product: 1, variantId: 1, alertType: 1, status: 1 },
  { 
    unique: true,
    partialFilterExpression: { status: 'active' }
  }
);

export const InventoryAlert = mongoose.model<IInventoryAlert>('InventoryAlert', inventoryAlertSchema);
