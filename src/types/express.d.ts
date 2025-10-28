import { IUser } from '../models/User';
import { RateLimitInfo } from 'express-rate-limit';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      rateLimit?: RateLimitInfo;
    }
  }
}

export {};
