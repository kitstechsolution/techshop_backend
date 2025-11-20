import { logger } from '../../../utils/logger.js';
import { IPickupLocation } from '../../../models/ShippingConfig.js';
import { fetchWithRetry } from '../core/utils.js';
import {
  ShippingRequest,
  ShippingRate,
  ShipmentResponse,
  ShipmentTrackingResponse,
  ShipmentCancellationResponse,
  PickupLocationResponse
} from '../core/types.js';
import { ShippingAggregatorProvider } from './base/ShippingProvider.js';
export class ShipwayProvider extends ShippingAggregatorProvider {
  private testMode: boolean;
  private username: string;
  private licenseKey: string;

  constructor(config: Record<string, string>) {
    super('Shipway', config);
    this.testMode = config.testMode === 'true';
    this.username = config.username;
    this.licenseKey = config.licenseKey;
  }

  /**
   * Check if required configuration fields are present
   */
  public isConfigured(): boolean {
    return Boolean(this.username && this.licenseKey);
  }

  /**
   * Get the base API URL based on environment
   */
  private getApiBaseUrl(): string {
    return this.testMode 
      ? 'https://staging.shipway.in/api' 
      : 'https://shipway.in/api';
  }

  /**
   * Get shipping rates from Shipway
   */
  public async getRates(request: ShippingRequest): Promise<ShippingRate[]> {
    try {
      const apiUrl = `${this.getApiBaseUrl()}/courier/serviceability`;
      
      // Prepare request data
      const requestData = {
        username: this.username,
        license_key: this.licenseKey,
        pickup_pincode: request.pickupPincode,
        delivery_pincode: request.deliveryPincode,
        weight: request.weight / 1000, // Convert to kg
        invoice_value: request.invoiceValue,
        payment_type: request.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
        length: request.packageDimensions?.length || request.dimensions?.length || 10,
        width: request.packageDimensions?.width || request.dimensions?.width || 10,
        height: request.packageDimensions?.height || request.dimensions?.height || 10
      };
      
      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`Failed to get rates: ${response.statusText}`);
      }

      const data: any = await response.json();
      
      if (!data.success || !Array.isArray(data.couriers)) {
        logger.warn('Shipway no available couriers for request:', request);
        return [];
      }
      
      // Transform to standard format
      return data.couriers.map((courier: any) => ({
        carrier: courier.name,
        serviceName: courier.service_id || courier.service,
        carrierId: courier.courier_id,
        serviceId: courier.service_id || courier.service,
        cost: courier.rate,
        estimatedDeliveryDays: courier.estimated_days || 3,
        isAvailable: true,
        hasInsurance: Boolean(courier.insurance_available),
        insuranceCost: courier.insurance_rate || 0,
        isInternational: false,
        currency: 'INR'
      }));
    } catch (error) {
      logger.error('Shipway get rates error:', error);
      return [];
    }
  }

  /**
   * Create shipment with Shipway
   */
  public async createShipment(request: ShippingRequest, service: string): Promise<ShipmentResponse> {
    try {
      const apiUrl = `${this.getApiBaseUrl()}/orders/create`;
      
      // Prepare order data
      const orderData = {
        username: this.username,
        license_key: this.licenseKey,
        order_id: request.orderId,
        service_id: service,
        pickup_name: request.pickupLocation,
        pickup_address: request.pickupAddress,
        pickup_city: request.pickupCity,
        pickup_state: request.pickupState,
        pickup_pincode: request.pickupPincode,
        pickup_phone: request.pickupPhone || '',
        pickup_email: request.pickupEmail || '',
        
        customer_name: request.customerName,
        customer_address: request.customerAddress,
        customer_city: request.customerCity,
        customer_state: request.customerState,
        customer_pincode: request.deliveryPincode,
        customer_phone: request.customerPhone,
        customer_email: request.customerEmail,
        
        payment_type: request.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
        cod_amount: request.paymentMethod === 'cod' ? request.invoiceValue : 0,
        invoice_value: request.invoiceValue,
        
        weight: request.weight / 1000, // Convert to kg
        length: request.packageDimensions?.length || request.dimensions?.length || 10,
        width: request.packageDimensions?.width || request.dimensions?.width || 10,
        height: request.packageDimensions?.height || request.dimensions?.height || 10,
        
        product_description: request.items?.map(item => item.name).join(', ') || 'Product',
        items: request.items?.map(item => ({
          name: item.name,
          sku: item.sku,
          units: item.quantity,
          price: item.price,
          discount: item.discount || 0
        })) || []
      };
      
      // Add insurance if required
      if (request.insuranceRequired && request.insuranceValue) {
        Object.assign(orderData, {
          insurance: 'Yes',
          insurance_value: request.insuranceValue
        });
      }
      
      // Add webhook URL if configured
      if (this.config.webhookUrl) {
        Object.assign(orderData, {
          webhook_url: this.config.webhookUrl
        });
      }
      
      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create shipment: ${response.statusText}`);
      }

      const data: any = await response.json();
      
      if (!data.success) {
        throw new Error(`Failed to create order: ${data.message || 'Unknown error'}`);
      }
      
      return {
        success: true,
        message: 'Shipment created successfully',
        trackingId: data.tracking_number || data.awb,
        labelUrl: data.label_url,
        manifestUrl: data.manifest_url,
        invoiceUrl: data.invoice_url,
        shipmentId: data.shipment_id?.toString(),
        carrierName: data.courier_name,
        estimatedDeliveryDate: data.expected_delivery_date ? new Date(data.expected_delivery_date) : undefined,
        insuranceDetails: request.insuranceRequired ? {
          insuranceProvider: 'Shipway',
          policyNumber: data.tracking_number || data.awb,
          coverageAmount: request.insuranceValue || 0
        } : undefined
      };
    } catch (error) {
      logger.error('Shipway create shipment error:', error);
      return {
        success: false,
        message: 'Failed to create shipment',
        error: (error as Error).message
      };
    }
  }

  /**
   * Track shipment with Shipway
   */
  public async trackShipment(trackingId: string): Promise<any> {
    try {
      const apiUrl = `${this.getApiBaseUrl()}/tracking`;
      
      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: this.username,
          license_key: this.licenseKey,
          awb: trackingId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to track shipment: ${response.statusText}`);
      }

      const data: any = await response.json();
      
      if (!data.success) {
        throw new Error(`Failed to track shipment: ${data.message || 'Unknown error'}`);
      }
      
      return {
        trackingId: trackingId,
        courier: data.courier_name || '',
        status: data.current_status?.status || '',
        statusDescription: data.current_status?.description || '',
        eta: data.expected_delivery_date || '',
        lastUpdated: data.last_update || '',
        deliveryDate: data.delivered_date || '',
        events: data.tracking_history || [],
        trackingUrl: data.tracking_url || ''
      };
    } catch (error) {
      logger.error('Shipway track shipment error:', error);
      throw new Error('Failed to track shipment');
    }
  }

  /**
   * Cancel shipment with Shipway
   */
  public async cancelShipment(trackingId: string): Promise<ShipmentCancellationResponse> {
    try {
      // Shipway API endpoint for cancellation
      const apiUrl = this.testMode 
        ? 'https://shipway.in/api/CancelShipment/test' 
        : 'https://shipway.in/api/CancelShipment';

      // Prepare the request payload
      const payload = {
        username: this.username,
        password: this.licenseKey,
        carrier: 'shipway', // Default to shipway as carrier for cancellation
        awb: trackingId
      };

      // Make the API request to cancel the shipment
      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        logger.error('Shipway cancellation request failed:', { 
          status: response.status,
          trackingId,
          errorText
        });
        return {
          success: false,
          message: 'Cancellation request failed',
          error: `HTTP Error: ${response.status} ${response.statusText}`,
          trackingId
        };
      }

      // Parse the response
      let responseData: any;
      try {
        responseData = await response.json() as any;
      } catch (parseError) {
        logger.error('Failed to parse Shipway cancellation response:', {
          trackingId,
          responseText: await response.text().catch(() => 'Unable to read response text'),
          parseError
        });
        return {
          success: false,
          message: 'Failed to parse cancellation response',
          error: 'Invalid response format',
          trackingId
        };
      }

      // Check if the response indicates success
      if (responseData.status === 'Success' || responseData.status === 'success') {
        logger.info('Shipway shipment cancelled successfully:', { 
          trackingId, 
          responseData 
        });
        return {
          success: true,
          message: responseData.message || 'Shipment cancelled successfully',
          trackingId,
          cancellationId: responseData.cancellationId || trackingId,
          extraData: {
            responseCode: responseData.code,
            cancellationDate: new Date().toISOString(),
            additionalInfo: responseData.additional_info || null,
            refundAmount: responseData.refund_amount
          }
        };
      }

      // If we reach here, the request was processed but cancellation failed
      logger.warn('Shipway cancellation request processed but failed:', { 
        trackingId, 
        responseData 
      });
      return {
        success: false,
        message: responseData.message || 'Cancellation failed',
        error: responseData.error || 'Unknown error from provider',
        trackingId
      };
    } catch (error) {
      logger.error('Shipway cancellation error:', { error, trackingId });
      return {
        success: false,
        message: 'Failed to cancel shipment due to an error',
        error: error instanceof Error ? error.message : String(error),
        trackingId
      };
    }
  }

  /**
   * Get pickup locations from Shipway
   */
  public async getPickupLocations(): Promise<PickupLocationResponse[]> {
    try {
      const apiUrl = `${this.getApiBaseUrl()}/pickup/locations`;
      
      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: this.username,
          license_key: this.licenseKey
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get pickup locations: ${response.statusText}`);
      }

      const data: any = await response.json();
      
      if (!data.success || !Array.isArray(data.pickup_locations)) {
        return [];
      }
      
      // Transform to standard format
      return data.pickup_locations.map((location: any) => ({
        id: location.id.toString(),
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        pincode: location.pincode,
        phone: location.phone,
        email: location.email || '',
        isDefault: location.is_default === true || location.is_default === 1
      }));
    } catch (error) {
      logger.error('Shipway get pickup locations error:', error);
      return [];
    }
  }

  /**
   * Create a new pickup location
   */
  public async createPickupLocation(location: IPickupLocation): Promise<PickupLocationResponse | null> {
    try {
      const apiUrl = `${this.getApiBaseUrl()}/pickup/create`;
      
      const pickupLocation = {
        username: this.username,
        license_key: this.licenseKey,
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        pincode: location.pincode,
        phone: location.phone,
        email: location.email,
        is_default: location.isDefault ? 1 : 0
      };
      
      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pickupLocation)
      });

      if (!response.ok) {
        throw new Error(`Failed to create pickup location: ${response.statusText}`);
      }

      const data: any = await response.json();
      
      if (!data.success) {
        throw new Error(`Failed to create pickup location: ${data.message || 'Unknown error'}`);
      }
      
      return {
        id: data.id.toString(),
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        pincode: location.pincode,
        phone: location.phone,
        email: location.email,
        isDefault: location.isDefault
      };
    } catch (error) {
      logger.error('Shipway create pickup location error:', error);
      return null;
    }
  }

  /**
   * Create a return shipment
   */
  public async createReturnShipment(originalTrackingId: string, request: ShippingRequest): Promise<ShipmentResponse> {
    try {
      const apiUrl = `${this.getApiBaseUrl()}/returns/create`;
      
      // Get tracking info to find order details
      const trackingData = await this.trackShipment(originalTrackingId);
      
      // Prepare return order data
      const returnData = {
        username: this.username,
        license_key: this.licenseKey,
        awb: originalTrackingId,
        order_id: request.orderId || `RET-${originalTrackingId}`,
        pickup_name: request.customerName,
        pickup_address: request.customerAddress,
        pickup_city: request.customerCity,
        pickup_state: request.customerState,
        pickup_pincode: request.deliveryPincode,
        pickup_phone: request.customerPhone,
        
        delivery_name: request.pickupLocation || trackingData.pickup_name,
        delivery_address: request.pickupAddress || trackingData.pickup_address,
        delivery_city: request.pickupCity || trackingData.pickup_city,
        delivery_state: request.pickupState || trackingData.pickup_state,
        delivery_pincode: request.pickupPincode || trackingData.pickup_pincode,
        delivery_phone: request.pickupPhone || trackingData.pickup_phone,
        
        payment_type: 'Prepaid', // Returns are always prepaid
        invoice_value: request.invoiceValue,
        
        weight: request.weight / 1000, // Convert to kg
        length: request.packageDimensions?.length || request.dimensions?.length || 10,
        width: request.packageDimensions?.width || request.dimensions?.width || 10,
        height: request.packageDimensions?.height || request.dimensions?.height || 10,
        
        return_reason: request.returnReason || 'Customer initiated return'
      };
      
      // Add webhook URL if configured
      if (this.config.webhookUrl) {
        Object.assign(returnData, {
          webhook_url: this.config.webhookUrl
        });
      }
      
      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(returnData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create return shipment: ${response.statusText}`);
      }

      const data: any = await response.json();
      
      if (!data.success) {
        throw new Error(`Failed to create return shipment: ${data.message || 'Unknown error'}`);
      }
      
      return {
        success: true,
        message: 'Return shipment created successfully',
        trackingId: data.tracking_number || data.awb,
        labelUrl: data.label_url,
        manifestUrl: data.manifest_url,
        shipmentId: data.shipment_id?.toString(),
        carrierName: data.courier_name
      };
    } catch (error) {
      logger.error('Shipway create return shipment error:', error);
      return {
        success: false,
        message: 'Failed to create return shipment',
        error: (error as Error).message
      };
    }
  }

  /**
   * Process webhook notification from Shipway
   */
  public processWebhookEvent(event: any): void {
    try {
      if (!event || !event.status) {
        logger.warn('Received invalid webhook event from Shipway');
        return;
      }
      
      const status = event.status;
      const awb = event.awb || event.tracking_number;
      const orderId = event.order_id;
      
      logger.info(`Shipway tracking update for ${awb}: ${status}`);
      
      // Handle different status types
      switch (status.toLowerCase()) {
        case 'delivered':
          logger.info(`Shipway order ${orderId} delivered successfully`);
          break;
        case 'out_for_delivery':
          logger.info(`Shipway order ${orderId} is out for delivery`);
          break;
        case 'ndr': {
          // NDR (Non-Delivery Report) handling
          const ndrReason = event.ndr_reason || 'Unknown reason';
          logger.warn(`Shipway NDR for order ${orderId}: ${ndrReason}`);
          // Here you can implement logic to handle NDR
          // For example, notify customer, attempt redelivery, etc.
          this.handleNDR(awb, ndrReason, event.ndr_comments);
          break;
        }
        case 'rto_initiated':
          logger.warn(`Shipway RTO initiated for order ${orderId}`);
          break;
        case 'cancelled':
          logger.info(`Shipway order ${orderId} cancelled`);
          break;
        default:
          logger.info(`Shipway order ${orderId} status updated: ${status}`);
      }
    } catch (error) {
      logger.error('Error processing Shipway webhook:', error);
    }
  }

  /**
   * Handle NDR (Non-Delivery Report)
   */
  private async handleNDR(awb: string, reason: string, comments?: string): Promise<void> {
    try {
      // Implement NDR resolution
      const apiUrl = `${this.getApiBaseUrl()}/ndr/resolve`;
      
      // Example: Request redelivery
      const ndrData = {
        username: this.username,
        license_key: this.licenseKey,
        awb: awb,
        action: 'redelivery', // Options: redelivery, cancel, rto
        comments: comments || `Auto-requesting redelivery after NDR: ${reason}`
      };
      
      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ndrData)
      });

      if (!response.ok) {
        throw new Error(`Failed to handle NDR: ${response.statusText}`);
      }

      const data: any = await response.json();
      
      if (data.success) {
        logger.info(`Successfully requested redelivery for AWB ${awb}`);
      } else {
        logger.warn(`Failed to resolve NDR for AWB ${awb}: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error(`Error handling NDR for AWB ${awb}:`, error);
    }
  }

  /**
   * Shipway does not support international shipping currently
   */
  public supportsInternationalShipping(): boolean {
    return false;
  }

  /**
   * Get international shipping rates
   * Note: Shipway doesn't support international shipping, this returns empty array
   */
  public async getInternationalRates(_request: ShippingRequest): Promise<ShippingRate[]> {
    logger.warn('Shipway does not support international shipping');
    return [];
  }
}

/**
 * Implementation of Shipyaari provider
 */

