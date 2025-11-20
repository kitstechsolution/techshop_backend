import { IShippingAggregator, IPickupLocation } from '../models/ShippingConfig.js';
import { logger } from '../utils/logger.js';

// HTTP helpers with timeout and retries for provider calls
const DEFAULT_TIMEOUT_MS = Number(process.env.SHIPPING_HTTP_TIMEOUT_MS || 10000);
const DEFAULT_MAX_RETRIES = Number(process.env.SHIPPING_HTTP_MAX_RETRIES || 2);
const DEFAULT_BACKOFF_MS = Number(process.env.SHIPPING_HTTP_BACKOFF_MS || 500);

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init: any = {}, opts?: { timeoutMs?: number; retries?: number; backoffMs?: number }): Promise<Response> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts?.retries ?? DEFAULT_MAX_RETRIES;
  const backoffMs = opts?.backoffMs ?? DEFAULT_BACKOFF_MS;

  let attempt = 0;
  while (true) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(id);
      if (res.ok) return res;
      // Retry on 5xx, 429, 408
      if (attempt < maxRetries && (res.status >= 500 || res.status === 429 || res.status === 408)) {
        attempt++;
        const jitter = Math.floor(Math.random() * 100);
        await sleep(backoffMs * Math.pow(2, attempt - 1) + jitter);
        continue;
      }
      return res; // caller will handle not ok
    } catch (err: any) {
      clearTimeout(id);
      const isAbort = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
      if (attempt < maxRetries && (isAbort || err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT')) {
        attempt++;
        const jitter = Math.floor(Math.random() * 100);
        await sleep(backoffMs * Math.pow(2, attempt - 1) + jitter);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Interface for shipping request
 */
export interface ShippingRequest {
  orderId: string;
  pickupPincode: string;
  deliveryPincode: string;
  weight: number; // in grams
  dimensions?: {
    length: number; // in cm
    width: number; // in cm
    height: number; // in cm
  };
  invoiceValue: number;
  isReversePicking?: boolean;
  // Fields for extended functionality
  paymentMethod?: 'cod' | 'prepaid';
  customerName?: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerCountry?: string;
  customerPhone?: string;
  customerEmail?: string;
  pickupLocation?: string;
  pickupAddress?: string;
  pickupCity?: string;
  pickupState?: string;
  pickupPhone?: string;
  pickupEmail?: string;
  returnReason?: string;
  items?: Array<{
    name: string;
    sku: string;
    quantity: number;
    price: number;
    discount?: number;
    tax?: number;
    hsn?: string; // Harmonized System Nomenclature for international shipping
  }>;
  packageDimensions?: {
    length: number;
    width: number;
    height: number;
  };
  // International shipping fields
  isInternational?: boolean;
  destinationCountry?: string;
  customsValue?: number;
  customsDescription?: string;
  customsContentType?: string;
  insuranceRequired?: boolean;
  insuranceValue?: number;
}

/**
 * Interface for shipping rate response
 */
export interface ShippingRate {
  carrier: string;
  serviceName: string;
  cost: number;
  estimatedDeliveryDays: number;
  isAvailable: boolean;
  // Extended fields
  carrierId?: string;
  serviceId?: string;
  insuranceCost?: number;
  hasInsurance?: boolean;
  isInternational?: boolean;
  currency?: string;
}

/**
 * Interface for shipment creation response
 */
export interface ShipmentResponse {
  success: boolean;
  message: string;
  trackingId?: string;
  labelUrl?: string;
  manifestUrl?: string;
  estimatedDeliveryDate?: Date;
  error?: string;
  // Extended fields
  shipmentId?: string;
  invoiceUrl?: string;
  customsDocumentUrl?: string;
  carrierName?: string;
  insuranceDetails?: {
    insuranceProvider: string;
    policyNumber: string;
    coverageAmount: number;
  };
}

/**
 * Interface for pickup location response
 */
export interface PickupLocationResponse {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  isDefault: boolean;
}

/**
 * Interface for shipment tracking response
 */
export interface ShipmentTrackingResponse {
  success: boolean;
  message: string;
  status?: string;
  trackingId?: string;
  currentLocation?: string;
  estimatedDeliveryDate?: Date;
  carrierName?: string;
  error?: string;
  history?: Array<{
    status: string;
    date: Date;
    location: string;
    description: string;
  }>;
  extraData?: {
    pickupDate?: Date;
    originCity: string;
    destinationCity: string;
    carrierUrl: string;
    shipmentWeight: string;
  };
}

/**
 * Interface for shipment cancellation response
 */
export interface ShipmentCancellationResponse {
  success: boolean;
  message: string;
  error?: string;
  trackingId: string;
  cancellationId?: string;
  extraData?: {
    responseCode?: string;
    cancellationDate: string;
    additionalInfo?: string | null;
    refundAmount?: number;
  };
}

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

/**
 * Implementation of Shiprocket provider
 */
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

/**
 * Implementation of Shipway provider
 */
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
