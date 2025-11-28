/**
 * Backend Configuration
 * 
 * This file contains all the configurable backend settings for the e-commerce platform.
 * When adapting this template for a client, modify these values or set appropriate environment variables.
 */

import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

// Load environment variables
dotenv.config();

// Helper function to get env variable with a default
const getEnv = (key: string, defaultValue: string): string => {
  const value = process.env[key];
  if (!value) {
    logger.debug(`Environment variable ${key} not found, using default value`);
    return defaultValue;
  }
  return value;
};

// Helper function to get number env variable with a default
const getNumberEnv = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) {
    logger.debug(`Environment variable ${key} not found, using default value`);
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    logger.warn(`Environment variable ${key} is not a valid number, using default value`);
    return defaultValue;
  }
  return parsed;
};

// Helper function to get boolean env variable with a default
const getBooleanEnv = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  if (!value) {
    logger.debug(`Environment variable ${key} not found, using default value`);
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
};

// Server Configuration
export const server = {
  port: getNumberEnv('PORT', 5000),
  nodeEnv: getEnv('NODE_ENV', 'development'),
  isProd: getEnv('NODE_ENV', 'development') === 'production',
  apiVersion: getEnv('API_VERSION', 'v1'),
  baseUrl: getEnv('BASE_URL', 'http://localhost:5000'),
  corsOrigin: getEnv('CORS_ORIGIN', 'http://localhost:5173'),
  corsOrigins: getEnv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  allowAllOrigins: getBooleanEnv('ALLOW_ALL_ORIGINS', false),
  trustedProxies: getEnv('TRUSTED_PROXIES', '127.0.0.1,::1').split(','),
  rateLimitRequests: getNumberEnv('RATE_LIMIT_REQUESTS', 100),
  rateLimitWindow: getNumberEnv('RATE_LIMIT_WINDOW', 15 * 60), // 15 minutes in seconds
};

// Database Configuration
export const database = {
  uri: getEnv('MONGODB_URI', 'mongodb://localhost:27017/ecommerce'),
  options: {},
  reconnectTries: getNumberEnv('DB_RECONNECT_TRIES', 3),
  reconnectInterval: getNumberEnv('DB_RECONNECT_INTERVAL', 1000),
};

// Authentication Configuration
export const auth = {
  jwtSecret: getEnv('JWT_SECRET', 'your-secret-key'),
  jwtExpiration: getEnv('JWT_EXPIRATION', '24h'),
  jwtRefreshExpiration: getEnv('JWT_REFRESH_EXPIRATION', '7d'),
  saltRounds: getNumberEnv('SALT_ROUNDS', 10),
  resetPasswordExpiration: getNumberEnv('RESET_PASSWORD_EXPIRATION', 60 * 60 * 1000), // 1 hour in milliseconds
  googleClientId: getEnv('GOOGLE_CLIENT_ID', ''),
  googleClientSecret: getEnv('GOOGLE_CLIENT_SECRET', ''),
  facebookAppId: getEnv('FACEBOOK_APP_ID', ''),
  facebookAppSecret: getEnv('FACEBOOK_APP_SECRET', ''),
};

// Payment Gateway Configuration
export const payment = {
  currency: getEnv('CURRENCY', 'INR'),
  currencySymbol: getEnv('CURRENCY_SYMBOL', '₹'),
  stripeSecretKey: getEnv('STRIPE_SECRET_KEY', ''),
  stripePublishableKey: getEnv('STRIPE_PUBLISHABLE_KEY', ''),
  stripeWebhookSecret: getEnv('STRIPE_WEBHOOK_SECRET', ''),
  razorpayKeyId: getEnv('RAZORPAY_KEY_ID', ''),
  razorpayKeySecret: getEnv('RAZORPAY_KEY_SECRET', ''),
  razorpayWebhookSecret: getEnv('RAZORPAY_WEBHOOK_SECRET', ''),
  paypalClientId: getEnv('PAYPAL_CLIENT_ID', ''),
  paypalClientSecret: getEnv('PAYPAL_CLIENT_SECRET', ''),
  paypalEnvironment: getEnv('PAYPAL_ENVIRONMENT', 'sandbox'), // 'sandbox' or 'production'
  cashOnDeliveryEnabled: getBooleanEnv('CASH_ON_DELIVERY_ENABLED', true),
};

// Email Configuration
export const email = {
  fromEmail: getEnv('FROM_EMAIL', 'no-reply@example.com'),
  fromName: getEnv('FROM_NAME', 'E-commerce Store'),
  smtpHost: getEnv('SMTP_HOST', ''),
  smtpPort: getNumberEnv('SMTP_PORT', 587),
  smtpUser: getEnv('SMTP_USER', ''),
  smtpPassword: getEnv('SMTP_PASSWORD', ''),
  smtpSecure: getBooleanEnv('SMTP_SECURE', false),
  sendgridApiKey: getEnv('SENDGRID_API_KEY', ''),
  useProvider: getEnv('EMAIL_PROVIDER', 'smtp'), // 'smtp', 'sendgrid', 'none'
};

// File Storage Configuration
export const storage = {
  provider: getEnv('STORAGE_PROVIDER', 'local'), // 'local', 's3', 'cloudinary'
  localDir: getEnv('LOCAL_STORAGE_DIR', 'uploads'),
  s3Region: getEnv('S3_REGION', ''),
  s3Bucket: getEnv('S3_BUCKET', ''),
  s3AccessKey: getEnv('S3_ACCESS_KEY', ''),
  s3SecretKey: getEnv('S3_SECRET_KEY', ''),
  cloudinaryCloudName: getEnv('CLOUDINARY_CLOUD_NAME', ''),
  cloudinaryApiKey: getEnv('CLOUDINARY_API_KEY', ''),
  cloudinaryApiSecret: getEnv('CLOUDINARY_API_SECRET', ''),
};

// Product Configuration
export const product = {
  defaultImageUrl: getEnv('DEFAULT_PRODUCT_IMAGE', '/images/placeholder.png'),
  imagesPerProduct: getNumberEnv('IMAGES_PER_PRODUCT', 5),
  taxRate: getNumberEnv('TAX_RATE', 18), // Tax rate in percentage
  pageSizeOptions: [10, 20, 50, 100],
  defaultPageSize: getNumberEnv('DEFAULT_PAGE_SIZE', 20),
  enabledReviews: getBooleanEnv('ENABLED_REVIEWS', true),
  requirePurchaseForReview: getBooleanEnv('REQUIRE_PURCHASE_FOR_REVIEW', false),
  autoApproveReviews: getBooleanEnv('AUTO_APPROVE_REVIEWS', getEnv('NODE_ENV', 'development') !== 'production'),
};

// Shipping Configuration
export const shipping = {
  methods: [
    {
      id: 'standard',
      name: getEnv('STANDARD_SHIPPING_NAME', 'Standard Shipping'),
      description: getEnv('STANDARD_SHIPPING_DESCRIPTION', 'Delivery in 3-5 business days'),
      price: getNumberEnv('STANDARD_SHIPPING_PRICE', 50),
      estimatedDays: getNumberEnv('STANDARD_SHIPPING_DAYS', 5),
    },
    {
      id: 'express',
      name: getEnv('EXPRESS_SHIPPING_NAME', 'Express Shipping'),
      description: getEnv('EXPRESS_SHIPPING_DESCRIPTION', 'Delivery in 1-2 business days'),
      price: getNumberEnv('EXPRESS_SHIPPING_PRICE', 150),
      estimatedDays: getNumberEnv('EXPRESS_SHIPPING_DAYS', 2),
    },
  ],
  freeShippingThreshold: getNumberEnv('FREE_SHIPPING_THRESHOLD', 500),
  defaultShippingMethod: getEnv('DEFAULT_SHIPPING_METHOD', 'standard'),
  calculateShippingByWeight: getBooleanEnv('CALCULATE_SHIPPING_BY_WEIGHT', false),
  baseShippingRate: getNumberEnv('BASE_SHIPPING_RATE', 50),
  weightMultiplier: getNumberEnv('WEIGHT_SHIPPING_MULTIPLIER', 10),
};

// Image Cleanup Configuration
export const imageCleanup = {
  enabled: getBooleanEnv('IMAGE_CLEANUP_ENABLED', true),
  retentionHours: getNumberEnv('IMAGE_CLEANUP_RETENTION_HOURS', 24),
  schedule: getEnv('IMAGE_CLEANUP_SCHEDULE', '0 * * * *'), // Hourly
};

// The complete config object combining all values
const config = {
  server,
  database,
  auth,
  payment,
  email,
  storage,
  product,
  shipping,
  imageCleanup,
};

export default config;
