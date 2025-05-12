import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
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