import { Product } from '../models/Product.js';
import { InventoryLog } from '../models/InventoryLog.js';
import { InventoryAlert } from '../models/InventoryAlert.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

// Stock thresholds (can be configured per product)
const DEFAULT_LOW_STOCK_THRESHOLD = 10;
const DEFAULT_OUT_OF_STOCK_THRESHOLD = 0;

interface StockUpdateParams {
  productId: mongoose.Types.ObjectId;
  variantId?: string;
  quantity: number; // Positive to add, negative to reduce
  type: 'purchase' | 'sale' | 'return' | 'adjustment' | 'damaged' | 'restocked';
  changedBy: mongoose.Types.ObjectId;
  reference?: {
    type: 'Order' | 'PurchaseOrder' | 'Manual';
    id?: mongoose.Types.ObjectId;
  };
  reason?: string;
  notes?: string;
  cost?: number;
}

// Update stock and create log entry
export const updateStock = async (params: StockUpdateParams): Promise<boolean> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const product = await Product.findById(params.productId).session(session);
    
    if (!product) {
      throw new Error('Product not found');
    }

    const previousStock = product.stock;
    const newStock = previousStock + params.quantity;

    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }

    // Update product stock
    product.stock = newStock;
    await product.save({ session });

    // Create inventory log
    await InventoryLog.create([{
      product: params.productId,
      variantId: params.variantId,
      type: params.type,
      quantity: params.quantity,
      previousStock,
      newStock,
      reference: params.reference,
      reason: params.reason,
      notes: params.notes,
      cost: params.cost,
      changedBy: params.changedBy,
    }], { session });

    // Check for stock alerts
    await checkStockAlerts(params.productId, params.variantId, newStock, session);

    await session.commitTransaction();
    logger.info(`Stock updated for product ${params.productId}: ${previousStock} → ${newStock}`);
    return true;
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error updating stock:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

// Check and create stock alerts
async function checkStockAlerts(
  productId: mongoose.Types.ObjectId,
  variantId: string | undefined,
  currentStock: number,
  session?: mongoose.ClientSession
): Promise<void> {
  try {
    // Determine alert type
    let alertType: 'low_stock' | 'out_of_stock' | null = null;
    let threshold = 0;

    if (currentStock === 0) {
      alertType = 'out_of_stock';
      threshold = DEFAULT_OUT_OF_STOCK_THRESHOLD;
    } else if (currentStock <= DEFAULT_LOW_STOCK_THRESHOLD) {
      alertType = 'low_stock';
      threshold = DEFAULT_LOW_STOCK_THRESHOLD;
    }

    if (alertType) {
      // Check if alert already exists
      const existingAlert = await InventoryAlert.findOne({
        product: productId,
        variantId: variantId || null,
        alertType,
        status: 'active',
      }).session(session || null);

      if (!existingAlert) {
        // Create new alert
        await InventoryAlert.create([{
          product: productId,
          variantId,
          alertType,
          threshold,
          currentStock,
          status: 'active',
        }], { session: session || undefined });

        logger.info(`${alertType} alert created for product ${productId}`);
      }
    } else {
      // Resolve existing alerts if stock is sufficient
      await InventoryAlert.updateMany(
        {
          product: productId,
          variantId: variantId || null,
          status: 'active',
        },
        {
          $set: {
            status: 'resolved',
            resolvedAt: new Date(),
          },
        }
      ).session(session || null);
    }
  } catch (error) {
    logger.error('Error checking stock alerts:', error);
  }
}

// Reduce stock when order is placed
export const reduceStockForOrder = async (
  orderId: mongoose.Types.ObjectId,
  items: Array<{
    productId: mongoose.Types.ObjectId;
    quantity: number;
    variantId?: string;
  }>,
  userId: mongoose.Types.ObjectId
): Promise<boolean> => {
  try {
    for (const item of items) {
      await updateStock({
        productId: item.productId,
        variantId: item.variantId,
        quantity: -item.quantity, // Negative to reduce
        type: 'sale',
        changedBy: userId,
        reference: {
          type: 'Order',
          id: orderId,
        },
        reason: 'Order placed',
      });
    }
    return true;
  } catch (error) {
    logger.error('Error reducing stock for order:', error);
    throw error;
  }
};

// Restore stock when order is cancelled or returned
export const restoreStockForOrder = async (
  orderId: mongoose.Types.ObjectId,
  items: Array<{
    productId: mongoose.Types.ObjectId;
    quantity: number;
    variantId?: string;
  }>,
  userId: mongoose.Types.ObjectId,
  type: 'return' | 'adjustment' = 'return'
): Promise<boolean> => {
  try {
    for (const item of items) {
      await updateStock({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity, // Positive to add back
        type,
        changedBy: userId,
        reference: {
          type: 'Order',
          id: orderId,
        },
        reason: type === 'return' ? 'Order cancelled/returned' : 'Stock adjustment',
      });
    }
    return true;
  } catch (error) {
    logger.error('Error restoring stock for order:', error);
    throw error;
  }
};

// Get inventory history for a product
export const getInventoryHistory = async (
  productId: mongoose.Types.ObjectId,
  options: {
    page?: number;
    limit?: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{
  logs: any[];
  pagination: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}> => {
  const {
    page = 1,
    limit = 20,
    type,
    startDate,
    endDate,
  } = options;

  const skip = (page - 1) * limit;

  // Build query
  const query: any = { product: productId };

  if (type) {
    query.type = type;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = startDate;
    if (endDate) query.createdAt.$lte = endDate;
  }

  const logs = await InventoryLog.find(query)
    .populate('changedBy', 'firstName lastName email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await InventoryLog.countDocuments(query);

  return {
    logs,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    },
  };
};

// Get active alerts
export const getActiveAlerts = async (
  filters: {
    productId?: mongoose.Types.ObjectId;
    alertType?: string;
    status?: string;
  } = {}
): Promise<any[]> => {
  const query: any = {};

  if (filters.productId) {
    query.product = filters.productId;
  }

  if (filters.alertType) {
    query.alertType = filters.alertType;
  }

  if (filters.status) {
    query.status = filters.status;
  } else {
    query.status = 'active'; // Default to active alerts
  }

  const alerts = await InventoryAlert.find(query)
    .populate('product', 'name sku images')
    .populate('acknowledgedBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .lean();

  return alerts;
};

// Acknowledge alert
export const acknowledgeAlert = async (
  alertId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  notes?: string
): Promise<boolean> => {
  try {
    const alert = await InventoryAlert.findById(alertId);

    if (!alert) {
      throw new Error('Alert not found');
    }

    if (alert.status !== 'active') {
      throw new Error('Alert is not active');
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();
    if (notes) {
      alert.notes = notes;
    }

    await alert.save();

    logger.info(`Alert ${alertId} acknowledged by user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    throw error;
  }
};

// Get inventory statistics
export const getInventoryStatistics = async (): Promise<{
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalValue: number;
  activeAlerts: number;
}> => {
  try {
    const [
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      activeAlerts,
      productValues,
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ stock: { $lte: DEFAULT_LOW_STOCK_THRESHOLD, $gt: 0 } }),
      Product.countDocuments({ stock: 0 }),
      InventoryAlert.countDocuments({ status: 'active' }),
      Product.aggregate([
        {
          $group: {
            _id: null,
            totalValue: { $sum: { $multiply: ['$stock', '$price'] } },
          },
        },
      ]),
    ]);

    return {
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      totalValue: productValues[0]?.totalValue || 0,
      activeAlerts,
    };
  } catch (error) {
    logger.error('Error getting inventory statistics:', error);
    throw error;
  }
};

// Bulk stock adjustment
export const bulkStockAdjustment = async (
  adjustments: Array<{
    productId: mongoose.Types.ObjectId;
    quantity: number;
    reason?: string;
  }>,
  userId: mongoose.Types.ObjectId
): Promise<{ success: number; failed: number }> => {
  let success = 0;
  let failed = 0;

  for (const adjustment of adjustments) {
    try {
      await updateStock({
        productId: adjustment.productId,
        quantity: adjustment.quantity,
        type: 'adjustment',
        changedBy: userId,
        reason: adjustment.reason || 'Bulk adjustment',
      });
      success++;
    } catch (error) {
      logger.error(`Failed to adjust stock for product ${adjustment.productId}:`, error);
      failed++;
    }
  }

  return { success, failed };
};

export default {
  updateStock,
  reduceStockForOrder,
  restoreStockForOrder,
  getInventoryHistory,
  getActiveAlerts,
  acknowledgeAlert,
  getInventoryStatistics,
  bulkStockAdjustment,
};
