import { Response } from 'express';
import { Product } from '../../models/Product.js';
import { AuthRequest } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import {
  updateStock,
  getInventoryHistory,
  getActiveAlerts,
  acknowledgeAlert,
  getInventoryStatistics,
  bulkStockAdjustment,
} from '../../services/inventoryService.js';
import mongoose from 'mongoose';

// @desc    Get inventory overview
// @route   GET /api/admin/inventory
// @access  Private/Admin
export const getInventoryOverview = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    // Filters
    const lowStock = req.query.lowStock === 'true';
    const outOfStock = req.query.outOfStock === 'true';
    const search = req.query.search as string;
    const category = req.query.category as string;
    
    // Build query
    const query: any = {};
    
    if (lowStock) {
      query.stock = { $lte: 10, $gt: 0 };
    }
    
    if (outOfStock) {
      query.stock = 0;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }
    
    if (category && mongoose.Types.ObjectId.isValid(category)) {
      query.category = category;
    }
    
    // Get products
    const products = await Product.find(query)
      .select('name sku images stock price category')
      .populate('category', 'name')
      .sort({ stock: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Product.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching inventory overview:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory',
    });
  }
};

// @desc    Update product stock
// @route   PATCH /api/admin/inventory/:productId/stock
// @access  Private/Admin
export const updateProductStock = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const { productId } = req.params;
    const { quantity, reason, notes } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    
    if (quantity === undefined || typeof quantity !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Quantity is required and must be a number',
      });
    }
    
    await updateStock({
      productId: new mongoose.Types.ObjectId(productId),
      quantity,
      type: 'adjustment',
      changedBy: adminId,
      reason: reason || 'Manual adjustment',
      notes,
    });
    
    // Get updated product
    const product = await Product.findById(productId).select('name stock');
    
    res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      data: {
        product: {
          id: product?._id,
          name: product?.name,
          stock: product?.stock,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error updating product stock:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating stock',
    });
  }
};

// @desc    Get inventory history for a product
// @route   GET /api/admin/inventory/:productId/history
// @access  Private/Admin
export const getProductInventoryHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as string;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    
    const result = await getInventoryHistory(
      new mongoose.Types.ObjectId(productId),
      { page, limit, type, startDate, endDate }
    );
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error fetching inventory history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory history',
    });
  }
};

// @desc    Get all inventory alerts
// @route   GET /api/admin/inventory/alerts
// @access  Private/Admin
export const getAllAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const alertType = req.query.alertType as string;
    const status = req.query.status as string;
    const productId = req.query.productId as string;
    
    const filters: any = {};
    
    if (alertType) {
      filters.alertType = alertType;
    }
    
    if (status) {
      filters.status = status;
    }
    
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      filters.productId = new mongoose.Types.ObjectId(productId);
    }
    
    const alerts = await getActiveAlerts(filters);
    
    res.status(200).json({
      success: true,
      data: {
        alerts,
        total: alerts.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching inventory alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching alerts',
    });
  }
};

// @desc    Acknowledge inventory alert
// @route   PATCH /api/admin/inventory/alerts/:alertId/acknowledge
// @access  Private/Admin
export const acknowledgeInventoryAlert = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const { alertId } = req.params;
    const { notes } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(alertId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid alert ID',
      });
    }
    
    await acknowledgeAlert(
      new mongoose.Types.ObjectId(alertId),
      adminId,
      notes
    );
    
    res.status(200).json({
      success: true,
      message: 'Alert acknowledged successfully',
    });
  } catch (error: any) {
    logger.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error acknowledging alert',
    });
  }
};

// @desc    Get inventory statistics
// @route   GET /api/admin/inventory/stats
// @access  Private/Admin
export const getInventoryStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await getInventoryStatistics();
    
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching inventory statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
    });
  }
};

// @desc    Bulk stock adjustment
// @route   POST /api/admin/inventory/bulk-adjust
// @access  Private/Admin
export const bulkAdjustStock = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const { adjustments } = req.body;
    
    if (!Array.isArray(adjustments) || adjustments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Adjustments array is required',
      });
    }
    
    // Validate adjustments
    const validAdjustments = adjustments
      .filter(adj => 
        adj.productId && 
        mongoose.Types.ObjectId.isValid(adj.productId) && 
        typeof adj.quantity === 'number'
      )
      .map(adj => ({
        productId: new mongoose.Types.ObjectId(adj.productId),
        quantity: adj.quantity,
        reason: adj.reason,
      }));
    
    if (validAdjustments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid adjustments provided',
      });
    }
    
    const result = await bulkStockAdjustment(validAdjustments, adminId);
    
    res.status(200).json({
      success: true,
      message: `Bulk adjustment completed: ${result.success} succeeded, ${result.failed} failed`,
      data: result,
    });
  } catch (error) {
    logger.error('Error performing bulk stock adjustment:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing bulk adjustment',
    });
  }
};

// @desc    Get low stock products
// @route   GET /api/admin/inventory/low-stock
// @access  Private/Admin
export const getLowStockProducts = async (req: AuthRequest, res: Response) => {
  try {
    const threshold = parseInt(req.query.threshold as string) || 10;
    
    const products = await Product.find({
      stock: { $lte: threshold, $gt: 0 }
    })
      .select('name sku images stock price category')
      .populate('category', 'name')
      .sort({ stock: 1 })
      .limit(50)
      .lean();
    
    res.status(200).json({
      success: true,
      data: {
        products,
        total: products.length,
        threshold,
      },
    });
  } catch (error) {
    logger.error('Error fetching low stock products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching low stock products',
    });
  }
};

// @desc    Get out of stock products
// @route   GET /api/admin/inventory/out-of-stock
// @access  Private/Admin
export const getOutOfStockProducts = async (req: AuthRequest, res: Response) => {
  try {
    const products = await Product.find({ stock: 0 })
      .select('name sku images stock price category')
      .populate('category', 'name')
      .sort({ name: 1 })
      .lean();
    
    res.status(200).json({
      success: true,
      data: {
        products,
        total: products.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching out of stock products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching out of stock products',
    });
  }
};

// @desc    Get inventory value report
// @route   GET /api/admin/inventory/value-report
// @access  Private/Admin
export const getInventoryValueReport = async (req: AuthRequest, res: Response) => {
  try {
    const report = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$stock' },
          totalValue: { $sum: { $multiply: ['$stock', '$price'] } },
          averagePrice: { $avg: '$price' },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      {
        $unwind: {
          path: '$categoryInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          categoryName: '$categoryInfo.name',
          totalProducts: 1,
          totalStock: 1,
          totalValue: { $round: ['$totalValue', 2] },
          averagePrice: { $round: ['$averagePrice', 2] },
        },
      },
      {
        $sort: { totalValue: -1 },
      },
    ]);
    
    // Calculate grand totals
    const grandTotals = report.reduce((acc, curr) => ({
      totalProducts: acc.totalProducts + curr.totalProducts,
      totalStock: acc.totalStock + curr.totalStock,
      totalValue: acc.totalValue + curr.totalValue,
    }), { totalProducts: 0, totalStock: 0, totalValue: 0 });
    
    res.status(200).json({
      success: true,
      data: {
        byCategory: report,
        grandTotals,
      },
    });
  } catch (error) {
    logger.error('Error generating inventory value report:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating report',
    });
  }
};

export default {
  getInventoryOverview,
  updateProductStock,
  getProductInventoryHistory,
  getAllAlerts,
  acknowledgeInventoryAlert,
  getInventoryStats,
  bulkAdjustStock,
  getLowStockProducts,
  getOutOfStockProducts,
  getInventoryValueReport,
};
