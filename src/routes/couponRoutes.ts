import express from 'express';
import {
  validateCoupon,
  getActiveCoupons,
} from '../controllers/couponController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/coupons/validate
 * @desc    Validate a coupon code
 * @access  Private (User)
 */
router.post('/validate', auth, validateCoupon);

/**
 * @route   GET /api/coupons/active
 * @desc    Get list of active coupons
 * @access  Public
 */
router.get('/active', getActiveCoupons);

export default router;
