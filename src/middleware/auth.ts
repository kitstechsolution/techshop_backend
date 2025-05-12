import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User.js';

interface AuthRequest extends Request {
  user?: IUser;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
    await auth(req, res, () => {
      // Empty callback for auth middleware
    });
    
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }
    
    next();
  } catch {
    res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
}; 