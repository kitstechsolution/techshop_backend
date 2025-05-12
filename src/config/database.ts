import mongoose from 'mongoose';
import { database } from './config.js';
import { logger } from '../utils/logger.js';

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(database.uri);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    
    // Implementation for retry logic
    let retries = database.reconnectTries;
    while (retries > 0) {
      logger.info(`Retrying MongoDB connection... (${retries} attempts left)`);
      
      try {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, database.reconnectInterval));
        await mongoose.connect(database.uri);
        logger.info('MongoDB connected successfully after retrying');
        return;
      } catch (retryError) {
        retries -= 1;
        logger.error('MongoDB connection retry failed:', retryError);
      }
    }
    
    logger.error('MongoDB connection failed after multiple attempts, exiting application');
    process.exit(1);
  }
}; 