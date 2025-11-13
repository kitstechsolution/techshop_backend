import express from 'express';
import { 
  register, 
  login, 
  getProfile, 
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword
} from '../controllers/authController.js';
import { auth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { 
  authRegisterSchema,
  authLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validation/schemas.js';

const router = express.Router();

// Public routes with validation
router.post('/register', validateBody(authRegisterSchema), register);
router.post('/login', validateBody(authLoginSchema), login);
router.post('/forgot-password', validateBody(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), resetPassword);

// Protected routes
router.get('/profile', auth, getProfile);
router.patch('/profile', auth, updateProfile);
router.post('/change-password', auth, changePassword);

export default router; 