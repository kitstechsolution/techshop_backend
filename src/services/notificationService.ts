import { Notification } from '../models/Notification.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

interface CreateNotificationParams {
  userId: mongoose.Types.ObjectId;
  type: 'order' | 'product' | 'account' | 'promotion' | 'system' | 'review' | 'wishlist';
  title: string;
  message: string;
  relatedId?: mongoose.Types.ObjectId;
  relatedType?: 'Order' | 'Product' | 'Review' | 'Coupon';
  actionUrl?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

// Generic notification creator
export const createNotification = async (params: CreateNotificationParams): Promise<boolean> => {
  try {
    await Notification.create({
      user: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      relatedId: params.relatedId,
      relatedType: params.relatedType,
      actionUrl: params.actionUrl,
      priority: params.priority || 'medium',
      metadata: params.metadata,
      expiresAt: params.expiresAt,
    });
    
    logger.info(`Notification created for user ${params.userId}: ${params.title}`);
    return true;
  } catch (error) {
    logger.error('Error creating notification:', error);
    return false;
  }
};

// Order-related notifications
export const notifyOrderPlaced = async (
  userId: mongoose.Types.ObjectId,
  orderId: mongoose.Types.ObjectId,
  orderNumber: string
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'order',
    title: 'Order Placed Successfully',
    message: `Your order ${orderNumber} has been placed and is being processed.`,
    relatedId: orderId,
    relatedType: 'Order',
    actionUrl: `/orders/${orderNumber}`,
    priority: 'high',
  });
};

export const notifyOrderShipped = async (
  userId: mongoose.Types.ObjectId,
  orderId: mongoose.Types.ObjectId,
  orderNumber: string,
  trackingNumber?: string
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'order',
    title: 'Order Shipped',
    message: `Your order ${orderNumber} has been shipped${trackingNumber ? ` with tracking number ${trackingNumber}` : ''}.`,
    relatedId: orderId,
    relatedType: 'Order',
    actionUrl: `/orders/${orderNumber}`,
    priority: 'high',
    metadata: { trackingNumber },
  });
};

export const notifyOrderDelivered = async (
  userId: mongoose.Types.ObjectId,
  orderId: mongoose.Types.ObjectId,
  orderNumber: string
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'order',
    title: 'Order Delivered',
    message: `Your order ${orderNumber} has been delivered. We hope you love it!`,
    relatedId: orderId,
    relatedType: 'Order',
    actionUrl: `/orders/${orderNumber}/review`,
    priority: 'medium',
  });
};

export const notifyOrderCancelled = async (
  userId: mongoose.Types.ObjectId,
  orderId: mongoose.Types.ObjectId,
  orderNumber: string
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'order',
    title: 'Order Cancelled',
    message: `Your order ${orderNumber} has been cancelled. Refund will be processed within 5-7 business days.`,
    relatedId: orderId,
    relatedType: 'Order',
    actionUrl: `/orders/${orderNumber}`,
    priority: 'high',
  });
};

// Cancel/Refund notifications
export const notifyCancelRequestApproved = async (
  userId: mongoose.Types.ObjectId,
  orderId: mongoose.Types.ObjectId,
  orderNumber: string
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'order',
    title: 'Cancellation Approved',
    message: `Your cancellation request for order ${orderNumber} has been approved.`,
    relatedId: orderId,
    relatedType: 'Order',
    actionUrl: `/orders/${orderNumber}`,
    priority: 'high',
  });
};

export const notifyCancelRequestRejected = async (
  userId: mongoose.Types.ObjectId,
  orderId: mongoose.Types.ObjectId,
  orderNumber: string
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'order',
    title: 'Cancellation Rejected',
    message: `Your cancellation request for order ${orderNumber} has been rejected.`,
    relatedId: orderId,
    relatedType: 'Order',
    actionUrl: `/orders/${orderNumber}`,
    priority: 'high',
  });
};

export const notifyRefundApproved = async (
  userId: mongoose.Types.ObjectId,
  orderId: mongoose.Types.ObjectId,
  orderNumber: string,
  amount: number
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'order',
    title: 'Refund Approved',
    message: `Your refund request for ₹${amount.toFixed(2)} has been approved for order ${orderNumber}.`,
    relatedId: orderId,
    relatedType: 'Order',
    actionUrl: `/orders/${orderNumber}`,
    priority: 'high',
    metadata: { amount },
  });
};

export const notifyRefundCompleted = async (
  userId: mongoose.Types.ObjectId,
  orderId: mongoose.Types.ObjectId,
  orderNumber: string,
  amount: number
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'order',
    title: 'Refund Completed',
    message: `Your refund of ₹${amount.toFixed(2)} for order ${orderNumber} has been processed.`,
    relatedId: orderId,
    relatedType: 'Order',
    actionUrl: `/orders/${orderNumber}`,
    priority: 'high',
    metadata: { amount },
  });
};

// Product notifications
export const notifyPriceDropWishlist = async (
  userId: mongoose.Types.ObjectId,
  productId: mongoose.Types.ObjectId,
  productName: string,
  oldPrice: number,
  newPrice: number
): Promise<boolean> => {
  const discount = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
  return createNotification({
    userId,
    type: 'wishlist',
    title: 'Price Drop Alert!',
    message: `${productName} is now ${discount}% off! Price dropped from ₹${oldPrice} to ₹${newPrice}.`,
    relatedId: productId,
    relatedType: 'Product',
    actionUrl: `/products/${productId}`,
    priority: 'medium',
    metadata: { oldPrice, newPrice, discount },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });
};

export const notifyProductBackInStock = async (
  userId: mongoose.Types.ObjectId,
  productId: mongoose.Types.ObjectId,
  productName: string
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'wishlist',
    title: 'Back in Stock!',
    message: `Good news! ${productName} is back in stock. Order now before it's gone again!`,
    relatedId: productId,
    relatedType: 'Product',
    actionUrl: `/products/${productId}`,
    priority: 'high',
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
  });
};

// Review notifications
export const notifyReviewApproved = async (
  userId: mongoose.Types.ObjectId,
  productId: mongoose.Types.ObjectId,
  productName: string
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'review',
    title: 'Review Approved',
    message: `Your review for ${productName} has been approved and is now visible to other customers.`,
    relatedId: productId,
    relatedType: 'Product',
    actionUrl: `/products/${productId}#reviews`,
    priority: 'low',
  });
};

export const notifyReviewRejected = async (
  userId: mongoose.Types.ObjectId,
  productId: mongoose.Types.ObjectId,
  productName: string
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'review',
    title: 'Review Not Approved',
    message: `Your review for ${productName} did not meet our community guidelines.`,
    relatedId: productId,
    relatedType: 'Product',
    actionUrl: `/support`,
    priority: 'low',
  });
};

// Promotion notifications
export const notifyNewCoupon = async (
  userId: mongoose.Types.ObjectId,
  couponCode: string,
  description: string,
  expiryDate: Date
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'promotion',
    title: 'New Coupon Available!',
    message: `Use code ${couponCode}: ${description}. Valid until ${expiryDate.toLocaleDateString()}.`,
    actionUrl: '/coupons',
    priority: 'medium',
    metadata: { couponCode },
    expiresAt: expiryDate,
  });
};

export const notifyFlashSale = async (
  userId: mongoose.Types.ObjectId,
  category: string,
  discount: number,
  endTime: Date
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'promotion',
    title: `Flash Sale: ${discount}% Off!`,
    message: `${discount}% off on ${category}! Hurry, sale ends ${endTime.toLocaleTimeString()}.`,
    actionUrl: `/products?category=${category}&sale=true`,
    priority: 'high',
    metadata: { category, discount },
    expiresAt: endTime,
  });
};

// System notifications
export const notifyAccountUpdate = async (
  userId: mongoose.Types.ObjectId,
  updateType: string
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'account',
    title: 'Account Updated',
    message: `Your ${updateType} has been updated successfully.`,
    actionUrl: '/profile',
    priority: 'low',
  });
};

export const notifyPasswordChanged = async (
  userId: mongoose.Types.ObjectId
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'account',
    title: 'Password Changed',
    message: 'Your password has been changed successfully. If you did not make this change, please contact support immediately.',
    actionUrl: '/support',
    priority: 'urgent',
  });
};

export const notifySystemMaintenance = async (
  userId: mongoose.Types.ObjectId,
  maintenanceTime: Date,
  duration: string
): Promise<boolean> => {
  return createNotification({
    userId,
    type: 'system',
    title: 'Scheduled Maintenance',
    message: `The platform will undergo maintenance on ${maintenanceTime.toLocaleString()} for approximately ${duration}.`,
    priority: 'medium',
    expiresAt: new Date(maintenanceTime.getTime() + 24 * 60 * 60 * 1000),
  });
};

// Bulk notification (for promotions to all users)
export const createBulkNotification = async (
  userIds: mongoose.Types.ObjectId[],
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<boolean> => {
  try {
    const notifications = userIds.map(userId => ({
      user: userId,
      type: params.type,
      title: params.title,
      message: params.message,
      relatedId: params.relatedId,
      relatedType: params.relatedType,
      actionUrl: params.actionUrl,
      priority: params.priority || 'medium',
      metadata: params.metadata,
      expiresAt: params.expiresAt,
    }));

    await Notification.insertMany(notifications);
    logger.info(`Bulk notification created for ${userIds.length} users: ${params.title}`);
    return true;
  } catch (error) {
    logger.error('Error creating bulk notification:', error);
    return false;
  }
};

export default {
  createNotification,
  notifyOrderPlaced,
  notifyOrderShipped,
  notifyOrderDelivered,
  notifyOrderCancelled,
  notifyCancelRequestApproved,
  notifyCancelRequestRejected,
  notifyRefundApproved,
  notifyRefundCompleted,
  notifyPriceDropWishlist,
  notifyProductBackInStock,
  notifyReviewApproved,
  notifyReviewRejected,
  notifyNewCoupon,
  notifyFlashSale,
  notifyAccountUpdate,
  notifyPasswordChanged,
  notifySystemMaintenance,
  createBulkNotification,
};
