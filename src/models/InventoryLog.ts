import mongoose, { Document, Schema } from 'mongoose';

export interface IInventoryLog extends Document {
  product: mongoose.Types.ObjectId;
  variantId?: string; // For products with variants
  
  // Stock change details
  type: 'purchase' | 'sale' | 'return' | 'adjustment' | 'damaged' | 'restocked';
  quantity: number; // Positive for increase, negative for decrease
  previousStock: number;
  newStock: number;
  
  // Reference information
  reference?: {
    type: 'Order' | 'PurchaseOrder' | 'Manual';
    id?: mongoose.Types.ObjectId;
  };
  
  // Additional details
  reason?: string;
  notes?: string;
  cost?: number; // Cost per unit (for purchase tracking)
  
  // User who made the change
  changedBy: mongoose.Types.ObjectId;
  
  createdAt: Date;
}

const inventoryLogSchema = new Schema<IInventoryLog>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantId: {
      type: String,
    },
    type: {
      type: String,
      enum: ['purchase', 'sale', 'return', 'adjustment', 'damaged', 'restocked'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },
    newStock: {
      type: Number,
      required: true,
      min: 0,
    },
    reference: {
      type: {
        type: String,
        enum: ['Order', 'PurchaseOrder', 'Manual'],
      },
      id: {
        type: Schema.Types.ObjectId,
      },
    },
    reason: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    cost: {
      type: Number,
      min: 0,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
inventoryLogSchema.index({ product: 1, createdAt: -1 });
inventoryLogSchema.index({ product: 1, type: 1, createdAt: -1 });
inventoryLogSchema.index({ changedBy: 1, createdAt: -1 });

export const InventoryLog = mongoose.model<IInventoryLog>('InventoryLog', inventoryLogSchema);
