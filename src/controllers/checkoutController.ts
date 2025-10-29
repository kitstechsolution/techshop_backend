import { Request, Response } from 'express';
import { CheckoutSession } from '../models/CheckoutSession.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Cart } from '../models/Cart.js';
import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';
import { logger } from '../utils/logger.js';

// Extend Request to include user
interface AuthRequest extends Request {
  user?: any;
}

/**
 * Get or create checkout session
 * GET /api/checkout/session
 */
export const getCheckoutSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;

    // Find active session
    let session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    // If no active session and cart data provided, create new one
    if (!session && req.query.createNew === 'true') {
      session = new CheckoutSession({
        userId,
        sessionId: uuidv4(),
        items: [],
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      });
      await session.save();
    }

    if (!session) {
      res.status(404).json({ error: 'No active checkout session found' });
      return;
    }

    res.json(session);
  } catch (error) {
    logger.error('Error getting checkout session:', error);
    res.status(500).json({ error: 'Failed to get checkout session' });
  }
};

/**
 * Create new checkout session from cart
 * POST /api/checkout/session
 */
export const createCheckoutSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const { items, cartId } = req.body;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Items are required' });
      return;
    }

    // Verify products exist and prices match
    const productIds = items.map((item: any) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    
    if (products.length !== items.length) {
      res.status(400).json({ error: 'Some products not found' });
      return;
    }

    // Validate prices
    const validatedItems = items.map((item: any) => {
      const product = products.find(p => String(p._id) === item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }
      return {
        productId: item.productId,
        name: product.name,
        quantity: item.quantity,
        price: product.price,
        image: product.imageUrl || product.images?.[0] || ''
      };
    });

    // Cancel any existing active sessions
    await CheckoutSession.updateMany(
      { userId, status: 'active' },
      { status: 'cancelled' }
    );

    // Create new session
    const session = new CheckoutSession({
      userId,
      sessionId: uuidv4(),
      cartId,
      items: validatedItems,
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    });

    await session.save();

    res.status(201).json(session);
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};

/**
 * Update shipping address
 * PUT /api/checkout/shipping-address
 */
export const updateShippingAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const { addressId } = req.body;

    const session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    if (!session) {
      res.status(404).json({ error: 'No active checkout session' });
      return;
    }

    // Get address from user's saved addresses
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const address = user.addresses?.find((addr: any) => addr._id?.toString() === addressId);
    if (!address) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    // Update session with address
    session.shippingAddress = {
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country || 'India'
    };

    if (session.useSameAddress) {
      session.billingAddress = session.shippingAddress;
    }

    // Extend expiration
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await session.save();

    res.json(session);
  } catch (error) {
    logger.error('Error updating shipping address:', error);
    res.status(500).json({ error: 'Failed to update shipping address' });
  }
};

/**
 * Add new shipping address during checkout
 * POST /api/checkout/shipping-address
 */
export const addShippingAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const addressData = req.body;

    const session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    if (!session) {
      res.status(404).json({ error: 'No active checkout session' });
      return;
    }

    // Validate address data
    const requiredFields = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'zipCode', 'country'];
    for (const field of requiredFields) {
      if (!addressData[field]) {
        res.status(400).json({ error: `${field} is required` });
        return;
      }
    }

    // Update session with new address
    session.shippingAddress = addressData;
    if (session.useSameAddress) {
      session.billingAddress = addressData;
    }

    // Extend expiration
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await session.save();

    // Optionally save to user's addresses
    const user = await User.findById(userId);
    if (user && addressData.saveForFuture) {
      if (!user.addresses) {
        user.addresses = [];
      }
      user.addresses.push(addressData);
      await user.save();
    }

    res.json(session);
  } catch (error) {
    logger.error('Error adding shipping address:', error);
    res.status(500).json({ error: 'Failed to add shipping address' });
  }
};

/**
 * Update billing address
 * PUT /api/checkout/billing-address
 */
export const updateBillingAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const { addressId } = req.body;

    const session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    if (!session) {
      res.status(404).json({ error: 'No active checkout session' });
      return;
    }

    // Get address from user's saved addresses
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const address = user.addresses?.find((addr: any) => addr._id?.toString() === addressId);
    if (!address) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    // Update billing address
    session.billingAddress = {
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country || 'India'
    };

    session.useSameAddress = false;
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await session.save();

    res.json(session);
  } catch (error) {
    logger.error('Error updating billing address:', error);
    res.status(500).json({ error: 'Failed to update billing address' });
  }
};

/**
 * Use shipping address as billing address
 * PUT /api/checkout/use-same-address
 */
export const useSameAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;

    const session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    if (!session) {
      res.status(404).json({ error: 'No active checkout session' });
      return;
    }

    if (!session.shippingAddress) {
      res.status(400).json({ error: 'Shipping address must be set first' });
      return;
    }

    session.billingAddress = session.shippingAddress;
    session.useSameAddress = true;
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await session.save();

    res.json(session);
  } catch (error) {
    logger.error('Error using same address:', error);
    res.status(500).json({ error: 'Failed to use same address' });
  }
};

/**
 * Get available shipping methods
 * GET /api/checkout/shipping-methods
 */
export const getShippingMethods = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;

    const session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    if (!session) {
      res.status(404).json({ error: 'No active checkout session' });
      return;
    }

    if (!session.shippingAddress) {
      res.status(400).json({ error: 'Shipping address required to get shipping methods' });
      return;
    }

    // Mock shipping methods (in production, integrate with shipping API)
    const shippingMethods = [
      {
        id: 'standard',
        name: 'Standard Shipping',
        description: 'Delivery in 5-7 business days',
        cost: 50,
        estimatedDays: 7,
        carrier: 'India Post'
      },
      {
        id: 'express',
        name: 'Express Shipping',
        description: 'Delivery in 2-3 business days',
        cost: 150,
        estimatedDays: 3,
        carrier: 'Blue Dart'
      },
      {
        id: 'overnight',
        name: 'Overnight Delivery',
        description: 'Next day delivery',
        cost: 300,
        estimatedDays: 1,
        carrier: 'DHL'
      }
    ];

    // Free shipping for orders above threshold
    const freeShippingThreshold = 1000;
    if (session.subtotal >= freeShippingThreshold) {
      shippingMethods[0].cost = 0;
      shippingMethods[0].description = 'Free standard shipping (5-7 business days)';
    }

    res.json(shippingMethods);
  } catch (error) {
    logger.error('Error getting shipping methods:', error);
    res.status(500).json({ error: 'Failed to get shipping methods' });
  }
};

/**
 * Select shipping method
 * PUT /api/checkout/shipping-method
 */
export const selectShippingMethod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const { methodId } = req.body;

    const session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    if (!session) {
      res.status(404).json({ error: 'No active checkout session' });
      return;
    }

    // Get available methods
    const methods = [
      {
        id: 'standard',
        name: 'Standard Shipping',
        description: 'Delivery in 5-7 business days',
        cost: session.subtotal >= 1000 ? 0 : 50,
        estimatedDays: 7,
        carrier: 'India Post'
      },
      {
        id: 'express',
        name: 'Express Shipping',
        description: 'Delivery in 2-3 business days',
        cost: 150,
        estimatedDays: 3,
        carrier: 'Blue Dart'
      },
      {
        id: 'overnight',
        name: 'Overnight Delivery',
        description: 'Next day delivery',
        cost: 300,
        estimatedDays: 1,
        carrier: 'DHL'
      }
    ];

    const selectedMethod = methods.find(m => m.id === methodId);
    if (!selectedMethod) {
      res.status(404).json({ error: 'Shipping method not found' });
      return;
    }

    session.shippingMethod = selectedMethod;
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await session.save();

    res.json(session);
  } catch (error) {
    logger.error('Error selecting shipping method:', error);
    res.status(500).json({ error: 'Failed to select shipping method' });
  }
};

/**
 * Get saved payment methods
 * GET /api/checkout/payment-methods
 */
export const getPaymentMethods = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Mock payment methods (in production, get from payment gateway)
    const paymentMethods = [
      {
        id: 'cod',
        type: 'cod',
        provider: 'Cash on Delivery',
        description: 'Pay with cash when your order is delivered'
      },
      {
        id: 'card',
        type: 'credit_card',
        provider: 'Credit/Debit Card',
        description: 'Pay securely with your credit or debit card'
      },
      {
        id: 'upi',
        type: 'upi',
        provider: 'UPI',
        description: 'Pay using UPI (Google Pay, PhonePe, Paytm)'
      },
      {
        id: 'netbanking',
        type: 'net_banking',
        provider: 'Net Banking',
        description: 'Pay using your bank account'
      },
      {
        id: 'wallet',
        type: 'wallet',
        provider: 'Wallets',
        description: 'Pay using Paytm, PhonePe, or other wallets'
      }
    ];

    res.json(paymentMethods);
  } catch (error) {
    logger.error('Error getting payment methods:', error);
    res.status(500).json({ error: 'Failed to get payment methods' });
  }
};

/**
 * Add new payment method
 * POST /api/checkout/payment-methods
 */
export const addPaymentMethod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, provider, cardNumber, expiryMonth, expiryYear } = req.body;

    // In production, validate with payment gateway
    // For now, just create a mock payment method
    const paymentMethod = {
      id: uuidv4(),
      type,
      provider,
      last4: cardNumber ? cardNumber.slice(-4) : undefined,
      expiryMonth,
      expiryYear
    };

    res.status(201).json(paymentMethod);
  } catch (error) {
    logger.error('Error adding payment method:', error);
    res.status(500).json({ error: 'Failed to add payment method' });
  }
};

/**
 * Select payment method
 * PUT /api/checkout/payment-method
 */
export const selectPaymentMethod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const { methodId } = req.body;

    const session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    if (!session) {
      res.status(404).json({ error: 'No active checkout session' });
      return;
    }

    // Map method ID to payment method
    const methodMap: { [key: string]: any } = {
      'cod': { id: 'cod', type: 'cod', provider: 'Cash on Delivery' },
      'card': { id: 'card', type: 'credit_card', provider: 'Credit/Debit Card' },
      'upi': { id: 'upi', type: 'upi', provider: 'UPI' },
      'netbanking': { id: 'netbanking', type: 'net_banking', provider: 'Net Banking' },
      'wallet': { id: 'wallet', type: 'wallet', provider: 'Wallets' }
    };

    const selectedMethod = methodMap[methodId];
    if (!selectedMethod) {
      res.status(404).json({ error: 'Payment method not found' });
      return;
    }

    session.paymentMethod = selectedMethod;
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await session.save();

    res.json(session);
  } catch (error) {
    logger.error('Error selecting payment method:', error);
    res.status(500).json({ error: 'Failed to select payment method' });
  }
};

/**
 * Create payment intent
 * POST /api/checkout/payment-intent
 */
export const createPaymentIntent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const { orderId } = req.body;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Mock payment intent (integrate with Razorpay/Stripe in production)
    const paymentIntent = {
      id: uuidv4(),
      amount: order.total,
      currency: 'INR',
      status: 'pending',
      // For Razorpay
      razorpayOrderId: `order_${uuidv4()}`,
      // For Stripe
      clientSecret: `pi_${uuidv4()}_secret_${uuidv4()}`
    };

    res.json(paymentIntent);
  } catch (error) {
    logger.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
};

/**
 * Verify payment
 * POST /api/checkout/verify-payment
 */
export const verifyPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.body;
    const userId = req.user._id;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // In production, verify payment with gateway
    // For now, mock verification
    order.paymentStatus = 'completed';
    order.status = 'processing';
    await order.save();

    res.json({
      success: true,
      order
    });
  } catch (error) {
    logger.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

/**
 * Get order summary
 * GET /api/checkout/order-summary
 */
export const getOrderSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;

    const session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    if (!session) {
      res.status(404).json({ error: 'No active checkout session' });
      return;
    }

    // Calculate estimated delivery
    const estimatedDays = session.shippingMethod?.estimatedDays || 7;
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + estimatedDays);

    res.json({
      items: session.items,
      subtotal: session.subtotal,
      tax: session.tax,
      shipping: session.shipping,
      discount: session.discount,
      total: session.total,
      estimatedDelivery: estimatedDelivery.toISOString()
    });
  } catch (error) {
    logger.error('Error getting order summary:', error);
    res.status(500).json({ error: 'Failed to get order summary' });
  }
};

/**
 * Apply gift card
 * POST /api/checkout/gift-card
 */
export const applyGiftCard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const { code } = req.body;

    const session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    if (!session) {
      res.status(404).json({ error: 'No active checkout session' });
      return;
    }

    // Verify gift card (mock for now)
    // In production, verify with gift card system
    const giftCardValue = 100; // Mock value

    session.giftCardCode = code;
    session.giftCardDiscount = giftCardValue;
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await session.save();

    res.json(session);
  } catch (error) {
    logger.error('Error applying gift card:', error);
    res.status(500).json({ error: 'Failed to apply gift card' });
  }
};

/**
 * Remove gift card
 * DELETE /api/checkout/gift-card
 */
export const removeGiftCard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;

    const session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    if (!session) {
      res.status(404).json({ error: 'No active checkout session' });
      return;
    }

    session.giftCardCode = undefined;
    session.giftCardDiscount = 0;
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await session.save();

    res.json(session);
  } catch (error) {
    logger.error('Error removing gift card:', error);
    res.status(500).json({ error: 'Failed to remove gift card' });
  }
};

/**
 * Use wallet balance
 * POST /api/checkout/wallet-balance
 */
export const useWalletBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const { amount } = req.body;

    const session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    if (!session) {
      res.status(404).json({ error: 'No active checkout session' });
      return;
    }

    // Verify user has sufficient wallet balance
    const user = await User.findById(userId);
    if (!user || (user as any).walletBalance < amount) {
      res.status(400).json({ error: 'Insufficient wallet balance' });
      return;
    }

    session.walletBalance = amount;
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await session.save();

    res.json(session);
  } catch (error) {
    logger.error('Error using wallet balance:', error);
    res.status(500).json({ error: 'Failed to use wallet balance' });
  }
};

/**
 * Add order notes
 * PUT /api/checkout/notes
 */
export const addOrderNotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const { notes } = req.body;

    const session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    if (!session) {
      res.status(404).json({ error: 'No active checkout session' });
      return;
    }

    session.notes = notes;
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await session.save();

    res.json(session);
  } catch (error) {
    logger.error('Error adding order notes:', error);
    res.status(500).json({ error: 'Failed to add order notes' });
  }
};

/**
 * Validate checkout
 * POST /api/checkout/validate
 */
export const validateCheckout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;

    const session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    if (!session) {
      res.status(200).json({ valid: false, errors: [{ field: 'session', message: 'No active checkout session' }] });
      return;
    }

    const validation = session.validateForOrder();

    res.json({
      valid: validation.valid,
      errors: validation.errors.map((error: string) => ({ field: 'general', message: error }))
    });
  } catch (error) {
    logger.error('Error validating checkout:', error);
    res.status(500).json({ error: 'Failed to validate checkout' });
  }
};

/**
 * Create order
 * POST /api/checkout/orders
 */
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;

    const session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    if (!session) {
      res.status(404).json({ error: 'No active checkout session' });
      return;
    }

    // Apply any incoming selection IDs to session (helps if UI skipped earlier steps)
    const { shippingAddressId, billingAddressId, shippingMethodId, paymentMethodId } = req.body || {};

    try {
      if (shippingAddressId && !session.shippingAddress) {
        const user = await User.findById(userId);
        const address = user?.addresses?.find((addr: any) => addr._id?.toString() === shippingAddressId);
        if (address) {
          session.shippingAddress = {
            fullName: address.fullName,
            phone: address.phone,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode,
            country: address.country || 'India'
          };
        }
      }

      if (billingAddressId && !session.billingAddress) {
        const user = await User.findById(userId);
        const address = user?.addresses?.find((addr: any) => addr._id?.toString() === billingAddressId);
        if (address) {
          session.billingAddress = {
            fullName: address.fullName,
            phone: address.phone,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode,
            country: address.country || 'India'
          };
        }
      }

      // If shipping method id provided, set a sensible default method object (mirrors selectShippingMethod)
      if (shippingMethodId && !session.shippingMethod) {
        const methodDefaults: any = {
          standard: { id: 'standard', name: 'Standard Shipping', description: 'Delivery in 5-7 business days', cost: session.subtotal >= 1000 ? 0 : 50, estimatedDays: 7, carrier: 'India Post' },
          express: { id: 'express', name: 'Express Shipping', description: 'Delivery in 2-3 business days', cost: 150, estimatedDays: 3, carrier: 'Blue Dart' },
          overnight: { id: 'overnight', name: 'Overnight Delivery', description: 'Next day delivery', cost: 300, estimatedDays: 1, carrier: 'DHL' }
        };
        session.shippingMethod = methodDefaults[shippingMethodId] || { id: shippingMethodId, name: shippingMethodId, cost: 0, estimatedDays: 7, carrier: 'Unknown' };
      }

      // If payment method id provided, set session.paymentMethod accordingly
      if (paymentMethodId && !session.paymentMethod) {
        const methodMap: { [key: string]: any } = {
          'cod': { id: 'cod', type: 'cod', provider: 'Cash on Delivery' },
          'card': { id: 'card', type: 'credit_card', provider: 'Credit/Debit Card' },
          'upi': { id: 'upi', type: 'upi', provider: 'UPI' },
          'netbanking': { id: 'netbanking', type: 'net_banking', provider: 'Net Banking' },
          'wallet': { id: 'wallet', type: 'wallet', provider: 'Wallets' }
        };
        session.paymentMethod = methodMap[paymentMethodId] || { id: paymentMethodId, type: 'wallet', provider: paymentMethodId };
      }

      // Persist any updates to session
      await session.save();
    } catch (applyErr) {
      const errMsg = applyErr && (applyErr as any).message ? (applyErr as any).message : String(applyErr);
      logger.warn('createOrder: failed to apply incoming selections to session', { err: errMsg });
    }

      // If session has no items, try to populate it from the user's cart (helps when UI updated cart but didn't create session)
      try {
        if ((!session.items || session.items.length === 0)) {
          const cart = await Cart.findOne({ user: userId }).populate('items.product');
          if (cart && cart.items && cart.items.length > 0) {
            session.items = cart.items.map((it: any) => ({
              productId: String(it.product?._id ?? it.product),
              name: it.name,
              quantity: it.quantity,
              price: it.price,
              image: it.image || (it.product && (it.product.imageUrl || (it.product.images && it.product.images[0]))) || '/images/no-image.png',
            }));
            await session.save();
            logger.info('createOrder: populated session items from cart', { userId, itemCount: session.items.length });
          }
        }
      } catch (populateErr) {
        logger.warn('createOrder: failed to populate session from cart', { err: (populateErr as any)?.message ?? String(populateErr) });
      }

      // Validate session
    const validation = session.validateForOrder();
    if (!validation.valid) {
      logger.warn('createOrder: checkout validation failed', { userId, errors: validation.errors, sessionSnapshot: { items: session.items.length, shippingAddress: !!session.shippingAddress, shippingMethod: !!session.shippingMethod, paymentMethod: !!session.paymentMethod } });
      res.status(400).json({ error: 'Checkout validation failed', errors: validation.errors });
      return;
    }

    // Create order - map session into Order schema shape
    const orderNumber = `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Map items: session.items may have different shapes. Order expects product ObjectId.
    const mappedItems = (session.items || [])
      .map((it: any) => {
        // support shapes: { productId }, { product: {_id} }, or { product }
        const rawProductId = it?.productId ?? it?.product?._id ?? it?.product ?? undefined;
        if (!rawProductId) return null;
        try {
          return {
            product: new Types.ObjectId(String(rawProductId)),
            name: it.name || it.title || '',
            price: typeof it.price === 'number' ? it.price : Number(it.price) || 0,
            quantity: typeof it.quantity === 'number' ? it.quantity : Number(it.quantity) || 1,
          };
        } catch (e) {
          // invalid id
          return null;
        }
      })
      .filter(Boolean);

    // Map shipping address fields expected by Order schema - use any to avoid TS indexing errors
    const sa: any = session.shippingAddress || {};
    const shippingAddressForOrder = {
      street: sa.addressLine1 || sa.street || sa.line1 || sa.address || '',
      city: sa.city || sa.town || '',
      state: sa.state || '',
      pincode: sa.zipCode || sa.pincode || sa.zip || sa.postalCode || '',
      country: sa.country || 'India'
    };

    // Ensure totalAmount exists (compute if needed)
    const subtotal = typeof session.subtotal === 'number' ? session.subtotal : Number(session.subtotal) || 0;
    const tax = typeof session.tax === 'number' ? session.tax : Number(session.tax) || 0;
    const shippingCost = typeof session.shipping === 'number' ? session.shipping : Number(session.shipping) || 0;
    const discountAmount = typeof session.discount === 'number' ? session.discount : Number(session.discount) || 0;
    const giftCardDiscount = typeof session.giftCardDiscount === 'number' ? session.giftCardDiscount : Number(session.giftCardDiscount) || 0;
    const computedTotal = subtotal + tax + shippingCost - discountAmount - giftCardDiscount;

    // Map payment method to Order.paymentMethod enum: produce simple string values only
    let paymentMethodForOrder: string | undefined = undefined;
    if (session.paymentMethod) {
      const pmAny: any = session.paymentMethod;
      const pmId = (pmAny && (pmAny.id || pmAny.type)) || (typeof pmAny === 'string' ? pmAny : undefined);
      if (pmId === 'cod' || pmId === 'cash') paymentMethodForOrder = 'cash';
      else if (pmId === 'razorpay' || pmId === 'stripe' || pmId === 'online') paymentMethodForOrder = 'razorpay';
      else if (pmId === 'upi' || pmId === 'netbanking' || pmId === 'wallet') paymentMethodForOrder = 'standard';
      else paymentMethodForOrder = String(pmId || 'standard');
    }

    const orderPayload: any = {
      user: new Types.ObjectId(String(userId)),
      orderNumber,
      items: mappedItems,
      shippingAddress: shippingAddressForOrder,
      subtotal,
      tax,
      shippingCost,
      discountAmount,
      total: session.total ?? computedTotal,
      totalAmount: session.total ?? computedTotal,
      notes: session.notes,
      status: 'pending',
      paymentStatus: 'pending'
    };

    if (paymentMethodForOrder) orderPayload.paymentMethod = paymentMethodForOrder;

    logger.info('createOrder: orderPayload before save', { orderPayload });
    logger.info('createOrder: mappedItems and shippingAddressForOrder', { mappedItems, shippingAddressForOrder, sessionShippingAddress: session.shippingAddress });
    const order = new Order(orderPayload);
    try {
      await order.save();
    } catch (saveErr) {
      logger.error('createOrder: order.save failed', { error: (saveErr as any)?.message ?? String(saveErr), orderPayload });
      throw saveErr;
    }

    // Mark session as completed
    session.status = 'completed';
    await session.save();

    // Return plain object with `id` for frontend convenience
    const orderObj = order.toObject({ getters: true });
    // Ensure `id` exists (some frontends expect `id` instead of `_id`)
    (orderObj as any).id = order._id;
    res.status(201).json(orderObj);
  } catch (error) {
    logger.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

/**
 * Get order confirmation
 * GET /api/checkout/orders/:id/confirmation
 */
export const getOrderConfirmation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    // Try to find by ObjectId first, then fallback to orderNumber
    let order = null;
    try {
      order = await Order.findOne({ _id: id, user: userId });
    } catch (e) {
      // ignore cast errors and try orderNumber
      order = null;
    }
    if (!order) {
      order = await Order.findOne({ orderNumber: id, user: userId });
    }
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const orderObj = order.toObject({ getters: true });
    (orderObj as any).id = order._id;
    res.json(orderObj);
  } catch (error) {
    logger.error('Error getting order confirmation:', error);
    res.status(500).json({ error: 'Failed to get order confirmation' });
  }
};

/**
 * Cancel order
 * POST /api/checkout/orders/:id/cancel
 */
export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, userId });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Check if order can be cancelled
    if (!['pending', 'confirmed'].includes(order.status)) {
      res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
      return;
    }

    order.status = 'cancelled';
    // order.cancellationReason = reason;
    await order.save();

    res.json(order);
  } catch (error) {
    logger.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
};

/**
 * Calculate delivery date
 * POST /api/checkout/delivery-estimate
 */
export const calculateDeliveryDate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { shippingMethodId } = req.body;

    // Mock shipping methods
    const methods: { [key: string]: { minDays: number; maxDays: number } } = {
      'standard': { minDays: 5, maxDays: 7 },
      'express': { minDays: 2, maxDays: 3 },
      'overnight': { minDays: 1, maxDays: 1 }
    };

    const method = methods[shippingMethodId];
    if (!method) {
      res.status(404).json({ error: 'Shipping method not found' });
      return;
    }

    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + method.maxDays);

    res.json({
      estimatedDate: estimatedDate.toISOString(),
      minDays: method.minDays,
      maxDays: method.maxDays
    });
  } catch (error) {
    logger.error('Error calculating delivery date:', error);
    res.status(500).json({ error: 'Failed to calculate delivery date' });
  }
};

/**
 * Check express checkout availability
 * GET /api/checkout/express-checkout
 */
export const checkExpressCheckout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Mock express checkout methods
    res.json({
      available: true,
      methods: ['google_pay', 'paypal']
    });
  } catch (error) {
    logger.error('Error checking express checkout:', error);
    res.status(500).json({ error: 'Failed to check express checkout' });
  }
};

/**
 * Process express checkout
 * POST /api/checkout/express-checkout
 */
export const processExpressCheckout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // In production, verify token with payment provider
    // Create order directly with express checkout

    res.status(501).json({ error: 'Express checkout not yet implemented' });
  } catch (error) {
    logger.error('Error processing express checkout:', error);
    res.status(500).json({ error: 'Failed to process express checkout' });
  }
};

/**
 * Save checkout progress
 * POST /api/checkout/save
 */
export const saveCheckoutProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;

    const session = await CheckoutSession.findOne({
      userId,
      status: 'active'
    });

    if (!session) {
      res.status(404).json({ error: 'No active checkout session' });
      return;
    }

    res.json({ checkoutId: session.sessionId });
  } catch (error) {
    logger.error('Error saving checkout progress:', error);
    res.status(500).json({ error: 'Failed to save checkout progress' });
  }
};

/**
 * Restore checkout progress
 * POST /api/checkout/restore
 */
export const restoreCheckoutProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const { checkoutId } = req.body;

    const session = await CheckoutSession.findOne({
      userId,
      sessionId: checkoutId,
      status: 'active'
    });

    if (!session) {
      res.status(404).json({ error: 'Checkout session not found or expired' });
      return;
    }

    // Extend expiration
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await session.save();

    res.json(session);
  } catch (error) {
    logger.error('Error restoring checkout progress:', error);
    res.status(500).json({ error: 'Failed to restore checkout progress' });
  }
};

/**
 * Calculate tax
 * POST /api/checkout/calculate-tax
 */
export const calculateTax = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { items } = req.body;

    // Calculate subtotal
    const subtotal = items.reduce((sum: number, item: any) => {
      return sum + (item.price * item.quantity);
    }, 0);

    // GST rates for India (simplified)
    const cgst = 0.09; // 9% CGST
    const sgst = 0.09; // 9% SGST
    const taxRate = cgst + sgst; // 18% total

    const tax = subtotal * taxRate;

    res.json({
      tax,
      taxBreakdown: [
        { name: 'CGST (9%)', rate: cgst, amount: subtotal * cgst },
        { name: 'SGST (9%)', rate: sgst, amount: subtotal * sgst }
      ]
    });
  } catch (error) {
    logger.error('Error calculating tax:', error);
    res.status(500).json({ error: 'Failed to calculate tax' });
  }
};
