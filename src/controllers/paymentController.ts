import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';
import { IUser } from '../models/User.js';
import { Order } from '../models/Order.js';

interface AuthRequest extends Request {
  user?: IUser;
}

// Initialize RazorPay conditionally if keys are available
let razorpay: Razorpay | null = null;

try {
  if (config.payment.razorpayKeyId && config.payment.razorpayKeySecret) {
    razorpay = new Razorpay({
      key_id: config.payment.razorpayKeyId,
      key_secret: config.payment.razorpayKeySecret,
    });
    logger.info('RazorPay initialized successfully');
  } else {
    logger.warn('RazorPay keys not provided. RazorPay integration will be unavailable.');
  }
} catch (error) {
  logger.error('Failed to initialize RazorPay:', error);
}

/**
 * Create a new RazorPay order
 */
export const createRazorPayOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if RazorPay is initialized
    if (!razorpay) {
      logger.error('RazorPay not initialized. Please check your configuration.');
      res.status(500).json({ error: 'Payment gateway not properly configured' });
      return;
    }

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

    // Create unique receipt ID
    const receiptId = `receipt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Ensure amount is in paise (smallest currency unit)
    // Amount might come directly in rupees from frontend, so we convert to paise
    const amountInPaise = Math.round(amount * 100);
    
    const options = {
      amount: amountInPaise, // RazorPay expects amount in paise
      currency,
      receipt: receiptId,
    };

    const rzpOrder = await razorpay.orders.create(options);
    
    // If there's an associated order in our system, link the razorpay order ID
    if (orderId && req.user?._id) {
      try {
        await Order.findOneAndUpdate(
          { _id: orderId, user: req.user._id },
          { 
            paymentMethod: 'razorpay',
            paymentOrderId: rzpOrder.id,
            paymentStatus: 'pending',
            paymentAttempts: { $inc: 1 }
          }
        );
        logger.info(`Linked RazorPay order ${rzpOrder.id} to system order ${orderId}`);
      } catch (updateError) {
        logger.error(`Failed to link RazorPay order to system order:`, updateError);
        // Don't return error here, continue with payment process
      }
    }
    
    logger.info('RazorPay order created:', rzpOrder);
    res.status(200).json(rzpOrder);
  } catch (error) {
    logger.error('Error creating RazorPay order:', error);
    res.status(500).json({ error: 'Failed to create order. Please try again later.' });
  }
};

/**
 * Verify RazorPay payment
 */
export const verifyRazorPayPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if RazorPay is initialized
    if (!razorpay || !config.payment.razorpayKeySecret) {
      logger.error('RazorPay not initialized or secret key missing. Please check your configuration.');
      res.status(500).json({ error: 'Payment gateway not properly configured' });
      return;
    }

    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      system_order_id // Optional parameter to link to our system order
    } = req.body;

    // Validate required fields
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      logger.warn('Missing required payment verification fields', {
        hasPaymentId: !!razorpay_payment_id,
        hasOrderId: !!razorpay_order_id,
        hasSignature: !!razorpay_signature
      });
      res.status(400).json({ error: 'All fields are required for payment verification' });
      return;
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', config.payment.razorpayKeySecret)
      .update(body)
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      logger.warn('Invalid RazorPay signature detected:', {
        expected: expectedSignature,
        received: razorpay_signature,
        paymentId: razorpay_payment_id,
      });

      // Update order with failure status if we have system_order_id
      if (system_order_id) {
        try {
          await Order.findByIdAndUpdate(
            system_order_id,
            {
              paymentStatus: 'failed',
              paymentError: 'Invalid payment signature',
              paymentId: razorpay_payment_id,
              paymentOrderId: razorpay_order_id,
              paymentSignature: razorpay_signature
            }
          );
          logger.info(`Updated order ${system_order_id} with failed payment status`);
        } catch (updateError) {
          logger.error(`Failed to update order with payment failure:`, updateError);
        }
      }

      res.status(400).json({ error: 'Invalid payment signature' });
      return;
    }

    // Find order by RazorPay order ID or by system order ID
    let order = null;
    
    if (system_order_id) {
      order = await Order.findById(system_order_id);
    }
    
    if (!order && razorpay_order_id) {
      order = await Order.findOne({ paymentOrderId: razorpay_order_id });
    }

    // Update order status with payment information
    if (order) {
      order.paymentStatus = 'completed';
      order.status = 'processing'; // Update the order status to processing
      order.paymentId = razorpay_payment_id;
      order.paymentOrderId = razorpay_order_id;
      order.paymentSignature = razorpay_signature;
      
      await order.save();
      logger.info(`Order ${order._id} payment completed successfully`, {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id
      });
    } else {
      logger.warn(`No matching order found for payment verification`, {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        systemOrderId: system_order_id || 'not provided'
      });
    }

    // Payment is successful
    logger.info('RazorPay payment verified successfully:', {
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id
    });
    
    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      order: order ? { id: order._id, status: order.status } : null
    });
  } catch (error) {
    logger.error('Error verifying RazorPay payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

/**
 * Retry a failed payment
 */
export const retryPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user._id) {
      res.status(401).json({ error: 'Unauthorized access' });
      return;
    }

    const { orderId } = req.params;
    
    // Find the order
    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    // Check if payment already completed
    if (order.paymentStatus === 'completed') {
      res.status(400).json({ error: 'Payment already completed for this order' });
      return;
    }
    
    // Check maximum retry attempts (3)
    if (order.paymentAttempts && order.paymentAttempts >= 3) {
      res.status(400).json({ 
        error: 'Maximum payment retry attempts reached',
        attemptsRemaining: 0,
        canRetry: false
      });
      return;
    }
    
    // Reset payment details for retry
    order.paymentError = undefined;
    order.paymentStatus = 'pending';
    if (!order.paymentAttempts) order.paymentAttempts = 0;
    order.paymentAttempts += 1;
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Order ready for payment retry',
      order: {
        id: order._id,
        amount: order.total,
        attemptsRemaining: 3 - (order.paymentAttempts || 0),
        canRetry: true
      }
    });
  } catch (error) {
    logger.error('Error retrying payment:', error);
    res.status(500).json({ error: 'Failed to retry payment' });
  }
};

/**
 * Get RazorPay key for frontend
 */
export const getRazorPayKey = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Validate that key exists in config
    if (!config.payment.razorpayKeyId) {
      logger.warn('RazorPay key not configured in environment variables');
      res.status(200).json({ 
        key: null, 
        isConfigured: false,
        isTestMode: false
      });
      return;
    }
    
    // Detect test mode (test keys start with rzp_test_)
    const isTestMode = config.payment.razorpayKeyId.startsWith('rzp_test_');
    
    res.status(200).json({ 
      key: config.payment.razorpayKeyId, 
      isConfigured: true,
      isTestMode
    });
  } catch (error) {
    logger.error('Error fetching RazorPay key:', error);
    res.status(500).json({ error: 'Failed to get RazorPay key' });
  }
};

/**
 * Handle RazorPay webhooks for asynchronous notifications
 */
export const handleRazorPayWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get the webhook secret from config
    const webhookSecret = config.payment.razorpayWebhookSecret;

    if (!webhookSecret) {
      logger.error('RazorPay webhook secret not configured');
      res.status(400).json({ error: 'Webhook secret not configured' });
      return;
    }

    // Get the webhook signature and payload
    const signature = req.headers['x-razorpay-signature'];
    
    if (!signature) {
      logger.error('RazorPay webhook signature missing');
      res.status(400).json({ error: 'Webhook signature missing' });
      return;
    }

    // Verify the webhook signature
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.error('RazorPay webhook signature invalid', {
        received: signature,
        expected: expectedSignature 
      });
      res.status(400).json({ error: 'Webhook signature invalid' });
      return;
    }

    // Process the webhook event
    const event = req.body.event;

    logger.info(`Processing RazorPay webhook event: ${event}`);

    switch (event) {
      case 'payment.authorized': {
        // Payment was authorized
        const paymentId = req.body.payload.payment.entity.id;
        const orderId = req.body.payload.payment.entity.order_id;
        
        // Find the order and update its status
        const order = await Order.findOne({ paymentOrderId: orderId });
        
        if (order) {
          order.paymentStatus = 'completed';
          order.status = 'processing';
          order.paymentId = paymentId;
          
          await order.save();
          logger.info(`Order ${order._id} payment authorized via webhook`);
        } else {
          logger.warn(`No order found for payment ${paymentId} (webhook notification)`);
        }
        break;
      }
      
      case 'payment.failed': {
        // Payment failed
        const paymentId = req.body.payload.payment.entity.id;
        const orderId = req.body.payload.payment.entity.order_id;
        const errorDescription = req.body.payload.payment.entity.error_description || 'Unknown error';
        
        // Find the order and update its status
        const order = await Order.findOne({ paymentOrderId: orderId });
        
        if (order) {
          order.paymentStatus = 'failed';
          order.paymentError = errorDescription;
          order.paymentId = paymentId;
          
          await order.save();
          logger.info(`Order ${order._id} payment failed via webhook: ${errorDescription}`);
        } else {
          logger.warn(`No order found for failed payment ${paymentId} (webhook notification)`);
        }
        break;
      }
      
      case 'refund.created': {
        // Payment was refunded
        const refundId = req.body.payload.refund.entity.id;
        const paymentId = req.body.payload.refund.entity.payment_id;
        
        // Find the order by payment ID
        const order = await Order.findOne({ paymentId });
        
        if (order) {
          order.status = 'cancelled';
          order.paymentStatus = 'refunded';
          
          await order.save();
          logger.info(`Order ${order._id} refunded via webhook (refund ID: ${refundId})`);
        } else {
          logger.warn(`No order found for refunded payment ${paymentId} (webhook notification)`);
        }
        break;
      }
      
      default:
        logger.info(`Unhandled RazorPay webhook event: ${event}`);
    }
    
    // Always return 200 to acknowledge receipt of the webhook
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error processing RazorPay webhook:', error);
    // Still return 200 to avoid RazorPay retrying the webhook
    res.status(200).json({ received: true, error: 'Error processing webhook' });
  }
}; 