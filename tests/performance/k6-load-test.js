/**
 * K6 Load Test for Satellite Imagery Analysis
 * 
 * This test simulates 50 concurrent users accessing satellite imagery
 * and NDVI calculation endpoints to measure performance under load.
 * 
 * Run with: k6 run tests/performance/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const imageryLoadTime = new Trend('imagery_load_time');
const ndviCalculationTime = new Trend('ndvi_calculation_time');
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 50 },   // Stay at 50 users for 3 minutes
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration{endpoint:imagery}': ['p(50)<3000', 'p(95)<5000'], // Imagery loading: p50 < 3s, p95 < 5s
    'http_req_duration{endpoint:ndvi}': ['p(50)<2000', 'p(95)<4000'],    // NDVI calculation: p50 < 2s, p95 < 4s
    'http_req_failed': ['rate<0.05'],  // Error rate < 5%
    'errors': ['rate<0.05'],
  },
};

// Base URL - can be overridden with -e BASE_URL=https://your-domain.com
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data - sample parcelle IDs (replace with actual IDs from your database)
const PARCELLE_IDS = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
];

// Authentication token (set via environment variable)
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export function setup() {
  console.log('Starting load test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Target: 50 concurrent users`);
  console.log(`Duration: 5 minutes`);
  
  if (!AUTH_TOKEN) {
    console.warn('WARNING: No AUTH_TOKEN provided. Requests may fail authentication.');
  }
  
  return { baseUrl: BASE_URL, authToken: AUTH_TOKEN };
}

export default function (data) {
  const { baseUrl, authToken } = data;
  
  // Select a random parcelle ID
  const parcelleId = PARCELLE_IDS[Math.floor(Math.random() * PARCELLE_IDS.length)];
  
  // Headers
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  // Test 1: Get satellite imagery
  const imageryStart = Date.now();
  const imageryResponse = http.get(
    `${baseUrl}/api/satellite/imagery?parcelleId=${parcelleId}&cloudCoverThreshold=20`,
    {
      headers,
      tags: { endpoint: 'imagery' },
    }
  );
  const imageryDuration = Date.now() - imageryStart;
  
  const imagerySuccess = check(imageryResponse, {
    'imagery status is 200': (r) => r.status === 200,
    'imagery has data': (r) => r.json('data') !== undefined,
    'imagery load time < 3s': () => imageryDuration < 3000,
  });
  
  imageryLoadTime.add(imageryDuration);
  errorRate.add(!imagerySuccess);
  
  if (!imagerySuccess) {
    console.error(`Imagery request failed: ${imageryResponse.status} - ${imageryResponse.body}`);
  }
  
  sleep(1); // Wait 1 second between requests
  
  // Test 2: Calculate NDVI
  const ndviStart = Date.now();
  const ndviResponse = http.post(
    `${baseUrl}/api/satellite/ndvi`,
    JSON.stringify({
      parcelleId,
      forceRecalculate: false,
    }),
    {
      headers,
      tags: { endpoint: 'ndvi' },
    }
  );
  const ndviDuration = Date.now() - ndviStart;
  
  const ndviSuccess = check(ndviResponse, {
    'ndvi status is 200': (r) => r.status === 200,
    'ndvi has result': (r) => r.json('data.meanNDVI') !== undefined,
    'ndvi calculation time < 2s': () => ndviDuration < 2000,
  });
  
  ndviCalculationTime.add(ndviDuration);
  errorRate.add(!ndviSuccess);
  
  if (!ndviSuccess) {
    console.error(`NDVI request failed: ${ndviResponse.status} - ${ndviResponse.body}`);
  }
  
  sleep(2); // Wait 2 seconds before next iteration
  
  // Test 3: Get health status
  const healthResponse = http.get(
    `${baseUrl}/api/satellite/health-status/${parcelleId}`,
    {
      headers,
      tags: { endpoint: 'health' },
    }
  );
  
  check(healthResponse, {
    'health status is 200': (r) => r.status === 200,
    'health has status': (r) => r.json('data.healthStatus') !== undefined,
  });
  
  sleep(1);
}

export function teardown(data) {
  console.log('Load test completed.');
  console.log('Check the summary below for performance metrics.');
}
