 
import { Request, Response } from 'express';
import { User, IUser } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';

interface AuthRequest extends Request {
  user?: IUser;
}

// Get dashboard statistics
export const getDashboardStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    
    // Calculate revenue
    const orders = await Order.find({ paymentStatus: 'completed' });
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    
    // Recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'firstName lastName email');
    
    // Low stock products
    const lowStockProducts = await Product.find({ stock: { $lt: 10 } })
      .sort({ stock: 1 })
      .limit(5);
    
    res.json({
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      recentOrders,
      lowStockProducts
    });
  } catch (_error) {
    res.status(500).json({ error: 'Error fetching dashboard statistics' });
  }
};

// User Management
export const getAllUsers = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (_error) {
    res.status(500).json({ error: 'Error fetching users' });
  }
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (_error) {
    res.status(500).json({ error: 'Error fetching user' });
  }
};

export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.body;
    
    if (!['user', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    res.json(user);
  } catch (_error) {
    res.status(500).json({ error: 'Error updating user role' });
  }
};

// Product Management
export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, price, imageUrl, images, category, subcategory, stock } = req.body;
    
    // Ensure correct category formatting
    let formattedCategory = category;
    // Handle special cases for categories with spaces and & symbols
    if (category.includes('Sensors') && category.includes('Modules')) {
      formattedCategory = 'sensors-modules';
    } else if (category.includes('Tools') && category.includes('Equipment')) {
      formattedCategory = 'tools-equipment';
    }
    
    const product = new Product({
      name,
      description,
      price,
      imageUrl: imageUrl || (Array.isArray(images) && images.length > 0 ? images[0] : ''),
      images: Array.isArray(images) ? images : undefined,
      category: formattedCategory,
      subcategory,
      stock
    });
    
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(400).json({ error: 'Error creating product' });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['name', 'description', 'price', 'imageUrl', 'images', 'category', 'subcategory', 'stock'];
    
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));
    if (!isValidOperation) {
      res.status(400).json({ error: 'Invalid updates' });
      return;
    }
    
    // Format category if needed
    if (req.body.category) {
      if (req.body.category.includes('Sensors') && req.body.category.includes('Modules')) {
        req.body.category = 'sensors-modules';
      } else if (req.body.category.includes('Tools') && req.body.category.includes('Equipment')) {
        req.body.category = 'tools-equipment';
      }
    }
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(400).json({ error: 'Error updating product' });
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (_error) {
    res.status(500).json({ error: 'Error deleting product' });
  }
};

// Order Management
export const getAllOrders = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await Order.find()
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (_error) {
    res.status(500).json({ error: 'Error fetching orders' });
  }
};

export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'firstName lastName email')
      .populate('items.product');
    
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    res.json(order);
  } catch (_error) {
    res.status(500).json({ error: 'Error fetching order' });
  }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, trackingNumber } = req.body;
    
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid order status' });
      return;
    }
    
    const updateData: Record<string, string> = { status };
    if (trackingNumber) {
      updateData.trackingNumber = trackingNumber;
    }
    
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    res.json(order);
  } catch (_error) {
    res.status(500).json({ error: 'Error updating order status' });
  }
};

// Payment Gateway Settings
export const getPaymentSettings = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // In a real implementation, these settings would come from a database
    // For now, we'll check if we have them in environment variables
    
    const settings = {
      gateways: [
        {
          id: 'razorpay',
          name: 'Razorpay',
          enabled: process.env.RAZORPAY_KEY_ID ? true : false,
          configFields: {
            keyId: {
              name: 'Key ID',
              value: process.env.RAZORPAY_KEY_ID || '',
            },
            keySecret: {
              name: 'Key Secret',
              value: process.env.RAZORPAY_KEY_SECRET ? '••••••••' : '', // Don't send actual secret
            },
            webhookSecret: {
              name: 'Webhook Secret',
              value: process.env.RAZORPAY_WEBHOOK_SECRET ? '••••••••' : '',
            },
            environment: {
              name: 'Environment',
              value: process.env.RAZORPAY_TEST_MODE === 'true' ? 'test' : 'live',
            },
          },
        },
        {
          id: 'stripe',
          name: 'Stripe',
          enabled: process.env.STRIPE_PUBLISHABLE_KEY ? true : false,
          configFields: {
            publishableKey: {
              name: 'Publishable Key',
              value: process.env.STRIPE_PUBLISHABLE_KEY || '',
            },
            secretKey: {
              name: 'Secret Key',
              value: process.env.STRIPE_SECRET_KEY ? '••••••••' : '',
            },
            webhookSecret: {
              name: 'Webhook Secret',
              value: process.env.STRIPE_WEBHOOK_SECRET ? '••••••••' : '',
            },
            environment: {
              name: 'Environment',
              value: process.env.STRIPE_TEST_MODE === 'true' ? 'test' : 'live',
            },
          },
        },
        {
          id: 'paypal',
          name: 'PayPal',
          enabled: process.env.PAYPAL_CLIENT_ID ? true : false,
          configFields: {
            clientId: {
              name: 'Client ID',
              value: process.env.PAYPAL_CLIENT_ID || '',
            },
            clientSecret: {
              name: 'Client Secret',
              value: process.env.PAYPAL_CLIENT_SECRET ? '••••••••' : '',
            },
            environment: {
              name: 'Environment',
              value: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
            },
          },
        },
        {
          id: 'cashfree',
          name: 'Cashfree',
          enabled: process.env.CASHFREE_APP_ID ? true : false,
          configFields: {
            appId: {
              name: 'App ID',
              value: process.env.CASHFREE_APP_ID || '',
            },
            secretKey: {
              name: 'Secret Key',
              value: process.env.CASHFREE_SECRET_KEY ? '••••••••' : '',
            },
            environment: {
              name: 'Environment',
              value: process.env.CASHFREE_TEST_MODE === 'true' ? 'test' : 'production',
            },
          },
        },
      ],
      allowCOD: process.env.ALLOW_COD === 'false' ? false : true, // Default to true
    };
    
    res.json(settings);
  } catch (error) {
    console.error('Error getting payment settings:', error);
    res.status(500).json({ error: 'Error fetching payment settings' });
  }
};

export const updatePaymentSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = req.body;
    
    // In a real implementation, we would save these settings to a database
    // For now, we'll log the settings and return success
    
    // We could also update environment variables, but that's not a good practice
    // In a real app, we would store these in a database
    
    console.log('Received payment settings update:', JSON.stringify(settings, null, 2));
    
    // Return success
    res.json({ 
      success: true,
      message: 'Payment settings updated successfully',
      // Don't send actual secrets back
      settings: {
        ...settings,
        gateways: settings.gateways.map((gateway: any) => ({
          ...gateway,
          configFields: Object.entries(gateway.configFields).reduce((fields: any, [key, value]: [string, any]) => {
            fields[key] = {
              ...value,
              value: key.toLowerCase().includes('secret') || key.toLowerCase().includes('key') && key !== 'keyId' && key !== 'publishableKey' 
                ? (value.value ? '••••••••' : '') 
                : value.value
            };
            return fields;
          }, {})
        }))
      }
    });
  } catch (error) {
    console.error('Error updating payment settings:', error);
    res.status(500).json({ error: 'Error updating payment settings' });
  }
}; 
