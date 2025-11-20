import { logger } from '../../../utils/logger.js';
import { IShippingAggregator, IPickupLocation } from '../../../models/ShippingConfig.js';
import {
  ShippingRequest,
  ShippingRate,
  ShipmentResponse,
  ShipmentTrackingResponse,
  ShipmentCancellationResponse,
  PickupLocationResponse
} from './types.js';
import { ShippingAggregatorProvider } from '../providers/base/ShippingProvider.js';
import { ShiprocketProvider } from '../providers/ShiprocketProvider.js';
import { ShipwayProvider } from '../providers/ShipwayProvider.js';
import { ShipyaariProvider } from '../providers/ShipyaariProvider.js';
export class ShippingService {
  private providers: Map<string, ShippingAggregatorProvider> = new Map();
  private defaultProvider: string | null = null;

  /**
   * Initialize shipping providers based on configuration
   * @param aggregators List of configured shipping aggregators
   * @param defaultAggregator Default aggregator to use
   */
  public initializeProviders(
    aggregators: IShippingAggregator[],
    defaultAggregator: string
  ): void {
    // Clear existing providers
    this.providers.clear();
    
    // Initialize enabled providers
    for (const agg of aggregators) {
      if (!agg.enabled) continue;
      
      // Convert config fields to simple key-value pairs
      const config: Record<string, string> = {};
      for (const [key, field] of Object.entries(agg.configFields)) {
        config[key] = field.value;
      }
      
      // Create provider instance based on ID
      let provider: ShippingAggregatorProvider | null = null;
      
      switch (agg.id) {
        case 'shiprocket':
          provider = new ShiprocketProvider(config);
          break;
        case 'shipway':
          provider = new ShipwayProvider(config);
          break;
        case 'shipyaari':
          provider = new ShipyaariProvider(config);
          break;
        default:
          logger.warn(`Unknown shipping provider: ${agg.id}`);
          continue;
      }
      
      // Add to providers map if configured correctly
      if (provider.isConfigured()) {
        this.providers.set(agg.id, provider);
      } else {
        logger.warn(`Shipping provider ${agg.id} is not properly configured`);
      }
    }
    
    // Set default provider
    if (this.providers.has(defaultAggregator)) {
      this.defaultProvider = defaultAggregator;
    } else if (this.providers.size > 0) {
      // Use first available provider as default if specified default is not available
      this.defaultProvider = Array.from(this.providers.keys())[0];
    } else {
      this.defaultProvider = null;
      logger.warn('No shipping providers configured properly');
    }
  }

  /**
   * Get all available shipping rates from all configured providers
   * @param request Shipping request details
   */
  public async getAllRates(request: ShippingRequest): Promise<Map<string, ShippingRate[]>> {
    const results = new Map<string, ShippingRate[]>();
    
    // Validate request
    if (!this.validatePincode(request.pickupPincode) || !this.validatePincode(request.deliveryPincode)) {
      logger.warn(`Invalid pincode in shipping request: ${request.pickupPincode} -> ${request.deliveryPincode}`);
      return results;
    }
    
    // Get rates from all providers in parallel
    const promises = Array.from(this.providers.entries()).map(
      async ([id, provider]) => {
        try {
          const rates = await provider.getRates(request);
          return { id, rates };
        } catch (error) {
          logger.error(`Error getting rates from ${id}:`, error);
          return { id, rates: [] };
        }
      }
    );
    
    const responses = await Promise.all(promises);
    
    // Store results
    for (const { id, rates } of responses) {
      results.set(id, rates);
    }
    
    return results;
  }

  /**
   * Get rates from a specific provider
   * @param providerId Provider ID
   * @param request Shipping request details
   */
  public async getRates(providerId: string, request: ShippingRequest): Promise<ShippingRate[]> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      logger.warn(`Provider ${providerId} not found`);
      return [];
    }
    
    if (!this.validatePincode(request.pickupPincode) || !this.validatePincode(request.deliveryPincode)) {
      logger.warn(`Invalid pincode in shipping request: ${request.pickupPincode} -> ${request.deliveryPincode}`);
      return [];
    }
    
    try {
      return await provider.getRates(request);
    } catch (error) {
      logger.error(`Error getting rates from ${providerId}:`, error);
      return [];
    }
  }

  /**
   * Create a shipment with the specified provider
   * @param providerId Provider ID
   * @param request Shipping request details
   * @param service Selected service name
   */
  public async createShipment(
    providerId: string,
    request: ShippingRequest,
    service: string
  ): Promise<ShipmentResponse> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return {
        success: false,
        message: `Provider ${providerId} not found or not enabled`,
      };
    }
    
    if (!this.validatePincode(request.pickupPincode) || !this.validatePincode(request.deliveryPincode)) {
      return {
        success: false,
        message: `Invalid pincode in shipping request: ${request.pickupPincode} -> ${request.deliveryPincode}`,
      };
    }
    
    try {
      return await provider.createShipment(request, service);
    } catch (error) {
      logger.error(`Error creating shipment with ${providerId}:`, error);
      return {
        success: false,
        message: 'Failed to create shipment',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Track a shipment with the specified provider
   * @param providerId Provider ID
   * @param trackingId Tracking ID
   */
  public async trackShipment(providerId: string, trackingId: string): Promise<ShipmentTrackingResponse> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found or not enabled`);
    }
    
    return await provider.trackShipment(trackingId);
  }

  /**
   * Cancel a shipment with the specified provider
   * @param providerId Provider ID
   * @param trackingId Tracking ID
   */
  public async cancelShipment(providerId: string, trackingId: string): Promise<ShipmentCancellationResponse> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      logger.warn(`Provider ${providerId} not found or not enabled`);
      return {
        success: false,
        message: 'Invalid provider',
        error: 'INVALID_PROVIDER',
        trackingId
      };
    }
    
    return await provider.cancelShipment(trackingId);
  }

  /**
   * Validate a pincode format
   * @param pincode Pincode to validate
   */
  private validatePincode(pincode: string): boolean {
    // Basic validation for Indian PIN codes (6 digits)
    return /^\d{6}$/.test(pincode);
  }

  /**
   * Get list of available providers
   */
  public getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get default provider
   */
  public getDefaultProvider(): string | null {
    return this.defaultProvider;
  }

  /**
   * Create a return shipment
   * @param providerId Provider ID
   * @param trackingId Original shipment tracking ID
   * @param request Shipping request details
   * @returns Shipment response
   */
  public async createReturnShipment(
    providerId: string,
    trackingId: string,
    request: ShippingRequest
  ): Promise<ShipmentResponse> {
    try {
      const provider = this.getProvider(providerId);
      if (!provider) {
        return {
          success: false,
          message: 'Invalid provider',
          error: 'INVALID_PROVIDER'
        };
      }

      // Mark the request as a return shipment
      request.isReversePicking = true;
      
      return await provider.createReturnShipment(trackingId, request);
    } catch (error) {
      logger.error(`Error creating return shipment with provider ${providerId}:`, error);
      return {
        success: false,
        message: `Failed to create return shipment: ${(error as Error).message}`,
        error: 'ERROR_CREATING_RETURN_SHIPMENT'
      };
    }
  }

  /**
   * Get pickup locations for a provider
   * @param providerId Provider ID
   * @returns Array of pickup locations
   */
  public async getPickupLocations(providerId: string): Promise<PickupLocationResponse[]> {
    try {
      const provider = this.getProvider(providerId);
      if (!provider) {
        return [];
      }

      return await provider.getPickupLocations();
    } catch (error) {
      logger.error(`Error getting pickup locations for provider ${providerId}:`, error);
      return [];
    }
  }

  /**
   * Create a new pickup location for a provider
   * @param providerId Provider ID
   * @param location Pickup location details
   * @returns Created pickup location or null if failed
   */
  public async createPickupLocation(
    providerId: string,
    location: IPickupLocation
  ): Promise<PickupLocationResponse | null> {
    try {
      const provider = this.getProvider(providerId);
      if (!provider) {
        return null;
      }

      return await provider.createPickupLocation(location);
    } catch (error) {
      logger.error(`Error creating pickup location for provider ${providerId}:`, error);
      return null;
    }
  }

  /**
   * Check if a provider supports international shipping
   * @param providerId Provider ID
   * @returns true if international shipping is supported
   */
  public supportsInternationalShipping(providerId: string): boolean {
    const provider = this.getProvider(providerId);
    if (!provider) {
      return false;
    }

    return provider.supportsInternationalShipping();
  }

  /**
   * Get international shipping rates
   * @param providerId Provider ID
   * @param request Shipping request details
   * @returns Array of shipping rates
   */
  public async getInternationalRates(
    providerId: string,
    request: ShippingRequest
  ): Promise<ShippingRate[]> {
    try {
      const provider = this.getProvider(providerId);
      if (!provider) {
        return [];
      }

      // Set the international flag
      request.isInternational = true;
      
      return await provider.getInternationalRates(request);
    } catch (error) {
      logger.error(`Error getting international rates for provider ${providerId}:`, error);
      return [];
    }
  }

  /**
   * Process a webhook event for a provider
   * @param providerId Provider ID
   * @param event Webhook event data
   */
  public processWebhookEvent(providerId: string, event: any): void {
    try {
      const provider = this.getProvider(providerId);
      if (!provider) {
        logger.warn(`Received webhook for unknown provider: ${providerId}`);
        return;
      }

      provider.processWebhookEvent(event);
    } catch (error) {
      logger.error(`Error processing webhook for provider ${providerId}:`, error);
    }
  }

  /**
   * Get provider by ID
   * @param providerId Provider ID
   * @returns Provider instance or null if not found
   */
  private getProvider(providerId: string): ShippingAggregatorProvider | null {
    if (!this.providers.has(providerId)) {
      logger.warn(`Provider not found: ${providerId}`);
      return null;
    }
    
    return this.providers.get(providerId) || null;
  }
}

// Create singleton instance
const shippingService = new ShippingService();
export default shippingService; 

/**
 * Test shipping provider connection
 * @param providerId The ID of the provider to test
 * @param configFields Configuration fields for the provider
 * @returns Result of the test connection
 */
export async function testShippingProvider(
  providerId: string, 
  configFields: Record<string, any>
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Validate provider ID
    if (!['shiprocket', 'shipway', 'shipyaari'].includes(providerId)) {
      return { success: false, error: 'Invalid provider ID' };
    }
    
    // Create appropriate provider instance based on providerId
    let provider: ShippingAggregatorProvider;
    
    switch (providerId) {
      case 'shiprocket':
        provider = new ShiprocketProvider(configFields);
        break;
      case 'shipway':
        provider = new ShipwayProvider(configFields);
        break;
      case 'shipyaari':
        provider = new ShipyaariProvider(configFields);
        break;
      default:
        return { success: false, error: 'Invalid provider ID' };
    }
    
    // Check if provider is configured correctly
    if (!provider.isConfigured()) {
      return { 
        success: false, 
        error: 'Provider is not properly configured. Please check all required fields.' 
      };
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
      return {
        success: true,
        data: {
          aggregatorName: provider.name,
          ratesAvailable: rates.length > 0,
          sampleRates: rates.slice(0, 3) // Just show first 3 rates
        }
      };
    } catch (error) {
      logger.error(`Error testing ${providerId} connection:`, error);
      return { 
        success: false, 
        error: `Failed to connect to ${providerId}: ${(error as Error).message}` 
      };
    }
  } catch (error) {
    logger.error('Error in testShippingProvider:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    };
  }
}


