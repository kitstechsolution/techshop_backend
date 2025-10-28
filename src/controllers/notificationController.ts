import { Response } from 'express';
import { Notification } from '../models/Notification.js';
import { AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

// @desc    Get user's notifications with pagination
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    // Filter options
    const type = req.query.type as string; // filter by notification type
    const isRead = req.query.isRead as string; // 'true', 'false', or undefined (all)
    const priority = req.query.priority as string; // filter by priority
    
    // Build query
    const query: any = { user: userId };
    
    if (type) {
      query.type = type;
    }
    
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    // Get notifications
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v')
      .lean();
    
    // Get total count for pagination
    const total = await Notification.countDocuments(query);
    
    // Get unread count
    const unreadCount = await Notification.countUnread(userId);
    
    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
        unreadCount,
      },
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
    });
  }
};

// @desc    Get single notification by ID
// @route   GET /api/notifications/:id
// @access  Private
export const getNotificationById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const notificationId = req.params.id;
    
    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID',
      });
    }
    
    const notification = await Notification.findOne({
      _id: notificationId,
      user: userId,
    }).lean();
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    logger.error('Error fetching notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification',
    });
  }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
export const markNotificationAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const notificationId = req.params.id;
    
    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID',
      });
    }
    
    const notification = await Notification.findOne({
      _id: notificationId,
      user: userId,
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }
    
    // Mark as read
    await notification.markAsRead();
    
    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
    });
  }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
export const markAllNotificationsAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    
    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notifications as read',
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const notificationId = req.params.id;
    
    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID',
      });
    }
    
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: userId,
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notification',
    });
  }
};

// @desc    Delete all read notifications
// @route   DELETE /api/notifications/read
// @access  Private
export const deleteReadNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    const result = await Notification.deleteMany({
      user: userId,
      isRead: true,
    });
    
    res.status(200).json({
      success: true,
      message: `${result.deletedCount} read notifications deleted`,
      data: {
        deletedCount: result.deletedCount,
      },
    });
  } catch (error) {
    logger.error('Error deleting read notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notifications',
    });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread/count
// @access  Private
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    const count = await Notification.countUnread(userId);
    
    res.status(200).json({
      success: true,
      data: {
        unreadCount: count,
      },
    });
  } catch (error) {
    logger.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting unread count',
    });
  }
};

// @desc    Get notification preferences
// @route   GET /api/notifications/preferences
// @access  Private
export const getNotificationPreferences = async (req: AuthRequest, res: Response) => {
  try {
    // const userId = req.user?.id; // Will be used when preferences model is implemented
    
    // This would typically fetch from a user preferences table/document
    // For now, returning a default structure
    // TODO: Implement actual user preferences model
    
    res.status(200).json({
      success: true,
      data: {
        emailNotifications: {
          order: true,
          promotion: true,
          account: true,
          review: false,
          wishlist: true,
        },
        pushNotifications: {
          order: true,
          promotion: false,
          account: true,
          review: false,
          wishlist: true,
        },
        inAppNotifications: {
          order: true,
          promotion: true,
          account: true,
          review: true,
          wishlist: true,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification preferences',
    });
  }
};

// @desc    Update notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
export const updateNotificationPreferences = async (req: AuthRequest, res: Response) => {
  try {
    // const userId = req.user?.id; // Will be used when preferences model is implemented
    const { emailNotifications, pushNotifications, inAppNotifications } = req.body;
    
    // TODO: Implement actual user preferences model update
    // For now, just validating the structure
    
    if (!emailNotifications && !pushNotifications && !inAppNotifications) {
      return res.status(400).json({
        success: false,
        message: 'At least one notification preference type is required',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: {
        emailNotifications,
        pushNotifications,
        inAppNotifications,
      },
    });
  } catch (error) {
    logger.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification preferences',
    });
  }
};

export default {
  getNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteReadNotifications,
  getUnreadCount,
  getNotificationPreferences,
  updateNotificationPreferences,
};
