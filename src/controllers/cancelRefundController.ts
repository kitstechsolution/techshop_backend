import { Request, Response } from 'express';
import { CancelRequest } from '../models/CancelRequest.js';
import { RefundRequest } from '../models/RefundRequest.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

/**
 * @api {post} /api/cancel-requests Create Cancel Request
 * @apiName CreateCancelRequest
 * @apiGroup CancelRefund
 * @apiPermission user
 * 
 * @apiBody {String} orderId Order ID to cancel
 * @apiBody {String} reason Cancellation reason
 * @apiBody {String} [additionalDetails] Additional details
 * @apiSuccess {Object} cancelRequest Created cancel request
 */
export const createCancelRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { orderId, reason, additionalDetails } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!orderId || !reason) {
      res.status(400).json({ error: 'Order ID and reason are required' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }

    // Check if order exists and belongs to user
    const Order = mongoose.model('Order');
    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Check order status - can only cancel pending or confirmed orders
    if (!['pending', 'confirmed', 'processing'].includes((order as any).status)) {
      res.status(400).json({ 
        error: 'Order cannot be cancelled at this stage',
        currentStatus: (order as any).status
      });
      return;
    }

    // Check if cancel request already exists
    const existingRequest = await CancelRequest.findOne({
      order: orderId,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingRequest) {
      res.status(400).json({ 
        error: 'A cancel request already exists for this order',
        existingRequest
      });
      return;
    }

    // Create cancel request
    const cancelRequest = await CancelRequest.create({
      order: orderId,
      user: userId,
      reason,
      additionalDetails,
      refundAmount: (order as any).total
    });

    const populatedRequest = await CancelRequest.findById(cancelRequest._id)
      .populate('order', 'orderNumber total status')
      .populate('user', 'firstName lastName email');

    res.status(201).json({
      message: 'Cancel request created successfully',
      cancelRequest: populatedRequest
    });
  } catch (error: any) {
    logger.error('Error creating cancel request:', error);
    
    if (error.code === 11000) {
      res.status(400).json({ error: 'A cancel request already exists for this order' });
    } else {
      res.status(500).json({ error: 'Failed to create cancel request' });
    }
  }
};

/**
 * @api {post} /api/refund-requests Create Refund Request
 * @apiName CreateRefundRequest
 * @apiGroup CancelRefund
 * @apiPermission user
 * 
 * @apiBody {String} orderId Order ID for refund
 * @apiBody {String} reason Refund reason
 * @apiBody {String} refundType Type (full or partial)
 * @apiBody {Number} [requestedAmount] Amount for partial refund
 * @apiBody {String} [additionalDetails] Additional details
 * @apiBody {Array} [images] Supporting images
 * @apiSuccess {Object} refundRequest Created refund request
 */
export const createRefundRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { 
      orderId, 
      reason, 
      refundType, 
      requestedAmount, 
      additionalDetails, 
      images 
    } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!orderId || !reason || !refundType) {
      res.status(400).json({ error: 'Order ID, reason, and refund type are required' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }

    // Check if order exists and belongs to user
    const Order = mongoose.model('Order');
    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Check order status - can only refund delivered orders
    if ((order as any).status !== 'delivered') {
      res.status(400).json({ 
        error: 'Refund can only be requested for delivered orders',
        currentStatus: (order as any).status
      });
      return;
    }

    // Validate requested amount for partial refunds
    if (refundType === 'partial') {
      if (!requestedAmount || requestedAmount <= 0) {
        res.status(400).json({ error: 'Requested amount is required for partial refunds' });
        return;
      }
      if (requestedAmount > (order as any).total) {
        res.status(400).json({ error: 'Requested amount cannot exceed order total' });
        return;
      }
    }

    // Check if refund request already exists
    const existingRequest = await RefundRequest.findOne({
      order: orderId,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingRequest) {
      res.status(400).json({ 
        error: 'A refund request already exists for this order',
        existingRequest
      });
      return;
    }

    // Create refund request
    const refundRequest = await RefundRequest.create({
      order: orderId,
      user: userId,
      reason,
      refundType,
      requestedAmount: refundType === 'full' ? (order as any).total : requestedAmount,
      additionalDetails,
      images: images || [],
      returnRequired: true,
      returnStatus: 'pending'
    });

    const populatedRequest = await RefundRequest.findById(refundRequest._id)
      .populate('order', 'orderNumber total status')
      .populate('user', 'firstName lastName email');

    res.status(201).json({
      message: 'Refund request created successfully',
      refundRequest: populatedRequest
    });
  } catch (error: any) {
    logger.error('Error creating refund request:', error);
    
    if (error.code === 11000) {
      res.status(400).json({ error: 'A refund request already exists for this order' });
    } else {
      res.status(500).json({ error: 'Failed to create refund request' });
    }
  }
};

/**
 * @api {get} /api/cancel-requests Get User's Cancel Requests
 * @apiName GetCancelRequests
 * @apiGroup CancelRefund
 * @apiPermission user
 * 
 * @apiQuery {String} [status] Filter by status
 * @apiSuccess {Array} cancelRequests List of cancel requests
 */
export const getCancelRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { status } = req.query;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const query: any = { user: userId };
    if (status) {
      query.status = status;
    }

    const cancelRequests = await CancelRequest.find(query)
      .populate('order', 'orderNumber total status createdAt')
      .sort({ createdAt: -1 });

    res.json({ cancelRequests });
  } catch (error) {
    logger.error('Error getting cancel requests:', error);
    res.status(500).json({ error: 'Failed to get cancel requests' });
  }
};

/**
 * @api {get} /api/refund-requests Get User's Refund Requests
 * @apiName GetRefundRequests
 * @apiGroup CancelRefund
 * @apiPermission user
 * 
 * @apiQuery {String} [status] Filter by status
 * @apiSuccess {Array} refundRequests List of refund requests
 */
export const getRefundRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { status } = req.query;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const query: any = { user: userId };
    if (status) {
      query.status = status;
    }

    const refundRequests = await RefundRequest.find(query)
      .populate('order', 'orderNumber total status createdAt')
      .sort({ createdAt: -1 });

    res.json({ refundRequests });
  } catch (error) {
    logger.error('Error getting refund requests:', error);
    res.status(500).json({ error: 'Failed to get refund requests' });
  }
};

/**
 * @api {get} /api/cancel-requests/:id Get Cancel Request Details
 * @apiName GetCancelRequestById
 * @apiGroup CancelRefund
 * @apiPermission user
 * 
 * @apiParam {String} id Cancel request ID
 * @apiSuccess {Object} cancelRequest Cancel request details
 */
export const getCancelRequestById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid request ID' });
      return;
    }

    const cancelRequest = await CancelRequest.findOne({ _id: id, user: userId })
      .populate('order')
      .populate('reviewedBy', 'firstName lastName');

    if (!cancelRequest) {
      res.status(404).json({ error: 'Cancel request not found' });
      return;
    }

    res.json({ cancelRequest });
  } catch (error) {
    logger.error('Error getting cancel request:', error);
    res.status(500).json({ error: 'Failed to get cancel request' });
  }
};

/**
 * @api {get} /api/refund-requests/:id Get Refund Request Details
 * @apiName GetRefundRequestById
 * @apiGroup CancelRefund
 * @apiPermission user
 * 
 * @apiParam {String} id Refund request ID
 * @apiSuccess {Object} refundRequest Refund request details
 */
export const getRefundRequestById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid request ID' });
      return;
    }

    const refundRequest = await RefundRequest.findOne({ _id: id, user: userId })
      .populate('order')
      .populate('reviewedBy', 'firstName lastName');

    if (!refundRequest) {
      res.status(404).json({ error: 'Refund request not found' });
      return;
    }

    res.json({ refundRequest });
  } catch (error) {
    logger.error('Error getting refund request:', error);
    res.status(500).json({ error: 'Failed to get refund request' });
  }
};

// Admin endpoints will be added to adminController
