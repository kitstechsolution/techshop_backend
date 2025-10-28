import { Request, Response } from 'express';
import { CancelRequest } from '../models/CancelRequest.js';
import { RefundRequest } from '../models/RefundRequest.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

/**
 * @api {get} /api/admin/cancel-requests Get All Cancel Requests
 * @apiName AdminGetCancelRequests
 * @apiGroup AdminCancelRefund
 * @apiPermission admin
 */
export const getAllCancelRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};
    if (status) {
      query.status = status;
    }

    const [requests, total] = await Promise.all([
      CancelRequest.find(query)
        .populate('order', 'orderNumber total status')
        .populate('user', 'firstName lastName email')
        .populate('reviewedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      CancelRequest.countDocuments(query)
    ]);

    res.json({
      cancelRequests: requests,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalRequests: total,
        limit: limitNum
      }
    });
  } catch (error) {
    logger.error('Error getting cancel requests:', error);
    res.status(500).json({ error: 'Failed to get cancel requests' });
  }
};

/**
 * @api {get} /api/admin/refund-requests Get All Refund Requests
 * @apiName AdminGetRefundRequests
 * @apiGroup AdminCancelRefund
 * @apiPermission admin
 */
export const getAllRefundRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, returnStatus, page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};
    if (status) {
      query.status = status;
    }
    if (returnStatus) {
      query.returnStatus = returnStatus;
    }

    const [requests, total] = await Promise.all([
      RefundRequest.find(query)
        .populate('order', 'orderNumber total status')
        .populate('user', 'firstName lastName email')
        .populate('reviewedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      RefundRequest.countDocuments(query)
    ]);

    res.json({
      refundRequests: requests,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalRequests: total,
        limit: limitNum
      }
    });
  } catch (error) {
    logger.error('Error getting refund requests:', error);
    res.status(500).json({ error: 'Failed to get refund requests' });
  }
};

/**
 * @api {patch} /api/admin/cancel-requests/:id/approve Approve Cancel Request
 * @apiName ApproveCancelRequest
 * @apiGroup AdminCancelRefund
 * @apiPermission admin
 */
export const approveCancelRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?._id;
    const { id } = req.params;
    const { adminNotes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid request ID' });
      return;
    }

    const cancelRequest = await CancelRequest.findById(id).populate('order');

    if (!cancelRequest) {
      res.status(404).json({ error: 'Cancel request not found' });
      return;
    }

    if (cancelRequest.status !== 'pending') {
      res.status(400).json({ 
        error: 'Only pending requests can be approved',
        currentStatus: cancelRequest.status
      });
      return;
    }

    // Update cancel request
    cancelRequest.status = 'approved';
    cancelRequest.reviewedBy = adminId;
    cancelRequest.reviewedAt = new Date();
    cancelRequest.adminNotes = adminNotes;
    cancelRequest.refundStatus = 'processing';
    await cancelRequest.save();

    // Update order status
    const Order = mongoose.model('Order');
    await Order.findByIdAndUpdate(cancelRequest.order, {
      status: 'cancelled'
    });

    res.json({
      message: 'Cancel request approved successfully',
      cancelRequest
    });
  } catch (error) {
    logger.error('Error approving cancel request:', error);
    res.status(500).json({ error: 'Failed to approve cancel request' });
  }
};

/**
 * @api {patch} /api/admin/cancel-requests/:id/reject Reject Cancel Request
 * @apiName RejectCancelRequest
 * @apiGroup AdminCancelRefund
 * @apiPermission admin
 */
export const rejectCancelRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?._id;
    const { id } = req.params;
    const { adminNotes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid request ID' });
      return;
    }

    if (!adminNotes) {
      res.status(400).json({ error: 'Admin notes are required for rejection' });
      return;
    }

    const cancelRequest = await CancelRequest.findById(id);

    if (!cancelRequest) {
      res.status(404).json({ error: 'Cancel request not found' });
      return;
    }

    if (cancelRequest.status !== 'pending') {
      res.status(400).json({ 
        error: 'Only pending requests can be rejected',
        currentStatus: cancelRequest.status
      });
      return;
    }

    cancelRequest.status = 'rejected';
    cancelRequest.reviewedBy = adminId;
    cancelRequest.reviewedAt = new Date();
    cancelRequest.adminNotes = adminNotes;
    await cancelRequest.save();

    res.json({
      message: 'Cancel request rejected',
      cancelRequest
    });
  } catch (error) {
    logger.error('Error rejecting cancel request:', error);
    res.status(500).json({ error: 'Failed to reject cancel request' });
  }
};

/**
 * @api {patch} /api/admin/refund-requests/:id/approve Approve Refund Request
 * @apiName ApproveRefundRequest
 * @apiGroup AdminCancelRefund
 * @apiPermission admin
 */
export const approveRefundRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?._id;
    const { id } = req.params;
    const { adminNotes, approvedAmount, refundMethod, returnRequired } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid request ID' });
      return;
    }

    const refundRequest = await RefundRequest.findById(id).populate('order');

    if (!refundRequest) {
      res.status(404).json({ error: 'Refund request not found' });
      return;
    }

    if (refundRequest.status !== 'pending') {
      res.status(400).json({ 
        error: 'Only pending requests can be approved',
        currentStatus: refundRequest.status
      });
      return;
    }

    // Update refund request
    refundRequest.status = 'approved';
    refundRequest.reviewedBy = adminId;
    refundRequest.reviewedAt = new Date();
    refundRequest.adminNotes = adminNotes;
    refundRequest.approvedAmount = approvedAmount || refundRequest.requestedAmount;
    refundRequest.refundMethod = refundMethod || 'original_payment';
    refundRequest.refundStatus = 'processing';
    
    if (returnRequired !== undefined) {
      refundRequest.returnRequired = returnRequired;
      refundRequest.returnStatus = returnRequired ? 'pending' : 'not_required';
    }

    await refundRequest.save();

    res.json({
      message: 'Refund request approved successfully',
      refundRequest
    });
  } catch (error) {
    logger.error('Error approving refund request:', error);
    res.status(500).json({ error: 'Failed to approve refund request' });
  }
};

/**
 * @api {patch} /api/admin/refund-requests/:id/reject Reject Refund Request
 * @apiName RejectRefundRequest
 * @apiGroup AdminCancelRefund
 * @apiPermission admin
 */
export const rejectRefundRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?._id;
    const { id } = req.params;
    const { adminNotes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid request ID' });
      return;
    }

    if (!adminNotes) {
      res.status(400).json({ error: 'Admin notes are required for rejection' });
      return;
    }

    const refundRequest = await RefundRequest.findById(id);

    if (!refundRequest) {
      res.status(404).json({ error: 'Refund request not found' });
      return;
    }

    if (refundRequest.status !== 'pending') {
      res.status(400).json({ 
        error: 'Only pending requests can be rejected',
        currentStatus: refundRequest.status
      });
      return;
    }

    refundRequest.status = 'rejected';
    refundRequest.reviewedBy = adminId;
    refundRequest.reviewedAt = new Date();
    refundRequest.adminNotes = adminNotes;
    await refundRequest.save();

    res.json({
      message: 'Refund request rejected',
      refundRequest
    });
  } catch (error) {
    logger.error('Error rejecting refund request:', error);
    res.status(500).json({ error: 'Failed to reject refund request' });
  }
};

/**
 * @api {patch} /api/admin/refund-requests/:id/complete Complete Refund
 * @apiName CompleteRefund
 * @apiGroup AdminCancelRefund
 * @apiPermission admin
 */
export const completeRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { refundReference } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid request ID' });
      return;
    }

    const refundRequest = await RefundRequest.findById(id);

    if (!refundRequest) {
      res.status(404).json({ error: 'Refund request not found' });
      return;
    }

    if (refundRequest.status !== 'approved') {
      res.status(400).json({ error: 'Only approved requests can be completed' });
      return;
    }

    refundRequest.status = 'completed';
    refundRequest.refundStatus = 'completed';
    refundRequest.refundReference = refundReference;
    await refundRequest.save();

    res.json({
      message: 'Refund completed successfully',
      refundRequest
    });
  } catch (error) {
    logger.error('Error completing refund:', error);
    res.status(500).json({ error: 'Failed to complete refund' });
  }
};

/**
 * @api {patch} /api/admin/refund-requests/:id/return-status Update Return Status
 * @apiName UpdateReturnStatus
 * @apiGroup AdminCancelRefund
 * @apiPermission admin
 */
export const updateReturnStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { returnStatus, returnTrackingId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid request ID' });
      return;
    }

    const refundRequest = await RefundRequest.findById(id);

    if (!refundRequest) {
      res.status(404).json({ error: 'Refund request not found' });
      return;
    }

    if (returnStatus) {
      refundRequest.returnStatus = returnStatus;
    }
    if (returnTrackingId) {
      refundRequest.returnTrackingId = returnTrackingId;
    }

    await refundRequest.save();

    res.json({
      message: 'Return status updated successfully',
      refundRequest
    });
  } catch (error) {
    logger.error('Error updating return status:', error);
    res.status(500).json({ error: 'Failed to update return status' });
  }
};
