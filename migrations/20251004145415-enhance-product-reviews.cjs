/**
 * Migration: Enhance Product Reviews
 * Date: 2025-10-04
 * Description: Adds approval workflow, helpful count, timestamps, and userName to product reviews
 */

module.exports = {
  async up(db, client) {
    // Update all existing products to add new review fields
    await db.collection('products').updateMany(
      {},
      {
        $set: {
          totalReviews: 0,
          approvedReviewsCount: 0
        }
      }
    );

    // Get all products with ratings
    const products = await db.collection('products').find({ ratings: { $exists: true } }).toArray();

    // Update each product's ratings with new fields
    for (const product of products) {
      if (product.ratings && product.ratings.length > 0) {
        const updatedRatings = product.ratings.map(rating => ({
          ...rating,
          userName: rating.userName || 'Anonymous',
          approved: rating.approved !== undefined ? rating.approved : false,
          helpfulCount: rating.helpfulCount || 0,
          createdAt: rating.createdAt || new Date(),
          updatedAt: rating.updatedAt || new Date()
        }));

        // Calculate counts
        const totalReviews = updatedRatings.length;
        const approvedReviews = updatedRatings.filter(r => r.approved);
        const approvedReviewsCount = approvedReviews.length;

        // Calculate average rating from approved reviews
        let averageRating = 0;
        if (approvedReviews.length > 0) {
          const totalRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0);
          averageRating = Number((totalRating / approvedReviews.length).toFixed(1));
        }

        await db.collection('products').updateOne(
          { _id: product._id },
          {
            $set: {
              ratings: updatedRatings,
              totalReviews,
              approvedReviewsCount,
              averageRating
            }
          }
        );
      }
    }

    // Create index on approved field for faster queries
    await db.collection('products').createIndex(
      { 'ratings.approved': 1 },
      { name: 'ratings_approved_index' }
    );

    console.log('✓ Product reviews enhanced with approval workflow');
  },

  async down(db, client) {
    // Remove the new fields
    await db.collection('products').updateMany(
      {},
      {
        $unset: {
          totalReviews: '',
          approvedReviewsCount: ''
        }
      }
    );

    // Remove new fields from ratings subdocuments
    await db.collection('products').updateMany(
      {},
      {
        $set: {
          'ratings.$[].approved': undefined,
          'ratings.$[].helpfulCount': undefined,
          'ratings.$[].userName': undefined,
          'ratings.$[].createdAt': undefined,
          'ratings.$[].updatedAt': undefined
        }
      }
    );

    // Drop the index
    await db.collection('products').dropIndex('ratings_approved_index');

    console.log('✓ Product reviews reverted to original schema');
  }
};
