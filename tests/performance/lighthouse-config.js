/**
 * Lighthouse Configuration for Satellite Imagery Performance Testing
 * 
 * This configuration focuses on measuring performance metrics for
 * satellite imagery pages and components.
 */

export default {
  extends: 'lighthouse:default',
  settings: {
    // Run multiple times for more accurate results
    onlyCategories: ['performance'],
    
    // Throttling settings (simulate 4G connection)
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
    },
    
    // Screen emulation (desktop)
    screenEmulation: {
      mobile: false,
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      disabled: false,
    },
    
    // Form factor
    formFactor: 'desktop',
    
    // Skip certain audits that aren't relevant
    skipAudits: [
      'uses-http2',
      'uses-long-cache-ttl',
      'uses-text-compression',
    ],
  },
  
  // Custom performance budgets
  budgets: [
    {
      resourceSizes: [
        {
          resourceType: 'script',
          budget: 500, // 500 KB for JavaScript
        },
        {
          resourceType: 'image',
          budget: 2000, // 2 MB for images (satellite imagery)
        },
        {
          resourceType: 'total',
          budget: 5000, // 5 MB total
        },
      ],
      timings: [
        {
          metric: 'first-contentful-paint',
          budget: 2000, // 2 seconds
        },
        {
          metric: 'largest-contentful-paint',
          budget: 3000, // 3 seconds
        },
        {
          metric: 'time-to-interactive',
          budget: 5000, // 5 seconds
        },
        {
          metric: 'cumulative-layout-shift',
          budget: 0.1, // CLS score
        },
      ],
    },
  ],
};
