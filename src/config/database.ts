import mongoose from 'mongoose';
import type { ConnectOptions } from 'mongoose';
import { database } from './config.js';
import { logger } from '../utils/logger.js';

const normalizeMongoUri = (uri: string): string => {
  if (!uri) return 'mongodb://127.0.0.1:27017/ecommerce';
  // Replace common unreachable hostnames with localhost for local dev
  return uri.replace('host.docker.internal', '127.0.0.1').replace('192.168.1.8', '127.0.0.1');
};

export const connectDB = async (): Promise<void> => {
  const uri = normalizeMongoUri(database.uri);
  let attemptsLeft = database.reconnectTries;

  while (attemptsLeft >= 0) {
    try {
  logger.info(`Attempting MongoDB connect to ${uri} (attempt ${database.reconnectTries - attemptsLeft + 1})`);
  await mongoose.connect(uri, database.options as ConnectOptions);
      logger.info('MongoDB connected successfully');
      return;
    } catch (error) {
      logger.error('MongoDB connection error:', error);
      attemptsLeft -= 1;
      if (attemptsLeft < 0) break;
      logger.info(`Retrying MongoDB connection in ${database.reconnectInterval}ms... (${attemptsLeft} attempts left)`);
      // backoff wait
      await new Promise(resolve => setTimeout(resolve, database.reconnectInterval));
    }
  }

  logger.error('MongoDB connection failed after multiple attempts. Please check MONGODB_URI and that MongoDB is reachable.');
  process.exit(1);
};