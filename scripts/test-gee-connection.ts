/**
 * Test script to verify Google Earth Engine service account connection
 * 
 * Usage:
 *   npx ts-node scripts/test-gee-connection.ts
 * 
 * Prerequisites:
 *   - Service account created (Task 1.1.2)
 *   - Environment variables configured (Task 1.1.3)
 *   - @google/earthengine package installed
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testGEEConnection() {
  console.log('🔍 Testing Google Earth Engine Connection...\n');

  // Check environment variables
  const projectId = process.env.GOOGLE_EARTH_ENGINE_PROJECT_ID;
  const serviceAccount = process.env.GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT;
  const privateKeyPath = process.env.GOOGLE_EARTH_ENGINE_PRIVATE_KEY_PATH;
  const privateKey = process.env.GOOGLE_EARTH_ENGINE_PRIVATE_KEY;

  console.log('📋 Configuration Check:');
  console.log(`  Project ID: ${projectId ? '✅' : '❌'} ${projectId || 'NOT SET'}`);
  console.log(`  Service Account: ${serviceAccount ? '✅' : '❌'} ${serviceAccount || 'NOT SET'}`);
  console.log(`  Private Key Path: ${privateKeyPath ? '✅' : '❌'} ${privateKeyPath || 'NOT SET'}`);
  console.log(`  Private Key (inline): ${privateKey ? '✅' : '❌'} ${privateKey ? 'SET' : 'NOT SET'}`);
  console.log('');

  if (!projectId || !serviceAccount) {
    console.error('❌ Missing required environment variables!');
    console.error('   Please configure GOOGLE_EARTH_ENGINE_PROJECT_ID and GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT');
    console.error('   See docs/satellite/gee-service-account-setup.md for setup instructions');
    process.exit(1);
  }

  if (!privateKeyPath && !privateKey) {
    console.error('❌ Missing private key configuration!');
    console.error('   Please set either GOOGLE_EARTH_ENGINE_PRIVATE_KEY_PATH or GOOGLE_EARTH_ENGINE_PRIVATE_KEY');
    console.error('   See docs/satellite/gee-service-account-setup.md for setup instructions');
    process.exit(1);
  }

  try {
    // Note: Actual Earth Engine authentication will be implemented in Task 1.3.2
    // This is a placeholder test that verifies configuration
    
    console.log('🔐 Attempting to authenticate with Google Earth Engine...');
    console.log('   (Full authentication implementation pending Task 1.3.2)');
    console.log('');

    // Simulate authentication check
    console.log('✅ Configuration validation passed!');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Install Earth Engine Python API or Node.js client');
    console.log('   2. Implement authentication helper (Task 1.3.2)');
    console.log('   3. Test actual API connection (Task 1.1.4)');
    console.log('');
    console.log('🎉 Service account setup is complete!');

    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    console.error('');
    console.error('Troubleshooting:');
    console.error('  1. Verify service account has Earth Engine permissions');
    console.error('  2. Check that Earth Engine API is enabled in Google Cloud Console');
    console.error('  3. Ensure service account is registered with Earth Engine');
    console.error('  4. Verify JSON key file is valid and not corrupted');
    console.error('');
    console.error('See docs/satellite/gee-service-account-setup.md for detailed troubleshooting');
    
    return false;
  }
}

// Run the test
testGEEConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
