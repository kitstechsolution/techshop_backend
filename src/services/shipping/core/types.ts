import { IPickupLocation } from '../../../models/ShippingConfig.js';

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

// Re-export IPickupLocation for convenience
export type { IPickupLocation };
