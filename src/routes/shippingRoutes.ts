import express from 'express';
import { 
  getShippingSettings,
  updateShippingSettings,
  getShippingRates,
  createShipment,
  trackShipment,
  cancelShipment,
  testShippingProvider,
  processWebhook,
  createReturnShipment,
  getPickupLocations,
  createPickupLocation,
  getShippingAnalytics,
  checkServiceability
} from '../controllers/shippingController.js';
import { adminAuth, auth } from '../middleware/auth.js';

const router = express.Router();

// Public serviceability check
router.get('/serviceability', checkServiceability);

// Admin-only routes for shipping settings
router.get('/settings', adminAuth, getShippingSettings);
router.post('/settings', adminAuth, updateShippingSettings);
router.post('/test-connection/:providerId', adminAuth, testShippingProvider);
router.get('/analytics', adminAuth, getShippingAnalytics);

// Webhook routes (no auth required as they are called by external providers)
router.post('/webhook/:providerId', processWebhook);

// Routes for pickup locations (admin only)
router.get('/pickup-locations/:providerId', adminAuth, getPickupLocations);
router.post('/pickup-locations/:providerId', adminAuth, createPickupLocation);

// Routes for shipping operations (require auth)
router.post('/rates', auth, getShippingRates);
router.post('/shipment', auth, createShipment);
router.post('/return/:providerId/:trackingId', auth, createReturnShipment);
router.get('/track/:providerId/:trackingId', auth, trackShipment);
router.post('/cancel/:providerId/:trackingId', auth, cancelShipment);

export default router; 
