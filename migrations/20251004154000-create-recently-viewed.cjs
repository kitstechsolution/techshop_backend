/**
 * Migration: Create Recently Viewed Collection
 * Date: 2025-10-04
 * Description: Creates recently viewed products tracking collection with indexes
 */

module.exports = {
  async up(db, client) {
    console.log('Creating recently viewed collection...');

    // Create the collection
    await db.createCollection('recentlyvieweds');

    // Create indexes
    await db.collection('recentlyvieweds').createIndexes([
      {
        key: { user: 1 },
        name: 'user_index'
      },
      {
        key: { viewedAt: 1 },
        name: 'viewed_at_index'
      },
      {
        key: { user: 1, viewedAt: -1 },
        name: 'user_viewed_at_index'
      },
      {
        key: { user: 1, product: 1 },
        name: 'user_product_unique',
        unique: true
      },
      {
        key: { viewedAt: 1 },
        name: 'ttl_index',
        expireAfterSeconds: 7776000 // 90 days
      }
    ]);

    console.log('✓ Recently viewed collection created with indexes');
    console.log('✓ TTL index set to automatically delete entries older than 90 days');
  },

  async down(db, client) {
    console.log('Dropping recently viewed collection...');
    
    await db.collection('recentlyvieweds').drop();
    
    console.log('✓ Recently viewed collection dropped');
  }
};
