import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

// Email configuration from environment variables
const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();

const smtpConfig = {
  host: process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587', 10),
  secure: (process.env.SMTP_SECURE || process.env.EMAIL_SECURE) === 'true', // true for 465
  auth: undefined as undefined | { user?: string; pass?: string },
};

if (process.env.SMTP_USER || process.env.EMAIL_USER) {
  smtpConfig.auth = {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASSWORD || process.env.EMAIL_PASS,
  };
}

// Create reusable transporter
const createTransporter = (): nodemailer.Transporter => {
  try {
    if (EMAIL_PROVIDER === 'none') {
      logger.info('Email provider set to none — emails will be skipped');
      // Use a stub transport that logs to console to avoid runtime errors
      return nodemailer.createTransport({ jsonTransport: true });
    }

    if (EMAIL_PROVIDER === 'sendgrid' && process.env.SENDGRID_API_KEY) {
      // Use SendGrid via SMTP or nodemailer-sendgrid-transport if desired
      // For simplicity, use SMTP config when SENDGRID_API_KEY missing from setup in this code path
      logger.info('Email provider sendgrid requested — using SMTP-compatible transport');
    }

    // If auth is missing and we're in development, fall back to jsonTransport
  if (!smtpConfig.auth || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
      if ((process.env.NODE_ENV || 'development') === 'development') {
        logger.warn('SMTP credentials not provided — falling back to jsonTransport in development');
        return nodemailer.createTransport({ jsonTransport: true });
      }
      logger.warn('SMTP credentials missing — transporter will still be created and may fail on verify/send');
    }

    return nodemailer.createTransport(smtpConfig as any) as nodemailer.Transporter;
  } catch (error) {
    logger.error('Failed to create email transporter:', error);
    throw error;
  }
};

// Verify email configuration
export const verifyEmailConfig = async (): Promise<boolean> => {
  try {
    if (EMAIL_PROVIDER === 'none') return true;

    const transporter = createTransporter();

    // Only call verify when transporter supports it and when credentials likely present
    // Detect jsonTransport safely
    type TransportOptionsShape = { options?: { jsonTransport?: boolean } };
    const transportOptions = (transporter as unknown) as TransportOptionsShape;
    if (transportOptions && transportOptions.options && transportOptions.options.jsonTransport) {
      logger.info('Using jsonTransport — skipping SMTP verify');
      return true;
    }

    // transporter.verify may throw if credentials missing — handle and log clearly
    await transporter.verify();
    logger.info('Email service is ready');
    return true;
  } catch (error) {
    logger.error('Email service verification failed:', error);
    return false;
  }
};

// Generic send email function
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: options.from || process.env.EMAIL_FROM || 'noreply@ecommerce.com',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId} to ${options.to}`);
    return true;
  } catch (error) {
    logger.error('Failed to send email:', error);
    return false;
  }
};

// Welcome email
export const sendWelcomeEmail = async (to: string, name: string): Promise<boolean> => {
  const subject = 'Welcome to Our E-Commerce Store!';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Our Store!</h1>
        </div>
        <div class="content">
          <h2>Hello ${name}!</h2>
          <p>Thank you for joining our e-commerce platform. We're excited to have you as part of our community!</p>
          <p>Here's what you can do now:</p>
          <ul>
            <li>Browse our extensive product catalog</li>
            <li>Add items to your wishlist</li>
            <li>Get exclusive deals and offers</li>
            <li>Track your orders in real-time</li>
          </ul>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="button">Start Shopping</a>
          <p>If you have any questions, feel free to reach out to our support team.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 E-Commerce Store. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({ to, subject, html });
};

// Order confirmation email
export const sendOrderConfirmationEmail = async (
  to: string,
  orderDetails: {
    orderNumber: string;
    name: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    subtotal: number;
    discount?: number;
    total: number;
    shippingAddress: string;
  }
): Promise<boolean> => {
  const subject = `Order Confirmation - ${orderDetails.orderNumber}`;
  
  const itemsHtml = orderDetails.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">₹${item.price.toFixed(2)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">₹${(item.quantity * item.price).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10B981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
        th { background: #f0f0f0; padding: 10px; text-align: left; }
        .total-row { font-weight: bold; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✓ Order Confirmed!</h1>
        </div>
        <div class="content">
          <h2>Thank you for your order, ${orderDetails.name}!</h2>
          <p>Your order has been confirmed and is being processed.</p>
          <p><strong>Order Number:</strong> ${orderDetails.orderNumber}</p>
          
          <h3>Order Details:</h3>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style="text-align: center;">Quantity</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr>
                <td colspan="3" style="padding: 10px; text-align: right;"><strong>Subtotal:</strong></td>
                <td style="padding: 10px; text-align: right;">₹${orderDetails.subtotal.toFixed(2)}</td>
              </tr>
              ${orderDetails.discount ? `
              <tr>
                <td colspan="3" style="padding: 10px; text-align: right; color: #10B981;"><strong>Discount:</strong></td>
                <td style="padding: 10px; text-align: right; color: #10B981;">-₹${orderDetails.discount.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr class="total-row">
                <td colspan="3" style="padding: 10px; text-align: right; font-size: 18px;"><strong>Total:</strong></td>
                <td style="padding: 10px; text-align: right; font-size: 18px;">₹${orderDetails.total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          
          <h3>Shipping Address:</h3>
          <p>${orderDetails.shippingAddress}</p>
          
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderDetails.orderNumber}" class="button">Track Your Order</a>
          
          <p>We'll send you another email when your order ships.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 E-Commerce Store. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({ to, subject, html });
};

// Order shipped email
export const sendOrderShippedEmail = async (
  to: string,
  orderDetails: {
    orderNumber: string;
    name: string;
    trackingNumber?: string;
    carrier?: string;
    estimatedDelivery?: string;
  }
): Promise<boolean> => {
  const subject = `Your Order Has Been Shipped - ${orderDetails.orderNumber}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .tracking-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #3B82F6; }
        .button { display: inline-block; padding: 12px 24px; background: #3B82F6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📦 Your Order is on the Way!</h1>
        </div>
        <div class="content">
          <h2>Great news, ${orderDetails.name}!</h2>
          <p>Your order has been shipped and is on its way to you.</p>
          <p><strong>Order Number:</strong> ${orderDetails.orderNumber}</p>
          
          ${orderDetails.trackingNumber ? `
          <div class="tracking-box">
            <h3>Tracking Information:</h3>
            <p><strong>Tracking Number:</strong> ${orderDetails.trackingNumber}</p>
            ${orderDetails.carrier ? `<p><strong>Carrier:</strong> ${orderDetails.carrier}</p>` : ''}
            ${orderDetails.estimatedDelivery ? `<p><strong>Estimated Delivery:</strong> ${orderDetails.estimatedDelivery}</p>` : ''}
          </div>
          ` : ''}
          
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderDetails.orderNumber}" class="button">Track Your Package</a>
          
          <p>Thank you for shopping with us!</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 E-Commerce Store. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({ to, subject, html });
};

// Order delivered email
export const sendOrderDeliveredEmail = async (
  to: string,
  orderDetails: {
    orderNumber: string;
    name: string;
  }
): Promise<boolean> => {
  const subject = `Your Order Has Been Delivered - ${orderDetails.orderNumber}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10B981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✓ Order Delivered!</h1>
        </div>
        <div class="content">
          <h2>Hello ${orderDetails.name}!</h2>
          <p>Your order has been successfully delivered.</p>
          <p><strong>Order Number:</strong> ${orderDetails.orderNumber}</p>
          
          <p>We hope you love your purchase! If you have any issues, please don't hesitate to contact us.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderDetails.orderNumber}/review" class="button">Leave a Review</a>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/support" class="button" style="background: #6B7280;">Need Help?</a>
          </div>
          
          <p>Thank you for shopping with us!</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 E-Commerce Store. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({ to, subject, html });
};

// Password reset email
export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  resetToken: string
): Promise<boolean> => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  const subject = 'Password Reset Request';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #EF4444; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #EF4444; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .warning { background: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          
          <a href="${resetUrl}" class="button">Reset Password</a>
          
          <div class="warning">
            <p><strong>⚠️ Security Notice:</strong></p>
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>If you didn't request this password reset, please ignore this email or contact support if you're concerned about your account security.</p>
          </div>
          
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 E-Commerce Store. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({ to, subject, html });
};

// Cancel request status email
export const sendCancelRequestStatusEmail = async (
  to: string,
  name: string,
  orderNumber: string,
  status: 'approved' | 'rejected',
  adminNotes?: string
): Promise<boolean> => {
  const isApproved = status === 'approved';
  const subject = `Cancellation Request ${isApproved ? 'Approved' : 'Rejected'} - ${orderNumber}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${isApproved ? '#10B981' : '#EF4444'}; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .info-box { background: white; padding: 15px; border-left: 4px solid ${isApproved ? '#10B981' : '#EF4444'}; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Cancellation Request ${isApproved ? 'Approved' : 'Rejected'}</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>Your cancellation request for order <strong>${orderNumber}</strong> has been ${isApproved ? 'approved' : 'rejected'}.</p>
          
          ${adminNotes ? `
          <div class="info-box">
            <h3>Admin Notes:</h3>
            <p>${adminNotes}</p>
          </div>
          ` : ''}
          
          ${isApproved ? `
          <p>Your refund will be processed within 5-7 business days and will be credited to your original payment method.</p>
          ` : `
          <p>If you have any questions about this decision, please contact our support team.</p>
          `}
          
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderNumber}" class="button">View Order Details</a>
        </div>
        <div class="footer">
          <p>&copy; 2025 E-Commerce Store. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({ to, subject, html });
};

// Refund request status email
export const sendRefundRequestStatusEmail = async (
  to: string,
  name: string,
  orderNumber: string,
  status: 'approved' | 'rejected' | 'completed',
  amount?: number,
  adminNotes?: string,
  refundReference?: string
): Promise<boolean> => {
  const subject = `Refund Request ${status.charAt(0).toUpperCase() + status.slice(1)} - ${orderNumber}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${status === 'rejected' ? '#EF4444' : '#10B981'}; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .info-box { background: white; padding: 15px; border-left: 4px solid ${status === 'rejected' ? '#EF4444' : '#10B981'}; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Refund Request ${status.charAt(0).toUpperCase() + status.slice(1)}</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>Your refund request for order <strong>${orderNumber}</strong> has been ${status}.</p>
          
          ${amount ? `<p><strong>Refund Amount:</strong> ₹${amount.toFixed(2)}</p>` : ''}
          ${refundReference ? `<p><strong>Reference Number:</strong> ${refundReference}</p>` : ''}
          
          ${adminNotes ? `
          <div class="info-box">
            <h3>Admin Notes:</h3>
            <p>${adminNotes}</p>
          </div>
          ` : ''}
          
          ${status === 'approved' ? `
          <p>Please return the product to proceed with the refund. Once we receive and verify the returned item, your refund will be processed.</p>
          ` : status === 'completed' ? `
          <p>Your refund has been processed successfully and will be reflected in your account within 5-7 business days.</p>
          ` : `
          <p>If you have any questions about this decision, please contact our support team.</p>
          `}
          
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderNumber}" class="button">View Order Details</a>
        </div>
        <div class="footer">
          <p>&copy; 2025 E-Commerce Store. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({ to, subject, html });
};

export default {
  verifyEmailConfig,
  sendEmail,
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
  sendPasswordResetEmail,
  sendCancelRequestStatusEmail,
  sendRefundRequestStatusEmail,
};
