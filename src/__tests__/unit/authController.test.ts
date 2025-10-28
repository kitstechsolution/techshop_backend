import { Request, Response } from 'express';
import { register, login, changePassword, forgotPassword } from '../../controllers/authController.js';
import { User } from '../../models/User.js';
import { PasswordResetToken } from '../../models/PasswordResetToken.js';
import * as emailService from '../../services/emailService.js';

// Mock dependencies
jest.mock('../../models/User.js');
jest.mock('../../models/PasswordResetToken.js');
jest.mock('../../services/emailService.js');
jest.mock('../../utils/logger.js');

describe('Auth Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn();
    responseStatus = jest.fn().mockReturnValue({ json: responseJson });
    
    mockRequest = {
      body: {},
      user: undefined,
    };
    
    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
      };

      mockRequest.body = userData;

      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.prototype.save as jest.Mock).mockResolvedValue({
        _id: '123',
        ...userData,
        role: 'customer',
      });

      await register(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(201);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            email: userData.email,
          }),
          token: expect.any(String),
        })
      );
    });

    it('should return error if email already exists', async () => {
      mockRequest.body = {
        email: 'existing@example.com',
      };

      (User.findOne as jest.Mock).mockResolvedValue({ email: 'existing@example.com' });

      await register(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({ error: 'Email already registered' });
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const userData = {
        _id: '123',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'customer',
        comparePassword: jest.fn().mockResolvedValue(true),
      };

      mockRequest.body = {
        email: 'john@example.com',
        password: 'password123',
      };

      (User.findOne as jest.Mock).mockResolvedValue(userData);

      await login(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            email: userData.email,
          }),
          token: expect.any(String),
        })
      );
    });

    it('should return error for invalid credentials', async () => {
      mockRequest.body = {
        email: 'john@example.com',
        password: 'wrongpassword',
      };

      (User.findOne as jest.Mock).mockResolvedValue({
        comparePassword: jest.fn().mockResolvedValue(false),
      });

      await login(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({ error: 'Invalid email or password' });
    });
  });

  describe('changePassword', () => {
    it('should change password with valid current password', async () => {
      const userData = {
        _id: '123',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      mockRequest.body = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      };
      mockRequest.user = userData as any;

      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(userData),
      });

      await changePassword(mockRequest as any, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith({ message: 'Password changed successfully' });
    });

    it('should return error for incorrect current password', async () => {
      const userData = {
        _id: '123',
        comparePassword: jest.fn().mockResolvedValue(false),
      };

      mockRequest.body = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
      };
      mockRequest.user = userData as any;

      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(userData),
      });

      await changePassword(mockRequest as any, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({ error: 'Current password is incorrect' });
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email for valid user', async () => {
      const userData = {
        _id: '123',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      mockRequest.body = {
        email: 'john@example.com',
      };

      (User.findOne as jest.Mock).mockResolvedValue(userData);
      (PasswordResetToken.deleteMany as jest.Mock).mockResolvedValue({});
      (PasswordResetToken.create as jest.Mock).mockResolvedValue({});
      (emailService.sendPasswordResetEmail as jest.Mock).mockResolvedValue(true);

      await forgotPassword(mockRequest as Request, mockResponse as Response);

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        userData.email,
        `${userData.firstName} ${userData.lastName}`,
        expect.any(String)
      );
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'If the email exists, a password reset link has been sent',
        })
      );
    });

    it('should return success message even for non-existent email', async () => {
      mockRequest.body = {
        email: 'nonexistent@example.com',
      };

      (User.findOne as jest.Mock).mockResolvedValue(null);

      await forgotPassword(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith({
        message: 'If the email exists, a password reset link will be sent',
      });
    });
  });
});
