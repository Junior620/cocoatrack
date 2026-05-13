# Performance Testing for Satellite Imagery Analysis

This directory contains comprehensive performance tests for the satellite imagery analysis feature, including Lighthouse audits and K6 load tests.

## Overview

The performance test suite validates that the satellite imagery system meets the following acceptance criteria:

- **Imagery Loading Time**: p50 < 3 seconds
- **NDVI Calculation Time**: p50 < 2 seconds
- **Concurrent Users**: System handles 50 concurrent users
- **Error Rate**: < 5%

## Prerequisites

### 1. Install K6

K6 is required for load testing.

**macOS:**
```bash
brew install k6
```

**Linux (Debian/Ubuntu):**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**
```powershell
choco install k6
```

Or download from: https://k6.io/docs/getting-started/installation/

### 2. Install Lighthouse

Lighthouse is installed automatically by the test script, but you can install it manually:

```bash
npm install -g lighthouse chrome-launcher
```

### 3. Prepare Test Data

Before running tests, ensure you have:

1. **Running Application**: The application must be running (locally or deployed)
2. **Test Parcelles**: Update `PARCELLE_IDS` in `k6-load-test.js` with actual parcelle IDs from your database
3. **Authentication Token**: Obtain a valid JWT token for API authentication

## Running Tests

### Quick Start (All Tests)

Run all performance tests with a single command:

```bash
./tests/performance/run-all-tests.sh [BASE_URL] [AUTH_TOKEN]
```

**Example (Local):**
```bash
./tests/performance/run-all-tests.sh http://localhost:3000 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Example (Production):**
```bash
./tests/performance/run-all-tests.sh https://cocoatrack.vercel.app eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Individual Tests

#### Lighthouse Performance Audit

Test page load performance and Core Web Vitals:

```bash
BASE_URL=http://localhost:3000 node tests/performance/lighthouse-test.js
```

#### K6 Load Test

Simulate 50 concurrent users:

```bash
k6 run tests/performance/k6-load-test.js \
  -e BASE_URL=http://localhost:3000 \
  -e AUTH_TOKEN=your-jwt-token
```

**Custom Configuration:**

```bash
# Run with different user count
k6 run tests/performance/k6-load-test.js \
  --vus 100 \
  --duration 10m \
  -e BASE_URL=http://localhost:3000

# Run with specific stages
k6 run tests/performance/k6-load-test.js \
  --stage 1m:10,3m:50,1m:0 \
  -e BASE_URL=http://localhost:3000
```

## Test Files

### `k6-load-test.js`

Load test simulating 50 concurrent users accessing satellite imagery and NDVI endpoints.

**Test Stages:**
1. Ramp up to 10 users (30 seconds)
2. Ramp up to 50 users (1 minute)
3. Maintain 50 users (3 minutes)
4. Ramp down to 0 users (30 seconds)

**Endpoints Tested:**
- `GET /api/satellite/imagery` - Satellite imagery retrieval
- `POST /api/satellite/ndvi` - NDVI calculation
- `GET /api/satellite/health-status/:id` - Health status retrieval

**Metrics Collected:**
- Request duration (p50, p95, p99)
- Error rate
- Requests per second
- Custom metrics: imagery_load_time, ndvi_calculation_time

### `lighthouse-test.js`

Lighthouse performance audit for satellite imagery pages.

**Pages Tested:**
- Parcelle list page
- Parcelle detail page with satellite overlay
- NDVI analysis view

**Metrics Measured:**
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- Cumulative Layout Shift (CLS)
- Total Blocking Time (TBT)
- Speed Index

### `lighthouse-config.js`

Lighthouse configuration with custom performance budgets and throttling settings.

### `run-all-tests.sh`

Comprehensive test runner that executes all performance tests and generates a summary report.

## Understanding Results

### Lighthouse Results

Lighthouse generates HTML reports for each tested page. Open the HTML files in `coverage/lighthouse/` to view detailed performance metrics.

**Key Metrics:**
- **Performance Score**: Overall score (0-100)
- **FCP**: Time when first content appears (target: < 2s)
- **LCP**: Time when largest content appears (target: < 3s)
- **TTI**: Time until page is fully interactive (target: < 5s)
- **CLS**: Visual stability score (target: < 0.1)

### K6 Results

K6 outputs detailed metrics to the console and JSON files.

**Key Metrics:**
- **http_req_duration**: Request duration percentiles (p50, p95, p99)
- **http_req_failed**: Percentage of failed requests
- **iterations**: Number of complete test iterations
- **vus**: Virtual users (concurrent users)

**Interpreting Results:**

✅ **PASS**: All thresholds met
- Imagery loading p50 < 3000ms
- NDVI calculation p50 < 2000ms
- Error rate < 5%

❌ **FAIL**: One or more thresholds exceeded
- Check logs for specific failures
- Review error messages in output

## Troubleshooting

### Common Issues

#### 1. K6 Not Found

```
Error: k6: command not found
```

**Solution**: Install k6 following the prerequisites section above.

#### 2. Application Not Running

```
Warning: Application may not be running at http://localhost:3000
```

**Solution**: Start the application before running tests:
```bash
npm run dev  # or npm run start for production build
```

#### 3. Authentication Failures

```
Error: 401 Unauthorized
```

**Solution**: Provide a valid JWT token:
1. Log in to the application
2. Copy the JWT token from browser DevTools (Application > Local Storage)
3. Pass it to the test script

#### 4. Parcelle IDs Not Found

```
Error: 404 Not Found - Parcelle not found
```

**Solution**: Update `PARCELLE_IDS` in `k6-load-test.js` with actual IDs from your database:
```sql
SELECT id FROM parcelles LIMIT 5;
```

#### 5. Rate Limiting

```
Error: 429 Too Many Requests
```

**Solution**: 
- Reduce concurrent users: `--vus 25`
- Increase sleep time between requests in `k6-load-test.js`
- Check Redis cache configuration

### Performance Optimization Tips

If tests fail to meet targets:

1. **Enable Redis Caching**: Ensure Redis is running and configured
2. **Optimize Database Queries**: Check query performance with `EXPLAIN ANALYZE`
3. **Enable CDN**: Use CDN for static assets and imagery tiles
4. **Implement Code Splitting**: Lazy load satellite components
5. **Optimize Images**: Compress satellite imagery tiles
6. **Database Indexes**: Ensure proper indexes on satellite tables

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/performance.yml`:

```yaml
name: Performance Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install K6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Start application
        run: npm start &
        
      - name: Wait for application
        run: npx wait-on http://localhost:3000
      
      - name: Run performance tests
        run: ./tests/performance/run-all-tests.sh http://localhost:3000 ${{ secrets.TEST_AUTH_TOKEN }}
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: performance-results
          path: coverage/performance-*
```

## Continuous Monitoring

For production monitoring, consider:

1. **Synthetic Monitoring**: Schedule regular performance tests
2. **Real User Monitoring (RUM)**: Track actual user performance
3. **APM Tools**: Use Application Performance Monitoring (e.g., New Relic, Datadog)
4. **Alerts**: Set up alerts for performance degradation

## References

- [K6 Documentation](https://k6.io/docs/)
- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
- [Web Vitals](https://web.dev/vitals/)
- [Performance Budgets](https://web.dev/performance-budgets-101/)
