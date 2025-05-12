import { Request, Response } from 'express';
import fetch from 'node-fetch';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';
import { IUser } from '../models/User.js';
import { Order } from '../models/Order.js';

interface AuthRequest extends Request {
  user?: IUser;
}

// Cache for PayPal access token
let paypalAccessToken = null;
let tokenExpiresAt = null;

/**
 * Get a PayPal access token
 */
const getPayPalAccessToken = async () => {
  // Check if we have a valid cached token
  const now = new Date();
  if (paypalAccessToken && tokenExpiresAt && now < tokenExpiresAt) {
    return paypalAccessToken;
  }

  try {
    // Get client ID and secret from config
    const { paypalClientId, paypalClientSecret, paypalEnvironment } = config.payment;
    
    if (!paypalClientId || !paypalClientSecret) {
      logger.error('PayPal client ID or secret not configured');
      return null;
    }

    // Set the base URL based on environment
    const baseUrl = paypalEnvironment === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    // Request a new access token
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Failed to get PayPal access token:', errorData);
      return null;
    }

    const data = await response.json();
    paypalAccessToken = data.access_token;
    
    // Set token expiration (subtract 60 seconds to be safe)
    tokenExpiresAt = new Date(now.getTime() + (data.expires_in - 60) * 1000);
    
    logger.info('PayPal access token obtained successfully');
    return paypalAccessToken;
  } catch (error) {
    logger.error('Error getting PayPal access token:', error);
    return null;
  }
};

/**
 * Get PayPal client ID and configuration status
 */
export const getPayPalConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paypalClientId, paypalEnvironment } = config.payment;
    
    // Check if PayPal is configured
    if (!paypalClientId) {
      logger.warn('PayPal client ID not configured');
      res.status(200).json({
        clientId: null,
        environment: paypalEnvironment,
        isConfigured: false
      });
      return;
    }

    // Test connection by getting an access token
    const accessToken = await getPayPalAccessToken();
    const isConfigured = !!accessToken;

    res.status(200).json({
      clientId: paypalClientId,
      environment: paypalEnvironment,
      isConfigured,
      isTestMode: paypalEnvironment === 'sandbox'
    });
  } catch (error) {
    logger.error('Error retrieving PayPal configuration:', error);
    res.status(500).json({ error: 'Failed to retrieve PayPal configuration' });
  }
};

/**
 * Create a PayPal order
 */
export const createPayPalOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount, currency = 'INR', orderId } = req.body;

    if (!amount) {
      res.status(400).json({ error: 'Amount is required' });
      return;
    }

    // Validate amount (must be a positive number)
    if (isNaN(amount) || amount <= 0) {
      res.status(400).json({ error: 'Amount must be a positive number' });
      return;
    }

    // Get client ID and environment from config
    const { paypalEnvironment } = config.payment;
    
    // Get access token
    const accessToken = await getPayPalAccessToken();
    if (!accessToken) {
      res.status(500).json({ error: 'Failed to authenticate with PayPal' });
      return;
    }

    // Set the base URL based on environment
    const baseUrl = paypalEnvironment === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    // Create PayPal order
    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: orderId || `order_${Date.now()}`,
          description: 'Purchase from E-commerce Store',
          amount: {
            currency_code: currency,
            value: amount.toString()
          }
        }],
        application_context: {
          brand_name: config.email.fromName,
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${config.server.baseUrl}/api/payments/paypal/capture`,
          cancel_url: `${config.server.baseUrl}/api/payments/paypal/cancel`
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Failed to create PayPal order:', errorData);
      res.status(response.status).json({ error: 'Failed to create PayPal order', details: errorData });
      return;
    }

    const orderData = await response.json();

    // Update our system order with PayPal order ID if orderId is provided
    if (orderId) {
      try {
        await Order.findByIdAndUpdate(orderId, {
          'payment.gatewayReference': orderData.id,
          'payment.gateway': 'paypal',
        });
      } catch (orderError) {
        logger.error(`Error updating order ${orderId} with PayPal order ID:`, orderError);
        // Continue with payment process even if order update fails
      }
    }

    res.status(200).json({
      id: orderData.id,
      status: orderData.status,
      links: orderData.links
    });
  } catch (error) {
    logger.error('Error creating PayPal order:', error);
    res.status(500).json({ error: 'Failed to create PayPal order' });
  }
};

/**
 * Capture a PayPal payment
 */
export const capturePayPalPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderID, system_order_id } = req.body;

    if (!orderID) {
      res.status(400).json({ error: 'PayPal order ID is required' });
      return;
    }

    // Get access token
    const accessToken = await getPayPalAccessToken();
    if (!accessToken) {
      res.status(500).json({ error: 'Failed to authenticate with PayPal' });
      return;
    }

    // Set the base URL based on environment
    const { paypalEnvironment } = config.payment;
    const baseUrl = paypalEnvironment === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    // Capture payment
    const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Failed to capture PayPal payment:', errorData);
      res.status(response.status).json({ error: 'Failed to capture payment', details: errorData });
      return;
    }

    const captureData = await response.json();

    // If payment is captured successfully, update the order
    if (captureData.status === 'COMPLETED') {
      // Get transaction ID and amount from the capture data
      const captureId = captureData.purchase_units[0]?.payments?.captures[0]?.id;
      const captureAmount = captureData.purchase_units[0]?.payments?.captures[0]?.amount?.value;
      
      // If system_order_id is provided, update the order
      if (system_order_id) {
        try {
          await Order.findByIdAndUpdate(system_order_id, {
            'payment.status': 'completed',
            'payment.gatewayReference': orderID,
            'payment.transactionId': captureId,
            'payment.amount': captureAmount,
            'payment.paidAt': new Date(),
            status: 'processing'
          });
          logger.info(`Order ${system_order_id} updated after PayPal payment capture`);
        } catch (orderError) {
          logger.error(`Error updating order ${system_order_id}:`, orderError);
          // Continue with payment verification even if order update fails
        }
      }
    }

    res.status(200).json({
      success: true,
      orderId: orderID,
      systemOrderId: system_order_id || '',
      status: captureData.status,
      captureData
    });
  } catch (error) {
    logger.error('Error capturing PayPal payment:', error);
    res.status(500).json({ error: 'Failed to capture payment' });
  }
};

/**
 * Handle PayPal webhook events
 */
export const handlePayPalWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const event = req.body;
    
    // Verify webhook payload - In production, implement proper webhook signature verification
    logger.info(`Received PayPal webhook: ${event.event_type}`);
    
    // Handle specific events
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        const resource = event.resource;
        
        logger.info(`Payment capture completed: ${resource.id}`);
        
        // Find the order by PayPal reference
        try {
          const order = await Order.findOne({
            'payment.gatewayReference': resource.supplementary_data?.related_ids?.order_id
          });
          
          if (order) {
            order.payment.status = 'completed';
            order.payment.transactionId = resource.id;
            order.payment.paidAt = new Date();
            order.status = 'processing';
            await order.save();
            
            logger.info(`Order ${order._id} updated after PayPal webhook notification`);
          } else {
            logger.warn(`Order not found for PayPal reference: ${resource.supplementary_data?.related_ids?.order_id}`);
          }
        } catch (orderError) {
          logger.error('Error updating order from PayPal webhook:', orderError);
        }
        break;
        
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.REVERSED':
        // Handle payment denials or reversals
        const failedResource = event.resource;
        
        logger.warn(`Payment capture issue: ${event.event_type}, ID: ${failedResource.id}`);
        
        // Find the order by PayPal reference
        try {
          const order = await Order.findOne({
            'payment.gatewayReference': failedResource.supplementary_data?.related_ids?.order_id
          });
          
          if (order) {
            order.payment.status = 'failed';
            order.payment.error = event.event_type;
            await order.save();
            
            logger.info(`Order ${order._id} marked as failed after PayPal webhook notification`);
          }
        } catch (orderError) {
          logger.error('Error updating order from PayPal webhook:', orderError);
        }
        break;
        
      default:
        // For other event types, just log them
        logger.info(`Unhandled PayPal webhook event: ${event.event_type}`);
    }
    
    // Return success response to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error handling PayPal webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
}; 