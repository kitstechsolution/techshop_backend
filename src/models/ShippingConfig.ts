import mongoose, { Document, Schema } from 'mongoose';

/**
 * Interface for configuring shipping aggregator providers
 */
export interface IShippingAggregator {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority?: number; // lower means higher priority
  configFields: {
    [key: string]: {
      name: string;
      type: 'text' | 'password' | 'select';
      required: boolean;
      options?: Array<{ value: string; label: string }>;
      placeholder?: string;
      value: string;
      isValid?: boolean;
      errorMessage?: string;
    };
  };
  webhookUrl?: string; // URL for receiving webhook notifications
}

/**
 * Interface for pickup location
 */
export interface IPickupLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  isDefault: boolean;
}

/**
 * Interface for shipping configuration
 */
export interface IShippingConfig {
  aggregators: IShippingAggregator[];
  defaultAggregator: string;
  selectionStrategy?: 'priority' | 'cheapest' | 'fastest';
  enablePincodeValidation: boolean;
  defaultShippingCost: number;
  freeShippingThreshold: number;
  enableInternationalShipping: boolean;
  pickupLocations: IPickupLocation[];
  enableWebhooks: boolean;
  enableInsurance: boolean;
  insuranceThreshold: number;
}

/**
 * Interface for the shipping configuration document in MongoDB
 */
export interface IShippingConfigDocument extends IShippingConfig, Document {}

/**
 * Schema for shipping configuration
 */
const ShippingConfigSchema = new Schema<IShippingConfigDocument>(
  {
    aggregators: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      description: { type: String, required: true },
      enabled: { type: Boolean, default: false },
      priority: { type: Number, default: 0 },
      configFields: { type: Schema.Types.Mixed, required: true },
      webhookUrl: { type: String, required: false }
    }],
    defaultAggregator: { type: String, required: true },
    selectionStrategy: { type: String, enum: ['priority', 'cheapest', 'fastest'], default: 'priority' },
    enablePincodeValidation: { type: Boolean, default: true },
    defaultShippingCost: { type: Number, default: 50 },
    freeShippingThreshold: { type: Number, default: 500 },
    enableInternationalShipping: { type: Boolean, default: false },
    pickupLocations: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true },
      isDefault: { type: Boolean, default: false }
    }],
    enableWebhooks: { type: Boolean, default: false },
    enableInsurance: { type: Boolean, default: false },
    insuranceThreshold: { type: Number, default: 10000 }
  },
  {
    timestamps: true
  }
);

/**
 * Model for shipping configuration
 */
const ShippingConfig = mongoose.model<IShippingConfigDocument>('ShippingConfig', ShippingConfigSchema);

export default ShippingConfig; 