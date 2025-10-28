import mongoose, { Document, Model } from 'mongoose';

export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  type: 'order' | 'product' | 'account' | 'promotion' | 'system' | 'review' | 'wishlist';
  title: string;
  message: string;
  relatedId?: mongoose.Types.ObjectId;
  relatedType?: 'Order' | 'Product' | 'Review' | 'Coupon';
  actionUrl?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isRead: boolean;
  readAt?: Date;
  metadata?: Record<string, any>;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Instance methods
  markAsRead(): Promise<this>;
}

export interface INotificationModel extends Model<INotification> {
  // Static methods
  createNotification(data: Partial<INotification>): Promise<INotification>;
  markMultipleAsRead(userId: mongoose.Types.ObjectId, notificationIds: mongoose.Types.ObjectId[]): Promise<any>;
  markAllAsRead(userId: mongoose.Types.ObjectId): Promise<any>;
  getUnreadCount(userId: mongoose.Types.ObjectId): Promise<number>;
  countUnread(userId: mongoose.Types.ObjectId): Promise<number>;
  cleanupOldNotifications(daysOld?: number): Promise<any>;
  cleanupExpiredNotifications(): Promise<any>;
}

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['order', 'product', 'account', 'promotion', 'system', 'review', 'wishlist'],
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedType',
  },
  relatedType: {
    type: String,
    enum: ['Order', 'Product', 'Review', 'Coupon'],
  },
  actionUrl: {
    type: String,
    trim: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
  expiresAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1, isRead: 1 });
notificationSchema.index({ user: 1, priority: 1, isRead: 1 });

// TTL index to automatically delete expired notifications
notificationSchema.index({ expiresAt: 1 }, { 
  expireAfterSeconds: 0,
  partialFilterExpression: { expiresAt: { $exists: true } }
});

// Method to mark as read
notificationSchema.methods.markAsRead = async function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Static method to create notification
notificationSchema.statics.createNotification = async function(data: Partial<INotification>) {
  return this.create(data);
};

// Static method to mark multiple as read
notificationSchema.statics.markMultipleAsRead = async function(
  userId: mongoose.Types.ObjectId,
  notificationIds: mongoose.Types.ObjectId[]
) {
  return this.updateMany(
    { _id: { $in: notificationIds }, user: userId },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

// Static method to mark all as read for user
notificationSchema.statics.markAllAsRead = async function(userId: mongoose.Types.ObjectId) {
  return this.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId: mongoose.Types.ObjectId) {
  return this.countDocuments({ user: userId, isRead: false });
};

// Static method to delete old read notifications
notificationSchema.statics.cleanupOldNotifications = async function(daysOld: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    isRead: true,
    readAt: { $lt: cutoffDate }
  });
};

// Static method to count unread (alias for getUnreadCount)
notificationSchema.statics.countUnread = async function(userId: mongoose.Types.ObjectId) {
  return this.countDocuments({ user: userId, isRead: false });
};

// Static method to cleanup expired notifications
notificationSchema.statics.cleanupExpiredNotifications = async function() {
  const now = new Date();
  return this.deleteMany({
    expiresAt: { $lt: now, $exists: true }
  });
};

export const Notification = mongoose.model<INotification, INotificationModel>('Notification', notificationSchema);
