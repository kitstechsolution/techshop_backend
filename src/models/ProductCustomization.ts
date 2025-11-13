import mongoose, { Document, Schema } from 'mongoose';

// Custom field types
export type CustomFieldType = 
  | 'text' 
  | 'textarea' 
  | 'select' 
  | 'radio' 
  | 'checkbox' 
  | 'color' 
  | 'image' 
  | 'number' 
  | 'date';

export interface ICustomOption {
  label: string;
  value: string;
  priceAdjustment?: number; // Additional cost for this option
  image?: string;
  available?: boolean;
}

export interface ICustomField {
  _id?: mongoose.Types.ObjectId;
  name: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  description?: string;
  placeholder?: string;
  
  // For select, radio, checkbox
  options?: ICustomOption[];
  
  // For text/textarea
  minLength?: number;
  maxLength?: number;
  
  // For number
  min?: number;
  max?: number;
  step?: number;
  
  // Validation
  pattern?: string; // Regex pattern
  errorMessage?: string;
  
  // Pricing
  priceAdjustment?: number; // Flat fee for this customization
  priceMultiplier?: number; // Multiply base price
  
  // Display
  displayOrder: number;
  helpText?: string;
  
  // Conditional display
  dependsOn?: {
    fieldName: string;
    value: string | string[];
  };
}

export interface IProductCustomization extends Document {
  product: mongoose.Types.ObjectId;
  
  // Customization settings
  enabled: boolean;
  customFields: ICustomField[];
  
  // Pricing rules
  basePrice?: number; // Override product base price
  minimumPrice?: number;
  maximumPrice?: number;
  
  // Inventory per customization
  trackInventory: boolean;
  variants?: Array<{
    _id?: mongoose.Types.ObjectId;
    sku: string;
    combination: Record<string, string>; // field name -> value
    price?: number;
    stock?: number;
    images?: string[];
  }>;
  
  // Preview
  previewTemplate?: string; // Template for rendering preview
  
  // Restrictions
  maxCustomizations?: number; // Max number of customizations per order
  allowCustomText?: boolean;
  moderateCustomText?: boolean; // Require approval for custom text
  
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  calculatePrice(selectedOptions: Record<string, any>, basePrice: number): number;
  validateOptions(selectedOptions: Record<string, any>): { valid: boolean; errors: string[] };
}

const customOptionSchema = new Schema<ICustomOption>(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
    priceAdjustment: {
      type: Number,
      default: 0,
    },
    image: {
      type: String,
    },
    available: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const customFieldSchema = new Schema<ICustomField>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['text', 'textarea', 'select', 'radio', 'checkbox', 'color', 'image', 'number', 'date'],
      required: true,
    },
    required: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
    },
    placeholder: {
      type: String,
      trim: true,
    },
    options: [customOptionSchema],
    minLength: Number,
    maxLength: Number,
    min: Number,
    max: Number,
    step: Number,
    pattern: String,
    errorMessage: String,
    priceAdjustment: {
      type: Number,
      default: 0,
    },
    priceMultiplier: {
      type: Number,
      default: 1,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    helpText: String,
    dependsOn: {
      fieldName: String,
      value: Schema.Types.Mixed,
    },
  },
  { _id: true }
);

const productCustomizationSchema = new Schema<IProductCustomization>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    customFields: [customFieldSchema],
    basePrice: Number,
    minimumPrice: Number,
    maximumPrice: Number,
    trackInventory: {
      type: Boolean,
      default: false,
    },
    variants: [
      {
        sku: {
          type: String,
          required: true,
        },
        combination: {
          type: Map,
          of: String,
        },
        price: Number,
        stock: {
          type: Number,
          default: 0,
          min: 0,
        },
        images: [String],
      },
    ],
    previewTemplate: String,
    maxCustomizations: Number,
    allowCustomText: {
      type: Boolean,
      default: true,
    },
    moderateCustomText: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
productCustomizationSchema.index({ product: 1, enabled: 1 });
productCustomizationSchema.index({ 'variants.sku': 1 }, { unique: true });

// Method to calculate price based on customizations
productCustomizationSchema.methods.calculatePrice = function (
  selectedOptions: Record<string, any>,
  basePrice: number
): number {
  let finalPrice = this.basePrice || basePrice;
  
  for (const field of this.customFields) {
    const selectedValue = selectedOptions[field.name];
    
    if (!selectedValue) continue;
    
    // Add field-level price adjustment
    if (field.priceAdjustment) {
      finalPrice += field.priceAdjustment;
    }
    
    // Apply field-level price multiplier
    if (field.priceMultiplier && field.priceMultiplier !== 1) {
      finalPrice *= field.priceMultiplier;
    }
    
    // Add option-level price adjustment
    if (field.options && (field.type === 'select' || field.type === 'radio')) {
      const option = field.options.find((opt: ICustomOption) => opt.value === selectedValue);
      if (option?.priceAdjustment) {
        finalPrice += option.priceAdjustment;
      }
    }
    
    // Handle checkbox (multiple selections)
    if (field.type === 'checkbox' && Array.isArray(selectedValue)) {
      for (const val of selectedValue) {
        const option = field.options?.find((opt: ICustomOption) => opt.value === val);
        if (option?.priceAdjustment) {
          finalPrice += option.priceAdjustment;
        }
      }
    }
  }
  
  // Apply min/max constraints
  if (this.minimumPrice && finalPrice < this.minimumPrice) {
    finalPrice = this.minimumPrice;
  }
  if (this.maximumPrice && finalPrice > this.maximumPrice) {
    finalPrice = this.maximumPrice;
  }
  
  return Math.round(finalPrice * 100) / 100; // Round to 2 decimals
};

// Method to validate customization options
productCustomizationSchema.methods.validateOptions = function (
  selectedOptions: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const field of this.customFields) {
    const value = selectedOptions[field.name];
    
    // Check required fields
    if (field.required && !value) {
      errors.push(`${field.label} is required`);
      continue;
    }
    
    if (!value) continue;
    
    // Validate based on type
    switch (field.type) {
      case 'text':
      case 'textarea':
        if (field.minLength && value.length < field.minLength) {
          errors.push(`${field.label} must be at least ${field.minLength} characters`);
        }
        if (field.maxLength && value.length > field.maxLength) {
          errors.push(`${field.label} must not exceed ${field.maxLength} characters`);
        }
        if (field.pattern && !new RegExp(field.pattern).test(value)) {
          errors.push(field.errorMessage || `${field.label} format is invalid`);
        }
        break;
        
      case 'number': {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`${field.label} must be a number`);
        } else {
          if (field.min !== undefined && num < field.min) {
            errors.push(`${field.label} must be at least ${field.min}`);
          }
          if (field.max !== undefined && num > field.max) {
            errors.push(`${field.label} must not exceed ${field.max}`);
          }
        }
        break;
      }
        
      case 'select':
      case 'radio': {
        const validOption = field.options?.some((opt: ICustomOption) => opt.value === value && opt.available);
        if (!validOption) {
          errors.push(`Invalid selection for ${field.label}`);
        }
        break;
      }
        
      case 'checkbox':
        if (Array.isArray(value)) {
          const validValues = value.every((val: string) =>
            field.options?.some((opt: ICustomOption) => opt.value === val && opt.available)
          );
          if (!validValues) {
            errors.push(`Invalid selection for ${field.label}`);
          }
        }
        break;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

// Static method to get customization by product
productCustomizationSchema.statics.getByProduct = async function (
  productId: mongoose.Types.ObjectId
) {
  return this.findOne({ product: productId, enabled: true }).lean();
};

export const ProductCustomization = mongoose.model<IProductCustomization>(
  'ProductCustomization',
  productCustomizationSchema
);
