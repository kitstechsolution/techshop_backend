import { Response } from 'express';
import { ProductCustomization } from '../../models/ProductCustomization.js';
import { Product } from '../../models/Product.js';
import { AuthRequest } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import mongoose from 'mongoose';

// @desc    Create or update product customization
// @route   POST /api/admin/customizations/:productId
// @access  Private/Admin
export const createOrUpdateCustomization = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const customizationData = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }
    
    // Validate custom fields
    if (customizationData.customFields && !Array.isArray(customizationData.customFields)) {
      return res.status(400).json({
        success: false,
        message: 'customFields must be an array',
      });
    }
    
    // Create or update
    let customization = await ProductCustomization.findOne({ product: productId });
    
    if (customization) {
      // Update existing
      Object.assign(customization, customizationData);
      await customization.save();
      
      logger.info(`Product customization updated for product ${productId}`);
    } else {
      // Create new
      customization = await ProductCustomization.create({
        product: productId,
        ...customizationData,
      });
      
      logger.info(`Product customization created for product ${productId}`);
    }
    
    await customization.populate('product', 'name sku price');
    
    res.status(200).json({
      success: true,
      message: customization ? 'Customization updated' : 'Customization created',
      data: customization,
    });
  } catch (error) {
    logger.error('Error creating/updating customization:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving customization',
    });
  }
};

// @desc    Get product customization
// @route   GET /api/admin/customizations/:productId
// @access  Private/Admin
export const getCustomization = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    
    const customization = await ProductCustomization.findOne({ product: productId })
      .populate('product', 'name sku price images')
      .lean();
    
    if (!customization) {
      return res.status(404).json({
        success: false,
        message: 'Customization not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: customization,
    });
  } catch (error) {
    logger.error('Error fetching customization:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customization',
    });
  }
};

// @desc    Get all customizations
// @route   GET /api/admin/customizations
// @access  Private/Admin
export const getAllCustomizations = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    const enabled = req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined;
    
    const query: any = {};
    if (enabled !== undefined) {
      query.enabled = enabled;
    }
    
    const customizations = await ProductCustomization.find(query)
      .populate('product', 'name sku images price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await ProductCustomization.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: {
        customizations,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching customizations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customizations',
    });
  }
};

// @desc    Delete product customization
// @route   DELETE /api/admin/customizations/:productId
// @access  Private/Admin
export const deleteCustomization = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    
    const customization = await ProductCustomization.findOneAndDelete({ product: productId });
    
    if (!customization) {
      return res.status(404).json({
        success: false,
        message: 'Customization not found',
      });
    }
    
    logger.info(`Product customization deleted for product ${productId}`);
    
    res.status(200).json({
      success: true,
      message: 'Customization deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting customization:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting customization',
    });
  }
};

// @desc    Toggle customization enabled status
// @route   PATCH /api/admin/customizations/:productId/toggle
// @access  Private/Admin
export const toggleCustomization = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    
    const customization = await ProductCustomization.findOne({ product: productId });
    
    if (!customization) {
      return res.status(404).json({
        success: false,
        message: 'Customization not found',
      });
    }
    
    customization.enabled = !customization.enabled;
    await customization.save();
    
    logger.info(`Customization ${customization.enabled ? 'enabled' : 'disabled'} for product ${productId}`);
    
    res.status(200).json({
      success: true,
      message: `Customization ${customization.enabled ? 'enabled' : 'disabled'}`,
      data: {
        enabled: customization.enabled,
      },
    });
  } catch (error) {
    logger.error('Error toggling customization:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling customization',
    });
  }
};

// @desc    Add custom field to product
// @route   POST /api/admin/customizations/:productId/fields
// @access  Private/Admin
export const addCustomField = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const fieldData = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    
    const customization = await ProductCustomization.findOne({ product: productId });
    
    if (!customization) {
      return res.status(404).json({
        success: false,
        message: 'Customization not found. Create customization first.',
      });
    }
    
    // Validate field data
    if (!fieldData.name || !fieldData.label || !fieldData.type) {
      return res.status(400).json({
        success: false,
        message: 'Field name, label, and type are required',
      });
    }
    
    customization.customFields.push(fieldData);
    await customization.save();
    
    logger.info(`Custom field added to product ${productId}`);
    
    res.status(200).json({
      success: true,
      message: 'Custom field added successfully',
      data: customization.customFields[customization.customFields.length - 1],
    });
  } catch (error) {
    logger.error('Error adding custom field:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding custom field',
    });
  }
};

// @desc    Update custom field
// @route   PUT /api/admin/customizations/:productId/fields/:fieldId
// @access  Private/Admin
export const updateCustomField = async (req: AuthRequest, res: Response) => {
  try {
    const { productId, fieldId } = req.params;
    const fieldData = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(fieldId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product or field ID',
      });
    }
    
    const customization = await ProductCustomization.findOne({ product: productId });
    
    if (!customization) {
      return res.status(404).json({
        success: false,
        message: 'Customization not found',
      });
    }
    
    const fieldIndex = customization.customFields.findIndex(
      (f: any) => f._id?.toString() === fieldId
    );
    
    if (fieldIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Field not found',
      });
    }
    
    // Update field
    Object.assign(customization.customFields[fieldIndex], fieldData);
    await customization.save();
    
    logger.info(`Custom field ${fieldId} updated for product ${productId}`);
    
    res.status(200).json({
      success: true,
      message: 'Custom field updated successfully',
      data: customization.customFields[fieldIndex],
    });
  } catch (error) {
    logger.error('Error updating custom field:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating custom field',
    });
  }
};

// @desc    Delete custom field
// @route   DELETE /api/admin/customizations/:productId/fields/:fieldId
// @access  Private/Admin
export const deleteCustomField = async (req: AuthRequest, res: Response) => {
  try {
    const { productId, fieldId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(fieldId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product or field ID',
      });
    }
    
    const customization = await ProductCustomization.findOne({ product: productId });
    
    if (!customization) {
      return res.status(404).json({
        success: false,
        message: 'Customization not found',
      });
    }
    
    const fieldIndex = customization.customFields.findIndex(
      (f: any) => f._id?.toString() === fieldId
    );
    
    if (fieldIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Field not found',
      });
    }
    
    // Remove the field
    customization.customFields.splice(fieldIndex, 1);
    await customization.save();
    
    logger.info(`Custom field ${fieldId} deleted from product ${productId}`);
    
    res.status(200).json({
      success: true,
      message: 'Custom field deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting custom field:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting custom field',
    });
  }
};

// @desc    Add variant to product
// @route   POST /api/admin/customizations/:productId/variants
// @access  Private/Admin
export const addVariant = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const variantData = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    
    const customization = await ProductCustomization.findOne({ product: productId });
    
    if (!customization) {
      return res.status(404).json({
        success: false,
        message: 'Customization not found',
      });
    }
    
    // Validate variant data
    if (!variantData.sku || !variantData.combination) {
      return res.status(400).json({
        success: false,
        message: 'SKU and combination are required',
      });
    }
    
    if (!customization.variants) {
      customization.variants = [];
    }
    
    customization.variants.push(variantData);
    await customization.save();
    
    logger.info(`Variant added to product ${productId}`);
    
    res.status(200).json({
      success: true,
      message: 'Variant added successfully',
      data: customization.variants[customization.variants.length - 1],
    });
  } catch (error: any) {
    logger.error('Error adding variant:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Variant SKU must be unique',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error adding variant',
    });
  }
};

export default {
  createOrUpdateCustomization,
  getCustomization,
  getAllCustomizations,
  deleteCustomization,
  toggleCustomization,
  addCustomField,
  updateCustomField,
  deleteCustomField,
  addVariant,
};
