module.exports = {
  async up(db) {
    console.log('🚀 Running migration: Schema Updates v1.0');
    console.log('==================================================');

    try {
      // 1. Migrate User addresses
      console.log('\n📝 Step 1/5: Migrating user addresses...');
      const users = await db.collection('users').find({ addresses: { $exists: true } }).toArray();
      let userCount = 0;
      
      for (const user of users) {
        if (user.addresses && user.addresses.length > 0) {
          const needsMigration = user.addresses.some(addr => 
            addr.hasOwnProperty('street') || addr.hasOwnProperty('pincode')
          );
          
          if (needsMigration) {
            const updatedAddresses = user.addresses.map(addr => {
              // If already migrated, return as is
              if (addr.addressLine1 !== undefined) {
                return addr;
              }
              
              // Otherwise, migrate
              return {
                fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
                phone: addr.phone || '',
                addressLine1: addr.street || '',
                addressLine2: addr.addressLine2 || '',
                city: addr.city || '',
                state: addr.state || '',
                zipCode: addr.pincode || addr.zipCode || '',
                country: addr.country || 'India',
                isDefault: addr.isDefault || false
              };
            });
            
            await db.collection('users').updateOne(
              { _id: user._id },
              { $set: { addresses: updatedAddresses } }
            );
            userCount++;
          }
        }
      }
      console.log(`✅ Migrated ${userCount} user addresses`);

      // 2. Add refund fields to orders
      console.log('\n📝 Step 2/5: Adding refund fields to orders...');
      const orderResult = await db.collection('orders').updateMany(
        { refundStatus: { $exists: false } },
        {
          $set: {
            refundStatus: 'none',
            refundAmount: 0
          }
        }
      );
      console.log(`✅ Updated ${orderResult.modifiedCount} orders with refund fields`);

      // 3. Add images array to products
      console.log('\n📝 Step 3/5: Adding images field to products...');
      const productResult = await db.collection('products').updateMany(
        { images: { $exists: false } },
        { $set: { images: [] } }
      );
      console.log(`✅ Updated ${productResult.modifiedCount} products with images field`);

      // Optional: Migrate imageUrl to images array
      const productsWithImageUrl = await db.collection('products')
        .find({ 
          imageUrl: { $exists: true, $ne: null, $ne: '' },
          $or: [
            { images: { $exists: false } },
            { images: { $size: 0 } }
          ]
        })
        .toArray();
      
      let imagesMigrated = 0;
      for (const product of productsWithImageUrl) {
        await db.collection('products').updateOne(
          { _id: product._id },
          { $addToSet: { images: product.imageUrl } }
        );
        imagesMigrated++;
      }
      if (imagesMigrated > 0) {
        console.log(`✅ Migrated ${imagesMigrated} product imageUrls to images array`);
      }

      // 4. Initialize theme settings
      console.log('\n📝 Step 4/5: Initializing theme settings...');
      const themeExists = await db.collection('themesettings').findOne({});
      
      if (!themeExists) {
        await db.collection('themesettings').insertOne({
          activeTheme: 'default',
          customThemes: [],
          presetThemes: [
            {
              id: 'default',
              name: 'Default Theme',
              description: 'Clean and modern default theme',
              colors: {
                primary: '#3B82F6',
                secondary: '#10B981',
                accent: '#F59E0B',
                background: '#FFFFFF',
                text: '#1F2937',
                border: '#E5E7EB',
                error: '#EF4444',
                success: '#10B981',
                warning: '#F59E0B',
                info: '#3B82F6'
              },
              typography: {
                fontFamily: 'Inter, sans-serif',
                fontSize: {
                  small: '0.875rem',
                  base: '1rem',
                  large: '1.125rem',
                  xlarge: '1.25rem',
                  xxlarge: '1.5rem'
                },
                fontWeight: {
                  normal: '400',
                  medium: '500',
                  semibold: '600',
                  bold: '700'
                },
                lineHeight: {
                  tight: '1.25',
                  normal: '1.5',
                  relaxed: '1.75'
                }
              },
              layout: {
                containerWidth: '1280px',
                borderRadius: '0.5rem',
                spacing: '1rem',
                headerHeight: '4rem',
                footerHeight: 'auto'
              },
              isDefault: true
            },
            {
              id: 'dark',
              name: 'Dark Theme',
              description: 'Modern dark theme for night browsing',
              colors: {
                primary: '#60A5FA',
                secondary: '#34D399',
                accent: '#FBBF24',
                background: '#111827',
                text: '#F9FAFB',
                border: '#374151',
                error: '#F87171',
                success: '#34D399',
                warning: '#FBBF24',
                info: '#60A5FA'
              },
              typography: {
                fontFamily: 'Inter, sans-serif',
                fontSize: {
                  small: '0.875rem',
                  base: '1rem',
                  large: '1.125rem',
                  xlarge: '1.25rem',
                  xxlarge: '1.5rem'
                },
                fontWeight: {
                  normal: '400',
                  medium: '500',
                  semibold: '600',
                  bold: '700'
                },
                lineHeight: {
                  tight: '1.25',
                  normal: '1.5',
                  relaxed: '1.75'
                }
              },
              layout: {
                containerWidth: '1280px',
                borderRadius: '0.5rem',
                spacing: '1rem',
                headerHeight: '4rem',
                footerHeight: 'auto'
              },
              isDefault: false
            }
          ],
          history: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log('✅ Theme settings initialized with default and dark themes');
      } else {
        console.log('✅ Theme settings already exist, skipping initialization');
      }

      // 5. Initialize payment settings
      console.log('\n📝 Step 5/5: Initializing payment settings...');
      const paymentExists = await db.collection('paymentsettings').findOne({});
      
      if (!paymentExists) {
        await db.collection('paymentsettings').insertOne({
          gateways: [],
          globalSettings: {
            currency: 'INR',
            currencySymbol: '₹',
            allowedPaymentMethods: ['card', 'upi', 'netbanking', 'wallet', 'cod'],
            enableTestMode: true,
            enableSaveCards: false,
            requireCVV: true,
            paymentTimeout: 15,
            autoRefundOnFailure: false,
            enablePartialPayments: false,
            minOrderAmount: 1
          },
          history: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log('✅ Payment settings initialized with default configuration');
      } else {
        console.log('✅ Payment settings already exist, skipping initialization');
      }

      console.log('\n==================================================');
      console.log('✨ Migration completed successfully!');
      console.log('==================================================\n');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(db) {
    console.log('⏪ Rolling back migration: Schema Updates v1.0');
    console.log('==================================================');

    try {
      console.log('\n⚠️  WARNING: Rollback may cause data loss!');
      console.log('This will revert schema changes but may not restore all data.');
      
      // Note: Rollback operations are destructive and should be used with caution
      // In production, prefer manual rollback with database backups
      
      console.log('\n📝 Rolling back refund fields from orders...');
      await db.collection('orders').updateMany(
        {},
        {
          $unset: {
            refundStatus: '',
            refundAmount: ''
          }
        }
      );
      
      console.log('📝 Rolling back images field from products...');
      await db.collection('products').updateMany(
        {},
        { $unset: { images: '' } }
      );
      
      console.log('📝 Removing theme settings collection...');
      await db.collection('themesettings').drop().catch(() => {
        console.log('Theme settings collection does not exist');
      });
      
      console.log('📝 Removing payment settings collection...');
      await db.collection('paymentsettings').drop().catch(() => {
        console.log('Payment settings collection does not exist');
      });
      
      console.log('\n⚠️  User addresses were NOT rolled back to prevent data loss.');
      console.log('Please restore from backup if needed.');
      
      console.log('\n==================================================');
      console.log('✅ Rollback completed!');
      console.log('==================================================\n');

    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
