import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { connectDB } from './config/database.js';
import { server } from './config/config.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/payments.js';
import shippingRoutes from './routes/shippingRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import filterRoutes from './routes/filterRoutes.js';
import recentlyViewedRoutes from './routes/recentlyViewedRoutes.js';
import cancelRefundRoutes from './routes/cancelRefundRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import adminNotificationRoutes from './routes/admin/adminNotificationRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import adminReviewRoutes from './routes/admin/adminReviewRoutes.js';
import adminInventoryRoutes from './routes/admin/adminInventoryRoutes.js';
import customizationRoutes from './routes/customizationRoutes.js';
import adminCustomizationRoutes from './routes/admin/adminCustomizationRoutes.js';
import adminAnalyticsRoutes from './routes/adminAnalyticsRoutes.js';
import loyaltyRoutes from './routes/loyaltyRoutes.js';
import adminLoyaltyRoutes from './routes/admin/adminLoyaltyRoutes.js';
import adminBadgeRoutes from './routes/admin/adminBadgeRoutes.js';
import checkoutRoutes from './routes/checkoutRoutes.js';
import themeRoutes from './routes/themeRoutes.js';
import paymentSettingsRoutes from './routes/paymentSettingsRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { logger } from './utils/logger.js';
import ShippingConfig from './models/ShippingConfig.js';
import { apiLimiter, publicLimiter, authLimiter, adminLimiter } from './middleware/rateLimiter.js';
import { verifyEmailConfig } from './services/emailService.js';

// Create Express app
const app = express();

// Connect to MongoDB
connectDB();

// Verify email configuration (non-blocking)
verifyEmailConfig().catch(err => {
  logger.warn('Email service not configured or verification failed:', err.message);
  logger.warn('Email features will not work until properly configured.');
});

// Middleware
const allowedOrigins = [
  server.corsOrigin,
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (server.allowAllOrigins || !origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
}));

// Handle preflight
app.options('*', cors({
  origin: (origin, callback) => {
    if (server.allowAllOrigins || !origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply global rate limiting
app.use('/api/', apiLimiter);

// Test route
app.get('/api/test', (_req: Request, res: Response): void => {
  res.json({ 
    message: 'Backend is running successfully!',
    timestamp: new Date().toISOString(),
    environment: server.nodeEnv
  });
});

// Debug route for shipping config
app.get('/api/debug/shipping/config', async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Debug shipping config route accessed');
    
    // Check if shipping config exists in the database
    const config = await ShippingConfig.findOne();
    
    res.json({
      message: 'Debug shipping config route is working',
      timestamp: new Date().toISOString(),
      configExists: !!config,
      defaultConfig: {
        aggregators: [
          {
            id: 'shiprocket',
            name: 'Shiprocket',
            description: 'India\'s leading shipping aggregator',
            enabled: false
          }
        ],
        defaultAggregator: '',
        enablePincodeValidation: true,
        defaultShippingCost: 50,
        freeShippingThreshold: 500,
        enableInternationalShipping: false
      }
    });
  } catch (error) {
    logger.error('Error in debug shipping config route:', error);
    res.status(500).json({ 
      error: 'Error in debug endpoint',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test admin route
app.get('/api/admin/test', (req: Request, res: Response): void => {
  logger.info('Admin test route accessed');
  res.json({
    message: 'Admin test route is working',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api/products', publicLimiter, productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/filters', filterRoutes);
app.use('/api/recently-viewed', recentlyViewedRoutes);
app.use('/api', cancelRefundRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin/reviews', adminReviewRoutes);
app.use('/api/admin/inventory', adminInventoryRoutes);
app.use('/api/customizations', customizationRoutes);
app.use('/api/admin/customizations', adminCustomizationRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/admin/loyalty', adminLoyaltyRoutes);
app.use('/api/admin', adminBadgeRoutes);
app.use('/api/themes', themeRoutes);
app.use('/api/payment-settings', paymentSettingsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/users', userRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Not found route
app.use('*', (req: Request, res: Response) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
 
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong' });
});

export default app; 