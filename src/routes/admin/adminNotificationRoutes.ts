import express from 'express';
import {
  getAllNotifications,
  createBulkNotificationForAllUsers,
  createNotificationForSpecificUsers,
  deleteNotificationById,
  deleteExpiredNotifications,
  getNotificationStatistics,
} from '../../controllers/admin/adminNotificationController.js';
import { protect, admin } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication and admin middleware to all routes
router.use(protect);
router.use(admin);

// Notification statistics (must be before other routes)
router.get('/stats', getNotificationStatistics);

// Create bulk notifications (must be before :id routes)
router.post('/bulk', createBulkNotificationForAllUsers);
router.post('/specific', createNotificationForSpecificUsers);

// Delete expired notifications (must be before :id routes)
router.delete('/expired', deleteExpiredNotifications);

// Get all notifications and delete by ID
router.route('/')
  .get(getAllNotifications);

router.route('/:id')
  .delete(deleteNotificationById);

export default router;
