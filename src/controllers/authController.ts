import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser } from '../models/User.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { logger } from '../utils/logger.js';

const rawJwtSecret = process.env.JWT_SECRET;
if (!rawJwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}
const JWT_SECRET = rawJwtSecret || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

interface JWTPayload {
  _id: string;
}

const generateToken = (user: IUser): string => {
  const payload: JWTPayload = { _id: user._id.toString() };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
      password,
    });

    await user.save();

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch {
    res.status(400).json({ error: 'Error creating user' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch {
    res.status(400).json({ error: 'Error logging in' });
  }
};

interface AuthRequest extends Request {
  user?: IUser;
}

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id).select('-password');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch {
    res.status(400).json({ error: 'Error fetching profile' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['firstName', 'lastName', 'email', 'password'] as const;
    type AllowedUpdate = typeof allowedUpdates[number];
    
    const isValidOperation = updates.every(update => allowedUpdates.includes(update as AllowedUpdate));

    if (!isValidOperation) {
      res.status(400).json({ error: 'Invalid updates' });
      return;
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Type-safe updates
    updates.forEach(update => {
      const key = update as AllowedUpdate;
      if (req.body[key] && allowedUpdates.includes(key)) {
        user[key] = req.body[key];
      }
    });

    await user.save();

    res.json({
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    });
  } catch {
    res.status(400).json({ error: 'Error updating profile' });
  }
};

/**
 * Change Password - Requires current password verification
 */
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long' });
      return;
    }

    // Get user with password field
    const user = await User.findById(req.user?._id).select('+password');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch {
    res.status(500).json({ error: 'Error changing password' });
  }
};

/**
 * Forgot Password - Send reset token via email (mock for now)
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists for security
      res.json({ message: 'If the email exists, a password reset link will be sent' });
      return;
    }

    // Generate reset token (32 bytes hex = 64 characters)
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash token for storage (using SHA256)
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Delete any existing tokens for this user
    await PasswordResetToken.deleteMany({ user: user._id });

    // Create new reset token (expires in 1 hour)
    await PasswordResetToken.create({
      user: user._id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      used: false,
    });

    // Send password reset email
    const emailSent = await sendPasswordResetEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      resetToken
    );

    if (!emailSent) {
      logger.warn(`Failed to send password reset email to ${user.email}`);
    }

    // Return same message regardless of email success (security best practice)
    // For development mode, include the token for testing
    const isDevelopment = process.env.NODE_ENV === 'development';
    const response: { message: string; token?: string; emailSent?: boolean } = {
      message: 'If the email exists, a password reset link has been sent',
    };

    if (isDevelopment) {
      response.token = resetToken; // Only for testing
      response.emailSent = emailSent;
    }

    res.json(response);
  } catch {
    res.status(500).json({ error: 'Error processing password reset request' });
  }
};

/**
 * Reset Password - Use token to reset password
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    // Validate input
    if (!token || !newPassword) {
      res.status(400).json({ error: 'Token and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long' });
      return;
    }

    // Hash the provided token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid token
    const resetToken = await PasswordResetToken.findOne({
      token: hashedToken,
      expiresAt: { $gt: new Date() }, // Not expired
      used: false, // Not already used
    });

    if (!resetToken) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    // Find user
    const user = await User.findById(resetToken.user);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Mark token as used
    resetToken.used = true;
    await resetToken.save();

    // Delete all reset tokens for this user
    await PasswordResetToken.deleteMany({ user: user._id });

    res.json({ message: 'Password reset successfully' });
  } catch {
    res.status(500).json({ error: 'Error resetting password' });
  }
};
