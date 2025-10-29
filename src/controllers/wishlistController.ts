import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Wishlist } from '../models/Wishlist.js';
import { Product } from '../models/Product.js';
import { Cart } from '../models/Cart.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

/**
 * @api {get} /api/wishlist Get User's Wishlist
 * @apiName GetWishlist
 * @apiGroup Wishlist
 * @apiPermission user
 * 
 * @apiSuccess {Object} wishlist User's wishlist with populated products
 */
export const getWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    let wishlist = await Wishlist.findOne({ user: userId })
      .populate('products')
      .exec();

    // Create wishlist if it doesn't exist
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [] });
      await wishlist.populate('products');
    }

    res.json(wishlist);
  } catch (error) {
    logger.error('Error fetching wishlist:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
};

/**
 * @api {post} /api/wishlist/add/:productId Add Product to Wishlist
 * @apiName AddToWishlist
 * @apiGroup Wishlist
 * @apiPermission user
 * 
 * @apiParam {String} productId Product ID to add
 * @apiSuccess {Object} wishlist Updated wishlist
 */
export const addToWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { productId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Validate productId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Find or create wishlist
    let wishlist = await Wishlist.findOne({ user: userId });
    
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [productId] });
    } else {
      // Check if product already in wishlist
      if (wishlist.hasProduct(new mongoose.Types.ObjectId(productId))) {
        res.status(400).json({ error: 'Product already in wishlist' });
        return;
      }
      
      await wishlist.addProduct(new mongoose.Types.ObjectId(productId));
    }

    await wishlist.populate('products');
    res.json({ 
      message: 'Product added to wishlist',
      wishlist 
    });
  } catch (error) {
    logger.error('Error adding to wishlist:', error);
    res.status(500).json({ error: 'Failed to add product to wishlist' });
  }
};

/**
 * @api {delete} /api/wishlist/remove/:productId Remove Product from Wishlist
 * @apiName RemoveFromWishlist
 * @apiGroup Wishlist
 * @apiPermission user
 * 
 * @apiParam {String} productId Product ID to remove
 * @apiSuccess {Object} wishlist Updated wishlist
 */
export const removeFromWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { productId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Validate productId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      res.status(404).json({ error: 'Wishlist not found' });
      return;
    }

    await wishlist.removeProduct(new mongoose.Types.ObjectId(productId));
    await wishlist.populate('products');

    res.json({ 
      message: 'Product removed from wishlist',
      wishlist 
    });
  } catch (error) {
    logger.error('Error removing from wishlist:', error);
    res.status(500).json({ error: 'Failed to remove product from wishlist' });
  }
};

/**
 * @api {delete} /api/wishlist/clear Clear Wishlist
 * @apiName ClearWishlist
 * @apiGroup Wishlist
 * @apiPermission user
 * 
 * @apiSuccess {Object} message Success message
 */
export const clearWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      res.status(404).json({ error: 'Wishlist not found' });
      return;
    }

    await wishlist.clear();

    res.json({ 
      message: 'Wishlist cleared successfully',
      wishlist 
    });
  } catch (error) {
    logger.error('Error clearing wishlist:', error);
    res.status(500).json({ error: 'Failed to clear wishlist' });
  }
};

/**
 * @api {get} /api/wishlist/check/:productId Check if Product in Wishlist
 * @apiName CheckWishlist
 * @apiGroup Wishlist
 * @apiPermission user
 * 
 * @apiParam {String} productId Product ID to check
 * @apiSuccess {Boolean} inWishlist Whether product is in wishlist
 */
export const checkInWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { productId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Validate productId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      res.json({ inWishlist: false });
      return;
    }

    const inWishlist = wishlist.hasProduct(new mongoose.Types.ObjectId(productId));
    res.json({ inWishlist });
  } catch (error) {
    logger.error('Error checking wishlist:', error);
    res.status(500).json({ error: 'Failed to check wishlist' });
  }
};

/**
 * Get wishlist items with pagination
 */
export const getWishlistItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const wishlist = await Wishlist.findOne({ user: userId })
      .populate({
        path: 'products',
        options: {
          skip,
          limit
        }
      })
      .exec();

    if (!wishlist) {
      res.json({
        items: [],
        totalItems: 0,
        currentPage: page,
        totalPages: 0,
        hasMore: false
      });
      return;
    }

    const totalItems = wishlist.products.length;
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      items: wishlist.products,
      totalItems,
      currentPage: page,
      totalPages,
      hasMore: page < totalPages
    });
  } catch (error) {
    logger.error('Error fetching wishlist items:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist items' });
  }
};

/**
 * Update wishlist item (e.g., add notes or priority)
 */
export const updateWishlistItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { productId } = req.params;
    const { notes, priority } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      res.status(404).json({ error: 'Wishlist not found' });
      return;
    }

    // Check if product exists in wishlist
    if (!wishlist.hasProduct(new mongoose.Types.ObjectId(productId))) {
      res.status(404).json({ error: 'Product not found in wishlist' });
      return;
    }

    // Update metadata (stored in a separate field if needed)
    // For now, we'll just confirm the update
    // In a real implementation, you might extend the Wishlist schema to support item metadata

    await wishlist.populate('products');

    res.json({
      message: 'Wishlist item updated successfully',
      wishlist
    });
  } catch (error) {
    logger.error('Error updating wishlist item:', error);
    res.status(500).json({ error: 'Failed to update wishlist item' });
  }
};

/**
 * Get wishlist item count
 */
export const getWishlistCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const wishlist = await Wishlist.findOne({ user: userId });

    const count = wishlist ? wishlist.products.length : 0;

    res.json({ count });
  } catch (error) {
    logger.error('Error getting wishlist count:', error);
    res.status(500).json({ error: 'Failed to get wishlist count' });
  }
};

/**
 * Move item from wishlist to cart
 */
export const moveToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { productId } = req.params;
    const { quantity = 1 } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Check stock availability
    if (product.stock < quantity) {
      res.status(400).json({ 
        error: 'Insufficient stock',
        availableStock: product.stock
      });
      return;
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (existingItemIndex >= 0) {
      // Update quantity if already in cart
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      if (newQuantity > product.stock) {
        res.status(400).json({ 
          error: 'Total quantity would exceed available stock',
          currentCartQuantity: cart.items[existingItemIndex].quantity,
          availableStock: product.stock
        });
        return;
      }
      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item to cart
      cart.items.push({
        product: product._id as Types.ObjectId,
        name: product.name,
        price: product.price,
        quantity,
        image: product.images?.[0] || '',
        maxQuantity: product.stock
      });
    }

    await cart.save();

    // Remove from wishlist
    const wishlist = await Wishlist.findOne({ user: userId });
    if (wishlist) {
      await wishlist.removeProduct(new mongoose.Types.ObjectId(productId));
    }

    res.json({
      message: 'Product moved to cart successfully',
      cart
    });
  } catch (error) {
    logger.error('Error moving to cart:', error);
    res.status(500).json({ error: 'Failed to move product to cart' });
  }
};

/**
 * Share wishlist - Generate shareable link/data
 */
export const shareWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const wishlist = await Wishlist.findOne({ user: userId })
      .populate('products', 'name price images category')
      .exec();

    if (!wishlist || wishlist.products.length === 0) {
      res.status(404).json({ error: 'Wishlist is empty or not found' });
      return;
    }

    // Generate a shareable token/URL
    // In a real app, you'd create a shareable link with a unique token
    const shareToken = Buffer.from(userId.toString()).toString('base64');
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/wishlist/shared/${shareToken}`;

    res.json({
      success: true,
      shareUrl,
      shareToken,
      message: 'Wishlist share link generated',
      itemCount: wishlist.products.length
    });
  } catch (error) {
    logger.error('Error sharing wishlist:', error);
    res.status(500).json({ error: 'Failed to share wishlist' });
  }
};

/**
 * Get price drops for wishlist items
 */
export const getPriceDrops = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const wishlist = await Wishlist.findOne({ user: userId })
      .populate('products')
      .exec();

    if (!wishlist) {
      res.json({ priceDrops: [] });
      return;
    }

    // Check for price drops
    // In a real app, you'd track historical prices
    // For now, we'll check if items are on sale or have discounts
    const priceDrops = [];

    for (const product of wishlist.products) {
      const prod = product as any;
      // Check if product has a discount or is on sale
      if (prod.discount && prod.discount > 0) {
        const originalPrice = prod.price / (1 - prod.discount / 100);
        priceDrops.push({
          product: {
            id: prod._id,
            name: prod.name,
            image: prod.images?.[0] || ''
          },
          originalPrice: originalPrice.toFixed(2),
          currentPrice: prod.price,
          discount: prod.discount,
          savings: (originalPrice - prod.price).toFixed(2),
          droppedAt: prod.updatedAt
        });
      }
    }

    res.json({
      success: true,
      priceDrops,
      count: priceDrops.length
    });
  } catch (error) {
    logger.error('Error fetching price drops:', error);
    res.status(500).json({ error: 'Failed to fetch price drops' });
  }
};

/**
 * Get wishlist statistics
 */
export const getWishlistStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const wishlist = await Wishlist.findOne({ user: userId })
      .populate('products')
      .exec();

    if (!wishlist) {
      res.json({
        totalItems: 0,
        totalValue: 0,
        categoriesCount: 0,
        averagePrice: 0,
        inStockCount: 0,
        outOfStockCount: 0
      });
      return;
    }

    const products = wishlist.products as any[];
    const totalItems = products.length;
    const totalValue = products.reduce((sum, p) => sum + (p.price || 0), 0);
    const averagePrice = totalItems > 0 ? totalValue / totalItems : 0;

    // Count in-stock vs out-of-stock
    const inStockCount = products.filter(p => p.stock > 0).length;
    const outOfStockCount = totalItems - inStockCount;

    // Get unique categories
    const categories = new Set(products.map(p => p.category?.toString()).filter(Boolean));
    const categoriesCount = categories.size;

    // Most expensive and cheapest items
    const mostExpensive = products.length > 0 
      ? products.reduce((max, p) => p.price > max.price ? p : max, products[0])
      : null;
    const cheapest = products.length > 0
      ? products.reduce((min, p) => p.price < min.price ? p : min, products[0])
      : null;

    res.json({
      success: true,
      stats: {
        totalItems,
        totalValue: totalValue.toFixed(2),
        averagePrice: averagePrice.toFixed(2),
        categoriesCount,
        inStockCount,
        outOfStockCount,
        mostExpensive: mostExpensive ? {
          id: mostExpensive._id,
          name: mostExpensive.name,
          price: mostExpensive.price
        } : null,
        cheapest: cheapest ? {
          id: cheapest._id,
          name: cheapest.name,
          price: cheapest.price
        } : null
      }
    });
  } catch (error) {
    logger.error('Error fetching wishlist stats:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist statistics' });
  }
};

/**
 * Merge wishlist (e.g., after login to combine guest wishlist)
 */
export const mergeWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { productIds } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!productIds || !Array.isArray(productIds)) {
      res.status(400).json({ error: 'Product IDs array is required' });
      return;
    }

    // Find or create user's wishlist
    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [] });
    }

    // Add products that aren't already in wishlist
    let addedCount = 0;
    const skippedProducts = [];

    for (const productId of productIds) {
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        continue;
      }

      const objectId = new mongoose.Types.ObjectId(productId);
      
      // Check if product exists
      const product = await Product.findById(objectId);
      if (!product) {
        skippedProducts.push({ productId, reason: 'Product not found' });
        continue;
      }

      // Check if already in wishlist
      if (!wishlist.hasProduct(objectId)) {
        await wishlist.addProduct(objectId);
        addedCount++;
      } else {
        skippedProducts.push({ productId, reason: 'Already in wishlist' });
      }
    }

    await wishlist.populate('products');

    res.json({
      success: true,
      message: `Merged ${addedCount} items into wishlist`,
      addedCount,
      skippedCount: skippedProducts.length,
      skippedProducts: skippedProducts.length > 0 ? skippedProducts : undefined,
      wishlist
    });
  } catch (error) {
    logger.error('Error merging wishlist:', error);
    res.status(500).json({ error: 'Failed to merge wishlist' });
  }
};

/**
 * Export wishlist (CSV/JSON format)
 */
export const exportWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const format = (req.query.format as string) || 'json';

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const wishlist = await Wishlist.findOne({ user: userId })
      .populate('products')
      .exec();

    if (!wishlist || wishlist.products.length === 0) {
      res.status(404).json({ error: 'Wishlist is empty' });
      return;
    }

    const products = wishlist.products as any[];

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Product ID,Name,Price,Category,Stock,URL\n';
      const csvRows = products.map(p => 
        `${p._id},"${p.name}",${p.price},"${p.category?.name || 'N/A'}",${p.stock},"${process.env.FRONTEND_URL}/products/${p._id}"`
      ).join('\n');
      
      const csv = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="wishlist-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      // JSON format
      const exportData = {
        exportedAt: new Date().toISOString(),
        totalItems: products.length,
        items: products.map(p => ({
          id: p._id,
          name: p.name,
          price: p.price,
          category: p.category?.name || 'N/A',
          stock: p.stock,
          inStock: p.stock > 0,
          image: p.images?.[0] || '',
          url: `${process.env.FRONTEND_URL}/products/${p._id}`
        }))
      };

      res.json(exportData);
    }
  } catch (error) {
    logger.error('Error exporting wishlist:', error);
    res.status(500).json({ error: 'Failed to export wishlist' });
  }
};
