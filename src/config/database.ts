import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
}; 