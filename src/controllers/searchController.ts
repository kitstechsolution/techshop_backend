import { Request, Response } from 'express';
import { Product } from '../models/Product.js';
import { logger } from '../utils/logger.js';

/**
 * @api {get} /api/search Search Products
 * @apiName SearchProducts
 * @apiGroup Search
 * @apiPermission public
 * 
 * @apiQuery {String} q Search query
 * @apiQuery {Number} [page=1] Page number
 * @apiQuery {Number} [limit=20] Results per page
 * @apiQuery {String} [category] Filter by category
 * @apiQuery {Number} [minPrice] Minimum price
 * @apiQuery {Number} [maxPrice] Maximum price
 * @apiQuery {Number} [minRating] Minimum rating
 * @apiQuery {Boolean} [inStock] Only in-stock items
 * @apiQuery {String} [brand] Filter by brand
 * @apiQuery {String} [tags] Filter by tags (comma-separated)
 * @apiQuery {Boolean} [featured] Only featured items
 * @apiQuery {Boolean} [onSale] Only items on sale
 * @apiQuery {String} [sort] Sort by (relevance, price-asc, price-desc, rating, newest, discount)
 * @apiSuccess {Object} results Search results with pagination
 */
export const searchProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      q,
      page = '1',
      limit = '20',
      category,
      minPrice,
      maxPrice,
      minRating,
      inStock,
      brand,
      tags,
      featured,
      onSale,
      sort = 'relevance'
    } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build search query
    const searchQuery: any = {
      $text: { $search: q }
    };

    // Add filters
    if (category) {
      searchQuery.category = category;
    }

    if (minPrice || maxPrice) {
      searchQuery.price = {};
      if (minPrice) searchQuery.price.$gte = parseFloat(minPrice as string);
      if (maxPrice) searchQuery.price.$lte = parseFloat(maxPrice as string);
    }

    if (minRating) {
      searchQuery.averageRating = { $gte: parseFloat(minRating as string) };
    }

    if (inStock === 'true') {
      searchQuery.stock = { $gt: 0 };
    }

    if (brand) {
      searchQuery.brand = brand;
    }

    if (tags && typeof tags === 'string') {
      const tagArray = tags.split(',').map(t => t.trim());
      searchQuery.tags = { $in: tagArray };
    }

    if (featured === 'true') {
      searchQuery.isFeatured = true;
    }

    if (onSale === 'true') {
      searchQuery.discount = { $gt: 0 };
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
        sortOption = { averageRating: -1 };
        break;
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
      case 'discount':
        sortOption = { discount: -1 };
        break;
      case 'relevance':
      default:
        sortOption = { score: { $meta: 'textScore' } };
        break;
    }

    // Add text score for relevance sorting
    const projection = sort === 'relevance' 
      ? { score: { $meta: 'textScore' } }
      : {};

    // Execute search
    const [products, total] = await Promise.all([
      Product.find(searchQuery, projection)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(searchQuery)
    ]);

    res.json({
      query: q,
      results: products,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalResults: total,
        limit: limitNum,
        hasNext: skip + limitNum < total,
        hasPrev: pageNum > 1
      },
      filters: {
        category,
        minPrice,
        maxPrice,
        minRating,
        inStock,
        sort
      }
    });
  } catch (error) {
    logger.error('Error searching products:', error);
    res.status(500).json({ error: 'Failed to search products' });
  }
};

/**
 * @api {get} /api/search/suggest Autosuggest Products
 * @apiName AutosuggestProducts
 * @apiGroup Search
 * @apiPermission public
 * 
 * @apiQuery {String} q Search query (minimum 2 characters)
 * @apiQuery {Number} [limit=10] Number of suggestions
 * @apiSuccess {Array} suggestions Product suggestions
 */
export const autosuggest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, limit = '10' } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    if (q.length < 2) {
      res.json({ suggestions: [] });
      return;
    }

    const limitNum = Math.min(parseInt(limit as string), 20); // Max 20 suggestions

    // Use text search for better relevance
    const suggestions = await Product.find(
      { $text: { $search: q } },
      { 
        score: { $meta: 'textScore' },
        name: 1,
        category: 1,
        price: 1,
        imageUrl: 1,
        averageRating: 1,
        stock: 1
      }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limitNum)
      .lean();

    // Also get category suggestions
    const categoryMatch = await Product.distinct('category', {
      category: { $regex: new RegExp(q, 'i') }
    });

    res.json({
      query: q,
      suggestions: suggestions.map(p => ({
        id: p._id,
        name: p.name,
        category: p.category,
        price: p.price,
        imageUrl: p.imageUrl,
        rating: p.averageRating,
        inStock: p.stock > 0
      })),
      categories: categoryMatch.slice(0, 5),
      totalSuggestions: suggestions.length
    });
  } catch (error) {
    logger.error('Error getting suggestions:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
};

/**
 * @api {get} /api/search/popular Get Popular Searches
 * @apiName GetPopularSearches
 * @apiGroup Search
 * @apiPermission public
 * 
 * @apiQuery {Number} [limit=10] Number of popular searches
 * @apiSuccess {Array} searches Popular search terms
 */
export const getPopularSearches = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string);

    // Get most common categories as popular searches
    const popularCategories = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgRating: { $avg: '$averageRating' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limitNum },
      {
        $project: {
          term: '$_id',
          type: { $literal: 'category' },
          count: 1,
          avgRating: { $round: ['$avgRating', 1] },
          _id: 0
        }
      }
    ]);

    // Get some popular product names (you could track this with analytics)
    const popularProducts = await Product.find({ averageRating: { $gte: 4 } })
      .select('name category')
      .limit(5)
      .lean();

    const popularTerms = popularProducts.map(p => ({
      term: p.name,
      type: 'product',
      category: p.category
    }));

    res.json({
      popularSearches: [...popularCategories, ...popularTerms].slice(0, limitNum)
    });
  } catch (error) {
    logger.error('Error getting popular searches:', error);
    res.status(500).json({ error: 'Failed to get popular searches' });
  }
};

/**
 * @api {get} /api/search/categories Search Categories
 * @apiName SearchCategories
 * @apiGroup Search
 * @apiPermission public
 * 
 * @apiQuery {String} q Search query
 * @apiSuccess {Array} categories Matching categories
 */
export const searchCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      // Return all categories if no query
      const allCategories = await Product.distinct('category');
      res.json({ categories: allCategories });
      return;
    }

    // Search for matching categories
    const categories = await Product.distinct('category', {
      category: { $regex: new RegExp(q, 'i') }
    });

    // Get product count per category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await Product.countDocuments({ category });
        return { name: category, productCount: count };
      })
    );

    res.json({
      query: q,
      categories: categoriesWithCount
    });
  } catch (error) {
    logger.error('Error searching categories:', error);
    res.status(500).json({ error: 'Failed to search categories' });
  }
};

/**
 * @api {post} /api/search/track Track Search Query
 * @apiName TrackSearch
 * @apiGroup Search
 * @apiPermission public
 * 
 * @apiBody {String} query Search query
 * @apiBody {Number} resultsCount Number of results
 * @apiSuccess {Object} message Success message
 */
export const trackSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, resultsCount } = req.body;

    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    // TODO: Store in analytics collection when implemented in Phase 2.13
    // For now, just log it
    logger.info('Search tracked:', { query, resultsCount, timestamp: new Date() });

    res.json({ message: 'Search tracked successfully' });
  } catch (error) {
    logger.error('Error tracking search:', error);
    res.status(500).json({ error: 'Failed to track search' });
  }
};
