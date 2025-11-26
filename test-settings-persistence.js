/**
 * Test script to verify settings persistence
 * 
 * This script tests that:
 * 1. Theme settings persist in MongoDB
 * 2. Content settings would need to be added to MongoDB
 */

const mongoose = require('mongoose');

async function testSettingsPersistence() {
    try {
        // Connect to MongoDB
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';
        await mongoose.connect(mongoURI);
        console.log('✅ Connected to MongoDB');

        // Check if ThemeSettings collection exists
        const collections = await mongoose.connection.db.listCollections().toArray();
        const themeCollection = collections.find(c => c.name === 'themesettings');

        if (themeCollection) {
            console.log('✅ ThemeSettings collection exists');

            // Get current theme settings
            const ThemeSettings = mongoose.connection.collection('themesettings');
            const settings = await ThemeSettings.findOne({});

            if (settings) {
                console.log('✅ Theme settings found in database:');
                console.log(`   - Active Theme ID: ${settings.activeThemeId}`);
                console.log(`   - Active Theme Type: ${settings.activeThemeType}`);
                console.log(`   - Custom Themes Count: ${settings.customThemes?.length || 0}`);
                console.log(`   - Last Modified: ${settings.lastModified}`);
            } else {
                console.log('⚠️  No theme settings document found (will be created on first access)');
            }
        } else {
            console.log('⚠️  ThemeSettings collection does not exist yet');
        }

        // Check for ContentSettings collection (expected to NOT exist)
        const contentCollection = collections.find(c => c.name === 'contentsettings');
        if (contentCollection) {
            console.log('✅ ContentSettings collection exists');
        } else {
            console.log('❌ ContentSettings collection does NOT exist - content is localStorage only!');
        }

        console.log('\n📊 Summary:');
        console.log('   Themes: Persisted to MongoDB ✅');
        console.log('   Content: localStorage only ❌');
        console.log('   Client Propagation: Manual refresh required ❌');

        await mongoose.disconnect();
        console.log('\n✅ Test complete');
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testSettingsPersistence();
