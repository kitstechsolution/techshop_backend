import { Request, Response } from 'express';
import ShippingConfig from '../models/ShippingConfig';
import { logger } from '../utils/logger';
import { testShippingProvider } from '../services/ShippingService';

// Get shipping configuration
export const getShippingConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await ShippingConfig.findOne();
    
    if (!config) {
      // Return a default configuration if none exists
      res.status(200).json({
        aggregators: [
          {
            id: 'shiprocket',
            name: 'Shiprocket',
            description: 'India\'s leading shipping aggregator with 25+ courier partners',
            enabled: false,
            configFields: {
              email: {
                name: 'Email',
                type: 'text',
                required: true,
                placeholder: 'Your Shiprocket account email',
                value: '',
              },
              password: {
                name: 'Password',
                type: 'password',
                required: true,
                placeholder: 'Your Shiprocket account password',
                value: '',
              },
              apiKey: {
                name: 'API Key',
                type: 'text',
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
            description: 'Automated shipping with AI-powered delivery experience',
            enabled: false,
            configFields: {
              username: {
                name: 'Username',
                type: 'text',
                required: true,
                placeholder: 'Your Shipway username',
                value: '',
              },
              licenseKey: {
                name: 'License Key',
                type: 'text',
                required: true,
                placeholder: 'Your Shipway license key',
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
            description: 'Nationwide shipping with 29,000+ pincode coverage',
            enabled: false,
            configFields: {
              userId: {
                name: 'User ID',
                type: 'text',
                required: true,
                placeholder: 'Your Shipyaari user ID',
                value: '',
              },
              apiKey: {
                name: 'API Key',
                type: 'text',
                required: true,
                placeholder: 'Your Shipyaari API key',
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
        defaultAggregator: '',
        enablePincodeValidation: true,
        defaultShippingCost: 50,
        freeShippingThreshold: 500,
        enableInternationalShipping: false,
        pickupLocations: [],
        enableWebhooks: false,
        enableInsurance: false,
        insuranceThreshold: 10000
      });
      return;
    }
    
    res.status(200).json(config);
  } catch (error) {
    logger.error('Error fetching shipping configuration:', error);
    res.status(500).json({ message: 'Failed to fetch shipping configuration' });
  }
};

// Update shipping configuration
export const updateShippingConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const configData = req.body;
    let config = await ShippingConfig.findOne();
    
    if (!config) {
      // Create new config if none exists
      config = new ShippingConfig(configData);
    } else {
      // Update existing config
      config.aggregators = configData.aggregators;
      config.defaultAggregator = configData.defaultAggregator;
      config.enablePincodeValidation = configData.enablePincodeValidation;
      config.defaultShippingCost = configData.defaultShippingCost;
      config.freeShippingThreshold = configData.freeShippingThreshold;
      config.enableInternationalShipping = configData.enableInternationalShipping;
      config.pickupLocations = configData.pickupLocations || [];
      config.enableWebhooks = configData.enableWebhooks || false;
      config.enableInsurance = configData.enableInsurance || false;
      config.insuranceThreshold = configData.insuranceThreshold || 10000;
    }
    
    await config.save();
    res.status(200).json(config);
  } catch (error) {
    logger.error('Error updating shipping configuration:', error);
    res.status(500).json({ message: 'Failed to update shipping configuration' });
  }
};

// Test shipping provider connection
export const testShippingConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    const configFields = req.body;
    
    // Validate the provider ID
    if (!['shiprocket', 'shipway', 'shipyaari'].includes(providerId)) {
      res.status(400).json({ success: false, message: 'Invalid provider ID' });
      return;
    }
    
    // Validate required config fields
    if (!configFields) {
      res.status(400).json({ success: false, message: 'Configuration fields are required' });
      return;
    }
    
    // Call the service to test the shipping provider
    const result = await testShippingProvider(providerId, configFields);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Connection successful',
        data: result.data
      });
    } else {
      res.status(200).json({
        success: false,
        message: result.error || 'Connection failed',
      });
    }
  } catch (error) {
    logger.error('Error testing shipping connection:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to test shipping connection' 
    });
  }
};

// Get shipping analytics
export const getShippingAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = '7d' } = req.query;
    
    // For now, return mock data
    // In a real implementation, you would query your database for actual statistics
    const mockData = {
      totalShipments: 152,
      deliveredShipments: 128,
      inTransitShipments: 18,
      returnedShipments: 6,
      averageDeliveryTime: 3.2, // in days
      providerBreakdown: [
        { provider: 'Shiprocket', count: 98, percentage: 64.5 },
        { provider: 'Shipway', count: 32, percentage: 21.0 },
        { provider: 'Shipyaari', count: 22, percentage: 14.5 },
      ],
      recentShipments: [
        { 
          orderId: 'ORD123456', 
          trackingId: 'TRK987654', 
          provider: 'Shiprocket', 
          status: 'Delivered', 
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          deliveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        },
        { 
          orderId: 'ORD123457', 
          trackingId: 'TRK987655', 
          provider: 'Shipway', 
          status: 'In Transit', 
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          deliveredAt: null
        },
        { 
          orderId: 'ORD123458', 
          trackingId: 'TRK987656', 
          provider: 'Shipyaari', 
          status: 'Out for Delivery', 
          createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          deliveredAt: null
        },
        { 
          orderId: 'ORD123459', 
          trackingId: 'TRK987657', 
          provider: 'Shiprocket', 
          status: 'Delivered', 
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        { 
          orderId: 'ORD123460', 
          trackingId: 'TRK987658', 
          provider: 'Shiprocket', 
          status: 'Returned', 
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          deliveredAt: null
        }
      ]
    };
    
    res.status(200).json(mockData);
  } catch (error) {
    logger.error('Error fetching shipping analytics:', error);
    res.status(500).json({ message: 'Failed to fetch shipping analytics' });
  }
}; 