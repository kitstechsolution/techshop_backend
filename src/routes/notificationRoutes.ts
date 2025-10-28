import express from 'express';
import {
  getNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteReadNotifications,
  getUnreadCount,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Notification preferences routes (must be before :id routes)
router.route('/preferences')
  .get(getNotificationPreferences)
  .put(updateNotificationPreferences);

// Mark all as read (must be before :id routes)
router.patch('/read-all', markAllNotificationsAsRead);

// Delete all read notifications (must be before :id routes)
router.delete('/read', deleteReadNotifications);

// Get unread count (must be before :id routes)
router.get('/unread/count', getUnreadCount);

// Get all notifications
router.get('/', getNotifications);

// Single notification routes
router.route('/:id')
  .get(getNotificationById)
  .delete(deleteNotification);

// Mark notification as read
router.patch('/:id/read', markNotificationAsRead);

export default router;
