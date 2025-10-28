import '../setup';
import { Product } from '../../models/Product.js';

describe('Product Model', () => {
  describe('Badge Functionality', () => {
    it('should create a product with badges', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        price: 999,
        imageUrl: 'https://example.com/image.jpg',
        category: 'Electronics',
        stock: 100,
        badges: [
          {
            type: 'new',
            label: 'New Arrival',
            color: '#00FF00',
            priority: 1,
          },
          {
            type: 'sale',
            label: 'On Sale',
            color: '#FF0000',
            priority: 2,
          },
        ],
      };

      const product = await Product.create(productData);

      expect(product.name).toBe('Test Product');
      expect(product.badges).toHaveLength(2);
      expect(product.badges![0].type).toBe('new');
      expect(product.badges![1].type).toBe('sale');
    });

    it('should create a product without badges', async () => {
      const product = await Product.create({
        name: 'Simple Product',
        description: 'Simple Description',
        price: 499,
        imageUrl: 'https://example.com/image.jpg',
        category: 'Books',
        stock: 50,
      });

      expect(product.badges).toBeUndefined();
    });

    it('should validate badge types', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'Test Description',
        price: 999,
        imageUrl: 'https://example.com/image.jpg',
        category: 'Electronics',
        stock: 100,
        badges: [
          {
            type: 'invalid_type' as any, // Force invalid type
            label: 'Invalid',
          },
        ],
      });

      await expect(product.save()).rejects.toThrow();
    });
  });

  describe('Rating Calculation', () => {
    it('should calculate average rating correctly', async () => {
      const product = await Product.create({
        name: 'Rated Product',
        description: 'A product with ratings',
        price: 1299,
        imageUrl: 'https://example.com/image.jpg',
        category: 'Electronics',
        stock: 30,
        ratings: [
          {
            userId: '507f1f77bcf86cd799439011',
            userName: 'User 1',
            rating: 5,
            review: 'Excellent!',
            approved: true,
            helpfulCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            userId: '507f1f77bcf86cd799439012',
            userName: 'User 2',
            rating: 4,
            review: 'Good product',
            approved: true,
            helpfulCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            userId: '507f1f77bcf86cd799439013',
            userName: 'User 3',
            rating: 3,
            review: 'Average',
            approved: false, // Not approved
            helpfulCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      // Only approved reviews should count: (5 + 4) / 2 = 4.5
      expect(product.averageRating).toBe(4.5);
      expect(product.totalReviews).toBe(3);
      expect(product.approvedReviewsCount).toBe(2);
    });

    it('should handle products with no ratings', async () => {
      const product = await Product.create({
        name: 'Unrated Product',
        description: 'No ratings yet',
        price: 599,
        imageUrl: 'https://example.com/image.jpg',
        category: 'Books',
        stock: 20,
      });

      expect(product.averageRating).toBe(0);
      expect(product.totalReviews).toBe(0);
      expect(product.approvedReviewsCount).toBe(0);
    });
  });

  describe('Stock and Thresholds', () => {
    it('should have default low stock threshold', async () => {
      const product = await Product.create({
        name: 'Product',
        description: 'Description',
        price: 100,
        imageUrl: 'https://example.com/image.jpg',
        category: 'Test',
        stock: 5,
      });

      expect(product.lowStockThreshold).toBe(10);
    });

    it('should allow custom low stock threshold', async () => {
      const product = await Product.create({
        name: 'Product',
        description: 'Description',
        price: 100,
        imageUrl: 'https://example.com/image.jpg',
        category: 'Test',
        stock: 5,
        lowStockThreshold: 20,
      });

      expect(product.lowStockThreshold).toBe(20);
    });
  });

  describe('Product Status', () => {
    it('should be active by default', async () => {
      const product = await Product.create({
        name: 'Product',
        description: 'Description',
        price: 100,
        imageUrl: 'https://example.com/image.jpg',
        category: 'Test',
        stock: 10,
      });

      expect(product.isActive).toBe(true);
    });

    it('should allow inactive products', async () => {
      const product = await Product.create({
        name: 'Product',
        description: 'Description',
        price: 100,
        imageUrl: 'https://example.com/image.jpg',
        category: 'Test',
        stock: 10,
        isActive: false,
      });

      expect(product.isActive).toBe(false);
    });
  });

  describe('Required Fields', () => {
    it('should require name', async () => {
      const product = new Product({
        description: 'Description',
        price: 100,
        imageUrl: 'https://example.com/image.jpg',
        category: 'Test',
        stock: 10,
      });

      await expect(product.save()).rejects.toThrow();
    });

    it('should require price', async () => {
      const product = new Product({
        name: 'Product',
        description: 'Description',
        imageUrl: 'https://example.com/image.jpg',
        category: 'Test',
        stock: 10,
      });

      await expect(product.save()).rejects.toThrow();
    });

    it('should require category', async () => {
      const product = new Product({
        name: 'Product',
        description: 'Description',
        price: 100,
        imageUrl: 'https://example.com/image.jpg',
        stock: 10,
      });

      await expect(product.save()).rejects.toThrow();
    });
  });
});
