/**
 * Migration: Create Cancel and Refund Request Collections
 * Date: 2025-10-04
 * Description: Creates collections for order cancellation and refund requests with approval workflow
 */

module.exports = {
  async up(db, client) {
    console.log('Creating cancel and refund request collections...');

    // Create cancel requests collection
    await db.createCollection('cancelrequests');

    await db.collection('cancelrequests').createIndexes([
      {
        key: { order: 1 },
        name: 'order_index'
      },
      {
        key: { user: 1 },
        name: 'user_index'
      },
      {
        key: { status: 1 },
        name: 'status_index'
      },
      {
        key: { user: 1, status: 1 },
        name: 'user_status_index'
      },
      {
        key: { order: 1, status: 1 },
        name: 'order_status_index'
      },
      {
        key: { status: 1, createdAt: -1 },
        name: 'status_created_index'
      },
      {
        key: { order: 1 },
        name: 'order_unique_pending',
        unique: true,
        partialFilterExpression: { status: { $in: ['pending', 'approved'] } }
      }
    ]);

    // Create refund requests collection
    await db.createCollection('refundrequests');

    await db.collection('refundrequests').createIndexes([
      {
        key: { order: 1 },
        name: 'order_index'
      },
      {
        key: { user: 1 },
        name: 'user_index'
      },
      {
        key: { status: 1 },
        name: 'status_index'
      },
      {
        key: { returnStatus: 1 },
        name: 'return_status_index'
      },
      {
        key: { user: 1, status: 1 },
        name: 'user_status_index'
      },
      {
        key: { order: 1, status: 1 },
        name: 'order_status_index'
      },
      {
        key: { status: 1, createdAt: -1 },
        name: 'status_created_index'
      },
      {
        key: { order: 1 },
        name: 'order_unique_pending',
        unique: true,
        partialFilterExpression: { status: { $in: ['pending', 'approved'] } }
      }
    ]);

    console.log('✓ Cancel and refund request collections created with indexes');
  },

  async down(db, client) {
    console.log('Dropping cancel and refund request collections...');
    
    await db.collection('cancelrequests').drop();
    await db.collection('refundrequests').drop();
    
    console.log('✓ Cancel and refund request collections dropped');
  }
};
