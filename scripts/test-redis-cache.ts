/**
 * Redis Cache Test Script
 * 
 * This script demonstrates the Redis caching implementation for temporal NDVI queries.
 * It shows cache operations, invalidation, and statistics tracking.
 * 
 * Usage:
 *   # Without Redis (graceful fallback)
 *   npx tsx scripts/test-redis-cache.ts
 * 
 *   # With Redis
 *   REDIS_URL=redis://localhost:6379 npx tsx scripts/test-redis-cache.ts
 */

import { redisCacheService } from '../lib/satellite/services/redis-cache.service';

async function testRedisCache() {
  console.log('='.repeat(60));
  console.log('Redis Cache Test Script');
  console.log('='.repeat(60));
  console.log();

  // Check Redis availability
  const isAvailable = redisCacheService.isAvailable();
  console.log('1. Redis Connection Status');
  console.log('-'.repeat(60));
  console.log(`   Redis Available: ${isAvailable ? '✅ Yes' : '❌ No'}`);
  console.log(`   REDIS_URL: ${process.env.REDIS_URL || '(not set)'}`);
  console.log();

  if (!isAvailable) {
    console.log('   ℹ️  Redis is not configured. The cache service will operate');
    console.log('   in fallback mode (no caching, direct database queries).');
    console.log();
    console.log('   To enable Redis caching, set the REDIS_URL environment variable:');
    console.log('   REDIS_URL=redis://localhost:6379 npx tsx scripts/test-redis-cache.ts');
    console.log();
  }

  // Test cache operations
  console.log('2. Cache Operations Test');
  console.log('-'.repeat(60));

  const testKey = {
    parcelleId: '123e4567-e89b-12d3-a456-426614174000',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    interval: 'monthly' as const,
  };

  const testData = {
    parcelleId: testKey.parcelleId,
    summary: {
      averageNDVI: 0.65,
      trend: 'improving',
      significantChanges: 2,
    },
  };

  console.log(`   Cache Key: temporal:${testKey.parcelleId}:${testKey.startDate}:${testKey.endDate}:${testKey.interval}`);
  console.log();

  // Test cache miss
  console.log('   Testing cache miss...');
  const cachedData1 = await redisCacheService.getTemporalData(testKey);
  console.log(`   Result: ${cachedData1 ? '❌ Unexpected hit' : '✅ Cache miss (expected)'}`);
  console.log();

  // Test cache set
  console.log('   Setting cache data...');
  const setResult = await redisCacheService.setTemporalData(testKey, testData);
  console.log(`   Result: ${setResult ? '✅ Cached successfully' : '⚠️  Cache not set (Redis unavailable)'}`);
  console.log();

  // Test cache hit
  if (setResult) {
    console.log('   Testing cache hit...');
    const cachedData2 = await redisCacheService.getTemporalData(testKey);
    console.log(`   Result: ${cachedData2 ? '✅ Cache hit' : '❌ Unexpected miss'}`);
    if (cachedData2) {
      console.log(`   Data: averageNDVI=${cachedData2.summary.averageNDVI}, trend=${cachedData2.summary.trend}`);
    }
    console.log();
  }

  // Test cache invalidation
  console.log('3. Cache Invalidation Test');
  console.log('-'.repeat(60));
  console.log('   Invalidating cache for parcelle...');
  const invalidateResult = await redisCacheService.invalidateParcelleCache(testKey.parcelleId);
  console.log(`   Result: ${invalidateResult ? '✅ Invalidated successfully' : '⚠️  Not invalidated (Redis unavailable)'}`);
  console.log();

  if (invalidateResult) {
    console.log('   Testing cache after invalidation...');
    const cachedData3 = await redisCacheService.getTemporalData(testKey);
    console.log(`   Result: ${cachedData3 ? '❌ Unexpected hit (should be invalidated)' : '✅ Cache miss (invalidated)'}`);
    console.log();
  }

  // Test cache statistics
  console.log('4. Cache Statistics');
  console.log('-'.repeat(60));
  const stats = redisCacheService.getCacheStats();
  console.log(`   Total Operations: ${stats.hits + stats.misses}`);
  console.log(`   Cache Hits: ${stats.hits}`);
  console.log(`   Cache Misses: ${stats.misses}`);
  console.log(`   Cache Errors: ${stats.errors}`);
  console.log(`   Hit Rate: ${stats.hitRate.toFixed(2)}%`);
  console.log();

  // Test cache clearing
  console.log('5. Cache Clearing Test');
  console.log('-'.repeat(60));
  console.log('   Clearing all temporal caches...');
  const deletedCount = await redisCacheService.clearAllTemporalCaches();
  console.log(`   Result: ${deletedCount > 0 ? `✅ Cleared ${deletedCount} entries` : '⚠️  No entries to clear'}`);
  console.log();

  // Disconnect
  console.log('6. Cleanup');
  console.log('-'.repeat(60));
  console.log('   Disconnecting from Redis...');
  await redisCacheService.disconnect();
  console.log('   ✅ Disconnected');
  console.log();

  console.log('='.repeat(60));
  console.log('Test Complete');
  console.log('='.repeat(60));
  console.log();

  if (!isAvailable) {
    console.log('💡 Tip: To see Redis caching in action, set up a Redis instance');
    console.log('   and run this script with REDIS_URL environment variable.');
    console.log();
  }
}

// Run the test
testRedisCache()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error running test:', error);
    process.exit(1);
  });
