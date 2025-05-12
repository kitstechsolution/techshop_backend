import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Test route
app.get('/api/test', (_req: Request, res: Response): void => {
  res.json({ 
    message: 'Backend is running successfully!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/api/auth', authRoutes);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, next: NextFunction): void => {
  logger.error('Unhandled error:', err.stack);
  
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
  
  // Call next() to ensure proper middleware chain handling
  next();
});

export default app; 