import { Request, Response } from 'express';
import { Order } from '../models/Order.js';
import { IUser } from '../models/User.js';
import { logger } from '../utils/logger.js';

interface AuthRequest extends Request {
  user?: IUser;
}

// Get all orders for the current authenticated user
export const getUserOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if user exists in request (added by auth middleware)
    if (!req.user || !req.user._id) {
      res.status(401).json({ error: 'Unauthorized access' });
      return;
    }
    
    const userId = req.user._id;
    
    // Find all orders for this user
    const orders = await Order.find({ user: userId })
      .populate('items.product')
      .sort({ createdAt: -1 });
    
    logger.info(`Fetched ${orders.length} orders for user ${userId}`);
    res.json(orders);
  } catch (error) {
    logger.error('Error fetching user orders:', error);
    res.status(500).json({ error: 'Error fetching your orders' });
  }
};

// Get a specific order by ID for the current user
export const getUserOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if user exists in request (added by auth middleware)
    if (!req.user || !req.user._id) {
      res.status(401).json({ error: 'Unauthorized access' });
      return;
    }
    
    const userId = req.user._id;
    const orderId = req.params.id;
    
    // Find the order and ensure it belongs to this user
    const order = await Order.findOne({ 
      _id: orderId,
      user: userId 
    }).populate('items.product');
    
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    res.json(order);
  } catch (error) {
    logger.error('Error fetching user order:', error);
    res.status(500).json({ error: 'Error fetching order details' });
  }
};

// Create a new order
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if user exists in request (added by auth middleware)
    if (!req.user || !req.user._id) {
      res.status(401).json({ error: 'Unauthorized access' });
      return;
    }
    
    const userId = req.user._id;
    const { items, shippingAddress } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Order must contain at least one item' });
      return;
    }
    
    if (!shippingAddress) {
      res.status(400).json({ error: 'Shipping address is required' });
      return;
    }
    
    // Create new order
    const newOrder = new Order({
      user: userId,
      items,
      shippingAddress,
      status: 'pending',
      paymentStatus: 'pending'
    });
    
    // Save the order
    await newOrder.save();
    
    // Return the created order
    res.status(201).json(newOrder);
  } catch (error) {
    logger.error('Error creating order:', error);
    res.status(500).json({ error: 'Error creating your order' });
  }
};

/**
 * Get payment status for an order
 */
export const getOrderPaymentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if user exists in request (added by auth middleware)
    if (!req.user || !req.user._id) {
      res.status(401).json({ error: 'Unauthorized access' });
      return;
    }
    
    const userId = req.user._id;
    const orderId = req.params.id;
    
    // Find the order and ensure it belongs to this user
    const order = await Order.findOne({ 
      _id: orderId,
      user: userId 
    });
    
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    // Calculate attempts remaining
    const attemptsRemaining = Math.max(0, 3 - (order.paymentAttempts || 0));
    const canRetry = order.paymentStatus !== 'completed' && attemptsRemaining > 0;
    
    res.json({
      success: true,
      order: {
        id: order._id,
        amount: order.total,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        attemptsRemaining,
        canRetry
      }
    });
  } catch (error) {
    logger.error('Error fetching order payment status:', error);
    res.status(500).json({ error: 'Error fetching payment status' });
  }
};

/**
 * Complete payment for an order (used for non-gateway payments)
 */
export const completeOrderPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Check if user exists in request (added by auth middleware)
    if (!req.user || !req.user._id) {
      res.status(401).json({ error: 'Unauthorized access' });
      return;
    }
    
    const userId = req.user._id;
    const orderId = req.params.id;
    const { method = 'standard' } = req.body;
    
    // Find the order and ensure it belongs to this user
    const order = await Order.findOne({ 
      _id: orderId,
      user: userId 
    });
    
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    // Check if payment is already completed
    if (order.paymentStatus === 'completed') {
      res.status(400).json({ error: 'Payment has already been completed for this order' });
      return;
    }
    
    // Update order with payment information
    order.paymentMethod = method as 'standard' | 'cash';
    order.paymentStatus = method === 'cash' ? 'pending' : 'completed'; // COD payments remain pending until delivery
    order.status = 'processing';
    
    // Save the updated order
    await order.save();
    
    logger.info(`Order ${order._id} payment completed using ${method} method`);
    
    res.status(200).json({
      success: true,
      message: `Payment ${method === 'cash' ? 'recorded' : 'completed'} successfully`,
      order: {
        id: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus
      }
    });
  } catch (error) {
    logger.error('Error completing order payment:', error);
    res.status(500).json({ error: 'Error processing payment' });
  }
}; 