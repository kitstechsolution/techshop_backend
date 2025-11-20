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
export class ShiprocketProvider extends ShippingAggregatorProvider {
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: Record<string, string>) {
    super('Shiprocket', config);
  }

  /**
   * Check if required configuration fields are present
   */
  public isConfigured(): boolean {
    return Boolean(this.config.email && this.config.password && this.config.apiKey);
  }

  /**
   * Authenticate with Shiprocket API and get token
   */
  private async authenticate(): Promise<string> {
    // Check if token is still valid
    if (this.token && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.token;
    }

    try {
      // Authenticate and get new token
      const response = await fetchWithRetry('https://apiv2.shiprocket.in/v1/external/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.config.email,
          password: this.config.password
        })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data: any = await response.json();
      this.token = data.token || null;
      
      // Token is valid for 24 hours
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 24);
      this.tokenExpiry = expiry;
      
      return this.token || '';
    } catch (error) {
      logger.error('Shiprocket authentication error:', error);
      throw new Error('Failed to authenticate with Shiprocket');
    }
  }

  /**
   * Get shipping rates from Shiprocket
   */
  public async getRates(request: ShippingRequest): Promise<ShippingRate[]> {
    // For international shipping, use the international rates endpoint
    if (request.isInternational && request.destinationCountry) {
      return this.getInternationalRates(request);
    }
    
    try {
      const token = await this.authenticate();
      
      // Convert weight from grams to kg for Shiprocket API
      const weightInKg = (request.weight / 1000).toFixed(2);
      
      // Determine COD value based on payment method
      const codValue = request.paymentMethod === 'cod' ? request.invoiceValue : 0;
      
      const queryParams = new URLSearchParams({
        pickup_postcode: request.pickupPincode,
        delivery_postcode: request.deliveryPincode,
        weight: weightInKg,
        cod: codValue.toString(),
        order_id: request.orderId
      });
      
      const response = await fetchWithRetry(`https://apiv2.shiprocket.in/v1/external/courier/serviceability?${queryParams}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get rates: ${response.statusText}`);
      }

      const data: any = await response.json();
      
      // Return empty array if no courier companies are available
      if (!data.data?.available_courier_companies?.length) {
        logger.warn('Shiprocket: No available couriers for request:', { 
          pickupPincode: request.pickupPincode,
          deliveryPincode: request.deliveryPincode,
          weight: weightInKg
        });
        return [];
      }
      
      // Transform response to standard ShippingRate format
      return data.data.available_courier_companies.map((courier: any) => ({
        carrier: courier.courier_name,
        serviceName: courier.courier_code,
        carrierId: courier.courier_company_id.toString(),
        serviceId: courier.courier_code,
        cost: parseFloat(courier.rate),
        estimatedDeliveryDays: parseInt(courier.estimated_delivery_days, 10),
        isAvailable: true,
        hasInsurance: false,
        isInternational: false,
        currency: 'INR'
      }));
    } catch (error) {
      logger.error('Shiprocket get rates error:', error);
      return [];
    }
  }

  /**
   * Create shipment with Shiprocket
   */
  public async createShipment(request: ShippingRequest, service: string): Promise<ShipmentResponse> {
    try {
      const token = await this.authenticate();
      const weightInKg = (request.weight / 1000).toFixed(2);
      
      // Prepare base order details
      const orderDetails = {
        order_id: request.orderId,
        order_date: new Date().toISOString().split('T')[0],
        pickup_location: request.pickupLocation || '',
        billing_customer_name: request.customerName || 'Customer',
        billing_last_name: '',
        billing_address: request.customerAddress || '',
        billing_city: request.customerCity || '',
        billing_pincode: request.deliveryPincode,
        billing_state: request.customerState || '',
        billing_country: request.customerCountry || 'India',
        billing_email: request.customerEmail || '',
        billing_phone: request.customerPhone || '',
        shipping_is_billing: !request.isInternational,
        order_items: request.items?.map(item => ({
          name: item.name,
          sku: item.sku || item.name.substring(0, 10),
          units: item.quantity,
          selling_price: item.price,
          discount: item.discount || 0,
          tax: item.tax || 0,
          hsn: item.hsn || ''
        })) || [],
        payment_method: request.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
        sub_total: request.invoiceValue,
        length: request.packageDimensions?.length || 10,
        breadth: request.packageDimensions?.width || 10,
        height: request.packageDimensions?.height || 10,
        weight: weightInKg
      };
      
      // Add conditional properties
      const conditionalProps: Record<string, any> = {};
      
      // Add insurance if required
      if (request.insuranceRequired && request.insuranceValue) {
        conditionalProps.is_insurance = 1;
        conditionalProps.insurance_value = request.insuranceValue;
      }
      
      // For international shipping, add customs information
      if (request.isInternational && request.destinationCountry && request.destinationCountry !== 'India') {
        Object.assign(conditionalProps, {
          shipping_is_billing: false,
          shipping_customer_name: request.customerName || 'Customer',
          shipping_address: request.customerAddress || '',
          shipping_city: request.customerCity || '',
          shipping_state: request.customerState || '',
          shipping_country: request.destinationCountry,
          shipping_pincode: request.deliveryPincode,
          shipping_email: request.customerEmail || '',
          shipping_phone: request.customerPhone || '',
          customs_value: request.customsValue || request.invoiceValue,
          customs_description: request.customsDescription || 'Merchandise',
          customs_content_type: request.customsContentType || 'Merchandise'
        });
      }
      
      // Merge the conditional properties
      const finalOrderDetails = { ...orderDetails, ...conditionalProps };
      
      // Create the order first
      const createOrderResponse = await fetchWithRetry('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(finalOrderDetails)
      });

      if (!createOrderResponse.ok) {
        const errorData: any = await createOrderResponse.json().catch(() => ({}));
        logger.error('Shiprocket create order failed:', { 
          status: createOrderResponse.status, 
          errorData, 
          orderId: request.orderId 
        });
        return {
          success: false,
          message: 'Failed to create order in Shiprocket',
          error: errorData.message || createOrderResponse.statusText
        };
      }

      const orderData: any = await createOrderResponse.json();
      
      if (!orderData.order_id) {
        return {
          success: false,
          message: 'Order created but no order ID returned',
          error: 'Missing order ID in response'
        };
      }
      
      // Now generate the shipment using the created order
      const shipmentResponse = await fetchWithRetry('https://apiv2.shiprocket.in/v1/external/courier/generate/pickup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          shipment_id: orderData.shipment_id,
          courier_id: ((): any => { const n = Number(service); return isNaN(n) ? service : n; })()
        })
      });

      if (!shipmentResponse.ok) {
        const errorData: any = await shipmentResponse.json().catch(() => ({}));
        logger.error('Shiprocket generate shipment failed:', { 
          status: shipmentResponse.status, 
          errorData, 
          orderId: request.orderId 
        });
        return {
          success: false,
          message: 'Order created but failed to generate shipment',
          error: errorData.message || shipmentResponse.statusText
        };
      }

      const shipmentData: any = await shipmentResponse.json();
      
      return {
        success: true,
        message: 'Shipment created successfully',
        shipmentId: String(shipmentData.shipment_id),
        trackingId: shipmentData.awb || shipmentData.tracking_number || String(shipmentData.shipment_id),
        labelUrl: shipmentData.label_url || '',
        manifestUrl: shipmentData.manifest_url || '',
        estimatedDeliveryDate: shipmentData.estimated_delivery_date ? new Date(shipmentData.estimated_delivery_date) : undefined,
        carrierName: shipmentData.courier_name || ''
      };
    } catch (error) {
      logger.error('Shiprocket create shipment error:', error);
      return {
        success: false,
        message: 'Failed to create shipment due to an error',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Track shipment with Shiprocket
   */
  public async trackShipment(trackingId: string): Promise<ShipmentTrackingResponse> {
    try {
      const token = await this.authenticate();
      
      const response = await fetchWithRetry(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${trackingId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({}));
        logger.error('Shiprocket tracking failed:', { 
          status: response.status, 
          errorData, 
          trackingId 
        });
        return {
          success: false,
          message: 'Failed to track shipment',
          error: errorData.message || response.statusText
        };
      }

      const data: any = await response.json();
      
      // Handle case where tracking data might not be available
      if (!data.tracking_data || !data.tracking_data.shipment_track || !Array.isArray(data.tracking_data.shipment_track)) {
        logger.warn('Shiprocket tracking data missing or malformed:', { trackingId, response: data });
        return {
          success: false,
          message: 'No tracking information available',
          error: 'Tracking data not found'
        };
      }

      // Get the tracking data from response
      const trackingData = data.tracking_data;
      const shipmentTrack = trackingData.shipment_track[0] || {};
      
      // Parse current status
      const currentStatus = shipmentTrack.current_status || 'Unknown';
      
      // Parse ETD if available
      let estimatedDeliveryDate: Date | undefined;
      if (shipmentTrack.etd) {
        try {
          estimatedDeliveryDate = new Date(shipmentTrack.etd);
        } catch (_e) {
          logger.warn('Failed to parse Shiprocket ETD:', shipmentTrack.etd);
        }
      }
      
      // Parse tracking history
      const trackingHistory = Array.isArray(trackingData.tracking_details) 
        ? trackingData.tracking_details.map((detail: any) => ({
            status: detail.status || 'Unknown',
            date: detail.date ? new Date(detail.date) : new Date(),
            location: detail.location || '',
            description: detail.activity || detail.status || ''
          }))
        : [];

      return {
        success: true,
        message: 'Tracking information retrieved successfully',
        status: currentStatus,
        trackingId: trackingId,
        currentLocation: shipmentTrack.current_location || '',
        estimatedDeliveryDate,
        carrierName: shipmentTrack.courier_name || '',
        history: trackingHistory,
        extraData: {
          pickupDate: shipmentTrack.pickup_date ? new Date(shipmentTrack.pickup_date) : undefined,
          originCity: shipmentTrack.origin || '',
          destinationCity: shipmentTrack.destination || '',
          carrierUrl: shipmentTrack.track_url || '',
          shipmentWeight: shipmentTrack.weight || ''
        }
      };
    } catch (error) {
      logger.error('Shiprocket tracking error:', error);
      return {
        success: false,
        message: 'Failed to track shipment due to an error',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Cancel shipment with Shiprocket
   */
  public async cancelShipment(trackingId: string): Promise<ShipmentCancellationResponse> {
    try {
      const token = await this.authenticate();
      
      // First, we need to find the order/shipment ID from the AWB code
      const trackResponse = await fetchWithRetry(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${trackingId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!trackResponse.ok) {
        throw new Error(`Failed to find shipment: ${trackResponse.statusText}`);
      }

      const trackData: any = await trackResponse.json();
      const orderId = trackData.tracking_data?.order_id;
      
      if (!orderId) {
        throw new Error('Could not find order ID for the given tracking number');
      }
      
      // Cancel the order
      const response = await fetch('https://apiv2.shiprocket.in/v1/external/orders/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ids: [orderId]
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel shipment: ${response.statusText}`);
      }

      return {
        success: true,
        message: 'Shipment cancelled successfully',
        trackingId,
        cancellationId: orderId,
        extraData: {
          responseCode: response.statusText,
          cancellationDate: new Date().toISOString(),
          additionalInfo: null
        }
      };
    } catch (error) {
      logger.error('Shiprocket cancel shipment error:', error);
      return {
        success: false,
        message: 'Failed to cancel shipment due to an error',
        error: error instanceof Error ? error.message : String(error),
        trackingId
      };
    }
  }

  /**
   * Get pickup locations for this provider
   * @returns Array of pickup locations
   */
  public async getPickupLocations(): Promise<PickupLocationResponse[]> {
    try {
      const token = await this.authenticate();
      
      const response = await fetchWithRetry('https://apiv2.shiprocket.in/v1/external/settings/company/pickup', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get pickup locations: ${response.statusText}`);
      }

      const data: any = await response.json();
      
      if (!data.data || !Array.isArray(data.data.shipping_address)) {
        return [];
      }
      
      // Transform to standard format
      return data.data.shipping_address.map((location: any) => ({
        id: location.id.toString(),
        name: location.pickup_location || location.address,
        address: location.address,
        city: location.city,
        state: location.state,
        pincode: location.pin_code,
        phone: location.phone,
        email: location.email || '',
        isDefault: location.primary === 1
      }));
    } catch (error) {
      logger.error('Shiprocket get pickup locations error:', error);
      return [];
    }
  }

  /**
   * Create a new pickup location
   * @param location Pickup location details
   * @returns Created pickup location or null if failed
   */
  public async createPickupLocation(location: IPickupLocation): Promise<PickupLocationResponse | null> {
    try {
      const token = await this.authenticate();
      
      const pickupLocation = {
        pickup_location: location.name,
        name: location.name,
        email: location.email,
        phone: location.phone,
        address: location.address,
        address_2: '',
        city: location.city,
        state: location.state,
        country: 'India',
        pin_code: location.pincode
      };
      
      const response = await fetchWithRetry('https://apiv2.shiprocket.in/v1/external/settings/company/addpickup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      
      // Get the ID of the newly created pickup location
      const pickupLocations = await this.getPickupLocations();
      const createdLocation = pickupLocations.find(loc => 
        loc.name === location.name && 
        loc.pincode === location.pincode
      );
      
      if (!createdLocation) {
        throw new Error('Could not find the created pickup location');
      }
      
      return createdLocation;
    } catch (error) {
      logger.error('Shiprocket create pickup location error:', error);
      return null;
    }
  }

  /**
   * Create a return shipment
   * @param originalTrackingId Original shipment tracking ID
   * @param request Shipping request details
   * @returns Shipment response
   */
  public async createReturnShipment(originalTrackingId: string, request: ShippingRequest): Promise<ShipmentResponse> {
    try {
      const token = await this.authenticate();
      
      // First, get the order details from the original shipment
      const trackResponse = await fetchWithRetry(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${originalTrackingId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!trackResponse.ok) {
        throw new Error(`Failed to find original shipment: ${trackResponse.statusText}`);
      }

      const trackData: any = await trackResponse.json();
      const orderId = trackData.tracking_data?.order_id;
      
      if (!orderId) {
        throw new Error('Could not find order ID for the given tracking number');
      }
      
      // Create return order
      const createReturnResponse = await fetchWithRetry('https://apiv2.shiprocket.in/v1/external/orders/create/return', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: orderId,
          order_date: new Date().toISOString().split('T')[0],
          channel_id: '',
          return_reason: request.returnReason || 'Customer initiated return',
          subtotal: request.invoiceValue
        })
      });
      
      if (!createReturnResponse.ok) {
        const errorData: any = await createReturnResponse.json();
        throw new Error(`Failed to create return shipment: ${JSON.stringify(errorData)}`);
      }
      
      const returnData: any = await createReturnResponse.json();
      // const returnOrderId = returnData.order_id; // May be needed for tracking
      const returnShipmentId = returnData.shipment_id;

      // Generate return label
      const generateLabelResponse = await fetchWithRetry('https://apiv2.shiprocket.in/v1/external/courier/generate/label', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          shipment_id: [returnShipmentId]
        })
      });
      
      let labelUrl = '';
      if (generateLabelResponse.ok) {
        const labelData: any = await generateLabelResponse.json();
        labelUrl = labelData.label_url || '';
      }
      
      return {
        success: true,
        message: 'Return shipment created successfully',
        trackingId: returnData.awb || '',
        labelUrl: labelUrl,
        shipmentId: returnShipmentId.toString()
      };
    } catch (error) {
      logger.error('Shiprocket create return shipment error:', error);
      return {
        success: false,
        message: 'Failed to create return shipment',
        error: (error as Error).message
      };
    }
  }

  /**
   * Process webhook notification from Shiprocket
   * @param event Webhook event data
   */
  public processWebhookEvent(event: any): void {
    try {
      if (!event || !event.data) {
        logger.warn('Received invalid webhook event from Shiprocket');
        return;
      }
      
      const eventType = event.event || '';
      const data = event.data;
      
      switch (eventType) {
        case 'order.created':
          logger.info(`Shiprocket order created: ${data.order_id}`);
          break;
        case 'order.dispatched':
          logger.info(`Shiprocket order dispatched: ${data.order_id}, AWB: ${data.awb_code}`);
          break;
        case 'tracking.updated':
          logger.info(`Shiprocket tracking updated for AWB ${data.awb_code}: ${data.status}`);
          break;
        case 'order.delivered':
          logger.info(`Shiprocket order delivered: ${data.order_id}, AWB: ${data.awb_code}`);
          break;
        case 'order.cancelled':
          logger.info(`Shiprocket order cancelled: ${data.order_id}`);
          break;
        default:
          logger.info(`Received unknown Shiprocket webhook event: ${eventType}`);
      }
    } catch (error) {
      logger.error('Error processing Shiprocket webhook:', error);
    }
  }

  /**
   * Check if Shiprocket supports international shipping
   * @returns true if supported
   */
  public supportsInternationalShipping(): boolean {
    return true;
  }

  /**
   * Get international shipping rates
   * @param request Shipping request details
   * @returns Array of shipping rates
   */
  public async getInternationalRates(request: ShippingRequest): Promise<ShippingRate[]> {
    try {
      const token = await this.authenticate();
      
      if (!request.destinationCountry) {
        throw new Error('Destination country is required for international shipping');
      }
      
      // Convert weight from grams to kg for Shiprocket
      const weightInKg = request.weight / 1000;
      
      const queryParams = new URLSearchParams({
        pickup_postcode: request.pickupPincode,
        delivery_country: request.destinationCountry,
        weight: weightInKg.toString(),
        cod: '0', // International shipments don't support COD
        order_id: request.orderId
      });
      
      // Add delivery pincode if available
      if (request.deliveryPincode) {
        queryParams.append('delivery_postcode', request.deliveryPincode);
      }
      
      const queryString = queryParams.toString();
      
      const response = await fetchWithRetry(`https://apiv2.shiprocket.in/v1/external/courier/international/serviceability?${queryString}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get international rates: ${response.statusText}`);
      }

      const data: any = await response.json();
      
      // Check if courier companies are available
      if (!data.data || !data.data.available_courier_companies || !Array.isArray(data.data.available_courier_companies)) {
        logger.warn('Shiprocket no available international couriers for request:', request);
        return [];
      }
      
      // Transform response to standard format
      return data.data.available_courier_companies.map((courier: any) => ({
        carrier: courier.courier_name,
        serviceName: courier.courier_code,
        carrierId: courier.courier_company_id,
        serviceId: courier.courier_code,
        cost: courier.rate,
        estimatedDeliveryDays: courier.estimated_delivery_days || 7,
        isAvailable: true,
        hasInsurance: Boolean(courier.insurance_amount),
        insuranceCost: courier.insurance_amount || 0,
        isInternational: true,
        currency: courier.currency || 'INR'
      }));
    } catch (error) {
      logger.error('Shiprocket get international rates error:', error);
      return [];
    }
  }
}

