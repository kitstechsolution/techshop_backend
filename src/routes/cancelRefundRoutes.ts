import express from 'express';
import {
  createCancelRequest,
  createRefundRequest,
  getCancelRequests,
  getRefundRequests,
  getCancelRequestById,
  getRefundRequestById
} from '../controllers/cancelRefundController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

/**
 * @route   POST /api/cancel-requests
 * @desc    Create a cancel request
 * @access  Private
 */
router.post('/cancel-requests', createCancelRequest);

/**
 * @route   POST /api/refund-requests
 * @desc    Create a refund request
 * @access  Private
 */
router.post('/refund-requests', createRefundRequest);

/**
 * @route   GET /api/cancel-requests
 * @desc    Get user's cancel requests
 * @access  Private
 */
router.get('/cancel-requests', getCancelRequests);

/**
 * @route   GET /api/refund-requests
 * @desc    Get user's refund requests
 * @access  Private
 */
router.get('/refund-requests', getRefundRequests);

/**
 * @route   GET /api/cancel-requests/:id
 * @desc    Get cancel request details
 * @access  Private
 */
router.get('/cancel-requests/:id', getCancelRequestById);

/**
 * @route   GET /api/refund-requests/:id
 * @desc    Get refund request details
 * @access  Private
 */
router.get('/refund-requests/:id', getRefundRequestById);

export default router;
