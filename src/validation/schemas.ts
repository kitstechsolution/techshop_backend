import { z } from 'zod';

// ---------- Auth Schemas ----------

export const authRegisterSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const authLoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// ---------- Order Schemas ----------

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        product: z.string().optional(),
        name: z.string().min(1),
        price: z.number().nonnegative(),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1, 'Order must contain at least one item'),
  shippingAddress: z.object({
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zipCode: z.string().min(1, 'Zip/postal code is required'),
    country: z.string().optional(),
  }),
  paymentMethod: z.enum(['razorpay', 'cash', 'standard']).optional(),
  couponCode: z.string().optional(),
  notes: z.string().optional(),
});

// ---------- Cart Schemas ----------

export const addToCartSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  variantId: z.any().optional(),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

export const applyCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
});

export const validateCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
});

export const mergeCartSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1),
      }),
    )
    .optional(),
});

export const canAddToCartSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  variantId: z.any().optional(),
});

export const restoreCartSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
});

export const calculateShippingSchema = z.object({
  zipCode: z.string().min(1, 'Zip/postal code is required'),
  country: z.string().min(1, 'Country is required'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1),
      }),
    )
    .optional(),
});
