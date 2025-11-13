import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User.js';

interface AuthRequest extends Request {
  user?: IUser;
}

const rawJwtSecret = process.env.JWT_SECRET;
if (!rawJwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}
const JWT_SECRET = rawJwtSecret || 'your-secret-key';

interface JWTPayload {
  _id: string;
}

export const auth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'Please authenticate.' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    const user = await User.findOne({ _id: decoded._id });

    if (!user) {
      res.status(401).json({ error: 'Please authenticate.' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Please authenticate.' });
  }
};

export const adminAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token verification logic instead of calling auth middleware
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'Please authenticate.' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    const user = await User.findOne({ _id: decoded._id });

    if (!user) {
      res.status(401).json({ error: 'Please authenticate.' });
      return;
    }

    req.user = user;
    
    // Check if user is admin
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }
    
    next();
  } catch (error) {
    // Determine whether this is an auth error or something else
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Please authenticate.' });
    } else {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
  }
};

/**
 * Optional authentication middleware
 * Attempts to authenticate the user but doesn't fail if no token is provided
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    // If no token, just continue without setting user
    if (!token) {
      next();
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    const user = await User.findOne({ _id: decoded._id });

    // If user found, set it; otherwise just continue
    if (user) {
      req.user = user;
    }

    next();
  } catch {
    // On error, just continue without user (don't block the request)
    next();
  }
};

// Export aliases for different naming conventions used in routes
export const protect = auth; // Alias for auth
export const admin = adminAuth; // Alias for adminAuth

// Export types
export type { AuthRequest };
