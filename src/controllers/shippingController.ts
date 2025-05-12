import { Request, Response } from 'express';
import ShippingConfig, { IShippingAggregator } from '../models/ShippingConfig';
import shippingService, { 
  ShippingRequest, 
  ShippingAggregatorProvider,
  ShiprocketProvider,
  ShipwayProvider, 
  ShipyaariProvider
} from '../services/ShippingService';
import { logger } from '../utils/logger';

/**
 * Extended Request with authenticated user
 */
interface AuthRequest extends Request {
  user?: any;
}

/**
 * Get shipping settings
 */
export const getShippingSettings = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Try to get settings from database
    let settings = await ShippingConfig.findOne();
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = await createDefaultShippingSettings();
    }
    
    // Mask sensitive values
    const maskedSettings = {
      ...settings.toObject(),
      aggregators: settings.aggregators.map(aggregator => ({
        ...aggregator,
        configFields: Object.entries(aggregator.configFields).reduce((fields: any, [key, field]: [string, any]) => {
          fields[key] = {
            ...field,
            value: isSecretField(key) && field.value 
              ? '••••••••' 
              : field.value
          };
          return fields;
        }, {})
      }))
    };
    
    res.json(maskedSettings);
  } catch (error) {
    logger.error('Error getting shipping settings:', error);
    res.status(500).json({ error: 'Failed to get shipping settings' });
  }
};

/**
 * Create default shipping settings
 */
const createDefaultShippingSettings = async () => {
  const defaultSettings = {
    aggregators: [
      {
        id: 'shiprocket',
        name: 'Shiprocket',
        description: 'Leading shipping aggregator with 25+ courier partners and extensive reach',
        enabled: false,
        configFields: {
          email: {
            name: 'Email',
            type: 'text',
            required: true,
            placeholder: 'Shiprocket account email',
            value: '',
          },
          password: {
            name: 'Password',
            type: 'password',
            required: true,
            placeholder: 'Shiprocket account password',
            value: '',
          },
          apiKey: {
            name: 'API Key',
            type: 'password',
            required: true,
            placeholder: 'Shiprocket API Key',
            value: '',
          },
          environment: {
            name: 'Environment',
            type: 'select',
            required: true,
            options: [
              { value: 'test', label: 'Test Mode' },
              { value: 'production', label: 'Production Mode' },
            ],
            value: 'test',
          },
        },
      },
      {
        id: 'shipway',
        name: 'Shipway',
        description: 'Excellent post-purchase experience with fraud detection and NDR management',
        enabled: false,
        configFields: {
          username: {
            name: 'Username',
            type: 'text',
            required: true,
            placeholder: 'Shipway username',
            value: '',
          },
          licenseKey: {
            name: 'License Key',
            type: 'password',
            required: true,
            placeholder: 'Shipway License Key',
            value: '',
          },
          environment: {
            name: 'Environment',
            type: 'select',
            required: true,
            options: [
              { value: 'test', label: 'Test Mode' },
              { value: 'production', label: 'Production Mode' },
            ],
            value: 'test',
          },
        },
      },
      {
        id: 'shipyaari',
        name: 'Shipyaari',
        description: '29,000+ pincode coverage with AI-driven courier recommendations',
        enabled: false,
        configFields: {
          userId: {
            name: 'User ID',
            type: 'text',
            required: true,
            placeholder: 'Shipyaari User ID',
            value: '',
          },
          apiKey: {
            name: 'API Key',
            type: 'password',
            required: true,
            placeholder: 'Shipyaari API Key',
            value: '',
          },
          environment: {
            name: 'Environment',
            type: 'select',
            required: true,
            options: [
              { value: 'test', label: 'Test Mode' },
              { value: 'production', label: 'Production Mode' },
            ],
            value: 'test',
          },
        },
      }
    ],
    defaultAggregator: 'shiprocket',
    enablePincodeValidation: true,
    defaultShippingCost: 50,
    freeShippingThreshold: 500,
    enableInternationalShipping: false
  };
  
  return await ShippingConfig.create(defaultSettings);
};

/**
 * Helper to check if a field is sensitive
 */
const isSecretField = (fieldName: string): boolean => {
  const secretKeywords = ['secret', 'password', 'key', 'token', 'license'];
  return secretKeywords.some(keyword => fieldName.toLowerCase().includes(keyword));
};

/**
 * Update shipping settings
 */
export const updateShippingSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = req.body;
    
    // Update or create settings in the database
    let config = await ShippingConfig.findOne();
    
    if (config) {
      // Update existing settings
      config.aggregators = settings.aggregators;
      config.defaultAggregator = settings.defaultAggregator;
      config.enablePincodeValidation = settings.enablePincodeValidation;
      config.defaultShippingCost = settings.defaultShippingCost;
      config.freeShippingThreshold = settings.freeShippingThreshold;
      config.enableInternationalShipping = settings.enableInternationalShipping;
      
      await config.save();
    } else {
      // Create new settings if none exist
      config = await ShippingConfig.create(settings);
    }
    
    // Initialize shipping service with the new settings
    const enabledAggregators = settings.aggregators.filter((agg: IShippingAggregator) => agg.enabled);
    shippingService.initializeProviders(enabledAggregators, settings.defaultAggregator);
    
    // Mask sensitive values before returning
    const maskedSettings = {
      ...config.toObject(),
      aggregators: config.aggregators.map((aggregator: any) => ({
        ...aggregator,
        configFields: Object.entries(aggregator.configFields).reduce((fields: any, [key, field]: [string, any]) => {
          fields[key] = {
            ...field,
            value: isSecretField(key) && field.value 
              ? '••••••••' 
              : field.value
          };
          return fields;
        }, {})
      }))
    };
    
    // Return success
    res.json({ 
      success: true,
      message: 'Shipping settings updated successfully',
      settings: maskedSettings
    });
  } catch (error) {
    logger.error('Error updating shipping settings:', error);
    res.status(500).json({ error: 'Error updating shipping settings' });
  }
};

/**
 * Get shipping rates for a request
 */
export const getShippingRates = async (req: Request, res: Response): Promise<void> => {
  try {
    const request = req.body as ShippingRequest;
    
    if (!request.pickupPincode || !request.deliveryPincode) {
      res.status(400).json({ error: 'Pickup and delivery pincodes are required' });
      return;
    }
    
    // Get rates from all providers or a specific provider
    let rates;
    if (req.query.provider) {
      const providerId = req.query.provider as string;
      rates = await shippingService.getRates(providerId, request);
      res.json({ provider: providerId, rates });
    } else {
      rates = await shippingService.getAllRates(request);
      // Convert map to plain object for response
      const result: Record<string, any> = {};
      rates.forEach((providerRates, providerId) => {
        result[providerId] = providerRates;
      });
      res.json(result);
    }
  } catch (error) {
    logger.error('Error getting shipping rates:', error);
    res.status(500).json({ error: 'Failed to get shipping rates' });
  }
};

/**
 * Create a shipment
 */
export const createShipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, service, request } = req.body;
    
    if (!providerId || !service || !request) {
      res.status(400).json({ error: 'Provider ID, service, and request details are required' });
      return;
    }
    
    const result = await shippingService.createShipment(providerId, request, service);
    res.json(result);
  } catch (error) {
    logger.error('Error creating shipment:', error);
    res.status(500).json({ error: 'Failed to create shipment' });
  }
};

/**
 * Track a shipment
 */
export const trackShipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, trackingId } = req.params;
    
    if (!providerId || !trackingId) {
      res.status(400).json({ error: 'Provider ID and tracking ID are required' });
      return;
    }
    
    const trackingInfo = await shippingService.trackShipment(providerId, trackingId);
    res.json(trackingInfo);
  } catch (error) {
    logger.error('Error tracking shipment:', error);
    res.status(500).json({ error: 'Failed to track shipment' });
  }
};

/**
 * Cancel a shipment
 */
export const cancelShipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, trackingId } = req.params;
    
    if (!providerId || !trackingId) {
      res.status(400).json({ error: 'Provider ID and tracking ID are required' });
      return;
    }
    
    const success = await shippingService.cancelShipment(providerId, trackingId);
    
    if (success) {
      res.json({ success: true, message: 'Shipment cancelled successfully' });
    } else {
      res.status(400).json({ error: 'Failed to cancel shipment' });
    }
  } catch (error) {
    logger.error('Error cancelling shipment:', error);
    res.status(500).json({ error: 'Failed to cancel shipment' });
  }
};

/**
 * Test shipping provider connection
 */
export const testShippingProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    const { config } = req.body;
    
    if (!providerId) {
      res.status(400).json({ success: false, message: 'Provider ID is required' });
      return;
    }
    
    // If config is not provided, try to get it from the database
    let providerConfig = config;
    if (!providerConfig) {
      const shippingConfig = await ShippingConfig.findOne();
      if (!shippingConfig) {
        res.status(400).json({ success: false, message: 'Shipping configuration not found' });
        return;
      }
      
      const aggregator = shippingConfig.aggregators.find(agg => agg.id === providerId);
      if (!aggregator) {
        res.status(400).json({ success: false, message: 'Provider not found in configuration' });
        return;
      }
      
      // Convert config fields to simple key-value pairs
      providerConfig = {};
      for (const [key, field] of Object.entries(aggregator.configFields)) {
        providerConfig[key] = field.value;
      }
    }
    
    // Create appropriate provider instance based on providerId
    let provider: ShippingAggregatorProvider | null = null;
    
    switch (providerId) {
      case 'shiprocket':
        provider = new ShiprocketProvider(providerConfig);
        break;
      case 'shipway':
        provider = new ShipwayProvider(providerConfig);
        break;
      case 'shipyaari':
        provider = new ShipyaariProvider(providerConfig);
        break;
      default:
        res.status(400).json({ success: false, message: 'Invalid provider ID' });
        return;
    }
    
    // Check if provider is configured correctly
    if (!provider.isConfigured()) {
      res.status(400).json({ 
        success: false, 
        message: 'Provider is not properly configured. Please check all required fields.' 
      });
      return;
    }
    
    // Create a test shipping request for checking rates
    const testRequest: ShippingRequest = {
      orderId: `test-${Date.now()}`,
      pickupPincode: '110001', // New Delhi
      deliveryPincode: '400001', // Mumbai
      weight: 500, // 500g
      invoiceValue: 1000, // ₹1000
      paymentMethod: 'prepaid',
      customerName: 'Test Customer',
      customerAddress: 'Test Address',
      customerCity: 'Mumbai',
      customerState: 'Maharashtra',
      customerPhone: '9999999999',
      customerEmail: 'test@example.com',
      pickupLocation: 'Test Warehouse',
      pickupAddress: 'Test Warehouse Address',
      pickupCity: 'New Delhi',
      pickupState: 'Delhi',
      items: [
        {
          name: 'Test Product',
          sku: 'TEST-1',
          quantity: 1,
          price: 1000
        }
      ]
    };
    
    try {
      // Attempt to get rates to verify API connection
      const rates = await provider.getRates(testRequest);
      
      // Return success with some sample rates
      res.json({
        success: true,
        message: 'Successfully connected to shipping provider',
        aggregatorName: provider.name,
        data: {
          ratesAvailable: rates.length > 0,
          sampleRates: rates.slice(0, 3) // Just show first 3 rates
        }
      });
    } catch (error) {
      logger.error(`Error testing ${providerId} connection:`, error);
      res.status(400).json({ 
        success: false, 
        message: `Failed to connect to ${providerId}: ${(error as Error).message}` 
      });
    }
  } catch (error) {
    logger.error('Error testing shipping provider:', error);
    res.status(500).json({ success: false, message: 'An unexpected error occurred' });
  }
};

/**
 * Process webhook notifications from shipping providers
 */
export const processWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    const webhookData = req.body;
    
    if (!providerId) {
      res.status(400).json({ error: 'Provider ID is required' });
      return;
    }
    
    // Get provider instance
    const shippingConfig = await ShippingConfig.findOne();
    if (!shippingConfig) {
      res.status(404).json({ error: 'Shipping configuration not found' });
      return;
    }
    
    const aggregator = shippingConfig.aggregators.find(agg => agg.id === providerId);
    if (!aggregator) {
      res.status(404).json({ error: 'Provider not found in configuration' });
      return;
    }
    
    if (!aggregator.enabled) {
      res.status(400).json({ error: 'Provider is not enabled' });
      return;
    }
    
    // Convert config fields to simple key-value pairs
    const providerConfig: Record<string, string> = {};
    for (const [key, field] of Object.entries(aggregator.configFields)) {
      providerConfig[key] = field.value;
    }
    
    // Add webhook URL if configured
    if (aggregator.webhookUrl) {
      providerConfig.webhookUrl = aggregator.webhookUrl;
    }
    
    // Create appropriate provider instance
    let provider: ShippingAggregatorProvider | null = null;
    
    switch (providerId) {
      case 'shiprocket':
        provider = new ShiprocketProvider(providerConfig);
        break;
      case 'shipway':
        provider = new ShipwayProvider(providerConfig);
        break;
      case 'shipyaari':
        provider = new ShipyaariProvider(providerConfig);
        break;
      default:
        res.status(400).json({ error: 'Invalid provider ID' });
        return;
    }
    
    // Process webhook event
    provider.processWebhookEvent(webhookData);
    
    // Return a 200 response to acknowledge receipt of the webhook
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
};

/**
 * Create return shipment
 */
export const createReturnShipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, trackingId } = req.params;
    const returnRequest = req.body;
    
    if (!providerId || !trackingId) {
      res.status(400).json({ error: 'Provider ID and tracking ID are required' });
      return;
    }
    
    if (!returnRequest) {
      res.status(400).json({ error: 'Return shipment details are required' });
      return;
    }
    
    // Create a return shipment
    const result = await shippingService.createReturnShipment(providerId, trackingId, returnRequest);
    res.json(result);
  } catch (error) {
    logger.error('Error creating return shipment:', error);
    res.status(500).json({ error: 'Failed to create return shipment' });
  }
};

/**
 * Get all pickup locations for a provider
 */
export const getPickupLocations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    
    if (!providerId) {
      res.status(400).json({ error: 'Provider ID is required' });
      return;
    }
    
    const locations = await shippingService.getPickupLocations(providerId);
    res.json(locations);
  } catch (error) {
    logger.error('Error getting pickup locations:', error);
    res.status(500).json({ error: 'Failed to get pickup locations' });
  }
};

/**
 * Create a new pickup location for a provider
 */
export const createPickupLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    const locationData = req.body;
    
    if (!providerId) {
      res.status(400).json({ error: 'Provider ID is required' });
      return;
    }
    
    if (!locationData) {
      res.status(400).json({ error: 'Pickup location details are required' });
      return;
    }
    
    const result = await shippingService.createPickupLocation(providerId, locationData);
    
    if (!result) {
      res.status(400).json({ error: 'Failed to create pickup location' });
      return;
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Error creating pickup location:', error);
    res.status(500).json({ error: 'Failed to create pickup location' });
  }
};

/**
 * Get shipping analytics
 */
export const getShippingAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const period = req.query.period as string || '30d'; // Default to 30 days
    
    // Get all orders with shipments in the given period
    // This would typically be fetched from the database or calculated from shipping data
    
    // For demo purposes, we're returning mock data here
    // In a real implementation, this would query orders and shipments from the database
    
    const result = {
      totalShipments: 125,
      pendingShipments: 15,
      deliveredShipments: 98,
      inTransitShipments: 12,
      averageDeliveryTime: 3.2,
      providerBreakdown: [
        { providerId: 'shiprocket', name: 'Shiprocket', count: 75, percentage: 60 },
        { providerId: 'shipway', name: 'Shipway', count: 30, percentage: 24 },
        { providerId: 'shipyaari', name: 'Shipyaari', count: 20, percentage: 16 }
      ],
      recentShipments: [
        { id: '1', orderId: 'ORD12345', trackingId: 'TRK12345', provider: 'Shiprocket', status: 'Delivered', createdAt: '2023-06-01T12:00:00Z' },
        { id: '2', orderId: 'ORD12346', trackingId: 'TRK12346', provider: 'Shipway', status: 'In Transit', createdAt: '2023-06-02T14:30:00Z' },
        { id: '3', orderId: 'ORD12347', trackingId: 'TRK12347', provider: 'Shipyaari', status: 'Pending', createdAt: '2023-06-03T09:15:00Z' }
      ]
    };
    
    res.json(result);
  } catch (error) {
    logger.error('Error getting shipping analytics:', error);
    res.status(500).json({ error: 'Failed to get shipping analytics' });
  }
}; 