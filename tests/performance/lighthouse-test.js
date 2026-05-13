/**
 * Lighthouse Performance Test Runner
 * 
 * This script runs Lighthouse performance tests on satellite imagery pages
 * and generates a detailed performance report.
 * 
 * Run with: node tests/performance/lighthouse-test.js
 */

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, '../../coverage/lighthouse');

// Pages to test
const PAGES_TO_TEST = [
  {
    name: 'Parcelle List',
    url: `${BASE_URL}/parcelles`,
    description: 'Main parcelle list page',
  },
  {
    name: 'Parcelle Detail with Satellite',
    url: `${BASE_URL}/parcelles/00000000-0000-0000-0000-000000000001`, // Replace with actual ID
    description: 'Parcelle detail page with satellite imagery overlay',
  },
  {
    name: 'NDVI Analysis',
    url: `${BASE_URL}/parcelles/00000000-0000-0000-0000-000000000001?tab=satellite`,
    description: 'NDVI analysis view',
  },
];

// Performance thresholds
const THRESHOLDS = {
  'first-contentful-paint': 2000, // 2 seconds
  'largest-contentful-paint': 3000, // 3 seconds
  'time-to-interactive': 5000, // 5 seconds
  'cumulative-layout-shift': 0.1,
  'total-blocking-time': 300, // 300ms
  'speed-index': 4000, // 4 seconds
};

/**
 * Launch Chrome and run Lighthouse
 */
async function runLighthouse(url, options = {}) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox'],
  });
  
  const lighthouseOptions = {
    logLevel: 'info',
    output: 'html',
    onlyCategories: ['performance'],
    port: chrome.port,
    ...options,
  };
  
  const runnerResult = await lighthouse(url, lighthouseOptions);
  
  await chrome.kill();
  
  return runnerResult;
}

/**
 * Extract key metrics from Lighthouse results
 */
function extractMetrics(lhr) {
  const audits = lhr.audits;
  
  return {
    'first-contentful-paint': audits['first-contentful-paint']?.numericValue || 0,
    'largest-contentful-paint': audits['largest-contentful-paint']?.numericValue || 0,
    'time-to-interactive': audits['interactive']?.numericValue || 0,
    'cumulative-layout-shift': audits['cumulative-layout-shift']?.numericValue || 0,
    'total-blocking-time': audits['total-blocking-time']?.numericValue || 0,
    'speed-index': audits['speed-index']?.numericValue || 0,
    'performance-score': lhr.categories.performance?.score * 100 || 0,
  };
}

/**
 * Check if metrics meet thresholds
 */
function checkThresholds(metrics) {
  const results = {};
  let allPassed = true;
  
  for (const [metric, threshold] of Object.entries(THRESHOLDS)) {
    const value = metrics[metric];
    const passed = value <= threshold;
    
    results[metric] = {
      value,
      threshold,
      passed,
      unit: metric === 'cumulative-layout-shift' ? 'score' : 'ms',
    };
    
    if (!passed) {
      allPassed = false;
    }
  }
  
  return { results, allPassed };
}

/**
 * Generate summary report
 */
function generateSummary(testResults) {
  let summary = '\n=== LIGHTHOUSE PERFORMANCE TEST SUMMARY ===\n\n';
  
  for (const result of testResults) {
    summary += `Page: ${result.name}\n`;
    summary += `URL: ${result.url}\n`;
    summary += `Performance Score: ${result.metrics['performance-score'].toFixed(1)}/100\n\n`;
    
    summary += 'Metrics:\n';
    for (const [metric, data] of Object.entries(result.thresholds.results)) {
      const status = data.passed ? '✓ PASS' : '✗ FAIL';
      const value = data.unit === 'ms' ? `${data.value.toFixed(0)}ms` : data.value.toFixed(3);
      const threshold = data.unit === 'ms' ? `${data.threshold}ms` : data.threshold;
      
      summary += `  ${status} ${metric}: ${value} (threshold: ${threshold})\n`;
    }
    
    summary += `\nOverall: ${result.thresholds.allPassed ? '✓ PASSED' : '✗ FAILED'}\n`;
    summary += `Report: ${result.reportPath}\n`;
    summary += '\n' + '='.repeat(50) + '\n\n';
  }
  
  return summary;
}

/**
 * Main test runner
 */
async function main() {
  console.log('Starting Lighthouse performance tests...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Testing ${PAGES_TO_TEST.length} pages\n`);
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const testResults = [];
  
  // Run tests for each page
  for (const page of PAGES_TO_TEST) {
    console.log(`Testing: ${page.name}...`);
    
    try {
      const result = await runLighthouse(page.url);
      const metrics = extractMetrics(result.lhr);
      const thresholds = checkThresholds(metrics);
      
      // Save HTML report
      const reportFilename = `${page.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.html`;
      const reportPath = path.join(OUTPUT_DIR, reportFilename);
      fs.writeFileSync(reportPath, result.report);
      
      testResults.push({
        name: page.name,
        url: page.url,
        metrics,
        thresholds,
        reportPath,
      });
      
      console.log(`✓ Completed: ${page.name}`);
      console.log(`  Performance Score: ${metrics['performance-score'].toFixed(1)}/100`);
      console.log(`  Report saved: ${reportPath}\n`);
    } catch (error) {
      console.error(`✗ Failed: ${page.name}`);
      console.error(`  Error: ${error.message}\n`);
    }
  }
  
  // Generate and save summary
  const summary = generateSummary(testResults);
  console.log(summary);
  
  const summaryPath = path.join(OUTPUT_DIR, `summary-${Date.now()}.txt`);
  fs.writeFileSync(summaryPath, summary);
  console.log(`Summary saved: ${summaryPath}`);
  
  // Exit with error code if any tests failed
  const allPassed = testResults.every(r => r.thresholds.allPassed);
  process.exit(allPassed ? 0 : 1);
}

// Run tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
