import { Request, Response } from 'express';
import { PaymentSettings } from '../models/PaymentSettings.js';

/**
 * Get all payment settings
 * GET /api/admin/payments/settings
 */
export const getPaymentSettings = async (req: Request, res: Response) => {
  try {
    const settings = await PaymentSettings.getSettings();
    
    // Remove sensitive credentials from response
    const safeSettings = {
      ...settings.toObject(),
      gateways: settings.gateways.map(gateway => ({
        id: gateway.id,
        name: gateway.name,
        displayName: gateway.displayName,
        description: gateway.description,
        enabled: gateway.enabled,
        isTest: gateway.isTest,
        supportedCurrencies: gateway.supportedCurrencies,
        supportedCountries: gateway.supportedCountries,
        minAmount: gateway.minAmount,
        maxAmount: gateway.maxAmount,
        processingFeePercent: gateway.processingFeePercent,
        processingFeeFixed: gateway.processingFeeFixed,
        settings: gateway.settings,
        // Indicate which credentials are configured without revealing values
        credentialsConfigured: gateway.credentials ? Object.keys(gateway.credentials) : []
      }))
    };
    
    res.json({
      success: true,
      data: safeSettings
    });
  } catch (error) {
    console.error('Error fetching payment settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment settings'
    });
  }
};

/**
 * Get specific gateway configuration (for frontend use)
 * GET /api/payments/config/:gatewayId
 */
export const getGatewayConfig = async (req: Request, res: Response) => {
  try {
    const { gatewayId } = req.params;
    const settings = await PaymentSettings.getSettings();
    
    const gateway = settings.getGateway(gatewayId);
    
    if (!gateway) {
      return res.status(404).json({
        success: false,
        message: 'Payment gateway not found'
      });
    }
    
    if (!gateway.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Payment gateway is not enabled'
      });
    }
    
    // Get decrypted public credentials only
    const credentials = settings.getDecryptedCredentials(gatewayId);
    const publicCredentials: Record<string, string> = {};
    
    // Only return public/publishable keys, never secret keys
    const publicKeyNames = [
      'keyId', 'publishableKey', 'clientId', 'publicKey', 
      'merchantId', 'appId'
    ];
    
    Object.entries(credentials).forEach(([key, value]) => {
      if (publicKeyNames.includes(key)) {
        publicCredentials[key] = value;
      }
    });
    
    res.json({
      success: true,
      data: {
        id: gateway.id,
        name: gateway.name,
        displayName: gateway.displayName,
        isTest: gateway.isTest,
        credentials: publicCredentials,
        supportedCurrencies: gateway.supportedCurrencies,
        settings: gateway.settings
      }
    });
  } catch (error) {
    console.error('Error fetching gateway config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gateway configuration'
    });
  }
};

/**
 * Get enabled payment gateways (public endpoint)
 * GET /api/payments/gateways
 */
export const getEnabledGateways = async (req: Request, res: Response) => {
  try {
    const settings = await PaymentSettings.getSettings();
    
    const enabledGateways = settings.gateways
      .filter(g => g.enabled)
      .map(g => ({
        id: g.id,
        name: g.name,
        displayName: g.displayName,
        description: g.description,
        supportedCurrencies: g.supportedCurrencies,
        minAmount: g.minAmount,
        maxAmount: g.maxAmount
      }));
    
    res.json({
      success: true,
      data: {
        gateways: enabledGateways,
        defaultGateway: settings.defaultGateway,
        globalSettings: settings.globalSettings
      }
    });
  } catch (error) {
    console.error('Error fetching enabled gateways:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment gateways'
    });
  }
};

/**
 * Create or update gateway configuration
 * PUT /api/admin/payments/gateway/:gatewayId
 */
export const updateGatewayConfig = async (req: Request, res: Response) => {
  try {
    const { gatewayId } = req.params;
    const {
      enabled,
      isTest,
      credentials,
      displayName,
      description,
      supportedCurrencies,
      supportedCountries,
      minAmount,
      maxAmount,
      processingFeePercent,
      processingFeeFixed,
      settings: gatewaySettings
    } = req.body;
    
    const paymentSettings = await PaymentSettings.getSettings();
    let gateway = paymentSettings.getGateway(gatewayId);
    
    const isNewGateway = !gateway;
    
    if (isNewGateway) {
      // Create new gateway
      gateway = {
        id: gatewayId,
        name: displayName || gatewayId,
        enabled: enabled || false,
        isTest: isTest !== undefined ? isTest : true,
        credentials: {},
        displayName,
        description,
        supportedCurrencies,
        supportedCountries,
        minAmount,
        maxAmount,
        processingFeePercent,
        processingFeeFixed,
        settings: gatewaySettings
      };
      
      paymentSettings.gateways.push(gateway);
    }
    
    // TypeScript now knows gateway cannot be undefined here
    if (!gateway) {
      return res.status(500).json({
        success: false,
        message: 'Gateway reference lost'
      });
    }
    
    // Track changes
    const changes: string[] = [];
    
    // Update basic fields
    if (displayName !== undefined && gateway.displayName !== displayName) {
      changes.push(`displayName: ${gateway.displayName} -> ${displayName}`);
      gateway.displayName = displayName;
    }
    
    if (description !== undefined && gateway.description !== description) {
      changes.push('description updated');
      gateway.description = description;
    }
    
    if (isTest !== undefined && gateway.isTest !== isTest) {
      changes.push(`isTest: ${gateway.isTest} -> ${isTest}`);
      gateway.isTest = isTest;
    }
    
    if (supportedCurrencies !== undefined) {
      changes.push('supportedCurrencies updated');
      gateway.supportedCurrencies = supportedCurrencies;
    }
    
    if (supportedCountries !== undefined) {
      changes.push('supportedCountries updated');
      gateway.supportedCountries = supportedCountries;
    }
    
    if (minAmount !== undefined) {
      gateway.minAmount = minAmount;
    }
    
    if (maxAmount !== undefined) {
      gateway.maxAmount = maxAmount;
    }
    
    if (processingFeePercent !== undefined) {
      gateway.processingFeePercent = processingFeePercent;
    }
    
    if (processingFeeFixed !== undefined) {
      gateway.processingFeeFixed = processingFeeFixed;
    }
    
    if (gatewaySettings !== undefined) {
      changes.push('settings updated');
      gateway.settings = gatewaySettings;
    }
    
    // Update credentials if provided
    if (credentials) {
      changes.push('credentials updated');
      const encryptedCredentials = PaymentSettings.encryptCredentials(credentials);
      
      // Convert to Map for storage
      if (!gateway.credentials) {
        gateway.credentials = {};
      }
      
      Object.entries(encryptedCredentials).forEach(([key, value]) => {
        (gateway.credentials as any)[key] = value;
      });
    }
    
    // Update enabled status
    if (enabled !== undefined && gateway.enabled !== enabled) {
      if (enabled) {
        paymentSettings.enableGateway(gatewayId);
        changes.push('gateway enabled');
      } else {
        paymentSettings.disableGateway(gatewayId);
        changes.push('gateway disabled');
      }
    }
    
    // Add to history
    if (changes.length > 0) {
      paymentSettings.addToHistory(
        gatewayId,
        isNewGateway ? 'created' : 'updated',
        changes.join(', ')
      );
    }
    
    await paymentSettings.save();
    
    res.json({
      success: true,
      message: isNewGateway ? 'Gateway created successfully' : 'Gateway updated successfully',
      data: {
        id: gateway.id,
        name: gateway.name,
        enabled: gateway.enabled
      }
    });
  } catch (error) {
    console.error('Error updating gateway config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update gateway configuration'
    });
  }
};

/**
 * Enable a payment gateway
 * POST /api/admin/payments/gateway/:gatewayId/enable
 */
export const enableGateway = async (req: Request, res: Response) => {
  try {
    const { gatewayId } = req.params;
    const settings = await PaymentSettings.getSettings();
    
    const gateway = settings.getGateway(gatewayId);
    
    if (!gateway) {
      return res.status(404).json({
        success: false,
        message: 'Payment gateway not found'
      });
    }
    
    settings.enableGateway(gatewayId);
    await settings.save();
    
    res.json({
      success: true,
      message: 'Gateway enabled successfully',
      data: {
        enabledGateways: settings.enabledGateways,
        defaultGateway: settings.defaultGateway
      }
    });
  } catch (error) {
    console.error('Error enabling gateway:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enable gateway'
    });
  }
};

/**
 * Disable a payment gateway
 * POST /api/admin/payments/gateway/:gatewayId/disable
 */
export const disableGateway = async (req: Request, res: Response) => {
  try {
    const { gatewayId } = req.params;
    const settings = await PaymentSettings.getSettings();
    
    const gateway = settings.getGateway(gatewayId);
    
    if (!gateway) {
      return res.status(404).json({
        success: false,
        message: 'Payment gateway not found'
      });
    }
    
    settings.disableGateway(gatewayId);
    await settings.save();
    
    res.json({
      success: true,
      message: 'Gateway disabled successfully',
      data: {
        enabledGateways: settings.enabledGateways,
        defaultGateway: settings.defaultGateway
      }
    });
  } catch (error) {
    console.error('Error disabling gateway:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disable gateway'
    });
  }
};

/**
 * Set default payment gateway
 * POST /api/admin/payments/gateway/:gatewayId/set-default
 */
export const setDefaultGateway = async (req: Request, res: Response) => {
  try {
    const { gatewayId } = req.params;
    const settings = await PaymentSettings.getSettings();
    
    const gateway = settings.getGateway(gatewayId);
    
    if (!gateway) {
      return res.status(404).json({
        success: false,
        message: 'Payment gateway not found'
      });
    }
    
    if (!gateway.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Cannot set disabled gateway as default'
      });
    }
    
    settings.defaultGateway = gatewayId;
    settings.addToHistory(gatewayId, 'updated', 'Set as default gateway');
    await settings.save();
    
    res.json({
      success: true,
      message: 'Default gateway updated successfully',
      data: {
        defaultGateway: settings.defaultGateway
      }
    });
  } catch (error) {
    console.error('Error setting default gateway:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set default gateway'
    });
  }
};

/**
 * Update global payment settings
 * PUT /api/admin/payments/settings/global
 */
export const updateGlobalSettings = async (req: Request, res: Response) => {
  try {
    const {
      currency,
      supportedCurrencies,
      allowGuestCheckout,
      requireBillingAddress,
      enableSaveCards,
      paymentTimeout
    } = req.body;
    
    const settings = await PaymentSettings.getSettings();
    const changes: string[] = [];
    
    if (currency !== undefined && settings.globalSettings.currency !== currency) {
      changes.push(`currency: ${settings.globalSettings.currency} -> ${currency}`);
      settings.globalSettings.currency = currency;
    }
    
    if (supportedCurrencies !== undefined) {
      changes.push('supportedCurrencies updated');
      settings.globalSettings.supportedCurrencies = supportedCurrencies;
    }
    
    if (allowGuestCheckout !== undefined && settings.globalSettings.allowGuestCheckout !== allowGuestCheckout) {
      changes.push(`allowGuestCheckout: ${settings.globalSettings.allowGuestCheckout} -> ${allowGuestCheckout}`);
      settings.globalSettings.allowGuestCheckout = allowGuestCheckout;
    }
    
    if (requireBillingAddress !== undefined && settings.globalSettings.requireBillingAddress !== requireBillingAddress) {
      changes.push(`requireBillingAddress: ${settings.globalSettings.requireBillingAddress} -> ${requireBillingAddress}`);
      settings.globalSettings.requireBillingAddress = requireBillingAddress;
    }
    
    if (enableSaveCards !== undefined && settings.globalSettings.enableSaveCards !== enableSaveCards) {
      changes.push(`enableSaveCards: ${settings.globalSettings.enableSaveCards} -> ${enableSaveCards}`);
      settings.globalSettings.enableSaveCards = enableSaveCards;
    }
    
    if (paymentTimeout !== undefined && settings.globalSettings.paymentTimeout !== paymentTimeout) {
      changes.push(`paymentTimeout: ${settings.globalSettings.paymentTimeout} -> ${paymentTimeout}`);
      settings.globalSettings.paymentTimeout = paymentTimeout;
    }
    
    if (changes.length > 0) {
      settings.addToHistory('global', 'updated', changes.join(', '));
      settings.lastModified = new Date();
      await settings.save();
    }
    
    res.json({
      success: true,
      message: 'Global settings updated successfully',
      data: settings.globalSettings
    });
  } catch (error) {
    console.error('Error updating global settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update global settings'
    });
  }
};

/**
 * Get payment settings history
 * GET /api/admin/payments/history
 */
export const getPaymentHistory = async (req: Request, res: Response) => {
  try {
    const settings = await PaymentSettings.getSettings();
    
    // Return history in reverse chronological order
    const history = [...settings.history].reverse();
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history'
    });
  }
};

/**
 * Test gateway connection
 * POST /api/admin/payments/gateway/:gatewayId/test
 */
export const testGatewayConnection = async (req: Request, res: Response) => {
  try {
    const { gatewayId } = req.params;
    const settings = await PaymentSettings.getSettings();
    
    const gateway = settings.getGateway(gatewayId);
    
    if (!gateway) {
      return res.status(404).json({
        success: false,
        message: 'Payment gateway not found'
      });
    }
    
    const credentials = settings.getDecryptedCredentials(gatewayId);
    
    // Basic validation - check if required credentials exist
    let hasRequiredCredentials = false;
    
    switch (gatewayId) {
      case 'razorpay':
        hasRequiredCredentials = !!(credentials.keyId && credentials.keySecret);
        break;
      case 'stripe':
        hasRequiredCredentials = !!(credentials.secretKey);
        break;
      case 'paypal':
        hasRequiredCredentials = !!(credentials.clientId && credentials.clientSecret);
        break;
      case 'cashfree':
        hasRequiredCredentials = !!(credentials.appId && credentials.secretKey);
        break;
      default:
        hasRequiredCredentials = Object.keys(credentials).length > 0;
    }
    
    if (!hasRequiredCredentials) {
      return res.status(400).json({
        success: false,
        message: 'Missing required credentials for this gateway'
      });
    }
    
    res.json({
      success: true,
      message: 'Gateway credentials are configured',
      data: {
        gateway: gatewayId,
        credentialsValid: true,
        testMode: gateway.isTest
      }
    });
  } catch (error) {
    console.error('Error testing gateway connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test gateway connection'
    });
  }
};

/**
 * Delete gateway configuration
 * DELETE /api/admin/payments/gateway/:gatewayId
 */
export const deleteGateway = async (req: Request, res: Response) => {
  try {
    const { gatewayId } = req.params;
    const settings = await PaymentSettings.getSettings();
    
    const gatewayIndex = settings.gateways.findIndex(g => g.id === gatewayId);
    
    if (gatewayIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Payment gateway not found'
      });
    }
    
    const gateway = settings.gateways[gatewayIndex];
    
    // Cannot delete if it's the only enabled gateway
    if (gateway.enabled && settings.enabledGateways.length === 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the only enabled gateway. Enable another gateway first.'
      });
    }
    
    // Disable before deleting
    if (gateway.enabled) {
      settings.disableGateway(gatewayId);
    }
    
    // Remove gateway
    settings.gateways.splice(gatewayIndex, 1);
    settings.addToHistory(gatewayId, 'deleted');
    await settings.save();
    
    res.json({
      success: true,
      message: 'Gateway deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting gateway:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete gateway'
    });
  }
};
