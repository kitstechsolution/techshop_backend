import { Request, Response } from 'express';
import ShippingConfig from '../models/ShippingConfig.js';
import { Order } from '../models/Order.js';
import { logger } from '../utils/logger.js';
import shippingService, { testShippingProvider } from '../services/ShippingService.js';

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
            priority: 1,
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
            priority: 2,
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
            priority: 3,
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
        selectionStrategy: 'priority',
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
      if (configData.selectionStrategy) {
        (config as any).selectionStrategy = configData.selectionStrategy;
      }
    }
    
    await config.save();

    // Initialize runtime providers with the new configuration
    const enabledAggregators = config.aggregators.filter((agg: any) => agg.enabled);
    shippingService.initializeProviders(enabledAggregators as any, config.defaultAggregator);

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
    // Period handling: default 30 days, override via ?periodDays=7|30|90
    const periodDaysRaw = (req.query.periodDays as string) || '30';
    const periodDays = Math.max(1, parseInt(periodDaysRaw, 10) || 30);
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    // Base match: orders with a tracking number created within period
    const baseMatch: any = { createdAt: { $gte: since } };

    const [totalShipments, deliveredShipments, inTransitShipments, cancelledShipments] = await Promise.all([
      Order.countDocuments({ ...baseMatch, trackingNumber: { $exists: true, $ne: '' } }),
      Order.countDocuments({ ...baseMatch, status: 'delivered' }),
      Order.countDocuments({ ...baseMatch, status: { $in: ['processing', 'shipped'] } }),
      Order.countDocuments({ ...baseMatch, status: 'cancelled' }),
    ]);

    // Average delivery time (days) for delivered orders in period
    const delivered = await Order.find({ ...baseMatch, status: 'delivered', actualDeliveryDate: { $exists: true } })
      .select({ createdAt: 1, actualDeliveryDate: 1 })
      .lean();
    let averageDeliveryTime = 0;
    if (delivered.length > 0) {
      const sumDays = delivered.reduce((sum: number, o: any) => {
        const ms = (new Date(o.actualDeliveryDate).getTime() - new Date(o.createdAt).getTime());
        return sum + Math.max(0, ms / (1000 * 60 * 60 * 24));
      }, 0);
      averageDeliveryTime = Number((sumDays / delivered.length).toFixed(2));
    }

    // Provider breakdown (counts per shippingProvider)
    const providerAgg = await Order.aggregate([
      { $match: { ...baseMatch, shippingProvider: { $exists: true, $ne: '' } } },
      { $group: { _id: '$shippingProvider', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const providerBreakdown = providerAgg.map((r: any) => ({ provider: r._id, count: r.count }));

    // Recent shipments (last 5)
    const recentDocs = await Order.find({ ...baseMatch, trackingNumber: { $exists: true, $ne: '' } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select({ orderNumber: 1, trackingNumber: 1, shippingProvider: 1, status: 1, createdAt: 1, actualDeliveryDate: 1 })
      .lean();
    const recentShipments = recentDocs.map((o: any) => ({
      orderId: o.orderNumber || String(o._id),
      trackingId: o.trackingNumber || '',
      provider: o.shippingProvider || '',
      status: (o.status || '').toString(),
      createdAt: o.createdAt?.toISOString?.() || new Date(o.createdAt).toISOString(),
      deliveredAt: o.actualDeliveryDate ? new Date(o.actualDeliveryDate).toISOString() : null,
    }));

    res.status(200).json({
      periodDays,
      totalShipments,
      deliveredShipments,
      inTransitShipments,
      returnedShipments: cancelledShipments,
      averageDeliveryTime,
      providerBreakdown,
      recentShipments,
    });
  } catch (error) {
    logger.error('Error fetching shipping analytics:', error);
    res.status(500).json({ message: 'Failed to fetch shipping analytics' });
  }
}; 
