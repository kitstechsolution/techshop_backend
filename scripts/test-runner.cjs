const { execSync } = require('child_process');
const net = require('net');

// Check if MongoDB is running
function checkMongoDB() {
  return new Promise((resolve) => {
    const client = new net.Socket();
    
    client.setTimeout(2000);
    
    client.on('connect', () => {
      console.log('✅ MongoDB is running');
      client.destroy();
      resolve(true);
    });
    
    client.on('timeout', () => {
      console.log('⚠️  MongoDB is not running');
      client.destroy();
      resolve(false);
    });
    
    client.on('error', () => {
      console.log('⚠️  MongoDB is not running');
      client.destroy();
      resolve(false);
    });
    
    client.connect(27017, '127.0.0.1');
  });
}

async function runTests() {
  console.log('\n🧪 Test Runner\n');
  
  const mongoDBRunning = await checkMongoDB();
  
  if (!mongoDBRunning) {
    console.log('\n❌ MongoDB is not running!');
    console.log('\nPlease start MongoDB first:');
    console.log('  - Windows Service: net start MongoDB');
    console.log('  - Manual: mongod');
    console.log('  - Docker: docker run -d -p 27017:27017 mongo\n');
    console.log('Or use manual testing with Postman/Thunder Client:');
    console.log('  See: docs/MANUAL_TESTING_GUIDE.md\n');
    process.exit(1);
  }
  
  console.log('\n🚀 Running tests with Jest...\n');
  
  try {
    execSync('jest --verbose --detectOpenHandles --forceExit', {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        MONGODB_TEST_URI: 'mongodb://localhost:27017/ecommerce_test'
      }
    });
    console.log('\n✅ All tests passed!\n');
  } catch (error) {
    console.log('\n❌ Some tests failed\n');
    process.exit(1);
  }
}

runTests();
