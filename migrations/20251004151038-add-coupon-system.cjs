/**
 * Migration: Add Coupon System
 * Date: 2025-10-04
 * Description: Creates coupons and coupon_usage collections, updates orders schema
 */

module.exports = {
  async up(db, client) {
    // Create coupons collection
    await db.createCollection('coupons', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['code', 'description', 'discountType', 'discountValue', 'validFrom', 'validUntil'],
          properties: {
            code: {
              bsonType: 'string',
              description: 'Unique coupon code - required'
            },
            description: {
              bsonType: 'string',
              description: 'Coupon description - required'
            },
            discountType: {
              enum: ['percentage', 'fixed'],
              description: 'Type of discount - required'
            },
            discountValue: {
              bsonType: 'number',
              minimum: 0,
              description: 'Discount value - required'
            },
            minPurchaseAmount: {
              bsonType: 'number',
              minimum: 0
            },
            maxDiscountAmount: {
              bsonType: 'number',
              minimum: 0
            },
            usageLimit: {
              bsonType: 'number',
              minimum: 0
            },
            usageCount: {
              bsonType: 'number',
              minimum: 0
            },
            perUserLimit: {
              bsonType: 'number',
              minimum: 1
            },
            validFrom: {
              bsonType: 'date',
              description: 'Valid from date - required'
            },
            validUntil: {
              bsonType: 'date',
              description: 'Valid until date - required'
            },
            status: {
              enum: ['active', 'inactive', 'expired']
            },
            isActive: {
              bsonType: 'bool'
            }
          }
        }
      }
    });

    // Create indexes on coupons
    await db.collection('coupons').createIndexes([
      { key: { code: 1 }, unique: true, name: 'code_unique_index' },
      { key: { code: 1, isActive: 1 }, name: 'code_active_index' },
      { key: { validFrom: 1, validUntil: 1 }, name: 'date_range_index' },
      { key: { status: 1, isActive: 1 }, name: 'status_active_index' }
    ]);

    // Create coupon usage tracking collection
    await db.createCollection('couponusages');

    await db.collection('couponusages').createIndexes([
      { key: { coupon: 1 }, name: 'coupon_index' },
      { key: { user: 1 }, name: 'user_index' },
      { key: { user: 1, coupon: 1 }, name: 'user_coupon_index' },
      { key: { coupon: 1, usedAt: -1 }, name: 'coupon_date_index' }
    ]);

    // Update existing orders to add discount fields
    await db.collection('orders').updateMany(
      { subtotal: { $exists: false } },
      [{
        $set: {
          subtotal: '$total',
          discountAmount: 0
        }
      }]
    );

    console.log('✓ Coupon system created with indexes');
    console.log('✓ Coupon usage tracking created');
    console.log('✓ Orders schema updated with discount fields');
  },

  async down(db, client) {
    // Drop collections
    await db.collection('coupons').drop();
    await db.collection('couponusages').drop();

    // Remove discount fields from orders
    await db.collection('orders').updateMany(
      {},
      {
        $unset: {
          subtotal: '',
          discountAmount: '',
          couponCode: ''
        }
      }
    );

    console.log('✓ Coupon system removed');
    console.log('✓ Orders schema reverted');
  }
};
