import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

// Encryption configuration
const ENCRYPTION_KEY = process.env.PAYMENT_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

// Helper functions for encryption/decryption
function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  if (!text) return { encrypted: '', iv: '', tag: '' };
  
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  };
}

function decrypt(encrypted: string, iv: string, tag: string): string {
  if (!encrypted || !iv || !tag) return '';
  
  try {
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return '';
  }
}

// Interface for encrypted field
interface EncryptedField {
  encrypted: string;
  iv: string;
  tag: string;
}

// Interface for payment gateway configuration
interface IPaymentGatewayConfig {
  id: string;
  name: string;
  enabled: boolean;
  isTest: boolean;
  credentials: {
    publicKey?: EncryptedField;
    secretKey?: EncryptedField;
    apiKey?: EncryptedField;
    clientId?: EncryptedField;
    clientSecret?: EncryptedField;
    merchantId?: EncryptedField;
    webhookSecret?: EncryptedField;
    [key: string]: EncryptedField | undefined;
  };
  displayName?: string;
  description?: string;
  supportedCurrencies?: string[];
  supportedCountries?: string[];
  minAmount?: number;
  maxAmount?: number;
  processingFeePercent?: number;
  processingFeeFixed?: number;
  settings?: {
    autoCapture?: boolean;
    saveCards?: boolean;
    allowInternational?: boolean;
    [key: string]: any;
  };
}

// Interface for history entry
interface IPaymentSettingsHistoryEntry {
  gateway: string;
  action: 'created' | 'updated' | 'enabled' | 'disabled' | 'deleted';
  timestamp: Date;
  changes?: string;
  modifiedBy?: string;
}

// Interface for PaymentSettings document
export interface IPaymentSettings extends Document {
  gateways: IPaymentGatewayConfig[];
  defaultGateway: string;
  enabledGateways: string[];
  globalSettings: {
    currency: string;
    supportedCurrencies: string[];
    allowGuestCheckout: boolean;
    requireBillingAddress: boolean;
    enableSaveCards: boolean;
    paymentTimeout: number; // in minutes
  };
  history: IPaymentSettingsHistoryEntry[];
  lastModified: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  addToHistory(gateway: string, action: string, changes?: string, modifiedBy?: string): void;
  getGateway(gatewayId: string): IPaymentGatewayConfig | undefined;
  enableGateway(gatewayId: string): void;
  disableGateway(gatewayId: string): void;
  getDecryptedCredentials(gatewayId: string): Record<string, string>;
}

// Interface for PaymentSettings Model (static methods)
export interface IPaymentSettingsModel extends mongoose.Model<IPaymentSettings> {
  getSettings(): Promise<IPaymentSettings>;
  encryptCredentials(credentials: Record<string, string>): Record<string, EncryptedField>;
  decryptCredentials(credentials: Record<string, EncryptedField>): Record<string, string>;
}

// Schema for encrypted field
const EncryptedFieldSchema = new Schema({
  encrypted: { type: String, required: true },
  iv: { type: String, required: true },
  tag: { type: String, required: true }
}, { _id: false });

// Schema for payment gateway configuration
const PaymentGatewayConfigSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  enabled: { type: Boolean, default: false },
  isTest: { type: Boolean, default: true },
  credentials: {
    type: Map,
    of: EncryptedFieldSchema
  },
  displayName: { type: String },
  description: { type: String },
  supportedCurrencies: { type: [String], default: ['USD', 'INR', 'EUR', 'GBP'] },
  supportedCountries: { type: [String], default: [] },
  minAmount: { type: Number, default: 0 },
  maxAmount: { type: Number },
  processingFeePercent: { type: Number, default: 0 },
  processingFeeFixed: { type: Number, default: 0 },
  settings: {
    type: Map,
    of: Schema.Types.Mixed
  }
}, { _id: false });

// Schema for history entry
const PaymentSettingsHistorySchema = new Schema({
  gateway: { type: String, required: true },
  action: {
    type: String,
    enum: ['created', 'updated', 'enabled', 'disabled', 'deleted'],
    required: true
  },
  timestamp: { type: Date, default: Date.now },
  changes: { type: String },
  modifiedBy: { type: String }
}, { _id: false });

// Main PaymentSettings schema
const PaymentSettingsSchema = new Schema({
  gateways: {
    type: [PaymentGatewayConfigSchema],
    default: []
  },
  defaultGateway: {
    type: String,
    default: 'razorpay'
  },
  enabledGateways: {
    type: [String],
    default: []
  },
  globalSettings: {
    currency: { type: String, default: 'INR' },
    supportedCurrencies: { type: [String], default: ['INR', 'USD', 'EUR', 'GBP'] },
    allowGuestCheckout: { type: Boolean, default: true },
    requireBillingAddress: { type: Boolean, default: true },
    enableSaveCards: { type: Boolean, default: false },
    paymentTimeout: { type: Number, default: 15 } // minutes
  },
  history: {
    type: [PaymentSettingsHistorySchema],
    default: []
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for fast lookups
PaymentSettingsSchema.index({ 'gateways.id': 1 });
PaymentSettingsSchema.index({ enabledGateways: 1 });

// Instance method: Add to history
PaymentSettingsSchema.methods.addToHistory = function(
  gateway: string,
  action: string,
  changes?: string,
  modifiedBy?: string
) {
  this.history.push({
    gateway,
    action,
    timestamp: new Date(),
    changes,
    modifiedBy
  });

  // Keep only last 100 history entries
  if (this.history.length > 100) {
    this.history = this.history.slice(-100);
  }

  this.lastModified = new Date();
};

// Instance method: Get gateway configuration
PaymentSettingsSchema.methods.getGateway = function(gatewayId: string) {
  return this.gateways.find((g: IPaymentGatewayConfig) => g.id === gatewayId);
};

// Instance method: Enable gateway
PaymentSettingsSchema.methods.enableGateway = function(gatewayId: string) {
  const gateway = this.getGateway(gatewayId);
  
  if (gateway) {
    gateway.enabled = true;
    
    if (!this.enabledGateways.includes(gatewayId)) {
      this.enabledGateways.push(gatewayId);
    }
    
    // Set as default if it's the first enabled gateway
    if (this.enabledGateways.length === 1) {
      this.defaultGateway = gatewayId;
    }
    
    this.addToHistory(gatewayId, 'enabled');
    this.lastModified = new Date();
  }
};

// Instance method: Disable gateway
PaymentSettingsSchema.methods.disableGateway = function(gatewayId: string) {
  const gateway = this.getGateway(gatewayId);
  
  if (gateway) {
    gateway.enabled = false;
    
    const index = this.enabledGateways.indexOf(gatewayId);
    if (index > -1) {
      this.enabledGateways.splice(index, 1);
    }
    
    // Change default if this was the default gateway
    if (this.defaultGateway === gatewayId) {
      this.defaultGateway = this.enabledGateways.length > 0 ? this.enabledGateways[0] : '';
    }
    
    this.addToHistory(gatewayId, 'disabled');
    this.lastModified = new Date();
  }
};

// Instance method: Get decrypted credentials
PaymentSettingsSchema.methods.getDecryptedCredentials = function(gatewayId: string): Record<string, string> {
  const gateway = this.getGateway(gatewayId);
  
  if (!gateway || !gateway.credentials) {
    return {};
  }
  
  const decrypted: Record<string, string> = {};
  
  // Handle Map type credentials
  if (gateway.credentials instanceof Map) {
    gateway.credentials.forEach((value: any, key: string) => {
      if (value && value.encrypted && value.iv && value.tag) {
        decrypted[key] = decrypt(value.encrypted, value.iv, value.tag);
      }
    });
  } else {
    // Handle plain object credentials
    Object.entries(gateway.credentials).forEach(([key, value]) => {
      if (value && typeof value === 'object' && 'encrypted' in value && 'iv' in value && 'tag' in value) {
        const encValue = value as EncryptedField;
        decrypted[key] = decrypt(encValue.encrypted, encValue.iv, encValue.tag);
      }
    });
  }
  
  return decrypted;
};

// Static method: Get or create settings
PaymentSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  
  if (!settings) {
    // Create default settings with gateways from environment variables
    const defaultGateways: IPaymentGatewayConfig[] = [];
    
    // Razorpay
    if (process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_SECRET) {
      const razorpayCredentials: Record<string, EncryptedField> = {};
      
      if (process.env.RAZORPAY_KEY_ID) {
        razorpayCredentials.keyId = encrypt(process.env.RAZORPAY_KEY_ID);
      }
      if (process.env.RAZORPAY_KEY_SECRET) {
        razorpayCredentials.keySecret = encrypt(process.env.RAZORPAY_KEY_SECRET);
      }
      
      defaultGateways.push({
        id: 'razorpay',
        name: 'Razorpay',
        displayName: 'Razorpay',
        description: 'India\'s leading payment gateway',
        enabled: true,
        isTest: process.env.NODE_ENV !== 'production',
        credentials: razorpayCredentials,
        supportedCurrencies: ['INR'],
        supportedCountries: ['IN']
      });
    }
    
    // Stripe
    if (process.env.STRIPE_SECRET_KEY || process.env.STRIPE_PUBLISHABLE_KEY) {
      const stripeCredentials: Record<string, EncryptedField> = {};
      
      if (process.env.STRIPE_SECRET_KEY) {
        stripeCredentials.secretKey = encrypt(process.env.STRIPE_SECRET_KEY);
      }
      if (process.env.STRIPE_PUBLISHABLE_KEY) {
        stripeCredentials.publishableKey = encrypt(process.env.STRIPE_PUBLISHABLE_KEY);
      }
      if (process.env.STRIPE_WEBHOOK_SECRET) {
        stripeCredentials.webhookSecret = encrypt(process.env.STRIPE_WEBHOOK_SECRET);
      }
      
      defaultGateways.push({
        id: 'stripe',
        name: 'Stripe',
        displayName: 'Stripe',
        description: 'Global payment processing platform',
        enabled: !!process.env.STRIPE_SECRET_KEY,
        isTest: process.env.NODE_ENV !== 'production',
        credentials: stripeCredentials,
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'INR'],
        supportedCountries: ['US', 'GB', 'CA', 'AU', 'IN']
      });
    }
    
    // PayPal
    if (process.env.PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_SECRET) {
      const paypalCredentials: Record<string, EncryptedField> = {};
      
      if (process.env.PAYPAL_CLIENT_ID) {
        paypalCredentials.clientId = encrypt(process.env.PAYPAL_CLIENT_ID);
      }
      if (process.env.PAYPAL_CLIENT_SECRET) {
        paypalCredentials.clientSecret = encrypt(process.env.PAYPAL_CLIENT_SECRET);
      }
      
      defaultGateways.push({
        id: 'paypal',
        name: 'PayPal',
        displayName: 'PayPal',
        description: 'Trusted global payment solution',
        enabled: !!process.env.PAYPAL_CLIENT_ID,
        isTest: process.env.PAYPAL_MODE !== 'live',
        credentials: paypalCredentials,
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
        supportedCountries: ['US', 'GB', 'CA', 'AU']
      });
    }
    
    // Cashfree
    if (process.env.CASHFREE_APP_ID || process.env.CASHFREE_SECRET_KEY) {
      const cashfreeCredentials: Record<string, EncryptedField> = {};
      
      if (process.env.CASHFREE_APP_ID) {
        cashfreeCredentials.appId = encrypt(process.env.CASHFREE_APP_ID);
      }
      if (process.env.CASHFREE_SECRET_KEY) {
        cashfreeCredentials.secretKey = encrypt(process.env.CASHFREE_SECRET_KEY);
      }
      
      defaultGateways.push({
        id: 'cashfree',
        name: 'Cashfree',
        displayName: 'Cashfree',
        description: 'Full-stack payments solution for India',
        enabled: !!process.env.CASHFREE_APP_ID,
        isTest: process.env.CASHFREE_MODE !== 'PROD',
        credentials: cashfreeCredentials,
        supportedCurrencies: ['INR'],
        supportedCountries: ['IN']
      });
    }
    
    const enabledGateways = defaultGateways
      .filter(g => g.enabled)
      .map(g => g.id);
    
    settings = await this.create({
      gateways: defaultGateways,
      defaultGateway: enabledGateways.length > 0 ? enabledGateways[0] : 'razorpay',
      enabledGateways,
      globalSettings: {
        currency: 'INR',
        supportedCurrencies: ['INR', 'USD', 'EUR', 'GBP'],
        allowGuestCheckout: true,
        requireBillingAddress: true,
        enableSaveCards: false,
        paymentTimeout: 15
      },
      history: []
    });
  }
  
  return settings;
};

// Static method: Encrypt credentials
PaymentSettingsSchema.statics.encryptCredentials = function(credentials: Record<string, string>): Record<string, EncryptedField> {
  const encrypted: Record<string, EncryptedField> = {};
  
  Object.entries(credentials).forEach(([key, value]) => {
    if (value) {
      encrypted[key] = encrypt(value);
    }
  });
  
  return encrypted;
};

// Static method: Decrypt credentials
PaymentSettingsSchema.statics.decryptCredentials = function(credentials: Record<string, EncryptedField>): Record<string, string> {
  const decrypted: Record<string, string> = {};
  
  Object.entries(credentials).forEach(([key, value]) => {
    if (value && value.encrypted && value.iv && value.tag) {
      decrypted[key] = decrypt(value.encrypted, value.iv, value.tag);
    }
  });
  
  return decrypted;
};

export const PaymentSettings = mongoose.model<IPaymentSettings, IPaymentSettingsModel>('PaymentSettings', PaymentSettingsSchema);
