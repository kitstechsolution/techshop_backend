import { Request, Response } from 'express';
import { Cart } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { Coupon } from '../models/Coupon.js';
import { Wishlist } from '../models/Wishlist.js';
import { logger } from '../utils/logger.js';

interface AuthRequest extends Request {
  user?: { _id: string };
}

/**
 * Get user's cart
 * GET /api/cart
 */
export const getCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cart = await Cart.findOne({ user: req.user?._id }).populate('items.product');
    
    if (!cart) {
      res.json({
        items: [],
        subtotal: 0,
        tax: 0,
        shipping: 0,
        discount: 0,
        total: 0,
      });
      return;
    }

    res.json(cart);
  } catch (error) {
    logger.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
};

/**
 * Add item to cart
 * POST /api/cart/items
 */
export const addToCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId, quantity, variantId } = req.body;

    if (!productId || !quantity) {
      res.status(400).json({ error: 'Product ID and quantity are required' });
      return;
    }

    // Validate product exists and has stock
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (product.stock < quantity) {
      res.status(400).json({ error: 'Insufficient stock' });
      return;
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      cart = new Cart({ user: req.user?._id, items: [] });
    }

    // Check if item already in cart
    const existingItemIndex = cart.items.findIndex(
      (item: any) => item.product.toString() === productId && 
              JSON.stringify(item.variant) === JSON.stringify(variantId)
    );

    if (existingItemIndex > -1) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
      
      // Check max quantity
      if (cart.items[existingItemIndex].quantity > product.stock) {
        res.status(400).json({ error: 'Exceeds available stock' });
        return;
      }
    } else {
      // Add new item
      cart.items.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity,
        image: product.images && product.images[0] ? product.images[0] : '',
        variant: variantId,
        maxQuantity: product.stock,
      });
    }

    await cart.save();
    await cart.populate('items.product');
    
    res.status(201).json(cart);
  } catch (error) {
    logger.error('Error adding to cart:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
};

/**
 * Update cart item quantity
 * PUT /api/cart/items/:itemId
 */
export const updateCartItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
      res.status(400).json({ error: 'Quantity must be at least 1' });
      return;
    }

    const cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    const item = cart.items.id(itemId);
    if (!item) {
      res.status(404).json({ error: 'Item not found in cart' });
      return;
    }

    // Check stock availability
    const product = await Product.findById(item.product);
    if (!product || product.stock < quantity) {
      res.status(400).json({ error: 'Insufficient stock' });
      return;
    }

    item.quantity = quantity;
    item.maxQuantity = product.stock;

    await cart.save();
    await cart.populate('items.product');
    
    res.json(cart);
  } catch (error) {
    logger.error('Error updating cart item:', error);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
};

/**
 * Remove item from cart
 * DELETE /api/cart/items/:itemId
 */
export const removeFromCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    cart.items = cart.items.filter((item: any) => item._id?.toString() !== itemId);

    await cart.save();
    await cart.populate('items.product');
    
    res.json(cart);
  } catch (error) {
    logger.error('Error removing from cart:', error);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
};

/**
 * Clear entire cart
 * DELETE /api/cart
 */
export const clearCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Cart.findOneAndDelete({ user: req.user?._id });
    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    logger.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
};

/**
 * Apply coupon code
 * POST /api/cart/coupon
 */
export const applyCoupon = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Coupon code is required' });
      return;
    }

    const cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    // Validate coupon
    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(), 
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    });

    if (!coupon) {
      res.status(400).json({ error: 'Invalid or expired coupon' });
      return;
    }

    // Check minimum order value
    if (coupon.minOrderValue && cart.subtotal < coupon.minOrderValue) {
      res.status(400).json({ 
        error: `Minimum order value of ${coupon.minOrderValue} required` 
      });
      return;
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (cart.subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    } else {
      discount = coupon.discountValue;
    }

    cart.couponCode = code.toUpperCase();
    cart.couponDiscount = discount;
    cart.discount = discount;

    await cart.save();
    await cart.populate('items.product');
    
    res.json(cart);
  } catch (error) {
    logger.error('Error applying coupon:', error);
    res.status(500).json({ error: 'Failed to apply coupon' });
  }
};

/**
 * Remove coupon
 * DELETE /api/cart/coupon
 */
export const removeCoupon = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    cart.couponCode = undefined;
    cart.couponDiscount = undefined;
    cart.discount = 0;

    await cart.save();
    await cart.populate('items.product');
    
    res.json(cart);
  } catch (error) {
    logger.error('Error removing coupon:', error);
    res.status(500).json({ error: 'Failed to remove coupon' });
  }
};

/**
 * Validate coupon code
 * POST /api/cart/coupon/validate
 */
export const validateCoupon = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Coupon code is required' });
      return;
    }

    const cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      res.status(400).json({ valid: false, message: 'Cart is empty' });
      return;
    }

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(), 
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    });

    if (!coupon) {
      res.json({ valid: false, message: 'Invalid or expired coupon' });
      return;
    }

    if (coupon.minOrderValue && cart.subtotal < coupon.minOrderValue) {
      res.json({ 
        valid: false, 
        message: `Minimum order value of ${coupon.minOrderValue} required` 
      });
      return;
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (cart.subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    } else {
      discount = coupon.discountValue;
    }

    res.json({ 
      valid: true, 
      discount,
      discountType: coupon.discountType,
      message: 'Coupon is valid'
    });
  } catch (error) {
    logger.error('Error validating coupon:', error);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
};

/**
 * Get cart summary
 * GET /api/cart/summary
 */
export const getCartSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cart = await Cart.findOne({ user: req.user?._id });
    
    if (!cart) {
      res.json({
        itemCount: 0,
        subtotal: 0,
        tax: 0,
        shipping: 0,
        discount: 0,
        total: 0,
      });
      return;
    }

    res.json({
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: cart.subtotal,
      tax: cart.tax,
      shipping: cart.shipping,
      discount: cart.discount,
      total: cart.total,
    });
  } catch (error) {
    logger.error('Error fetching cart summary:', error);
    res.status(500).json({ error: 'Failed to fetch cart summary' });
  }
};

/**
 * Get cart item count
 * GET /api/cart/count
 */
export const getCartItemCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cart = await Cart.findOne({ user: req.user?._id });
    const count = cart ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
    
    res.json({ count });
  } catch (error) {
    logger.error('Error fetching cart count:', error);
    res.status(500).json({ error: 'Failed to fetch cart count' });
  }
};

/**
 * Merge guest cart with user cart
 * POST /api/cart/merge
 */
export const mergeCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { items: guestItems } = req.body;

    if (!guestItems || !Array.isArray(guestItems)) {
      res.status(400).json({ error: 'Invalid cart items' });
      return;
    }

    let cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      cart = new Cart({ user: req.user?._id, items: [] });
    }

    // Merge items
    for (const guestItem of guestItems) {
      const product = await Product.findById(guestItem.productId);
      if (!product || product.stock === 0) continue;

      const existingItemIndex = cart.items.findIndex(
        (item: any) => item.product.toString() === guestItem.productId
      );

      if (existingItemIndex > -1) {
        const newQuantity = cart.items[existingItemIndex].quantity + guestItem.quantity;
        cart.items[existingItemIndex].quantity = Math.min(newQuantity, product.stock);
      } else {
        cart.items.push({
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: Math.min(guestItem.quantity, product.stock),
          image: product.images && product.images[0] ? product.images[0] : '',
          maxQuantity: product.stock,
        });
      }
    }

    await cart.save();
    await cart.populate('items.product');
    
    res.json(cart);
  } catch (error) {
    logger.error('Error merging cart:', error);
    res.status(500).json({ error: 'Failed to merge cart' });
  }
};

/**
 * Validate cart (check stock availability)
 * POST /api/cart/validate
 */
export const validateCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cart = await Cart.findOne({ user: req.user?._id }).populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      res.json({ valid: true });
      return;
    }

    const issues: Array<{
      itemId: string;
      issue: string;
      message: string;
    }> = [];

    for (const item of cart.items) {
      const product = item.product as any;
      
      if (!product) {
        issues.push({
          itemId: item._id?.toString() || '',
          issue: 'unavailable',
          message: 'Product no longer available',
        });
        continue;
      }

      if (product.stock === 0) {
        issues.push({
          itemId: item._id?.toString() || '',
          issue: 'out_of_stock',
          message: `${item.name} is out of stock`,
        });
      } else if (product.stock < item.quantity) {
        issues.push({
          itemId: item._id?.toString() || '',
          issue: 'insufficient_stock',
          message: `Only ${product.stock} units of ${item.name} available`,
        });
      }

      if (product.price !== item.price) {
        issues.push({
          itemId: item._id?.toString() || '',
          issue: 'price_changed',
          message: `Price of ${item.name} has changed`,
        });
      }
    }

    res.json({
      valid: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined,
    });
  } catch (error) {
    logger.error('Error validating cart:', error);
    res.status(500).json({ error: 'Failed to validate cart' });
  }
};

/**
 * Get product recommendations based on cart
 * GET /api/cart/recommendations
 */
export const getRecommendations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cart = await Cart.findOne({ user: req.user?._id }).populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      res.json([]);
      return;
    }

    // Get categories from cart items
    const categories = cart.items
      .map((item: any) => item.product?.category)
      .filter(Boolean);

    // Find related products
    const recommendations = await Product.find({
      category: { $in: categories },
      _id: { $nin: cart.items.map((item: any) => item.product?._id) },
      stock: { $gt: 0 },
    })
    .limit(6)
    .sort({ rating: -1 });

    res.json(recommendations);
  } catch (error) {
    logger.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
};

/**
 * Move item to wishlist
 * POST /api/cart/items/:itemId/move-to-wishlist
 */
export const moveToWishlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    const item = cart.items.id(itemId);
    if (!item) {
      res.status(404).json({ error: 'Item not found in cart' });
      return;
    }

    // Add to wishlist
    let wishlist = await Wishlist.findOne({ user: req.user?._id });
    if (!wishlist) {
      wishlist = new Wishlist({ user: req.user?._id, products: [] });
    }

    if (!wishlist.products.includes(item.product)) {
      wishlist.products.push(item.product);
      await wishlist.save();
    }

    // Remove from cart
    cart.items = cart.items.filter((i: any) => i._id?.toString() !== itemId);
    await cart.save();

    res.json({ message: 'Item moved to wishlist', cart, wishlist });
  } catch (error) {
    logger.error('Error moving to wishlist:', error);
    res.status(500).json({ error: 'Failed to move item to wishlist' });
  }
};

/**
 * Save cart for later (guest users)
 * POST /api/cart/save
 */
export const saveCartForLater = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cart = await Cart.findOne({ user: req.user?._id });
    
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    res.json({ cartId: cart._id.toString() });
  } catch (error) {
    logger.error('Error saving cart:', error);
    res.status(500).json({ error: 'Failed to save cart' });
  }
};

/**
 * Restore saved cart
 * POST /api/cart/restore
 */
export const restoreCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { cartId } = req.body;

    const cart = await Cart.findById(cartId).populate('items.product');
    
    if (!cart) {
      res.status(404).json({ error: 'Saved cart not found' });
      return;
    }

    res.json(cart);
  } catch (error) {
    logger.error('Error restoring cart:', error);
    res.status(500).json({ error: 'Failed to restore cart' });
  }
};

/**
 * Calculate shipping cost
 * POST /api/cart/shipping/calculate
 */
export const calculateShipping = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { zipCode, country, items } = req.body;

    // Basic shipping calculation (can be extended with real shipping APIs)
    const baseShipping = 50;
    const freeShippingThreshold = 500;

    const cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      res.json({ cost: baseShipping, estimatedDelivery: '5-7 business days' });
      return;
    }

    const cost = cart.subtotal >= freeShippingThreshold ? 0 : baseShipping;

    res.json({
      cost,
      estimatedDelivery: country === 'India' ? '3-5 business days' : '7-14 business days',
      methods: [
        {
          id: 'standard',
          name: 'Standard Delivery',
          cost,
          estimatedDays: country === 'India' ? 5 : 10,
        },
        {
          id: 'express',
          name: 'Express Delivery',
          cost: cost + 100,
          estimatedDays: country === 'India' ? 2 : 5,
        },
      ],
    });
  } catch (error) {
    logger.error('Error calculating shipping:', error);
    res.status(500).json({ error: 'Failed to calculate shipping' });
  }
};

/**
 * Apply gift wrapping to item
 * PUT /api/cart/items/:itemId/gift-wrap
 */
export const applyGiftWrapping = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const { enabled } = req.body;

    const cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    const item = cart.items.id(itemId);
    if (!item) {
      res.status(404).json({ error: 'Item not found in cart' });
      return;
    }

    item.giftWrap = enabled;
    await cart.save();
    await cart.populate('items.product');
    
    res.json(cart);
  } catch (error) {
    logger.error('Error applying gift wrap:', error);
    res.status(500).json({ error: 'Failed to apply gift wrapping' });
  }
};

/**
 * Add gift message to cart
 * PUT /api/cart/gift-message
 */
export const addGiftMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { message } = req.body;

    const cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    cart.giftMessage = message;
    await cart.save();
    await cart.populate('items.product');
    
    res.json(cart);
  } catch (error) {
    logger.error('Error adding gift message:', error);
    res.status(500).json({ error: 'Failed to add gift message' });
  }
};

/**
 * Check if product can be added to cart
 * POST /api/cart/can-add
 */
export const canAddToCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId, quantity, variantId } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      res.json({ canAdd: false, reason: 'Product not found' });
      return;
    }

    if (product.stock === 0) {
      res.json({ canAdd: false, reason: 'Product is out of stock' });
      return;
    }

    if (product.stock < quantity) {
      res.json({ 
        canAdd: false, 
        reason: 'Insufficient stock', 
        availableQuantity: product.stock 
      });
      return;
    }

    res.json({ canAdd: true });
  } catch (error) {
    logger.error('Error checking if can add to cart:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
};

/**
 * Get abandoned cart
 * GET /api/cart/abandoned/:cartId
 */
export const getAbandonedCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { cartId } = req.params;

    const cart = await Cart.findById(cartId).populate('items.product');
    
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    res.json(cart);
  } catch (error) {
    logger.error('Error fetching abandoned cart:', error);
    res.status(500).json({ error: 'Failed to fetch abandoned cart' });
  }
};

/**
 * Update cart notes
 * PUT /api/cart/notes
 */
export const updateNotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { notes } = req.body;

    const cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    cart.notes = notes;
    await cart.save();
    await cart.populate('items.product');
    
    res.json(cart);
  } catch (error) {
    logger.error('Error updating notes:', error);
    res.status(500).json({ error: 'Failed to update notes' });
  }
};
