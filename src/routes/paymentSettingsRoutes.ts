import express from 'express';
import {
  getPaymentSettings,
  getGatewayConfig,
  getEnabledGateways,
  updateGatewayConfig,
  enableGateway,
  disableGateway,
  setDefaultGateway,
  updateGlobalSettings,
  getPaymentHistory,
  testGatewayConnection,
  deleteGateway
} from '../controllers/paymentSettingsController.js';
import { adminAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes (no authentication required)
// These routes allow the frontend to fetch payment configuration
router.get('/gateways', getEnabledGateways);
router.get('/config/:gatewayId', getGatewayConfig);

// Admin routes (protected with authentication middleware)
// Payment settings management
router.get('/admin/settings', adminAuth, getPaymentSettings);
router.put('/admin/settings/global', adminAuth, updateGlobalSettings);

// Gateway management
router.put('/admin/gateway/:gatewayId', adminAuth, updateGatewayConfig);
router.post('/admin/gateway/:gatewayId/enable', adminAuth, enableGateway);
router.post('/admin/gateway/:gatewayId/disable', adminAuth, disableGateway);
router.post('/admin/gateway/:gatewayId/set-default', adminAuth, setDefaultGateway);
router.post('/admin/gateway/:gatewayId/test', adminAuth, testGatewayConnection);
router.delete('/admin/gateway/:gatewayId', adminAuth, deleteGateway);

// Payment history
router.get('/admin/history', adminAuth, getPaymentHistory);

export default router;
