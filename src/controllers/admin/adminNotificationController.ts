import { Response } from 'express';
import { Notification } from '../../models/Notification.js';
import { User } from '../../models/User.js';
import { AuthRequest } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import { createBulkNotification } from '../../services/notificationService.js';
import mongoose from 'mongoose';

// @desc    Get all notifications (admin view)
// @route   GET /api/admin/notifications
// @access  Private/Admin
export const getAllNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    
    // Filter options
    const userId = req.query.userId as string;
    const type = req.query.type as string;
    const priority = req.query.priority as string;
    const isRead = req.query.isRead as string;
    
    // Build query
    const query: any = {};
    
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.user = userId;
    }
    
    if (type) {
      query.type = type;
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }
    
    // Get notifications with user details
    const notifications = await Notification.find(query)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Notification.countDocuments(query);
    
    // Get statistics
    const stats = await Notification.aggregate([
      {
        $group: {
          _id: null,
          totalNotifications: { $sum: 1 },
          unreadNotifications: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] },
          },
          urgentNotifications: {
            $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] },
          },
        },
      },
    ]);
    
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
        stats: stats[0] || {
          totalNotifications: 0,
          unreadNotifications: 0,
          urgentNotifications: 0,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching all notifications (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
    });
  }
};

// @desc    Create bulk notification for all users
// @route   POST /api/admin/notifications/bulk
// @access  Private/Admin
export const createBulkNotificationForAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const {
      type,
      title,
      message,
      actionUrl,
      priority,
      metadata,
      expiresAt,
      userFilter, // Optional: filter users by specific criteria
    } = req.body;
    
    // Validation
    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Type, title, and message are required',
      });
    }
    
    // Get users based on filter or all users
    const query: any = {};
    
    if (userFilter) {
      // Filter by verified users only
      if (userFilter.verifiedOnly) {
        query.isVerified = true;
      }
      
      // Filter by active users (logged in within last 30 days)
      if (userFilter.activeOnly) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query.lastLogin = { $gte: thirtyDaysAgo };
      }
      
      // Filter by user role
      if (userFilter.role) {
        query.role = userFilter.role;
      }
    }
    
    // Fetch user IDs
    const users = await User.find(query).select('_id').lean();
    const userIds = users.map(user => user._id);
    
    if (userIds.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No users found matching the criteria',
      });
    }
    
    // Create bulk notification
    const success = await createBulkNotification(userIds, {
      type,
      title,
      message,
      actionUrl,
      priority: priority || 'medium',
      metadata,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create bulk notification',
      });
    }
    
    logger.info(`Admin ${req.user?.id} created bulk notification for ${userIds.length} users`);
    
    res.status(201).json({
      success: true,
      message: `Notification created for ${userIds.length} users`,
      data: {
        recipientCount: userIds.length,
        type,
        title,
      },
    });
  } catch (error) {
    logger.error('Error creating bulk notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating bulk notification',
    });
  }
};

// @desc    Create notification for specific users
// @route   POST /api/admin/notifications/specific
// @access  Private/Admin
export const createNotificationForSpecificUsers = async (req: AuthRequest, res: Response) => {
  try {
    const {
      userIds,
      type,
      title,
      message,
      actionUrl,
      priority,
      metadata,
      expiresAt,
    } = req.body;
    
    // Validation
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required',
      });
    }
    
    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Type, title, and message are required',
      });
    }
    
    // Validate user IDs
    const validUserIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validUserIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid user IDs provided',
      });
    }
    
    // Verify users exist
    const existingUsers = await User.find({ _id: { $in: validUserIds } }).select('_id').lean();
    const existingUserIds = existingUsers.map(user => user._id);
    
    if (existingUserIds.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No users found with provided IDs',
      });
    }
    
    // Create bulk notification
    const success = await createBulkNotification(existingUserIds, {
      type,
      title,
      message,
      actionUrl,
      priority: priority || 'medium',
      metadata,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create notifications',
      });
    }
    
    logger.info(`Admin ${req.user?.id} created notification for ${existingUserIds.length} specific users`);
    
    res.status(201).json({
      success: true,
      message: `Notification created for ${existingUserIds.length} users`,
      data: {
        recipientCount: existingUserIds.length,
        type,
        title,
      },
    });
  } catch (error) {
    logger.error('Error creating notification for specific users:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating notifications',
    });
  }
};

// @desc    Delete notification by ID (admin)
// @route   DELETE /api/admin/notifications/:id
// @access  Private/Admin
export const deleteNotificationById = async (req: AuthRequest, res: Response) => {
  try {
    const notificationId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID',
      });
    }
    
    const notification = await Notification.findByIdAndDelete(notificationId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }
    
    logger.info(`Admin ${req.user?.id} deleted notification ${notificationId}`);
    
    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting notification (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notification',
    });
  }
};

// @desc    Delete expired notifications
// @route   DELETE /api/admin/notifications/expired
// @access  Private/Admin
export const deleteExpiredNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const result = await Notification.cleanupExpiredNotifications();
    
    logger.info(`Admin ${req.user?.id} deleted ${result.deletedCount} expired notifications`);
    
    res.status(200).json({
      success: true,
      message: `${result.deletedCount} expired notifications deleted`,
      data: {
        deletedCount: result.deletedCount,
      },
    });
  } catch (error) {
    logger.error('Error deleting expired notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting expired notifications',
    });
  }
};

// @desc    Get notification statistics
// @route   GET /api/admin/notifications/stats
// @access  Private/Admin
export const getNotificationStatistics = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await Notification.aggregate([
      {
        $facet: {
          totalStats: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
                read: { $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] } },
              },
            },
          ],
          byType: [
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 },
              },
            },
          ],
          byPriority: [
            {
              $group: {
                _id: '$priority',
                count: { $sum: 1 },
              },
            },
          ],
          recentActivity: [
            {
              $match: {
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        total: stats[0].totalStats[0] || { total: 0, unread: 0, read: 0 },
        byType: stats[0].byType,
        byPriority: stats[0].byPriority,
        recentActivity: stats[0].recentActivity,
      },
    });
  } catch (error) {
    logger.error('Error fetching notification statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
    });
  }
};

export default {
  getAllNotifications,
  createBulkNotificationForAllUsers,
  createNotificationForSpecificUsers,
  deleteNotificationById,
  deleteExpiredNotifications,
  getNotificationStatistics,
};
