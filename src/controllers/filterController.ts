import { Request, Response } from 'express';
import { Product } from '../models/Product.js';
import { logger } from '../utils/logger.js';

/**
 * @api {get} /api/filters/facets Get Filter Facets
 * @apiName GetFilterFacets
 * @apiGroup Filters
 * @apiPermission public
 * 
 * @apiQuery {String} [category] Filter by category
 * @apiQuery {String} [q] Search query to apply before faceting
 * @apiSuccess {Object} facets Available filter options with counts
 */
export const getFilterFacets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, q } = req.query;

    // Build base query
    const baseQuery: any = {};
    
    if (category) {
      baseQuery.category = category;
    }
    
    if (q && typeof q === 'string') {
      baseQuery.$text = { $search: q };
    }

    // Get facets using aggregation
    const facets = await Product.aggregate([
      // Match base query
      ...(Object.keys(baseQuery).length > 0 ? [{ $match: baseQuery }] : []),
      
      // Facet aggregation
      {
        $facet: {
          // Price ranges
          priceRanges: [
            {
              $bucket: {
                groupBy: '$price',
                boundaries: [0, 500, 1000, 2500, 5000, 10000, 50000, 100000],
                default: 100000,
                output: {
                  count: { $sum: 1 },
                  minPrice: { $min: '$price' },
                  maxPrice: { $max: '$price' }
                }
              }
            }
          ],
          
          // Categories
          categories: [
            {
              $group: {
                _id: '$category',
                count: { $sum: 1 },
                avgPrice: { $avg: '$price' },
                subcategories: { $addToSet: '$subcategory' }
              }
            },
            { $sort: { count: -1 } }
          ],
          
          // Brands
          brands: [
            {
              $match: { brand: { $exists: true, $ne: null } }
            },
            {
              $group: {
                _id: '$brand',
                count: { $sum: 1 },
                avgPrice: { $avg: '$price' },
                avgRating: { $avg: '$averageRating' }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 50 }
          ],
          
          // Rating distribution
          ratings: [
            {
              $match: { averageRating: { $gt: 0 } }
            },
            {
              $bucket: {
                groupBy: '$averageRating',
                boundaries: [0, 1, 2, 3, 4, 5],
                default: 5,
                output: {
                  count: { $sum: 1 }
                }
              }
            }
          ],
          
          // Price statistics
          priceStats: [
            {
              $group: {
                _id: null,
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' },
                avgPrice: { $avg: '$price' }
              }
            }
          ],
          
          // Stock availability
          availability: [
            {
              $group: {
                _id: null,
                inStock: {
                  $sum: {
                    $cond: [{ $gt: ['$stock', 0] }, 1, 0]
                  }
                },
                outOfStock: {
                  $sum: {
                    $cond: [{ $eq: ['$stock', 0] }, 1, 0]
                  }
                }
              }
            }
          ],
          
          // Featured products count
          featured: [
            {
              $match: { isFeatured: true }
            },
            {
              $count: 'count'
            }
          ],
          
          // Products with discount
          onSale: [
            {
              $match: { discount: { $gt: 0 } }
            },
            {
              $count: 'count'
            }
          ]
        }
      }
    ]);

    const result = facets[0];
    
    // Format price ranges
    const priceRanges = result.priceRanges.map((range: any) => {
      const labels: { [key: number]: string } = {
        0: 'Under ₹500',
        500: '₹500 - ₹1000',
        1000: '₹1000 - ₹2500',
        2500: '₹2500 - ₹5000',
        5000: '₹5000 - ₹10000',
        10000: '₹10000 - ₹50000',
        50000: '₹50000 - ₹100000',
        100000: 'Over ₹100000'
      };
      
      return {
        label: labels[range._id] || `₹${range._id}+`,
        min: range._id,
        max: range._id === 100000 ? null : range._id,
        count: range.count
      };
    }).filter((r: any) => r.count > 0);

    res.json({
      facets: {
        priceRanges,
        categories: result.categories.map((c: any) => ({
          name: c._id,
          count: c.count,
          avgPrice: Math.round(c.avgPrice),
          subcategories: c.subcategories.filter((s: any) => s)
        })),
        brands: result.brands.map((b: any) => ({
          name: b._id,
          count: b.count,
          avgPrice: Math.round(b.avgPrice),
          avgRating: parseFloat(b.avgRating?.toFixed(1) || '0')
        })),
        ratings: result.ratings.map((r: any) => ({
          rating: r._id,
          count: r.count,
          label: `${r._id}+ stars`
        })),
        priceStats: result.priceStats[0] || {
          minPrice: 0,
          maxPrice: 0,
          avgPrice: 0
        },
        availability: {
          inStock: result.availability[0]?.inStock || 0,
          outOfStock: result.availability[0]?.outOfStock || 0
        },
        featured: result.featured[0]?.count || 0,
        onSale: result.onSale[0]?.count || 0
      }
    });
  } catch (error) {
    logger.error('Error getting filter facets:', error);
    res.status(500).json({ error: 'Failed to get filter facets' });
  }
};

/**
 * @api {get} /api/filters/brands Get All Brands
 * @apiName GetBrands
 * @apiGroup Filters
 * @apiPermission public
 * 
 * @apiQuery {String} [q] Search brands
 * @apiSuccess {Array} brands List of brands with product counts
 */
export const getBrands = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;

    const matchQuery: any = {
      brand: { $exists: true, $ne: null }
    };

    if (q && typeof q === 'string') {
      matchQuery.brand = { $regex: new RegExp(q, 'i') };
    }

    const brands = await Product.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$brand',
          count: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          avgRating: { $avg: '$averageRating' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      brands: brands.map(b => ({
        name: b._id,
        productCount: b.count,
        priceRange: {
          min: Math.round(b.minPrice),
          max: Math.round(b.maxPrice),
          avg: Math.round(b.avgPrice)
        },
        avgRating: parseFloat(b.avgRating?.toFixed(1) || '0')
      }))
    });
  } catch (error) {
    logger.error('Error getting brands:', error);
    res.status(500).json({ error: 'Failed to get brands' });
  }
};

/**
 * @api {get} /api/filters/price-range Get Price Range
 * @apiName GetPriceRange
 * @apiGroup Filters
 * @apiPermission public
 * 
 * @apiQuery {String} [category] Filter by category
 * @apiSuccess {Object} priceRange Min and max prices
 */
export const getPriceRange = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;

    const matchQuery: any = {};
    if (category) {
      matchQuery.category = category;
    }

    const result = await Product.aggregate([
      ...(Object.keys(matchQuery).length > 0 ? [{ $match: matchQuery }] : []),
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          avgPrice: { $avg: '$price' }
        }
      }
    ]);

    if (result.length === 0) {
      res.json({
        minPrice: 0,
        maxPrice: 0,
        avgPrice: 0
      });
      return;
    }

    res.json({
      minPrice: Math.floor(result[0].minPrice),
      maxPrice: Math.ceil(result[0].maxPrice),
      avgPrice: Math.round(result[0].avgPrice)
    });
  } catch (error) {
    logger.error('Error getting price range:', error);
    res.status(500).json({ error: 'Failed to get price range' });
  }
};

/**
 * @api {get} /api/filters/tags Get Popular Tags
 * @apiName GetTags
 * @apiGroup Filters
 * @apiPermission public
 * 
 * @apiQuery {Number} [limit=20] Number of tags to return
 * @apiSuccess {Array} tags Popular product tags
 */
export const getTags = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = '20' } = req.query;
    const limitNum = parseInt(limit as string);

    const tags = await Product.aggregate([
      { $match: { tags: { $exists: true, $ne: [] } } },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limitNum }
    ]);

    res.json({
      tags: tags.map(t => ({
        name: t._id,
        count: t.count
      }))
    });
  } catch (error) {
    logger.error('Error getting tags:', error);
    res.status(500).json({ error: 'Failed to get tags' });
  }
};
