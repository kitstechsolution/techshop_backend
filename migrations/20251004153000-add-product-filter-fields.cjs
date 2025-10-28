/**
 * Migration: Add Filter Fields to Products
 * Date: 2025-10-04
 * Description: Adds brand, tags, isFeatured, and discount fields for advanced filtering
 */

module.exports = {
  async up(db, client) {
    console.log('Adding filter fields to products collection...');

    // Add new fields to existing products with default values
    await db.collection('products').updateMany(
      {},
      {
        $set: {
          isFeatured: false,
          discount: 0,
          tags: []
        }
      }
    );

    // Create indexes for new fields
    await db.collection('products').createIndexes([
      {
        key: { brand: 1 },
        name: 'brand_index'
      },
      {
        key: { tags: 1 },
        name: 'tags_index'
      },
      {
        key: { isFeatured: 1 },
        name: 'featured_index'
      },
      {
        key: { discount: -1 },
        name: 'discount_index'
      }
    ]);

    // Update text index to include brand and tags
    // Note: You can only have one text index per collection
    // So we'll drop the old one and create a new comprehensive one
    try {
      await db.collection('products').dropIndex('product_text_search');
    } catch (error) {
      // Index might not exist, that's okay
      console.log('Previous text index not found, creating new one...');
    }

    await db.collection('products').createIndex(
      {
        name: 'text',
        description: 'text',
        category: 'text',
        subcategory: 'text',
        brand: 'text',
        tags: 'text'
      },
      {
        name: 'product_text_search_v2',
        weights: {
          name: 10,
          brand: 8,
          category: 5,
          tags: 4,
          subcategory: 3,
          description: 1
        },
        default_language: 'english'
      }
    );

    console.log('✓ Filter fields and indexes added successfully');
  },

  async down(db, client) {
    console.log('Removing filter fields from products collection...');

    // Remove the new fields
    await db.collection('products').updateMany(
      {},
      {
        $unset: {
          brand: '',
          tags: '',
          isFeatured: '',
          discount: ''
        }
      }
    );

    // Drop the new indexes
    await db.collection('products').dropIndex('brand_index');
    await db.collection('products').dropIndex('tags_index');
    await db.collection('products').dropIndex('featured_index');
    await db.collection('products').dropIndex('discount_index');

    // Restore old text index
    try {
      await db.collection('products').dropIndex('product_text_search_v2');
    } catch (error) {
      console.log('Text index v2 not found');
    }

    await db.collection('products').createIndex(
      {
        name: 'text',
        description: 'text',
        category: 'text',
        subcategory: 'text'
      },
      {
        name: 'product_text_search',
        weights: {
          name: 10,
          category: 5,
          subcategory: 3,
          description: 1
        },
        default_language: 'english'
      }
    );

    console.log('✓ Filter fields removed');
  }
};
