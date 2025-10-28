import { Request, Response } from 'express';
import analyticsService from '../services/analyticsService.js';
import { Parser } from 'json2csv';

/**
 * @desc    Get dashboard overview with key metrics
 * @route   GET /api/admin/analytics/dashboard
 * @access  Admin
 */
export const getDashboardOverview = async (req: Request, res: Response) => {
  try {
    const { period = 'last-30-days' } = req.query;
    const dateRange = analyticsService.parseDateRange(period as string);

    const overview = await analyticsService.getDashboardOverview(dateRange);

    res.json({
      success: true,
      period,
      dateRange,
      data: overview,
    });
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard overview',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Get sales metrics
 * @route   GET /api/admin/analytics/sales
 * @access  Admin
 */
export const getSalesMetrics = async (req: Request, res: Response) => {
  try {
    const { period = 'last-30-days', startDate, endDate } = req.query;

    let dateRange;
    if (startDate && endDate) {
      dateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      };
    } else {
      dateRange = analyticsService.parseDateRange(period as string);
    }

    const salesMetrics = await analyticsService.getSalesMetrics(dateRange);

    res.json({
      success: true,
      period,
      dateRange,
      data: salesMetrics,
    });
  } catch (error) {
    console.error('Get sales metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales metrics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Get sales trends over time
 * @route   GET /api/admin/analytics/sales/trends
 * @access  Admin
 */
export const getSalesTrends = async (req: Request, res: Response) => {
  try {
    const { period = 'last-30-days', groupBy = 'day' } = req.query;
    const dateRange = analyticsService.parseDateRange(period as string);

    const trends = await analyticsService.getSalesTrends(
      dateRange,
      groupBy as 'day' | 'week' | 'month'
    );

    res.json({
      success: true,
      period,
      groupBy,
      dateRange,
      data: trends,
    });
  } catch (error) {
    console.error('Get sales trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales trends',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Get revenue breakdown
 * @route   GET /api/admin/analytics/revenue
 * @access  Admin
 */
export const getRevenueBreakdown = async (req: Request, res: Response) => {
  try {
    const { period = 'last-30-days' } = req.query;
    const dateRange = analyticsService.parseDateRange(period as string);

    const revenueBreakdown = await analyticsService.getRevenueBreakdown(dateRange);

    res.json({
      success: true,
      period,
      dateRange,
      data: revenueBreakdown,
    });
  } catch (error) {
    console.error('Get revenue breakdown error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue breakdown',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Get top performing products
 * @route   GET /api/admin/analytics/products/top
 * @access  Admin
 */
export const getTopProducts = async (req: Request, res: Response) => {
  try {
    const { period = 'last-30-days', limit = '10' } = req.query;
    const dateRange = analyticsService.parseDateRange(period as string);

    const topProducts = await analyticsService.getTopProducts(
      dateRange,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      period,
      dateRange,
      data: topProducts,
    });
  } catch (error) {
    console.error('Get top products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top products',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Get category performance
 * @route   GET /api/admin/analytics/categories
 * @access  Admin
 */
export const getCategoryPerformance = async (req: Request, res: Response) => {
  try {
    const { period = 'last-30-days' } = req.query;
    const dateRange = analyticsService.parseDateRange(period as string);

    const categories = await analyticsService.getCategoryPerformance(dateRange);

    res.json({
      success: true,
      period,
      dateRange,
      data: categories,
    });
  } catch (error) {
    console.error('Get category performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category performance',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Get customer metrics
 * @route   GET /api/admin/analytics/customers
 * @access  Admin
 */
export const getCustomerMetrics = async (req: Request, res: Response) => {
  try {
    const { period = 'last-30-days' } = req.query;
    const dateRange = analyticsService.parseDateRange(period as string);

    const customerMetrics = await analyticsService.getCustomerMetrics(dateRange);

    res.json({
      success: true,
      period,
      dateRange,
      data: customerMetrics,
    });
  } catch (error) {
    console.error('Get customer metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer metrics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Get product analytics
 * @route   GET /api/admin/analytics/products/:productId
 * @access  Admin
 */
export const getProductAnalytics = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { period = 'last-30-days' } = req.query;
    const dateRange = analyticsService.parseDateRange(period as string);

    const productAnalytics = await analyticsService.getProductAnalytics(productId, dateRange);

    res.json({
      success: true,
      period,
      dateRange,
      data: productAnalytics,
    });
  } catch (error) {
    console.error('Get product analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Get low stock products
 * @route   GET /api/admin/analytics/inventory/low-stock
 * @access  Admin
 */
export const getLowStockProducts = async (req: Request, res: Response) => {
  try {
    const products = await analyticsService.getLowStockProducts();

    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error('Get low stock products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock products',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Export sales report to CSV
 * @route   GET /api/admin/analytics/export/sales
 * @access  Admin
 */
export const exportSalesReport = async (req: Request, res: Response) => {
  try {
    const { period = 'last-30-days', groupBy = 'day' } = req.query;
    const dateRange = analyticsService.parseDateRange(period as string);

    const trends = await analyticsService.getSalesTrends(
      dateRange,
      groupBy as 'day' | 'week' | 'month'
    );

    const fields = ['date', 'revenue', 'orders', 'averageOrderValue'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(trends);

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="sales-report-${period}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export sales report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export sales report',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Export products report to CSV
 * @route   GET /api/admin/analytics/export/products
 * @access  Admin
 */
export const exportProductsReport = async (req: Request, res: Response) => {
  try {
    const { period = 'last-30-days', limit = '50' } = req.query;
    const dateRange = analyticsService.parseDateRange(period as string);

    const products = await analyticsService.getTopProducts(
      dateRange,
      parseInt(limit as string)
    );

    const fields = [
      'productName',
      'category',
      'totalSold',
      'totalRevenue',
      'averageRating',
      'reviewCount',
      'stockLevel',
    ];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(products);

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="products-report-${period}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export products report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export products report',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @desc    Export customers report to CSV
 * @route   GET /api/admin/analytics/export/customers
 * @access  Admin
 */
export const exportCustomersReport = async (req: Request, res: Response) => {
  try {
    const { period = 'last-30-days' } = req.query;
    const dateRange = analyticsService.parseDateRange(period as string);

    const customerMetrics = await analyticsService.getCustomerMetrics(dateRange);

    const fields = ['name', 'email', 'totalOrders', 'totalSpent'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(customerMetrics.topCustomers);

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="customers-report-${period}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export customers report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export customers report',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
