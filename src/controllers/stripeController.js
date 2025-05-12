import { Request, Response } from 'express';
import Stripe from 'stripe';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';
import { IUser } from '../models/User.js';
import { Order } from '../models/Order.js';

interface AuthRequest extends Request {
  user?: IUser;
}

// Initialize Stripe conditionally if keys are available
let stripe: Stripe | null = null;

try {
  if (config.payment.stripeSecretKey && config.payment.stripePublishableKey) {
    stripe = new Stripe(config.payment.stripeSecretKey, {
      apiVersion: '2024-04-10', // Pin to a recent stable API version
    });
    logger.info('Stripe initialized successfully');
  } else {
    logger.warn('Stripe keys not provided. Stripe integration will be unavailable.');
  }
} catch (error) {
  logger.error('Failed to initialize Stripe:', error);
}

/**
 * Get Stripe publishable key
 */
export const getStripeKey = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if Stripe is initialized
    if (!stripe || !config.payment.stripePublishableKey) {
      logger.error('Stripe not initialized. Please check your configuration.');
      res.status(200).json({
        key: null,
        isConfigured: false,
        isTestMode: config.payment.stripePublishableKey?.startsWith('pk_test_') || false
      });
      return;
    }

    // Return publishable key to the client
    res.status(200).json({
      key: config.payment.stripePublishableKey,
      isConfigured: true,
      isTestMode: config.payment.stripePublishableKey.startsWith('pk_test_')
    });
  } catch (error) {
    logger.error('Error retrieving Stripe publishable key:', error);
    res.status(500).json({ error: 'Failed to retrieve Stripe publishable key' });
  }
};

/**
 * Create a new Stripe payment intent
 */
export const createPaymentIntent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if Stripe is initialized
    if (!stripe) {
      logger.error('Stripe not initialized. Please check your configuration.');
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

    // Create a unique idempotency key for this transaction
    const idempotencyKey = `order_${orderId || Date.now()}`;

    // For Stripe, amount needs to be in the smallest currency unit
    // For INR, this means paise (1 INR = 100 paise)
    const amountInSmallestUnit = Math.round(amount * 100);

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInSmallestUnit,
      currency: currency.toLowerCase(),
      payment_method_types: ['card'],
      metadata: {
        order_id: orderId || '',
      },
    }, {
      idempotencyKey
    });

    // Update order with payment intent if orderId is provided
    if (orderId) {
      try {
        await Order.findByIdAndUpdate(orderId, {
          'payment.gatewayReference': paymentIntent.id,
          'payment.gateway': 'stripe',
        });
      } catch (orderError) {
        logger.error(`Error updating order ${orderId} with payment intent:`, orderError);
        // Continue with payment process even if order update fails
      }
    }

    // Return client secret to the client
    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });
  } catch (error) {
    logger.error('Error creating Stripe payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
};

/**
 * Handle Stripe webhook events
 */
export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if Stripe is initialized
    if (!stripe || !config.payment.stripeWebhookSecret) {
      logger.error('Stripe not initialized or webhook secret missing. Please check your configuration.');
      res.status(500).json({ error: 'Payment gateway not properly configured' });
      return;
    }

    const signature = req.headers['stripe-signature'];

    if (!signature || typeof signature !== 'string') {
      logger.error('Stripe webhook signature missing');
      res.status(400).json({ error: 'Webhook signature missing' });
      return;
    }

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        config.payment.stripeWebhookSecret
      );
    } catch (err) {
      logger.error('Stripe webhook signature verification failed:', err);
      res.status(400).json({ error: 'Webhook signature verification failed' });
      return;
    }

    // Handle specific events
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        logger.info(`Payment succeeded: ${paymentIntent.id}`);

        // Update order if order ID is in metadata
        if (paymentIntent.metadata?.order_id) {
          try {
            await Order.findByIdAndUpdate(paymentIntent.metadata.order_id, {
              'payment.status': 'completed',
              'payment.gatewayReference': paymentIntent.id,
              'payment.transactionId': paymentIntent.id,
              'payment.paidAt': new Date(),
              status: 'processing',
            });
            logger.info(`Order ${paymentIntent.metadata.order_id} updated after successful payment`);
          } catch (orderError) {
            logger.error(`Error updating order ${paymentIntent.metadata.order_id}:`, orderError);
          }
        }
        break;
      
      case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object;
        logger.error(`Payment failed: ${failedPaymentIntent.id}`);

        // Update order if order ID is in metadata
        if (failedPaymentIntent.metadata?.order_id) {
          try {
            await Order.findByIdAndUpdate(failedPaymentIntent.metadata.order_id, {
              'payment.status': 'failed',
              'payment.gatewayReference': failedPaymentIntent.id,
              'payment.error': failedPaymentIntent.last_payment_error?.message || 'Payment failed',
            });
            logger.info(`Order ${failedPaymentIntent.metadata.order_id} updated after failed payment`);
          } catch (orderError) {
            logger.error(`Error updating order ${failedPaymentIntent.metadata.order_id}:`, orderError);
          }
        }
        break;

      default:
        // For other event types, just log them
        logger.info(`Unhandled Stripe event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error handling Stripe webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
};

/**
 * Verify Stripe payment
 */
export const verifyStripePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if Stripe is initialized
    if (!stripe) {
      logger.error('Stripe not initialized. Please check your configuration.');
      res.status(500).json({ error: 'Payment gateway not properly configured' });
      return;
    }

    const { payment_intent_id, system_order_id } = req.body;

    if (!payment_intent_id) {
      res.status(400).json({ error: 'Payment intent ID is required' });
      return;
    }

    // Retrieve payment intent to verify status
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    // Check payment intent status
    if (paymentIntent.status !== 'succeeded') {
      res.status(400).json({
        success: false,
        message: `Payment verification failed. Status: ${paymentIntent.status}`,
        status: paymentIntent.status
      });
      return;
    }

    // If system_order_id is provided, update the order
    if (system_order_id) {
      try {
        await Order.findByIdAndUpdate(system_order_id, {
          'payment.status': 'completed',
          'payment.gatewayReference': payment_intent_id,
          'payment.transactionId': payment_intent_id,
          'payment.paidAt': new Date(),
          status: 'processing'
        });
        logger.info(`Order ${system_order_id} updated after payment verification`);
      } catch (orderError) {
        logger.error(`Error updating order ${system_order_id}:`, orderError);
        // Continue with payment verification even if order update fails
      }
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      paymentId: payment_intent_id,
      orderId: system_order_id || '',
      order: system_order_id ? {
        id: system_order_id,
        status: 'processing'
      } : undefined
    });
  } catch (error) {
    logger.error('Error verifying Stripe payment:', error);
    res.status(500).json({ error: 'Failed to verify payment', success: false });
  }
}; 