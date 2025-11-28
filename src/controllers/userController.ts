import { Request, Response } from 'express';
import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { Wishlist } from '../models/Wishlist.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';
import { storage as storageCfg } from '../config/config.js';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import UploadedImage from '../models/UploadedImage.js';

// Configure Cloudinary if using cloud storage
if (storageCfg.provider === 'cloudinary') {
  cloudinary.config({
    cloud_name: storageCfg.cloudinaryCloudName,
    api_key: storageCfg.cloudinaryApiKey,
    api_secret: storageCfg.cloudinaryApiSecret,
    secure: true,
  });
}

interface AuthRequest extends Request {
  user?: { _id: string };
  file?: any;
}

/**
 * Get user addresses
 * GET /api/users/addresses
 */
export const getAddresses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ addresses: user.addresses || [] });
  } catch (error) {
    logger.error('Error fetching addresses:', error);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
};

/**
 * Add new address
 * POST /api/users/addresses
 */
export const addAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fullName, phone, addressLine1, addressLine2, city, state, zipCode, country, isDefault } = req.body;

    if (!fullName || !phone || !addressLine1 || !city || !state || !zipCode) {
      res.status(400).json({ error: 'Missing required address fields' });
      return;
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // If this is set as default, unset all other default addresses
    if (isDefault) {
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    // If this is the first address, make it default
    const shouldBeDefault = isDefault || user.addresses.length === 0;

    user.addresses.push({
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      country: country || 'India',
      isDefault: shouldBeDefault,
    });

    await user.save();

    res.status(201).json({
      address: user.addresses[user.addresses.length - 1],
      message: 'Address added successfully'
    });
  } catch (error) {
    logger.error('Error adding address:', error);
    res.status(500).json({ error: 'Failed to add address' });
  }
};

/**
 * Update address
 * PATCH /api/users/addresses/:addressId
 */
export const updateAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { addressId } = req.params;
    const updates = req.body;

    const user = await User.findById(req.user?._id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const address = (user.addresses as any).id(addressId);

    if (!address) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    // If setting as default, unset all other default addresses
    if (updates.isDefault) {
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    // Update address fields
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        (address as any)[key] = updates[key];
      }
    });

    await user.save();

    res.json({
      address,
      message: 'Address updated successfully'
    });
  } catch (error) {
    logger.error('Error updating address:', error);
    res.status(500).json({ error: 'Failed to update address' });
  }
};

/**
 * Delete address
 * DELETE /api/users/addresses/:addressId
 */
export const deleteAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user?._id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const addressIndex = user.addresses.findIndex(
      (addr: any) => addr._id?.toString() === addressId
    );

    if (addressIndex === -1) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    const wasDefault = user.addresses[addressIndex].isDefault;
    user.addresses.splice(addressIndex, 1);

    // If deleted address was default, make the first remaining address default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    logger.error('Error deleting address:', error);
    res.status(500).json({ error: 'Failed to delete address' });
  }
};

/**
 * Set default address
 * PATCH /api/users/addresses/:addressId/default
 */
export const setDefaultAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user?._id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const address = (user.addresses as any).id(addressId);

    if (!address) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    // Unset all default addresses
    user.addresses.forEach(addr => {
      addr.isDefault = false;
    });

    // Set this address as default
    address.isDefault = true;

    await user.save();

    res.json({
      address,
      message: 'Default address updated successfully'
    });
  } catch (error) {
    logger.error('Error setting default address:', error);
    res.status(500).json({ error: 'Failed to set default address' });
  }
};

/**
 * Get notification preferences
 * GET /api/users/notification-preferences
 */
export const getNotificationPreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Return default preferences if not set
    const preferences = {
      orderUpdates: true,
      promotions: true,
      newsletter: false,
      sms: false,
      ...(user as any).notificationPreferences,
    };

    res.json(preferences);
  } catch (error) {
    logger.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
};

/**
 * Update notification preferences
 * PATCH /api/users/notification-preferences
 */
export const updateNotificationPreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderUpdates, promotions, newsletter, sms } = req.body;

    const user = await User.findById(req.user?._id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const preferences = {
      orderUpdates: orderUpdates !== undefined ? orderUpdates : true,
      promotions: promotions !== undefined ? promotions : true,
      newsletter: newsletter !== undefined ? newsletter : false,
      sms: sms !== undefined ? sms : false,
    };

    (user as any).notificationPreferences = preferences;
    await user.save();

    res.json({
      preferences,
      message: 'Notification preferences updated successfully'
    });
  } catch (error) {
    logger.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
};

/**
 * Get user statistics
 * GET /api/users/stats
 */
export const getUserStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    // Get total orders and total spent
    const orders = await Order.find({ user: userId });
    const totalOrders = orders.length;
    const totalSpent = orders
      .filter(order => order.paymentStatus === 'completed' || order.status === 'delivered')
      .reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0);

    // Get wishlist items count
    const wishlist = await Wishlist.findOne({ user: userId });
    const wishlistItems = wishlist ? wishlist.products.length : 0;

    // Get loyalty points (if loyalty system exists)
    const loyaltyPoints = 0; // TODO: Integrate with loyalty system

    res.json({
      totalOrders,
      totalSpent,
      loyaltyPoints,
      wishlistItems,
    });
  } catch (error) {
    logger.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
};

/**
 * Upload profile picture
 * POST /api/users/avatar
 */
export const uploadAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let avatarUrl: string;
    let cloudinaryPublicId: string | undefined;

    // Delete old avatar if exists
    if (user.avatar) {
      if (storageCfg.provider === 'cloudinary' && user.avatarCloudinaryId) {
        // Delete from Cloudinary
        try {
          await cloudinary.uploader.destroy(user.avatarCloudinaryId);
          logger.info(`Deleted old avatar from Cloudinary: ${user.avatarCloudinaryId}`);
        } catch (error) {
          logger.error('Error deleting old avatar from Cloudinary:', error);
        }
      } else if (storageCfg.provider === 'local') {
        // Delete from local filesystem
        const oldAvatarPath = path.join(storageCfg.localDir || 'uploads', 'avatars', path.basename(user.avatar));
        if (fs.existsSync(oldAvatarPath)) {
          try {
            fs.unlinkSync(oldAvatarPath);
            logger.info(`Deleted old avatar from local: ${oldAvatarPath}`);
          } catch (error) {
            logger.error('Error deleting old avatar from local:', error);
          }
        }
      }
    }

    // Upload based on provider
    if (storageCfg.provider === 'cloudinary') {
      // Upload to Cloudinary
      const publicId = `avatars/${uuidv4()}`;
      const result: any = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'ecommerce/avatars',
            public_id: publicId,
            transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
          },
          (err: any, uploaded: any) => (err ? reject(err) : resolve(uploaded))
        );
        const readable = new Readable();
        readable._read = () => { };
        readable.push(req.file!.buffer);
        readable.push(null);
        readable.pipe(stream);
      });

      avatarUrl = result.secure_url;
      cloudinaryPublicId = result.public_id;

      // Track uploaded image
      try {
        await UploadedImage.create({
          url: avatarUrl,
          filename: req.file.originalname,
          provider: 'cloudinary',
          uploadedBy: req.user!._id,
          size: req.file.size,
          mimeType: req.file.mimetype,
          cloudinaryId: cloudinaryPublicId,
          isUsed: true,
          usedIn: [{
            model: 'User',
            documentId: user._id,
            field: 'avatar'
          }],
          markedForDeletion: false,
          deletionScheduledAt: null,
        });
      } catch (trackingError) {
        logger.error('Failed to create upload tracking record:', trackingError);
      }
    } else {
      // Local storage
      avatarUrl = `/uploads/avatars/${req.file.filename}`;

      // Track uploaded image
      try {
        await UploadedImage.create({
          url: `${storageCfg.localDir || 'uploads'}/avatars/${req.file.filename}`,
          filename: req.file.originalname,
          provider: 'local',
          uploadedBy: req.user!._id,
          size: req.file.size,
          mimeType: req.file.mimetype,
          isUsed: true,
          usedIn: [{
            model: 'User',
            documentId: user._id,
            field: 'avatar'
          }],
          markedForDeletion: false,
          deletionScheduledAt: null,
        });
      } catch (trackingError) {
        logger.error('Failed to create upload tracking record:', trackingError);
      }
    }

    // Save new avatar URL
    user.avatar = avatarUrl;
    if (cloudinaryPublicId) {
      user.avatarCloudinaryId = cloudinaryPublicId;
    }
    await user.save();

    res.json({
      url: avatarUrl,
      message: 'Avatar uploaded successfully',
      provider: storageCfg.provider
    });
  } catch (error) {
    logger.error('Error uploading avatar:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
};

/**
 * Delete user account
 * DELETE /api/users/account
 */
export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ error: 'Password is required to delete account' });
      return;
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: 'Incorrect password' });
      return;
    }

    // Delete user's avatar if exists
    if (user.avatar) {
      if (storageCfg.provider === 'cloudinary' && user.avatarCloudinaryId) {
        // Delete from Cloudinary
        try {
          await cloudinary.uploader.destroy(user.avatarCloudinaryId);
          logger.info(`Deleted avatar from Cloudinary during account deletion: ${user.avatarCloudinaryId}`);
        } catch (error) {
          logger.error('Error deleting avatar from Cloudinary:', error);
        }
      } else if (storageCfg.provider === 'local') {
        // Delete from local filesystem
        const avatarPath = path.join(storageCfg.localDir || 'uploads', 'avatars', path.basename(user.avatar));
        if (fs.existsSync(avatarPath)) {
          try {
            fs.unlinkSync(avatarPath);
            logger.info(`Deleted avatar from local during account deletion: ${avatarPath}`);
          } catch (error) {
            logger.error('Error deleting avatar from local:', error);
          }
        }
      }
    }

    // Delete user account
    await User.findByIdAndDelete(req.user?._id);

    // Note: You may want to also delete or anonymize user's orders, reviews, etc.
    // This is a design decision based on your data retention policy

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    logger.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
