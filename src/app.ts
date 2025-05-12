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
import { logger } from './utils/logger.js';
import ShippingConfig from './models/ShippingConfig.js';

// Create Express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: server.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/shipping', shippingRoutes);

// Not found route
app.use('*', (req: Request, res: Response) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong' });
});

export default app; 