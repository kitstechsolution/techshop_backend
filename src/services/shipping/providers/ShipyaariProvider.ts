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
export class ShipyaariProvider extends ShippingAggregatorProvider {
  private userId: string;
  private apiKey: string;
  private testMode: boolean;

  constructor(config: Record<string, string>) {
    super('Shipyaari', config);
    this.userId = config.userId || '';
    this.apiKey = config.apiKey || '';
    this.testMode = config.testMode === 'true';
  }

  /**
   * Check if required configuration fields are present
   */
  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.userId);
  }

  /**
   * Get shipping rates from Shipyaari
   */
  public async getRates(request: ShippingRequest): Promise<ShippingRate[]> {
    try {
      const apiUrl = this.testMode
        ? 'https://api.shipyaari.com/v1/test/search_availability'
        : 'https://ship.shipyaari.com/logistic/webservice/SearchAvailability_new.php';
      
      // Validate request parameters
      if (!request.pickupPincode || !request.deliveryPincode || !request.weight || !request.invoiceValue) {
        logger.warn('Shipyaari rates request missing required parameters:', { request });
        return [];
      }

      // Prepare request data
      const requestData = {
        api_key: this.apiKey,
        user_id: this.userId,
        pickup_pincode: request.pickupPincode,
        delivery_pincode: request.deliveryPincode,
        weight: (request.weight / 1000).toFixed(2), // Convert to kg with 2 decimal places
        order_type: request.paymentMethod === 'cod' ? 'COD' : 'PPD',
        cod_amount: request.paymentMethod === 'cod' ? request.invoiceValue : 0,
        invoice_value: request.invoiceValue,
        length: (request.packageDimensions?.length || 10).toString(),
        width: (request.packageDimensions?.width || 10).toString(),
        height: (request.packageDimensions?.height || 10).toString(),
        product_type: 'parcel' // Default product type
      };
      
      logger.debug('Shipyaari rate request data:', requestData);

      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        logger.error('Shipyaari rate request failed:', {
          status: response.status,
          error: errorText,
          request: requestData
        });
        return [];
      }

      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        logger.error('Failed to parse Shipyaari rate response:', parseError);
        return [];
      }
      
      // Check if services are available
      if (!data.success || !data.data || !Array.isArray(data.data.available_courier_companies)) {
        logger.warn('Shipyaari no available couriers for request:', {
          pickupPincode: request.pickupPincode,
          deliveryPincode: request.deliveryPincode,
          response: data
        });
        return [];
      }
      
      // Transform to standard format
      return data.data.available_courier_companies.map((service: any) => ({
        carrier: service.courier_name || 'Unknown',
        serviceName: service.courier_id.toString(),
        cost: parseFloat(service.total_amount || service.freight_charge || 0),
        estimatedDeliveryDays: parseInt(service.etd || service.estimated_delivery_time || 3, 10),
        isAvailable: true,
        carrierId: service.courier_id?.toString(),
        serviceId: service.service_id?.toString() || service.courier_id?.toString(),
        currency: 'INR'
      }));
    } catch (error) {
      logger.error('Shipyaari get rates error:', error);
      return [];
    }
  }

  /**
   * Create shipment with Shipyaari
   */
  public async createShipment(request: ShippingRequest, service: string): Promise<ShipmentResponse> {
    try {
      const apiUrl = this.testMode
        ? 'https://api.shipyaari.com/v1/test/create_order'
        : 'https://ship.shipyaari.com/logistic/webservice/CreateOrder.php';
      
      // Validate essential parameters
      if (!request.orderId || !request.customerName || !request.customerAddress || 
          !request.customerCity || !request.customerState || !request.deliveryPincode || 
          !request.customerPhone || !request.pickupAddress || !request.pickupPincode) {
        logger.error('Shipyaari create shipment missing required parameters:', request);
        return {
          success: false,
          message: 'Missing required parameters for shipment creation',
          error: 'MISSING_PARAMETERS'
        };
      }
      
      // Prepare base order data for Shipyaari
      const orderData: Record<string, any> = {
        api_key: this.apiKey,
        user_id: this.userId,
        service_type: service,
        order_number: request.orderId,
        
        // Customer details
        customer_name: request.customerName,
        customer_address: request.customerAddress,
        customer_city: request.customerCity,
        customer_state: request.customerState,
        customer_pincode: request.deliveryPincode,
        customer_phone: request.customerPhone,
        customer_email: request.customerEmail || '',
        
        // Pickup details
        pickup_address: request.pickupAddress,
        pickup_city: request.pickupCity || '',
        pickup_state: request.pickupState || '',
        pickup_pincode: request.pickupPincode,
        pickup_phone: request.pickupPhone || '',
        pickup_email: request.pickupEmail || '',
        pickup_company: request.pickupLocation || '',
        
        // Package details
        payment_mode: request.paymentMethod === 'cod' ? 'COD' : 'PPD',
        cod_amount: request.paymentMethod === 'cod' ? request.invoiceValue : 0,
        invoice_value: request.invoiceValue,
        package_count: 1,
        weight: (request.weight / 1000).toFixed(2), // Convert to kg with 2 decimal places
        length: (request.packageDimensions?.length || 10).toString(),
        width: (request.packageDimensions?.width || 10).toString(),
        height: (request.packageDimensions?.height || 10).toString(),
        
        // Product info
        product_description: request.items?.map(item => item.name).join(', ') || 'Package',
        product_type: 'parcel',
        product_category: "ecommerce"
      };
      
      // Add order items if available
      if (Array.isArray(request.items) && request.items.length > 0) {
        orderData.order_items = request.items.map(item => ({
          name: item.name,
          qty: item.quantity,
          price: item.price,
          sku: item.sku || ''
        }));
      }
      
      // Add insurance if required
      if (request.insuranceRequired && request.insuranceValue) {
        orderData.is_insurance = 'yes';
        orderData.insurance_value = request.insuranceValue;
      }
      
      logger.debug('Shipyaari create order request:', orderData);
      
      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        logger.error('Shipyaari create shipment request failed:', {
          status: response.status,
          error: errorText
        });
        return {
          success: false,
          message: `Failed to create shipment: ${response.statusText}`,
          error: errorText
        };
      }

      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        logger.error('Failed to parse Shipyaari create order response:', parseError);
        return {
          success: false,
          message: 'Failed to parse response from Shipyaari',
          error: 'PARSE_ERROR'
        };
      }
      
      if (!data.success) {
        logger.error('Shipyaari create order failed:', data);
        return {
          success: false,
          message: data.message || 'Failed to create shipment',
          error: data.error || 'SHIPYAARI_ERROR'
        };
      }
      
      // Extract required fields from response
      const awbNumber = data.awb_number || data.awb || data.tracking_number;
      
      if (!awbNumber) {
        logger.error('Shipyaari create order success but missing AWB number:', data);
        return {
          success: true,
          message: 'Shipment created but tracking number not found in response',
          shipmentId: data.shipment_id || data.order_id || request.orderId,
          error: 'MISSING_AWB'
        };
      }
      
      // Get tracking details to include in response
      let trackingInfo;
      try {
        trackingInfo = await this.trackShipment(awbNumber);
      } catch (trackingError) {
        logger.warn('Shipyaari order created but tracking info unavailable:', { 
          awbNumber, 
          error: trackingError 
        });
        trackingInfo = null;
      }
      
      return {
        success: true,
        message: 'Shipment created successfully',
        trackingId: awbNumber,
        shipmentId: data.shipment_id || data.order_id || request.orderId,
        labelUrl: data.label_url || data.label || '',
        manifestUrl: data.manifest_url || '',
        estimatedDeliveryDate: trackingInfo?.estimatedDeliveryDate,
        carrierName: data.courier_name || trackingInfo?.carrierName || ''
      };
    } catch (error) {
      logger.error('Shipyaari create shipment error:', error);
      return {
        success: false,
        message: 'Failed to create shipment due to an error',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Track shipment with Shipyaari
   */
  public async trackShipment(trackingId: string): Promise<ShipmentTrackingResponse> {
    try {
      const apiUrl = this.testMode
        ? 'https://api.shipyaari.com/v1/test/track_order'
        : 'https://ship.shipyaari.com/logistic/webservice/TrackOrder.php';
      
      if (!trackingId) {
        throw new Error('Tracking ID is required');
      }
      
      const requestData = {
        api_key: this.apiKey,
        user_id: this.userId,
        awb_number: trackingId,
        awb: trackingId // For newer API endpoints
      };
      
      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        logger.error('Shipyaari tracking request failed:', {
          status: response.status,
          trackingId,
          error: errorText
        });
        return {
          success: false,
          message: `Failed to track shipment: ${response.statusText}`,
          error: errorText,
          trackingId,
          status: 'Error',
          currentLocation: '',
          carrierName: '',
          history: [],
          extraData: {
            originCity: '',
            destinationCity: '',
            carrierUrl: '',
            shipmentWeight: ''
          }
        };
      }

      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        logger.error('Failed to parse Shipyaari tracking response:', {
          trackingId,
          parseError
        });
        return {
          success: false,
          message: 'Failed to parse tracking response',
          error: 'PARSE_ERROR',
          trackingId,
          status: 'Error',
          currentLocation: '',
          carrierName: '',
          history: [],
          extraData: {
            originCity: '',
            destinationCity: '',
            carrierUrl: '',
            shipmentWeight: ''
          }
        };
      }
      
      if (!data.success) {
        logger.warn('Shipyaari tracking returned error:', {
          trackingId,
          response: data
        });
        return {
          success: false,
          message: data.message || 'No tracking information available',
          error: data.error || 'TRACKING_NOT_FOUND',
          trackingId,
          status: 'Unknown',
          currentLocation: '',
          carrierName: '',
          history: [],
          extraData: {
            originCity: '',
            destinationCity: '',
            carrierUrl: '',
            shipmentWeight: ''
          }
        };
      }
      
      // Parse tracking data
      const currentStatus = data.current_status?.status || data.status || 'Unknown';
      const courierName = data.courier_name || 'Unknown';
      
      // Parse tracking history
      const trackingHistory = Array.isArray(data.scan_details) 
        ? data.scan_details.map((detail: any) => ({
            status: detail.status || detail.scan_status || 'Unknown',
            date: detail.date ? new Date(detail.date) : new Date(),
            location: detail.location || '',
            description: detail.description || detail.scan_description || detail.status || ''
          }))
        : [];
      
      // Parse estimated delivery date if available
      let estimatedDeliveryDate: Date | undefined;
      if (data.estimated_delivery_date) {
        try {
          estimatedDeliveryDate = new Date(data.estimated_delivery_date);
        } catch (_e) {
          logger.warn('Failed to parse Shipyaari ETD:', data.estimated_delivery_date);
        }
      }
      
      return {
        success: true,
        message: 'Tracking information retrieved successfully',
        trackingId,
        status: currentStatus,
        currentLocation: trackingHistory.length > 0 ? trackingHistory[0].location : '',
        estimatedDeliveryDate,
        carrierName: courierName,
        history: trackingHistory,
        extraData: {
          originCity: data.origin_city || '',
          destinationCity: data.destination_city || '',
          carrierUrl: data.tracking_url || '',
          shipmentWeight: data.weight || ''
        }
      };
    } catch (error) {
      logger.error('Shipyaari track shipment error:', { error, trackingId });
      return {
        success: false,
        message: 'Failed to track shipment due to an error',
        error: error instanceof Error ? error.message : String(error),
        trackingId,
        status: 'Error',
        currentLocation: '',
        carrierName: '',
        history: [],
        extraData: {
          originCity: '',
          destinationCity: '',
          carrierUrl: '',
          shipmentWeight: ''
        }
      };
    }
  }

  /**
   * Cancel a shipment with Shipyaari
   */
  public async cancelShipment(trackingId: string): Promise<ShipmentCancellationResponse> {
    try {
      // Shipyaari API endpoint for cancellation
      const apiUrl = this.testMode
        ? 'https://api.shipyaari.com/v1/test/cancel_shipment'
        : 'https://api.shipyaari.com/v1/cancel_shipment';

      // First, verify the tracking ID exists in their system
      const verifyTrackingUrl = this.testMode
        ? 'https://api.shipyaari.com/v1/test/track_order'
        : 'https://api.shipyaari.com/v1/track_order';
      
      // Verify tracking ID exists
      const verifyPayload = {
        user_id: this.userId,
        api_key: this.apiKey,
        awb: trackingId
      };

      // Verify the tracking number first
      const verifyResponse = await fetchWithRetry(verifyTrackingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(verifyPayload)
      });

      // Check if verification was successful
      if (!verifyResponse.ok) {
        logger.error('Shipyaari tracking verification failed:', {
          status: verifyResponse.status,
          trackingId
        });
        return {
          success: false,
          message: 'Failed to verify tracking ID before cancellation',
          error: `HTTP Error: ${verifyResponse.status} ${verifyResponse.statusText}`,
          trackingId
        };
      }

      // Parse verification response
      let verifyData: any;
      try {
        verifyData = await verifyResponse.json();
      } catch (parseError) {
        logger.error('Failed to parse Shipyaari tracking verification response:', {
          trackingId,
          parseError
        });
        return {
          success: false,
          message: 'Failed to parse tracking verification response',
          error: 'Invalid response format',
          trackingId
        };
      }

      // Check if the tracking number exists and is valid
      if (!verifyData.success || !verifyData.data) {
        return {
          success: false,
          message: 'Tracking ID not found or invalid',
          error: verifyData.message || 'Tracking verification failed',
          trackingId
        };
      }

      // Now proceed with cancellation
      const cancelPayload = {
        user_id: this.userId,
        api_key: this.apiKey,
        awb: trackingId,
        reason: 'Cancelled by merchant' // Default reason
      };

      // Make the API request to cancel the shipment
      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cancelPayload)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        logger.error('Shipyaari cancellation request failed:', { 
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
        logger.error('Failed to parse Shipyaari cancellation response:', {
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
      if (responseData.success || responseData.status === 'success') {
        logger.info('Shipyaari shipment cancelled successfully:', { 
          trackingId, 
          responseData 
        });
        return {
          success: true,
          message: responseData.message || 'Shipment cancelled successfully',
          trackingId,
          cancellationId: responseData.cancellation_id || trackingId,
          extraData: {
            responseCode: responseData.code || 200,
            cancellationDate: new Date().toISOString(),
            refundAmount: responseData.refund_amount || 0,
            additionalInfo: responseData.additional_info || null
          }
        };
      }

      // If we reach here, the request was processed but cancellation failed
      logger.warn('Shipyaari cancellation request processed but failed:', { 
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
      logger.error('Shipyaari cancellation error:', { error, trackingId });
      return {
        success: false,
        message: 'Failed to cancel shipment due to an error',
        error: error instanceof Error ? error.message : String(error),
        trackingId
      };
    }
  }
  
  /**
   * Check if Shipyaari supports international shipping
   */
  public supportsInternationalShipping(): boolean {
    return this.config.enableInternational === 'true';
  }
}

/**
 * Main shipping service to manage all providers
 */

