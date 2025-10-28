import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { Review } from '../models/Review.js';
import { startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface SalesMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalProducts: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  refundedAmount: number;
}

interface SalesTrend {
  date: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
}

interface ProductPerformance {
  productId: string;
  productName: string;
  category: string;
  totalSold: number;
  totalRevenue: number;
  averageRating: number;
  reviewCount: number;
  stockLevel: number;
  lowStockAlert: boolean;
}

interface CategoryPerformance {
  category: string;
  totalSold: number;
  totalRevenue: number;
  productCount: number;
  averageRating: number;
}

interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  activeCustomers: number;
  customerRetentionRate: number;
  averageCustomerValue: number;
  topCustomers: Array<{
    userId: string;
    name: string;
    email: string;
    totalOrders: number;
    totalSpent: number;
  }>;
}

interface RevenueBreakdown {
  productSales: number;
  shippingFees: number;
  taxCollected: number;
  discounts: number;
  refunds: number;
  netRevenue: number;
}

class AnalyticsService {
  /**
   * Get comprehensive dashboard overview
   */
  async getDashboardOverview(dateRange: DateRange): Promise<{
    salesMetrics: SalesMetrics;
    revenueBreakdown: RevenueBreakdown;
    topProducts: ProductPerformance[];
    recentOrders: any[];
  }> {

    const [salesMetrics, revenueBreakdown, topProducts, recentOrders] = await Promise.all([
      this.getSalesMetrics(dateRange),
      this.getRevenueBreakdown(dateRange),
      this.getTopProducts(dateRange, 5),
      this.getRecentOrders(10),
    ]);

    return {
      salesMetrics,
      revenueBreakdown,
      topProducts,
      recentOrders,
    };
  }

  /**
   * Get sales metrics for a date range
   */
  async getSalesMetrics(dateRange: DateRange): Promise<SalesMetrics> {
    const { startDate, endDate } = dateRange;

    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    const completedOrders = orders.filter((o) => o.status === 'delivered');
    const pendingOrders = orders.filter((o) =>
      ['pending', 'processing', 'shipped'].includes(o.status)
    );
    const cancelledOrders = orders.filter((o) => o.status === 'cancelled');
    const refundedOrders = orders.filter((o) => o.refundStatus === 'completed');

    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalProducts = completedOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
      0
    );
    const refundedAmount = refundedOrders.reduce((sum, o) => sum + (o.refundAmount || 0), 0);

    return {
      totalRevenue,
      totalOrders: orders.length,
      averageOrderValue: orders.length > 0 ? totalRevenue / completedOrders.length : 0,
      totalProducts,
      completedOrders: completedOrders.length,
      pendingOrders: pendingOrders.length,
      cancelledOrders: cancelledOrders.length,
      refundedAmount,
    };
  }

  /**
   * Get sales trends over time
   */
  async getSalesTrends(dateRange: DateRange, groupBy: 'day' | 'week' | 'month' = 'day'): Promise<SalesTrend[]> {
    const { startDate, endDate } = dateRange;

    const groupFormat = groupBy === 'day' ? '%Y-%m-%d' : groupBy === 'week' ? '%Y-W%U' : '%Y-%m';

    const trends = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'delivered',
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          date: '$_id',
          revenue: 1,
          orders: 1,
          averageOrderValue: { $divide: ['$revenue', '$orders'] },
        },
      },
    ]);

    return trends;
  }

  /**
   * Get top performing products
   */
  async getTopProducts(dateRange: DateRange, limit: number = 10): Promise<ProductPerformance[]> {
    const { startDate, endDate } = dateRange;

    // Get product sales from orders
    const productSales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'delivered',
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit },
    ]);

    // Enrich with product details
    const productIds = productSales.map((p) => p._id);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const reviews = await Review.aggregate([
      { $match: { product: { $in: productIds } } },
      {
        $group: {
          _id: '$product',
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]);

    const reviewMap = new Map(reviews.map((r) => [r._id.toString(), r]));
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    return productSales.map((sale) => {
      const product = productMap.get(sale._id.toString());
      const reviewData = reviewMap.get(sale._id.toString());

      return {
        productId: sale._id.toString(),
        productName: product?.name || 'Unknown Product',
        category: product?.category || 'Uncategorized',
        totalSold: sale.totalSold,
        totalRevenue: sale.totalRevenue,
        averageRating: reviewData?.averageRating || 0,
        reviewCount: reviewData?.reviewCount || 0,
        stockLevel: product?.stock || 0,
        lowStockAlert: (product?.stock || 0) < (product?.lowStockThreshold || 10),
      };
    });
  }

  /**
   * Get category performance
   */
  async getCategoryPerformance(dateRange: DateRange): Promise<CategoryPerformance[]> {
    const { startDate, endDate } = dateRange;

    // Get sales by category
    const categorySales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'delivered',
        },
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productData',
        },
      },
      { $unwind: '$productData' },
      {
        $group: {
          _id: '$productData.category',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          products: { $addToSet: '$items.product' },
        },
      },
      {
        $project: {
          category: '$_id',
          totalSold: 1,
          totalRevenue: 1,
          productCount: { $size: '$products' },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    // Get average ratings by category
    const categoryRatings = await Review.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productData',
        },
      },
      { $unwind: '$productData' },
      {
        $group: {
          _id: '$productData.category',
          averageRating: { $avg: '$rating' },
        },
      },
    ]);

    const ratingMap = new Map(categoryRatings.map((r) => [r._id, r.averageRating]));

    return categorySales.map((cat) => ({
      category: cat._id || 'Uncategorized',
      totalSold: cat.totalSold,
      totalRevenue: cat.totalRevenue,
      productCount: cat.productCount,
      averageRating: ratingMap.get(cat._id) || 0,
    }));
  }

  /**
   * Get customer metrics
   */
  async getCustomerMetrics(dateRange: DateRange): Promise<CustomerMetrics> {
    const { startDate, endDate } = dateRange;
    const previousPeriodStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));

    // Total and new customers
    const totalCustomers = await User.countDocuments({ role: 'user' });
    const newCustomers = await User.countDocuments({
      role: 'user',
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Active customers (made at least one order)
    const activeCustomerIds = await Order.distinct('user', {
      createdAt: { $gte: startDate, $lte: endDate },
    });
    const activeCustomers = activeCustomerIds.length;

    // Customer retention (customers who ordered in both periods)
    const previousCustomerIds = await Order.distinct('user', {
      createdAt: { $gte: previousPeriodStart, $lt: startDate },
    });
    const retainedCustomers = activeCustomerIds.filter((id) =>
      previousCustomerIds.some((prevId) => prevId.toString() === id.toString())
    ).length;
    const customerRetentionRate =
      previousCustomerIds.length > 0 ? (retainedCustomers / previousCustomerIds.length) * 100 : 0;

    // Average customer value
    const customerSpending = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'delivered',
        },
      },
      {
        $group: {
          _id: '$user',
          totalSpent: { $sum: '$totalAmount' },
        },
      },
    ]);
    const averageCustomerValue =
      customerSpending.length > 0
        ? customerSpending.reduce((sum, c) => sum + c.totalSpent, 0) / customerSpending.length
        : 0;

    // Top customers
    const topCustomerData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'delivered',
        },
      },
      {
        $group: {
          _id: '$user',
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
    ]);

    const topCustomerIds = topCustomerData.map((c) => c._id);
    const topCustomerUsers = await User.find({ _id: { $in: topCustomerIds } })
      .select('name email')
      .lean();

    const userMap = new Map(topCustomerUsers.map((u) => [u._id.toString(), u]));

    const topCustomers = topCustomerData.map((customer) => {
      const user = userMap.get(customer._id.toString());
      return {
        userId: customer._id.toString(),
        name: user?.name || 'Unknown',
        email: user?.email || 'Unknown',
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
      };
    });

    return {
      totalCustomers,
      newCustomers,
      activeCustomers,
      customerRetentionRate,
      averageCustomerValue,
      topCustomers,
    };
  }

  /**
   * Get revenue breakdown
   */
  async getRevenueBreakdown(dateRange: DateRange): Promise<RevenueBreakdown> {
    const { startDate, endDate } = dateRange;

    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'delivered',
    });

    const productSales = orders.reduce((sum, o) => sum + o.subtotal, 0);
    const shippingFees = orders.reduce((sum, o) => sum + (o.shippingCost || 0), 0);
    const taxCollected = orders.reduce((sum, o) => sum + (o.tax || 0), 0);
    const discounts = orders.reduce((sum, o) => sum + (o.discount || 0), 0);

    const refundedOrders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
      refundStatus: 'refunded',
    });
    const refunds = refundedOrders.reduce((sum, o) => sum + (o.refundAmount || 0), 0);

    const netRevenue = productSales + shippingFees + taxCollected - discounts - refunds;

    return {
      productSales,
      shippingFees,
      taxCollected,
      discounts,
      refunds,
      netRevenue,
    };
  }

  /**
   * Get recent orders
   */
  async getRecentOrders(limit: number = 10): Promise<any[]> {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('user', 'name email')
      .select('orderNumber totalAmount status createdAt user')
      .lean();

    return orders;
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(): Promise<any[]> {
    const products = await Product.find({
      $expr: { $lt: ['$stock', '$lowStockThreshold'] },
    })
      .select('name category stock lowStockThreshold price')
      .sort({ stock: 1 })
      .lean();

    return products;
  }

  /**
   * Get product analytics
   */
  async getProductAnalytics(productId: string, dateRange: DateRange): Promise<any> {
    const { startDate, endDate } = dateRange;

    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    // Sales data
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'delivered',
          'items.product': product._id,
        },
      },
      { $unwind: '$items' },
      { $match: { 'items.product': product._id } },
      {
        $group: {
          _id: null,
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    // Review analytics
    const reviewStats = await Review.aggregate([
      { $match: { product: product._id } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating',
          },
        },
      },
    ]);

    const sales = salesData[0] || { totalSold: 0, totalRevenue: 0, orderCount: 0 };
    const reviews = reviewStats[0] || { averageRating: 0, totalReviews: 0, ratingDistribution: [] };

    // Calculate rating distribution
    const ratingDist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.ratingDistribution?.forEach((rating: number) => {
      ratingDist[rating as keyof typeof ratingDist]++;
    });

    return {
      product: {
        id: product._id,
        name: product.name,
        category: product.category,
        price: product.price,
        stock: product.stock,
      },
      sales,
      reviews: {
        averageRating: reviews.averageRating,
        totalReviews: reviews.totalReviews,
        ratingDistribution: ratingDist,
      },
    };
  }

  /**
   * Helper to parse date range strings
   */
  parseDateRange(period: string): DateRange {
    const now = new Date();
    let startDate: Date;
    let endDate = endOfDay(now);

    switch (period) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case 'yesterday':
        startDate = startOfDay(subDays(now, 1));
        endDate = endOfDay(subDays(now, 1));
        break;
      case 'last-7-days':
        startDate = startOfDay(subDays(now, 7));
        break;
      case 'last-30-days':
        startDate = startOfDay(subDays(now, 30));
        break;
      case 'this-month':
        startDate = startOfMonth(now);
        break;
      case 'last-month':
        startDate = startOfMonth(subMonths(now, 1));
        endDate = endOfMonth(subMonths(now, 1));
        break;
      case 'last-3-months':
        startDate = startOfDay(subMonths(now, 3));
        break;
      case 'last-6-months':
        startDate = startOfDay(subMonths(now, 6));
        break;
      case 'this-year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = startOfDay(subDays(now, 30));
    }

    return { startDate, endDate };
  }
}

export default new AnalyticsService();
