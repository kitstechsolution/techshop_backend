/**
 * Migration: Add Search Indexes to Products
 * Date: 2025-10-04
 * Description: Creates text indexes for search functionality and additional indexes for filtering
 */

module.exports = {
  async up(db, client) {
    console.log('Creating search indexes on products collection...');

    // Create text index for full-text search
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
          name: 10,          // Name is most important
          category: 5,       // Category is second
          subcategory: 3,    // Subcategory is third
          description: 1     // Description is least important
        },
        default_language: 'english'
      }
    );

    // Create indexes for filtering and sorting
    await db.collection('products').createIndexes([
      {
        key: { category: 1, price: 1 },
        name: 'category_price_index'
      },
      {
        key: { price: 1 },
        name: 'price_index'
      },
      {
        key: { averageRating: -1 },
        name: 'rating_index'
      },
      {
        key: { createdAt: -1 },
        name: 'created_date_index'
      },
      {
        key: { stock: 1 },
        name: 'stock_index'
      }
    ]);

    console.log('✓ Search indexes created successfully');
  },

  async down(db, client) {
    console.log('Dropping search indexes from products collection...');

    // Drop all the indexes we created
    await db.collection('products').dropIndex('product_text_search');
    await db.collection('products').dropIndex('category_price_index');
    await db.collection('products').dropIndex('price_index');
    await db.collection('products').dropIndex('rating_index');
    await db.collection('products').dropIndex('created_date_index');
    await db.collection('products').dropIndex('stock_index');

    console.log('✓ Search indexes dropped');
  }
};
