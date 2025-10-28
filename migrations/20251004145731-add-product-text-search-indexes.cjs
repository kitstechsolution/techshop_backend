/**
 * Migration: Add Product Text Search Indexes
 * Date: 2025-10-04
 * Description: Creates text indexes on product name, description, and category for full-text search
 */

module.exports = {
  async up(db, client) {
    // Create text index on name, description, and category
    // Weights determine relevance: name is most important, then description, then category
    await db.collection('products').createIndex(
      {
        name: 'text',
        description: 'text',
        category: 'text',
        subcategory: 'text'
      },
      {
        name: 'product_text_search_index',
        weights: {
          name: 10,           // Highest weight - exact name matches are most relevant
          category: 5,        // Category matches are important
          subcategory: 3,     // Subcategory is moderately important
          description: 1      // Description matches are least weighted
        },
        default_language: 'english',
        language_override: 'language'
      }
    );

    // Create compound index for filtered searches (category + price)
    await db.collection('products').createIndex(
      { category: 1, price: 1 },
      { name: 'category_price_index' }
    );

    // Create index for rating-based searches
    await db.collection('products').createIndex(
      { averageRating: -1 },
      { name: 'rating_index' }
    );

    // Create index for stock availability
    await db.collection('products').createIndex(
      { stock: 1 },
      { name: 'stock_index' }
    );

    // Create compound index for category + rating (common filter combination)
    await db.collection('products').createIndex(
      { category: 1, averageRating: -1 },
      { name: 'category_rating_index' }
    );

    console.log('✓ Text search indexes created for products');
  },

  async down(db, client) {
    // Drop all indexes created in up()
    await db.collection('products').dropIndex('product_text_search_index');
    await db.collection('products').dropIndex('category_price_index');
    await db.collection('products').dropIndex('rating_index');
    await db.collection('products').dropIndex('stock_index');
    await db.collection('products').dropIndex('category_rating_index');

    console.log('✓ Text search indexes removed from products');
  }
};
