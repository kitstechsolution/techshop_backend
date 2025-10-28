import { Response } from 'express';
import { ProductCustomization } from '../models/ProductCustomization.js';
import { Product } from '../models/Product.js';
import { AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

// @desc    Get product customization options
// @route   GET /api/customizations/products/:productId
// @access  Public
export const getProductCustomizationOptions = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    
    const customization = await ProductCustomization.findOne({
      product: productId,
      enabled: true,
    })
      .populate('product', 'name price images')
      .lean();
    
    if (!customization) {
      return res.status(404).json({
        success: false,
        message: 'No customization available for this product',
      });
    }
    
    // Sort custom fields by display order
    if (customization.customFields) {
      customization.customFields.sort((a, b) => a.displayOrder - b.displayOrder);
    }
    
    res.status(200).json({
      success: true,
      data: customization,
    });
  } catch (error) {
    logger.error('Error fetching customization options:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customization options',
    });
  }
};

// @desc    Calculate price for customization
// @route   POST /api/customizations/products/:productId/calculate-price
// @access  Public
export const calculateCustomizationPrice = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const { selectedOptions } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    
    if (!selectedOptions || typeof selectedOptions !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'selectedOptions is required and must be an object',
      });
    }
    
    const customization = await ProductCustomization.findOne({
      product: productId,
      enabled: true,
    });
    
    if (!customization) {
      return res.status(404).json({
        success: false,
        message: 'No customization available for this product',
      });
    }
    
    const product = await Product.findById(productId).select('price');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }
    
    // Calculate price
    const finalPrice = customization.calculatePrice(selectedOptions, product.price);
    
    res.status(200).json({
      success: true,
      data: {
        basePrice: product.price,
        finalPrice,
        priceAdjustment: finalPrice - product.price,
      },
    });
  } catch (error) {
    logger.error('Error calculating price:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating price',
    });
  }
};

// @desc    Validate customization options
// @route   POST /api/customizations/products/:productId/validate
// @access  Public
export const validateCustomizationOptions = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const { selectedOptions } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    
    if (!selectedOptions || typeof selectedOptions !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'selectedOptions is required and must be an object',
      });
    }
    
    const customization = await ProductCustomization.findOne({
      product: productId,
      enabled: true,
    });
    
    if (!customization) {
      return res.status(404).json({
        success: false,
        message: 'No customization available for this product',
      });
    }
    
    // Validate options
    const validation = customization.validateOptions(selectedOptions);
    
    res.status(200).json({
      success: true,
      data: validation,
    });
  } catch (error) {
    logger.error('Error validating options:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating options',
    });
  }
};

// @desc    Get variant by combination
// @route   POST /api/customizations/products/:productId/variant
// @access  Public
export const getVariantByCombination = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const { combination } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    
    if (!combination || typeof combination !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'combination is required and must be an object',
      });
    }
    
    const customization = await ProductCustomization.findOne({
      product: productId,
      enabled: true,
      trackInventory: true,
    });
    
    if (!customization || !customization.variants) {
      return res.status(404).json({
        success: false,
        message: 'No variants available',
      });
    }
    
    // Find matching variant
    const variant = customization.variants.find(v => {
      // Convert Map to Object for comparison
      const combObj = v.combination instanceof Map 
        ? Object.fromEntries(v.combination) 
        : v.combination;
      return JSON.stringify(combObj) === JSON.stringify(combination);
    });
    
    if (!variant) {
      return res.status(404).json({
        success: false,
        message: 'No matching variant found',
      });
    }
    
    // Check stock
    if (variant.stock === 0) {
      return res.status(200).json({
        success: true,
        data: {
          ...variant,
          available: false,
          message: 'This variant is out of stock',
        },
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        ...variant,
        available: true,
      },
    });
  } catch (error) {
    logger.error('Error fetching variant:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching variant',
    });
  }
};

export default {
  getProductCustomizationOptions,
  calculateCustomizationPrice,
  validateCustomizationOptions,
  getVariantByCombination,
};
