import { Request, Response } from 'express';
import fetch from 'node-fetch';
import crypto from 'crypto';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';
import { IUser } from '../models/User.js';
import { Order } from '../models/Order.js';

interface AuthRequest extends Request {
  user?: IUser;
}

// Configuration for Cashfree
const API_VERSION = '2023-08-01';

/**
 * Get Cashfree API configuration details
 */
export const getCashfreeConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if Cashfree is configured
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const environment = process.env.CASHFREE_ENVIRONMENT || 'TEST';
    
    if (!appId || !secretKey) {
      logger.warn('Cashfree credentials not configured properly');
      res.status(200).json({
        appId: null,
        isConfigured: false,
        isTestMode: environment === 'TEST'
      });
      return;
    }

    // Return configuration to client
    res.status(200).json({
      appId,
      isConfigured: true,
      isTestMode: environment === 'TEST'
    });
  } catch (error) {
    logger.error('Error retrieving Cashfree configuration:', error);
    res.status(500).json({ error: 'Failed to retrieve Cashfree configuration' });
  }
};

/**
 * Create a Cashfree payment order
 */
export const createCashfreeOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount, currency = 'INR', orderId, customerDetails } = req.body;

    if (!amount) {
      res.status(400).json({ error: 'Amount is required' });
      return;
    }

    // Validate amount (must be a positive number)
    if (isNaN(amount) || amount <= 0) {
      res.status(400).json({ error: 'Amount must be a positive number' });
      return;
    }

    if (!customerDetails?.email || !customerDetails?.phone) {
      res.status(400).json({ error: 'Customer email and phone are required' });
      return;
    }

    // Get Cashfree credentials
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const environment = process.env.CASHFREE_ENVIRONMENT || 'TEST';

    if (!appId || !secretKey) {
      logger.error('Cashfree credentials not configured properly');
      res.status(500).json({ error: 'Payment gateway not properly configured' });
      return;
    }

    // Set the base URL based on environment
    const baseUrl = environment === 'PROD'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

    // Generate a unique order ID for Cashfree
    const cashfreeOrderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Create Cashfree order
    const response = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': API_VERSION,
        'x-client-id': appId,
        'x-client-secret': secretKey
      },
      body: JSON.stringify({
        order_id: cashfreeOrderId,
        order_amount: amount,
        order_currency: currency,
        customer_details: {
          customer_id: customerDetails.id || `customer_${Date.now()}`,
          customer_email: customerDetails.email,
          customer_phone: customerDetails.phone,
          customer_name: customerDetails.name || 'Customer'
        },
        order_meta: {
          return_url: `${config.server.baseUrl}/api/payments/cashfree/return?order_id=${cashfreeOrderId}&system_order_id=${orderId || ''}`,
          notify_url: `${config.server.baseUrl}/api/payments/cashfree/webhook`,
          system_order_id: orderId || ''
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Failed to create Cashfree order:', errorData);
      res.status(response.status).json({ error: 'Failed to create Cashfree order', details: errorData });
      return;
    }

    const orderData = await response.json();

    // Update our system order with Cashfree order ID if orderId is provided
    if (orderId) {
      try {
        await Order.findByIdAndUpdate(orderId, {
          'payment.gatewayReference': cashfreeOrderId,
          'payment.gateway': 'cashfree',
        });
      } catch (orderError) {
        logger.error(`Error updating order ${orderId} with Cashfree order ID:`, orderError);
        // Continue with payment process even if order update fails
      }
    }

    res.status(200).json({
      orderId: cashfreeOrderId,
      orderToken: orderData.order_token,
      paymentSessionId: orderData.payment_session_id,
      paymentUrl: orderData.payment_link
    });
  } catch (error) {
    logger.error('Error creating Cashfree order:', error);
    res.status(500).json({ error: 'Failed to create Cashfree order' });
  }
};

/**
 * Handle Cashfree payment return URL callback
 */
export const handleCashfreeReturn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { order_id, system_order_id } = req.query;
    
    if (!order_id) {
      logger.error('Missing order_id in Cashfree return URL');
      res.redirect(`${config.server.corsOrigin}/checkout/error`);
      return;
    }
    
    // Verify the payment status with Cashfree
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const environment = process.env.CASHFREE_ENVIRONMENT || 'TEST';
    
    if (!appId || !secretKey) {
      logger.error('Cashfree credentials not configured properly');
      res.redirect(`${config.server.corsOrigin}/checkout/error`);
      return;
    }
    
    // Set the base URL based on environment
    const baseUrl = environment === 'PROD'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';
      
    // Get order details from Cashfree
    const response = await fetch(`${baseUrl}/orders/${order_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': API_VERSION,
        'x-client-id': appId,
        'x-client-secret': secretKey
      }
    });
    
    if (!response.ok) {
      logger.error(`Failed to get Cashfree order details for ${order_id}`);
      res.redirect(`${config.server.corsOrigin}/checkout/error`);
      return;
    }
    
    const orderData = await response.json();
    
    // Check order status
    if (orderData.order_status === 'PAID') {
      // If system_order_id is provided, update the order
      if (system_order_id) {
        try {
          await Order.findByIdAndUpdate(system_order_id, {
            'payment.status': 'completed',
            'payment.gatewayReference': order_id,
            'payment.transactionId': orderData.cf_order_id || orderData.order_id,
            'payment.paidAt': new Date(),
            status: 'processing'
          });
          logger.info(`Order ${system_order_id} updated after Cashfree payment`);
        } catch (orderError) {
          logger.error(`Error updating order ${system_order_id}:`, orderError);
        }
      }
      
      // Redirect to success page
      res.redirect(`${config.server.corsOrigin}/checkout/success`);
    } else {
      // If payment failed, update order status
      if (system_order_id) {
        try {
          await Order.findByIdAndUpdate(system_order_id, {
            'payment.status': 'failed',
            'payment.error': `Payment failed with status: ${orderData.order_status}`
          });
        } catch (orderError) {
          logger.error(`Error updating order ${system_order_id}:`, orderError);
        }
      }
      
      // Redirect to error page
      res.redirect(`${config.server.corsOrigin}/checkout/error`);
    }
  } catch (error) {
    logger.error('Error handling Cashfree return:', error);
    res.redirect(`${config.server.corsOrigin}/checkout/error`);
  }
};

/**
 * Verify a Cashfree payment
 */
export const verifyCashfreePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, systemOrderId } = req.body;

    if (!orderId) {
      res.status(400).json({ error: 'Cashfree order ID is required' });
      return;
    }

    // Get Cashfree credentials
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const environment = process.env.CASHFREE_ENVIRONMENT || 'TEST';

    if (!appId || !secretKey) {
      logger.error('Cashfree credentials not configured properly');
      res.status(500).json({ error: 'Payment gateway not properly configured' });
      return;
    }

    // Set the base URL based on environment
    const baseUrl = environment === 'PROD'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

    // Get order details from Cashfree
    const response = await fetch(`${baseUrl}/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': API_VERSION,
        'x-client-id': appId,
        'x-client-secret': secretKey
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Failed to verify Cashfree payment:', errorData);
      res.status(response.status).json({ error: 'Failed to verify payment', details: errorData });
      return;
    }

    const orderData = await response.json();

    // Check if payment is successful
    if (orderData.order_status === 'PAID') {
      // If systemOrderId is provided, update the order
      if (systemOrderId) {
        try {
          await Order.findByIdAndUpdate(systemOrderId, {
            'payment.status': 'completed',
            'payment.gatewayReference': orderId,
            'payment.transactionId': orderData.cf_order_id || orderData.order_id,
            'payment.paidAt': new Date(),
            status: 'processing'
          });
          logger.info(`Order ${systemOrderId} updated after Cashfree payment verification`);
        } catch (orderError) {
          logger.error(`Error updating order ${systemOrderId}:`, orderError);
          // Continue with payment verification even if order update fails
        }
      }

      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        orderId,
        systemOrderId: systemOrderId || '',
        status: orderData.order_status,
        orderData
      });
    } else {
      // If payment failed, update order status
      if (systemOrderId) {
        try {
          await Order.findByIdAndUpdate(systemOrderId, {
            'payment.status': 'failed',
            'payment.error': `Payment failed with status: ${orderData.order_status}`
          });
        } catch (orderError) {
          logger.error(`Error updating order ${systemOrderId}:`, orderError);
        }
      }

      res.status(400).json({
        success: false,
        message: `Payment verification failed. Status: ${orderData.order_status}`,
        orderId,
        systemOrderId: systemOrderId || '',
        status: orderData.order_status
      });
    }
  } catch (error) {
    logger.error('Error verifying Cashfree payment:', error);
    res.status(500).json({ error: 'Failed to verify payment', success: false });
  }
};

/**
 * Handle Cashfree webhook events
 */
export const handleCashfreeWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const event = req.body;
    const signature = req.headers['x-webhook-signature'];
    
    // Get Cashfree credentials
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    
    if (!secretKey) {
      logger.error('Cashfree secret key not configured properly');
      res.status(500).json({ error: 'Payment gateway not properly configured' });
      return;
    }
    
    // Verify webhook signature if provided
    if (signature && typeof signature === 'string') {
      const payload = JSON.stringify(event);
      const computedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(payload)
        .digest('hex');
      
      if (computedSignature !== signature) {
        logger.error('Cashfree webhook signature verification failed');
        res.status(400).json({ error: 'Webhook signature verification failed' });
        return;
      }
    }
    
    logger.info(`Received Cashfree webhook: ${event.event_type}`);
    
    // Handle specific events
    switch (event.event_type) {
      case 'ORDER_PAID':
        // Order was successfully paid
        const orderData = event.data;
        const systemOrderId = orderData.order_meta?.system_order_id;
        
        logger.info(`Cashfree order paid: ${orderData.order_id}`);
        
        // If system_order_id is provided in order_meta, update the order
        if (systemOrderId) {
          try {
            await Order.findByIdAndUpdate(systemOrderId, {
              'payment.status': 'completed',
              'payment.gatewayReference': orderData.order_id,
              'payment.transactionId': orderData.cf_order_id || orderData.order_id,
              'payment.paidAt': new Date(),
              status: 'processing'
            });
            logger.info(`Order ${systemOrderId} updated after Cashfree webhook notification`);
          } catch (orderError) {
            logger.error(`Error updating order ${systemOrderId}:`, orderError);
          }
        } else {
          // Try to find the order by Cashfree order ID
          try {
            const order = await Order.findOne({
              'payment.gatewayReference': orderData.order_id
            });
            
            if (order) {
              order.payment.status = 'completed';
              order.payment.transactionId = orderData.cf_order_id || orderData.order_id;
              order.payment.paidAt = new Date();
              order.status = 'processing';
              await order.save();
              
              logger.info(`Order ${order._id} updated after Cashfree webhook notification`);
            } else {
              logger.warn(`Order not found for Cashfree order ID: ${orderData.order_id}`);
            }
          } catch (orderError) {
            logger.error('Error updating order from Cashfree webhook:', orderError);
          }
        }
        break;
        
      case 'ORDER_FAILED':
      case 'PAYMENT_FAILED':
        // Order or payment failed
        const failedOrderData = event.data;
        const failedSystemOrderId = failedOrderData.order_meta?.system_order_id;
        
        logger.warn(`Cashfree payment failed: ${failedOrderData.order_id}`);
        
        // If system_order_id is provided in order_meta, update the order
        if (failedSystemOrderId) {
          try {
            await Order.findByIdAndUpdate(failedSystemOrderId, {
              'payment.status': 'failed',
              'payment.error': event.event_type
            });
            logger.info(`Order ${failedSystemOrderId} marked as failed after Cashfree webhook notification`);
          } catch (orderError) {
            logger.error(`Error updating order ${failedSystemOrderId}:`, orderError);
          }
        } else {
          // Try to find the order by Cashfree order ID
          try {
            const order = await Order.findOne({
              'payment.gatewayReference': failedOrderData.order_id
            });
            
            if (order) {
              order.payment.status = 'failed';
              order.payment.error = event.event_type;
              await order.save();
              
              logger.info(`Order ${order._id} marked as failed after Cashfree webhook notification`);
            }
          } catch (orderError) {
            logger.error('Error updating order from Cashfree webhook:', orderError);
          }
        }
        break;
        
      default:
        // For other event types, just log them
        logger.info(`Unhandled Cashfree webhook event: ${event.event_type}`);
    }
    
    // Return success response to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error handling Cashfree webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
}; 