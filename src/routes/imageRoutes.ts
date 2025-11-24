import express from 'express';
import { protect, admin } from '../middleware/auth.js';
import * as imageController from '../controllers/imageController.js';

const router = express.Router();

// Mark images as used (when saving a document)
router.post('/mark-used', protect, imageController.markImagesAsUsed);

// Mark images as unused (when removing from a document)
router.post('/mark-unused', protect, imageController.markImagesAsUnused);

// Get cleanup statistics (admin only)
router.get('/stats', protect, admin, imageController.getCleanupStats);

// Delete a specific image (admin only)
router.delete('/:id', protect, admin, imageController.deleteImage);

// Manually trigger cleanup (admin only)
router.post('/cleanup', protect, admin, imageController.manualCleanup);

export default router;
