/**
 * Migration: Add Wishlist Collection
 * Date: 2025-10-04
 * Description: Creates wishlist collection with indexes for user wishlists
 */

module.exports = {
  async up(db, client) {
    // Create wishlist collection with validation
    await db.createCollection('wishlists', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['user', 'products'],
          properties: {
            user: {
              bsonType: 'objectId',
              description: 'User reference - required'
            },
            products: {
              bsonType: 'array',
              description: 'Array of product IDs',
              items: {
                bsonType: 'objectId'
              }
            },
            createdAt: {
              bsonType: 'date',
              description: 'Creation timestamp'
            },
            updatedAt: {
              bsonType: 'date',
              description: 'Last update timestamp'
            }
          }
        }
      }
    });

    // Create unique index on user field (one wishlist per user)
    await db.collection('wishlists').createIndex(
      { user: 1 },
      { unique: true, name: 'user_unique_index' }
    );

    // Create compound index for user and products queries
    await db.collection('wishlists').createIndex(
      { user: 1, products: 1 },
      { name: 'user_products_index' }
    );

    console.log('✓ Wishlist collection created with indexes');
  },

  async down(db, client) {
    // Drop the wishlist collection
    await db.collection('wishlists').drop();
    
    console.log('✓ Wishlist collection dropped');
  }
};
