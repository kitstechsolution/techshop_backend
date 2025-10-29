import express from 'express';
import {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getNotificationPreferences,
  updateNotificationPreferences,
  getUserStats,
  uploadAvatar,
  deleteAccount,
} from '../controllers/userController.js';
import { auth } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    cb(null, uploadsDir);
  },
  filename: (req: any, file: any, cb: any) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter,
});

// All user routes require authentication
router.use(auth);

/**
 * Address Management Routes
 */

// Get all user addresses
router.get('/addresses', getAddresses);

// Add new address
router.post('/addresses', addAddress);

// Update address
router.patch('/addresses/:addressId', updateAddress);

// Delete address
router.delete('/addresses/:addressId', deleteAddress);

// Set default address
router.patch('/addresses/:addressId/default', setDefaultAddress);

/**
 * Notification Preferences Routes
 */

// Get notification preferences
router.get('/notification-preferences', getNotificationPreferences);

// Update notification preferences
router.patch('/notification-preferences', updateNotificationPreferences);

/**
 * User Statistics Route
 */

// Get user statistics
router.get('/stats', getUserStats);

/**
 * Avatar Upload Route
 */

// Upload profile picture (with multer middleware)
router.post('/avatar', upload.single('avatar'), uploadAvatar);

/**
 * Account Deletion Route
 */

// Delete user account
router.delete('/account', deleteAccount);

export default router;
