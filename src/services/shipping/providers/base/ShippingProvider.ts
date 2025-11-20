import { logger } from '../../../../utils/logger.js';
import { IPickupLocation } from '../../../../models/ShippingConfig.js';
import {
  ShippingRequest,
  ShippingRate,
  ShipmentResponse,
  ShipmentTrackingResponse,
  ShipmentCancellationResponse,
  PickupLocationResponse
} from '../../core/types.js';
/**
 * Interface for shipping aggregator provider
 */
export abstract class ShippingAggregatorProvider {
  protected config: Record<string, string>;
  public name: string;

  constructor(name: string, config: Record<string, string>) {
    this.name = name;
    this.config = config;
  }

  /**
   * Checks if provider is properly configured with all required fields
   */
  public abstract isConfigured(): boolean;

  /**
   * Get shipping rates from provider
   * @param request Shipping request details
   */
  public abstract getRates(request: ShippingRequest): Promise<ShippingRate[]>;

  /**
   * Create a shipment with the provider
   * @param request Shipping request details
   * @param service Selected service name
   */
  public abstract createShipment(request: ShippingRequest, service: string): Promise<ShipmentResponse>;

  /**
   * Track a shipment
   * @param trackingId Tracking ID of the shipment
   */
  public abstract trackShipment(trackingId: string): Promise<ShipmentTrackingResponse>;

  /**
   * Cancel a shipment
   * @param trackingId Tracking ID of the shipment
   */
  public abstract cancelShipment(trackingId: string): Promise<ShipmentCancellationResponse>;

  /**
   * Get pickup locations for this provider
   * Default implementation returns empty array, override in provider implementation
   */
  public async getPickupLocations(): Promise<PickupLocationResponse[]> {
    return [];
  }

  /**
   * Create a new pickup location for this provider
   * Default implementation returns null, override in provider implementation
   */
  public async createPickupLocation(_location: IPickupLocation): Promise<PickupLocationResponse | null> {
    return null;
  }

  /**
   * Create a return shipment (reverse pickup)
   * Default implementation returns error, override in provider implementation
   */
  public async createReturnShipment(_originalTrackingId: string, _request: ShippingRequest): Promise<ShipmentResponse> {
    return {
      success: false,
      message: 'Return shipment creation not supported by this provider',
      error: 'NOT_IMPLEMENTED'
    };
  }

  /**
   * Check if a webhook is configured
   */
  public hasWebhook(): boolean {
    return Boolean(this.config.webhookUrl);
  }

  /**
   * Process webhook notification - default implementation logs the event
   * Override in provider implementation for specific webhook handling
   */
  public processWebhookEvent(event: any): void {
    logger.info(`Received webhook event for ${this.name}:`, event);
  }

  /**
   * Check if provider supports international shipping
   * Default implementation returns false, override in provider implementation
   */
  public supportsInternationalShipping(): boolean {
    return false;
  }

  /**
   * Get international shipping rates
   * Default implementation returns empty array, override in provider implementation
   */
  public async getInternationalRates(_request: ShippingRequest): Promise<ShippingRate[]> {
    return [];
  }
}
