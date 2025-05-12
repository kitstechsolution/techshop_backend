import express from 'express';
import { Product } from '../models/Product.js';
import { logger } from '../utils/logger.js';
import { productCategories } from '../utils/seed.js';

const router = express.Router();

// Map for special category names to IDs
const CATEGORY_NAME_TO_ID: Record<string, string> = {
  'Sensors & Modules': 'sensors-modules',
  'Tools & Equipment': 'tools-equipment'
};

// Map for special subcategory names to IDs
const SUBCATEGORY_NAME_TO_ID: Record<string, string> = {
  'Motion & Position': 'motion-position',
  'Motors & Servos': 'motors-servos'
};

// Helper function to convert category name to ID
const categoryNameToId = (name: string): string => {
  return CATEGORY_NAME_TO_ID[name] || name.toLowerCase().replace(/\s+/g, '-');
};

// Helper function to convert subcategory name to ID
const subcategoryNameToId = (name: string): string => {
  return SUBCATEGORY_NAME_TO_ID[name] || name.toLowerCase().replace(/\s+/g, '-').replace(/[/]/g, '-');
};

// Get all unique categories with subcategories
router.get('/', async (req, res) => {
  try {
    // Format the categories from the seed data with subcategories
    const formattedCategories = productCategories.map(category => {
      // Generate an ID based on the category name (slug-like)
      const mainCategoryId = categoryNameToId(category.name);
      
      return {
        id: mainCategoryId,
        name: category.name,
        subcategories: category.subcategories.map(subName => {
          const subId = subcategoryNameToId(subName);
          return {
            id: subId,
            name: subName
          };
        })
      };
    });
    
    // Get unique categories directly from DB to ensure we have all used categories
    const existingMainCategories = await Product.distinct('category');
    
    // Add any categories from the DB that don't exist in our seed data
    for (const dbCategory of existingMainCategories) {
      // Skip if already in our formatted categories
      if (formattedCategories.some(c => c.id === dbCategory)) {
        continue;
      }
      
      // Get the display name for the category
      let displayName;
      
      // Map DB category IDs back to proper display names
      if (dbCategory === 'sensors-modules') {
        displayName = 'Sensors & Modules';
      } else if (dbCategory === 'tools-equipment') {
        displayName = 'Tools & Equipment';
      } else {
        // Format the category name for display
        displayName = dbCategory
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
      
      // Get subcategories for this main category
      const subcategories = await Product.distinct('subcategory', { category: dbCategory });
      
      // Add the category with its subcategories
      formattedCategories.push({
        id: dbCategory,
        name: displayName,
        subcategories: subcategories
          .filter(Boolean) // Remove null/undefined values
          .map(sub => {
            // Map subcategory IDs back to proper display names
            let subName;
            if (sub === 'motion-position') {
              subName = 'Motion & Position';
            } else if (sub === 'motors-servos') {
              subName = 'Motors & Servos';
            } else {
              subName = sub
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            }
            
            return {
              id: sub,
              name: subName
            };
          })
      });
    }
    
    // Return the categories
    res.json(formattedCategories);
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router; 