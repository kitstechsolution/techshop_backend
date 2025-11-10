import ShippingConfig from '../models/ShippingConfig.js';
import shippingService from './ShippingService.js';
import { logger } from '../utils/logger.js';

/**
 * Initialize shipping configuration
 */
export const initializeShipping = async (): Promise<void> => {
  try {
    // Check if shipping configuration exists
    const existingConfig = await ShippingConfig.findOne();
    
    if (!existingConfig) {
      logger.info('Creating default shipping configuration');
      
      // Create default shipping configuration
      const defaultConfig = {
        aggregators: [
          {
            id: 'shiprocket',
            name: 'Shiprocket',
            description: 'Leading shipping aggregator with 25+ courier partners and extensive reach',
            enabled: false,
            priority: 1,
            configFields: {
              email: {
                name: 'Email',
                type: 'text',
                required: true,
                placeholder: 'Shiprocket account email',
                value: process.env.SHIPROCKET_EMAIL || '',
              },
              password: {
                name: 'Password',
                type: 'password',
                required: true,
                placeholder: 'Shiprocket account password',
                value: process.env.SHIPROCKET_PASSWORD || '',
              },
              apiKey: {
                name: 'API Key',
                type: 'password',
                required: true,
                placeholder: 'Shiprocket API Key',
                value: process.env.SHIPROCKET_API_KEY || '',
              },
              environment: {
                name: 'Environment',
                type: 'select',
                required: true,
                options: [
                  { value: 'test', label: 'Test Mode' },
                  { value: 'production', label: 'Production Mode' },
                ],
                value: process.env.SHIPROCKET_TEST_MODE === 'true' ? 'test' : 'production',
              },
            },
          },
          {
            id: 'shipway',
            name: 'Shipway',
            description: 'Excellent post-purchase experience with fraud detection and NDR management',
            enabled: false,
            priority: 2,
            configFields: {
              username: {
                name: 'Username',
                type: 'text',
                required: true,
                placeholder: 'Shipway username',
                value: process.env.SHIPWAY_USERNAME || '',
              },
              licenseKey: {
                name: 'License Key',
                type: 'password',
                required: true,
                placeholder: 'Shipway License Key',
                value: process.env.SHIPWAY_LICENSE_KEY || '',
              },
              environment: {
                name: 'Environment',
                type: 'select',
                required: true,
                options: [
                  { value: 'test', label: 'Test Mode' },
                  { value: 'production', label: 'Production Mode' },
                ],
                value: process.env.SHIPWAY_TEST_MODE === 'true' ? 'test' : 'production',
              },
            },
          },
          {
            id: 'shipyaari',
            name: 'Shipyaari',
            description: '29,000+ pincode coverage with AI-driven courier recommendations',
            enabled: false,
            priority: 3,
            configFields: {
              userId: {
                name: 'User ID',
                type: 'text',
                required: true,
                placeholder: 'Shipyaari User ID',
                value: process.env.SHIPYAARI_USER_ID || '',
              },
              apiKey: {
                name: 'API Key',
                type: 'password',
                required: true,
                placeholder: 'Shipyaari API Key',
                value: process.env.SHIPYAARI_API_KEY || '',
              },
              environment: {
                name: 'Environment',
                type: 'select',
                required: true,
                options: [
                  { value: 'test', label: 'Test Mode' },
                  { value: 'production', label: 'Production Mode' },
                ],
                value: process.env.SHIPYAARI_TEST_MODE === 'true' ? 'test' : 'production',
              },
            },
          }
        ],
        defaultAggregator: process.env.DEFAULT_SHIPPING_AGGREGATOR || 'shiprocket',
        selectionStrategy: (process.env.SELECTION_STRATEGY as any) || 'priority',
        enablePincodeValidation: process.env.ENABLE_PINCODE_VALIDATION !== 'false',
        defaultShippingCost: parseInt(process.env.DEFAULT_SHIPPING_COST || '50', 10),
        freeShippingThreshold: parseInt(process.env.FREE_SHIPPING_THRESHOLD || '500', 10),
        enableInternationalShipping: process.env.ENABLE_INTERNATIONAL_SHIPPING === 'true'
      };
      
      const config = await ShippingConfig.create(defaultConfig);
      logger.info('Default shipping configuration created');
      
      // Initialize shipping service with the default configuration
      const enabledAggregators = config.aggregators.filter(agg => agg.enabled);
      shippingService.initializeProviders(enabledAggregators, config.defaultAggregator);
    } else {
      logger.info('Shipping configuration already exists, initializing service');
      
      // Initialize shipping service with existing configuration
      const enabledAggregators = existingConfig.aggregators.filter(agg => agg.enabled);
      shippingService.initializeProviders(enabledAggregators, existingConfig.defaultAggregator);
    }
  } catch (error) {
    logger.error('Error initializing shipping configuration:', error);
  }
};

// Add shipping initialization to the main init function
export const initializeAll = async (): Promise<void> => {
  // ... existing initialization code ...
  
  // Initialize shipping
  await initializeShipping();
  
  // ... rest of the function ...
}; 