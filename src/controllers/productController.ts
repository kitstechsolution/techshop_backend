import { Request, Response } from 'express';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { Wishlist } from '../models/Wishlist.js';
import { Review } from '../models/Review.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

/**
 * @api {get} /api/products Get All Products with Filters
 * @apiName GetProducts
 * @apiGroup Products
 * @apiPermission public
 * 
 * @apiQuery {String} [category] Filter by category
 * @apiQuery {String} [subcategory] Filter by subcategory
 * @apiQuery {Number} [minPrice] Minimum price
 * @apiQuery {Number} [maxPrice] Maximum price
 * @apiQuery {Number} [minRating] Minimum average rating (0-5)
 * @apiQuery {Boolean} [inStock] Only in-stock products
 * @apiQuery {Boolean} [featured] Only featured products
 * @apiQuery {Boolean} [isNew] Only new products
 * @apiQuery {String} [tags] Comma-separated tags
 * @apiQuery {String} [sort] Sort by (price-asc, price-desc, rating, newest, popular, name)
 * @apiQuery {Number} [page=1] Page number
 * @apiQuery {Number} [limit=20] Products per page
 * @apiSuccess {Object} products Filtered products with pagination
 */
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      category,
      subcategory,
      minPrice,
      maxPrice,
      minRating,
      inStock,
      featured,
      isNew,
      tags,
      onSale,
      sort = 'newest',
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    // Build filter query
    const filter: any = {};

    if (category) {
      filter.category = Array.isArray(category) ? { $in: category } : category;
    }

    if (subcategory) {
      filter.subcategory = Array.isArray(subcategory) ? { $in: subcategory } : subcategory;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice as string);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice as string);
    }

    // Rating filter
    if (minRating) {
      filter.averageRating = { $gte: parseFloat(minRating as string) };
    }

    // Stock filter
    if (inStock === 'true') {
      filter.stock = { $gt: 0 };
    }

    // Featured filter
    if (featured === 'true') {
      filter.isFeatured = true;
    }

    // New products filter
    if (isNew === 'true') {
      filter.isNew = true;
    }

    // Tags filter
    if (tags) {
      const tagArray = (tags as string).split(',').map(t => t.trim());
      filter.tags = { $in: tagArray };
    }

    // On Sale filter
    if (onSale === 'true') {
      filter.$or = [
        { discount: { $gt: 0 } },
        { 'badges.type': 'sale' }
      ];
    }

    // Determine sort order
    let sortOption: any = {};
    switch (sort) {
      case 'price-asc':
        sortOption = { price: 1 };
        break;
      case 'price-desc':
        sortOption = { price: -1 };
        break;
      case 'rating':
        sortOption = { averageRating: -1, totalReviews: -1 };
        break;
      case 'popular':
        sortOption = { totalReviews: -1, averageRating: -1 };
        break;
      case 'name':
        sortOption = { name: 1 };
        break;
      case 'newest':
      default:
        sortOption = { createdAt: -1 };
        break;
    }

    // Execute query with pagination
    const [productsRaw, total] = await Promise.all([
      Product.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter)
    ]);

    // Attach live review stats from Review model to ensure listing shows accurate ratings
    const productIds = productsRaw.map((p: any) => p._id).filter(Boolean);
    let products = productsRaw;
    if (productIds.length > 0) {
      const reviewAgg = await Review.aggregate([
        { $match: { product: { $in: productIds }, status: 'approved' } },
        {
          $group: {
            _id: '$product',
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
          },
        },
      ]);

      const statMap = new Map<string, { avg: number; count: number }>();
      reviewAgg.forEach((s: any) => {
        const avg = s.averageRating ? Math.round(s.averageRating * 10) / 10 : 0;
        statMap.set(String(s._id), { avg, count: s.totalReviews || 0 });
      });

      products = productsRaw.map((p: any) => {
        const s = statMap.get(String(p._id));
        return {
          ...p,
          averageRating: s?.avg ?? p.averageRating ?? 0,
          totalReviews: s?.count ?? p.totalReviews ?? 0,
        };
      });
    }

    // Get available filter options for frontend
    const [categories, priceRange] = await Promise.all([
      Product.distinct('category'),
      Product.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' }
          }
        }
      ])
    ]);

    res.json({
      products,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalProducts: total,
        limit: limitNum,
        hasNext: skip + limitNum < total,
        hasPrev: pageNum > 1
      },
      filters: {
        applied: {
          category,
          subcategory,
          minPrice,
          maxPrice,
          minRating,
          inStock,
          featured,
          isNew,
          tags,
          sort
        },
        available: {
          categories,
          priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 }
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

/**
 * @api {get} /api/products/category/:category Get Products by Category
 * @apiName GetProductsByCategory
 * @apiGroup Products
 * @apiPermission public
 * 
 * @apiParam {String} category Product category
 * @apiQuery {Number} [page=1] Page number
 * @apiQuery {Number} [limit=20] Products per page
 * @apiQuery {String} [sort] Sort option
 * @apiSuccess {Object} products Products in category
 */
export const getProductsByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.params;
    const { page = '1', limit = '20', sort = 'newest' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Determine sort
    let sortOption: any = { createdAt: -1 };
    switch (sort) {
      case 'price-asc':
        sortOption = { price: 1 };
        break;
      case 'price-desc':
        sortOption = { price: -1 };
        break;
      case 'rating':
        sortOption = { averageRating: -1 };
        break;
    }

    const [productsRaw, total] = await Promise.all([
      Product.find({ category })
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments({ category })
    ]);

    // Enrich with review stats to ensure accurate ratings
    const ids = productsRaw.map((p: any) => p._id).filter(Boolean);
    let products = productsRaw;
    if (ids.length > 0) {
      const reviewAgg = await Review.aggregate([
        { $match: { product: { $in: ids }, status: 'approved' } },
        { $group: { _id: '$product', averageRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } },
      ]);
      const statMap = new Map<string, { avg: number; count: number }>();
      reviewAgg.forEach((s: any) => {
        const avg = s.averageRating ? Math.round(s.averageRating * 10) / 10 : 0;
        statMap.set(String(s._id), { avg, count: s.totalReviews || 0 });
      });
      products = productsRaw.map((p: any) => {
        const s = statMap.get(String(p._id));
        return { ...p, averageRating: s?.avg ?? p.averageRating ?? 0, totalReviews: s?.count ?? p.totalReviews ?? 0 };
      });
    }

    res.json({
      category,
      products,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalProducts: total,
        limit: limitNum
      }
    });
  } catch (error) {
    logger.error('Error fetching products by category:', error);
    res.status(500).json({ error: 'Failed to fetch products by category' });
  }
};

/**
 * @api {get} /api/products/:id Get Product by ID
 * @apiName GetProduct
 * @apiGroup Products
 * @apiPermission public
 * 
 * @apiParam {String} id Product ID
 * @apiSuccess {Object} product Product details
 */
export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const product = await Product.findById(id);

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json(product);
  } catch (error) {
    logger.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

/**
 * @api {get} /api/products/filters/options Get Available Filter Options
 * @apiName GetFilterOptions
 * @apiGroup Products
 * @apiPermission public
 * 
 * @apiSuccess {Object} options Available filter options
 */
export const getFilterOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get all unique subcategories and tags
    const [subcategories, tags] = await Promise.all([
      Product.distinct('subcategory'),
      Product.distinct('tags')
    ]);

    // Get price range
    const priceRange = await Product.aggregate([
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        }
      }
    ]);

    // Get rating distribution
    const ratingDistribution = await Product.aggregate([
      {
        $bucket: {
          groupBy: '$averageRating',
          boundaries: [0, 1, 2, 3, 4, 5],
          default: 'No Rating',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

    // Get stock status counts
    const stockCounts = await Product.aggregate([
      {
        $group: {
          _id: null,
          inStock: { $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] } },
          outOfStock: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } }
        }
      }
    ]);

    // Get product counts by category
    const categoryCount = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      categories: categoryCount.map(c => ({
        name: c._id,
        count: c.count
      })),
      subcategories: subcategories.filter(Boolean),
      tags: tags.filter(Boolean),
      priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 },
      ratingDistribution,
      stockCounts: stockCounts[0] || { inStock: 0, outOfStock: 0 },
      sortOptions: [
        { value: 'newest', label: 'Newest First' },
        { value: 'price-asc', label: 'Price: Low to High' },
        { value: 'price-desc', label: 'Price: High to Low' },
        { value: 'rating', label: 'Highest Rated' },
        { value: 'popular', label: 'Most Popular' },
        { value: 'name', label: 'Name: A to Z' }
      ]
    });
  } catch (error) {
    logger.error('Error fetching filter options:', error);
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
};

/**
 * @api {get} /api/products/featured/list Get Featured Products
 * @apiName GetFeaturedProducts
 * @apiGroup Products
 * @apiPermission public
 * 
 * @apiQuery {Number} [limit=10] Number of featured products
 * @apiSuccess {Array} products Featured products
 */
export const getFeaturedProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string);

    const products = await Product.find({ isFeatured: true })
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(limitNum)
      .lean();

    res.json({ products });
  } catch (error) {
    logger.error('Error fetching featured products:', error);
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
};

/**
 * @api {get} /api/products/new/list Get New Products
 * @apiName GetNewProducts
 * @apiGroup Products
 * @apiPermission public
 * 
 * @apiQuery {Number} [limit=10] Number of new products
 * @apiSuccess {Array} products New products
 */
export const getNewProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string);

    const products = await Product.find({ isNew: true })
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    res.json({ products });
  } catch (error) {
    logger.error('Error fetching new products:', error);
    res.status(500).json({ error: 'Failed to fetch new products' });
  }
};

/**
 * Get product by slug
 */
export const getProductBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ slug });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json(product);
  } catch (error) {
    logger.error('Error fetching product by slug:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

/**
 * Get best sellers
 */
export const getBestSellers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = '10', category } = req.query;
    const limitNum = parseInt(limit as string);

    // Get products sorted by total sales
    // In a real app, you'd track sales count in the product model
    // For now, we'll use total reviews and rating as a proxy for popularity
    const filter: any = {};
    if (category) {
      filter.category = category;
    }

    const products = await Product.find(filter)
      .sort({
        totalReviews: -1,
        averageRating: -1,
        createdAt: -1
      })
      .limit(limitNum)
      .lean();

    res.json({
      success: true,
      products,
      count: products.length
    });
  } catch (error) {
    logger.error('Error fetching best sellers:', error);
    res.status(500).json({ error: 'Failed to fetch best sellers' });
  }
};

/**
 * Get related products based on category and tags
 */
export const getRelatedProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { limit = '5' } = req.query;
    const limitNum = parseInt(limit as string);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    // Get the original product
    const product = await Product.findById(id);

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Find related products
    // Priority: same category and matching tags > same category > similar price range
    const relatedProducts = await Product.find({
      _id: { $ne: product._id }, // Exclude the current product
      $or: [
        {
          category: product.category,
          tags: { $in: product.tags || [] }
        },
        { category: product.category },
        {
          price: {
            $gte: product.price * 0.7,
            $lte: product.price * 1.3
          }
        }
      ]
    })
      .sort({ averageRating: -1 })
      .limit(limitNum)
      .lean();

    res.json({
      success: true,
      products: relatedProducts,
      count: relatedProducts.length
    });
  } catch (error) {
    logger.error('Error fetching related products:', error);
    res.status(500).json({ error: 'Failed to fetch related products' });
  }
};

/**
 * Get personalized recommendations for a user
 */
export const getRecommendations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string);

    if (!userId) {
      // Return popular products for non-authenticated users
      const products = await Product.find()
        .sort({ totalReviews: -1, averageRating: -1 })
        .limit(limitNum)
        .lean();

      res.json({
        success: true,
        products,
        count: products.length,
        type: 'popular'
      });
      return;
    }

    // Get user's order history
    const orders = await Order.find({ user: userId })
      .select('items')
      .limit(10)
      .lean();

    // Get user's wishlist
    const wishlist = await Wishlist.findOne({ user: userId })
      .select('products')
      .lean();

    // Collect categories and product IDs from order history
    const purchasedProductIds: string[] = [];
    const categoryPreferences: string[] = [];

    for (const order of orders) {
      for (const item of order.items) {
        const productId = item.product.toString();
        if (!purchasedProductIds.includes(productId)) {
          purchasedProductIds.push(productId);
        }
      }
    }

    // Get categories from purchased products
    if (purchasedProductIds.length > 0) {
      const purchasedProducts = await Product.find({
        _id: { $in: purchasedProductIds }
      }).select('category').lean();

      purchasedProducts.forEach(p => {
        if (p.category && !categoryPreferences.includes(p.category.toString())) {
          categoryPreferences.push(p.category.toString());
        }
      });
    }

    // Exclude already purchased products and wishlist items
    const excludeIds = [...purchasedProductIds];
    if (wishlist && wishlist.products) {
      excludeIds.push(...wishlist.products.map(p => p.toString()));
    }

    // Build recommendation query
    const recommendationFilter: any = {
      _id: { $nin: excludeIds }
    };

    if (categoryPreferences.length > 0) {
      recommendationFilter.category = { $in: categoryPreferences };
    }

    // Get recommended products
    const recommendations = await Product.find(recommendationFilter)
      .sort({
        averageRating: -1,
        totalReviews: -1,
        createdAt: -1
      })
      .limit(limitNum)
      .lean();

    res.json({
      success: true,
      products: recommendations,
      count: recommendations.length,
      type: 'personalized',
      basedOn: {
        orderHistory: purchasedProductIds.length,
        categoryPreferences: categoryPreferences.length
      }
    });
  } catch (error) {
    logger.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
};

/**
 * Check product availability
 */
export const checkAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { quantity = 1 } = req.query;
    const requestedQuantity = parseInt(quantity as string);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const product = await Product.findById(id).select('name stock price');

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const available = product.stock >= requestedQuantity;
    const maxAvailable = product.stock;

    res.json({
      success: true,
      available,
      stock: product.stock,
      requested: requestedQuantity,
      maxAvailable,
      message: available
        ? `${requestedQuantity} units available`
        : `Only ${maxAvailable} units available`,
      estimatedRestock: !available && product.stock === 0
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        : null
    });
  } catch (error) {
    logger.error('Error checking availability:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
};

/**
 * Get product variants (if product supports variants)
 */
export const getProductVariants = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const product = await Product.findById(id).select('name variants options');

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // For now, return a mock structure
    // In a real app, you'd have variant-specific stock and pricing
    const variants = {
      hasVariants: false, // This would be based on your product schema
      options: [
        // Example structure:
        // { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
        // { name: 'Color', values: ['Red', 'Blue', 'Green'] }
      ],
      combinations: [
        // Example:
        // { size: 'M', color: 'Red', stock: 10, price: product.price }
      ]
    };

    res.json({
      success: true,
      productId: product._id,
      productName: product.name,
      variants
    });
  } catch (error) {
    logger.error('Error fetching product variants:', error);
    res.status(500).json({ error: 'Failed to fetch product variants' });
  }
};

/**
 * Track product view
 */
export const trackProductView = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const product = await Product.findById(id);

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // In a real app, you'd track views in a separate collection or analytics service
    // For now, we'll just log it
    logger.info(`Product ${id} viewed by user ${userId || 'anonymous'}`);

    // You could also increment a views counter on the product
    // await Product.findByIdAndUpdate(id, { $inc: { views: 1 } });

    res.json({
      success: true,
      message: 'View tracked',
      productId: id
    });
  } catch (error) {
    logger.error('Error tracking product view:', error);
    res.status(500).json({ error: 'Failed to track view' });
  }
};

/**
 * Check if product is in user's wishlist
 */
export const isInWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      res.json({ inWishlist: false, message: 'User not authenticated' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const wishlist = await Wishlist.findOne({
      user: userId,
      products: id
    });

    res.json({
      success: true,
      inWishlist: !!wishlist,
      productId: id
    });
  } catch (error) {
    logger.error('Error checking wishlist status:', error);
    res.status(500).json({ error: 'Failed to check wishlist status' });
  }
};
