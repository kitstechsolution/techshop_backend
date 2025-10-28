import mongoose from 'mongoose';

// Use real MongoDB for tests
const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/ecommerce_test';

export const setupTestDB = async () => {
  try {
    // Connect to test database
    await mongoose.connect(MONGODB_TEST_URI);
    console.log('✅ Connected to test database');
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error);
    throw error;
  }
};

export const teardownTestDB = async () => {
  try {
    // Drop the test database
    await mongoose.connection.dropDatabase();
    console.log('✅ Test database dropped');
    
    // Close connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error in teardown:', error);
  }
};

export const clearTestDB = async () => {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  }
};

// Global setup
beforeAll(async () => {
  await setupTestDB();
}, 30000); // 30 second timeout for connection

// Global teardown
afterAll(async () => {
  await teardownTestDB();
}, 30000);

// Clear database between tests
afterEach(async () => {
  await clearTestDB();
});
