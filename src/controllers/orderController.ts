import { Request, Response } from 'express';
import { Order } from '../models/Order.js';
import { IUser } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { Product } from '../models/Product.js';
import { pdfService } from '../services/pdfService.js';
import { sendOrderConfirmationEmail } from '../services/emailService.js';

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
    
    // Send order confirmation email
    try {
      const user = req.user as IUser;
      await sendOrderConfirmationEmail(
        user.email,
        {
          orderNumber: newOrder._id.toString(),
          name: `${user.firstName} ${user.lastName}`,
          items: newOrder.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })),
          subtotal: newOrder.subtotal || 0,
          discount: newOrder.discount,
          total: newOrder.total || 0,
          shippingAddress: `${shippingAddress.street}, ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}`,
        }
      );
      logger.info(`Order confirmation email sent for order ${newOrder._id}`);
    } catch (emailError) {
      logger.error('Failed to send order confirmation email:', emailError);
      // Don't fail the order creation if email fails
    }
    
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

/**
 * Cancel an order
 */
export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user._id) {
      res.status(401).json({ error: 'Unauthorized access' });
      return;
    }
    
    const userId = req.user._id;
    const orderId = req.params.id;
    const { reason } = req.body;
    
    // Find the order and ensure it belongs to this user
    const order = await Order.findOne({ 
      _id: orderId,
      user: userId 
    });
    
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    // Check if order can be cancelled (only pending or processing orders)
    if (!['pending', 'processing'].includes(order.status)) {
      res.status(400).json({ 
        error: `Cannot cancel order with status: ${order.status}`,
        message: 'Only pending or processing orders can be cancelled'
      });
      return;
    }
    
    // Update order status
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Customer requested cancellation';
    
    await order.save();
    
    logger.info(`Order ${order._id} cancelled by user ${userId}`);
    
    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        id: order._id,
        status: order.status,
        cancelledAt: order.cancelledAt
      }
    });
  } catch (error) {
    logger.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Error cancelling order' });
  }
};

/**
 * Get order statistics for the current user
 */
export const getOrderStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user._id) {
      res.status(401).json({ error: 'Unauthorized access' });
      return;
    }
    
    const userId = req.user._id;
    
    // Get all orders for this user
    const orders = await Order.find({ user: userId });
    
    // Calculate statistics
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'delivered').length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
    const pendingOrders = orders.filter(o => ['pending', 'processing', 'shipped'].includes(o.status)).length;
    
    const totalSpent = orders
      .filter(o => o.status === 'delivered')
      .reduce((sum, order) => sum + (order.total || 0), 0);
    
    const averageOrderValue = completedOrders > 0 ? totalSpent / completedOrders : 0;
    
    // Get order status breakdown
    const statusBreakdown = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Get recent orders (last 5)
    const recentOrders = orders
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(order => ({
        id: order._id,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt
      }));
    
    res.json({
      success: true,
      stats: {
        totalOrders,
        completedOrders,
        cancelledOrders,
        pendingOrders,
        totalSpent,
        averageOrderValue,
        statusBreakdown,
        recentOrders
      }
    });
  } catch (error) {
    logger.error('Error fetching order stats:', error);
    res.status(500).json({ error: 'Error fetching order statistics' });
  }
};

/**
 * Download invoice for an order
 */
export const downloadInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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
    }).populate('items.product').populate('user', 'firstName lastName email');
    
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    // Generate invoice for any order (proforma for unpaid/pending)
    // Map shipping address fields defensively (support different schemas)
    const street = (order as any)?.shippingAddress?.street || (order as any)?.shippingAddress?.addressLine1 || '';
    const zip = (order as any)?.shippingAddress?.zipCode || (order as any)?.shippingAddress?.pincode || '';
    const country = (order as any)?.shippingAddress?.country || 'IN';

    // Prepare invoice data for PDF generation
    const invoiceData = {
      invoiceNumber: `INV-${order._id.toString().slice(-8).toUpperCase()}`,
      orderNumber: order._id.toString(),
      date: order.createdAt,
      customer: {
        name: `${(order.user as any)?.firstName || ''} ${(order.user as any)?.lastName || ''}`.trim(),
        email: (order.user as any)?.email || '',
      },
      shippingAddress: {
        street,
        city: (order as any)?.shippingAddress?.city,
        state: (order as any)?.shippingAddress?.state,
        zipCode: zip,
        country,
      },
      items: order.items.map((item: any) => {
        const name = item?.name || item?.product?.name || 'Product';
        const price = typeof item?.price === 'number' ? item.price : (item?.product?.price ?? 0);
        const quantity = typeof item?.quantity === 'number' ? item.quantity : 1;
        return {
          product: name,
          quantity,
          price,
          total: price * quantity,
        };
      }),
      subtotal: typeof (order as any)?.subtotal === 'number' ? (order as any).subtotal : (order.items as any[]).reduce((s, it: any) => s + ((it.price ?? it.product?.price ?? 0) * (it.quantity ?? 1)), 0),
      tax: (order as any)?.tax ?? 0,
      shipping: (order as any)?.shipping ?? 0,
      total: typeof (order as any)?.total === 'number' ? (order as any).total : (order.items as any[]).reduce((s, it: any) => s + ((it.price ?? it.product?.price ?? 0) * (it.quantity ?? 1)), 0) + ((order as any)?.tax ?? 0) + ((order as any)?.shipping ?? 0),
      paymentMethod: (order as any)?.paymentMethod || 'standard',
      paymentStatus: (order as any)?.paymentStatus || 'pending',
    } as const;

    // Generate and stream PDF
    await pdfService.generateInvoice(res, invoiceData);
    
    logger.info(`Invoice PDF generated for order ${order._id} by user ${userId}`);
  } catch (error) {
    logger.error('Error downloading invoice:', error);
    res.status(500).json({ error: 'Error generating invoice' });
  }
};

/**
 * Track order status and location
 */
export const trackOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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
    
    // Build tracking timeline based on order status
    const timeline = [
      {
        status: 'pending',
        label: 'Order Placed',
        completed: true,
        date: order.createdAt,
        description: 'Your order has been received'
      }
    ];
    
    const statusOrder = ['pending', 'processing', 'shipped', 'delivered'];
    const currentIndex = statusOrder.indexOf(order.status);
    
    if (currentIndex >= 1) {
      timeline.push({
        status: 'processing',
        label: 'Processing',
        completed: true,
        date: order.updatedAt,
        description: 'Your order is being prepared'
      });
    }
    
    if (currentIndex >= 2) {
      timeline.push({
        status: 'shipped',
        label: 'Shipped',
        completed: true,
        date: order.shippedAt || order.updatedAt,
        description: 'Your order has been shipped'
      });
    }
    
    if (currentIndex >= 3) {
      timeline.push({
        status: 'delivered',
        label: 'Delivered',
        completed: true,
        date: order.deliveredAt || order.updatedAt,
        description: 'Your order has been delivered'
      });
    } else if (order.status !== 'cancelled') {
      // Add pending steps
      for (let i = currentIndex + 1; i < statusOrder.length; i++) {
        const status = statusOrder[i];
        timeline.push({
          status,
          label: status.charAt(0).toUpperCase() + status.slice(1),
          completed: false,
          date: null,
          description: `Order will be ${status}`
        });
      }
    }
    
    // Handle cancelled orders
    if (order.status === 'cancelled') {
      timeline.push({
        status: 'cancelled',
        label: 'Cancelled',
        completed: true,
        date: order.cancelledAt || order.updatedAt,
        description: order.cancellationReason || 'Order was cancelled'
      });
    }
    
    res.json({
      success: true,
      tracking: {
        orderId: order._id,
        currentStatus: order.status,
        estimatedDelivery: order.estimatedDeliveryDate,
        trackingNumber: order.trackingNumber,
        carrier: order.carrier || 'Standard Shipping',
        timeline,
        shippingAddress: order.shippingAddress
      }
    });
  } catch (error) {
    logger.error('Error tracking order:', error);
    res.status(500).json({ error: 'Error tracking order' });
  }
};

/**
 * Reorder - Create a new order from an existing order
 */
export const reorder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user._id) {
      res.status(401).json({ error: 'Unauthorized access' });
      return;
    }
    
    const userId = req.user._id;
    const orderId = req.params.id;
    
    // Find the original order
    const originalOrder = await Order.findOne({ 
      _id: orderId,
      user: userId 
    }).populate('items.product');
    
    if (!originalOrder) {
      res.status(404).json({ error: 'Original order not found' });
      return;
    }
    
    // Check product availability and prices
    const items = [];
    const unavailableItems = [];
    
    for (const item of originalOrder.items) {
      const product = await Product.findById(item.product);
      
      if (!product) {
        unavailableItems.push({
          productId: item.product,
          reason: 'Product no longer available'
        });
        continue;
      }
      
      if (product.stock < item.quantity) {
        unavailableItems.push({
          productId: item.product,
          name: product.name,
          requestedQuantity: item.quantity,
          availableStock: product.stock,
          reason: 'Insufficient stock'
        });
        continue;
      }
      
      items.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price // Use current price, not original price
      });
    }
    
    if (items.length === 0) {
      res.status(400).json({ 
        error: 'Cannot reorder',
        message: 'None of the items from the original order are currently available',
        unavailableItems
      });
      return;
    }
    
    // Create new order with available items
    const newOrder = new Order({
      user: userId,
      items,
      shippingAddress: originalOrder.shippingAddress,
      status: 'pending',
      paymentStatus: 'pending'
    });
    
    await newOrder.save();
    
    logger.info(`Order ${originalOrder._id} reordered as ${newOrder._id}`);
    
    res.status(201).json({
      success: true,
      message: unavailableItems.length > 0 
        ? 'Order created with available items. Some items were unavailable.'
        : 'Order created successfully',
      order: newOrder,
      unavailableItems: unavailableItems.length > 0 ? unavailableItems : undefined
    });
  } catch (error) {
    logger.error('Error reordering:', error);
    res.status(500).json({ error: 'Error creating reorder' });
  }
};

/**
 * Request return for a delivered order
 */
export const requestReturn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user._id) {
      res.status(401).json({ error: 'Unauthorized access' });
      return;
    }
    
    const userId = req.user._id;
    const orderId = req.params.id;
    const { reason, items: returnItems } = req.body;
    
    if (!reason) {
      res.status(400).json({ error: 'Return reason is required' });
      return;
    }
    
    // Find the order and ensure it belongs to this user
    const order = await Order.findOne({ 
      _id: orderId,
      user: userId 
    });
    
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    // Check if order can be returned (must be delivered)
    if (order.status !== 'delivered') {
      res.status(400).json({ 
        error: 'Cannot request return',
        message: 'Only delivered orders can be returned'
      });
      return;
    }
    
    // Check if return window is still open (e.g., 30 days)
    const deliveryDate = order.deliveredAt ? new Date(order.deliveredAt) : new Date(order.updatedAt);
    const daysSinceDelivery = Math.floor((Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
    const returnWindowDays = 30;
    
    if (daysSinceDelivery > returnWindowDays) {
      res.status(400).json({ 
        error: 'Return window expired',
        message: `Returns must be requested within ${returnWindowDays} days of delivery`,
        daysSinceDelivery
      });
      return;
    }
    
    // Check if return already requested
    if (order.returnRequested) {
      res.status(400).json({ 
        error: 'Return already requested',
        message: 'A return request has already been submitted for this order'
      });
      return;
    }
    
    // Update order with return information
    order.returnRequested = true;
    order.returnRequestedAt = new Date();
    order.returnReason = reason;
    order.returnItems = returnItems || order.items.map(item => item._id);
    order.returnStatus = 'pending';
    
    await order.save();
    
    logger.info(`Return requested for order ${order._id} by user ${userId}`);
    
    res.json({
      success: true,
      message: 'Return request submitted successfully',
      return: {
        orderId: order._id,
        requestedAt: order.returnRequestedAt,
        status: order.returnStatus,
        reason: order.returnReason,
        estimatedRefund: order.total
      }
    });
  } catch (error) {
    logger.error('Error requesting return:', error);
    res.status(500).json({ error: 'Error processing return request' });
  }
};
