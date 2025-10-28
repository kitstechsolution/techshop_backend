import express from 'express';
import {
  getProductCustomizationOptions,
  calculateCustomizationPrice,
  validateCustomizationOptions,
  getVariantByCombination,
} from '../controllers/customizationController.js';

const router = express.Router();

// All routes are public
router.get('/products/:productId', getProductCustomizationOptions);
router.post('/products/:productId/calculate-price', calculateCustomizationPrice);
router.post('/products/:productId/validate', validateCustomizationOptions);
router.post('/products/:productId/variant', getVariantByCombination);

export default router;
