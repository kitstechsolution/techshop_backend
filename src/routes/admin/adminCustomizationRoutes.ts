import express from 'express';
import {
  createOrUpdateCustomization,
  getCustomization,
  getAllCustomizations,
  deleteCustomization,
  toggleCustomization,
  addCustomField,
  updateCustomField,
  deleteCustomField,
  addVariant,
} from '../../controllers/admin/adminCustomizationController.js';
import { protect, admin } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication and admin middleware to all routes
router.use(protect);
router.use(admin);

// Get all customizations
router.get('/', getAllCustomizations);

// Product customization operations
router.route('/:productId')
  .get(getCustomization)
  .post(createOrUpdateCustomization)
  .delete(deleteCustomization);

// Toggle customization
router.patch('/:productId/toggle', toggleCustomization);

// Custom field operations
router.post('/:productId/fields', addCustomField);
router.route('/:productId/fields/:fieldId')
  .put(updateCustomField)
  .delete(deleteCustomField);

// Variant operations
router.post('/:productId/variants', addVariant);

export default router;
