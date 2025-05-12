import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { logger } from './logger.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';

const seedUsers = [
  {
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin' as const,
  },
  {
    firstName: 'Test',
    lastName: 'User',
    email: 'user@example.com',
    password: 'user123',
    role: 'user' as const,
  },
];

const seedProducts = [
  {
    name: 'Arduino Uno R4 WiFi',
    price: 3499.00,
    description: 'Latest Arduino board with built-in WiFi, perfect for IoT projects. Features the new RA4M1 32-bit processor and enhanced capabilities.',
    imageUrl: 'https://picsum.photos/720/1080?electronics=1',
    category: 'arduino',
    stock: 25,
  },
  {
    name: 'Raspberry Pi 5',
    price: 6999.00,
    description: 'The newest Raspberry Pi with 2.4GHz quad-core CPU, up to 8GB RAM, and enhanced GPU performance.',
    imageUrl: 'https://picsum.photos/720/1080?electronics=2',
    category: 'raspberry-pi',
    stock: 10,
  },
  {
    name: 'ESP32-CAM Module',
    price: 899.00,
    description: 'ESP32 development board with integrated camera, perfect for IoT video streaming and surveillance projects.',
    imageUrl: 'https://picsum.photos/720/1080?electronics=3',
    category: 'esp32',
    stock: 50,
  },
];

const seedDatabase = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});
    logger.info('Cleared existing data');

    // Seed users
    await User.create(seedUsers);
    logger.info('Users seeded');

    // Seed products
    await Product.create(seedProducts);
    logger.info('Products seeded');

    logger.info('Database seeded successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Only run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
} 