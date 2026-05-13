# Performance Tests - Quick Start Guide

## 🚀 Quick Start (5 Minutes)

### Step 1: Install K6

**macOS:**
```bash
brew install k6
```

**Linux (Ubuntu/Debian):**
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

### Step 2: Get Test Data

```bash
npm run test:performance:data
```

This will:
- Fetch 5 random parcelle IDs from your database
- Show you how to get an authentication token

### Step 3: Update Test Configuration

Edit `tests/performance/k6-load-test.js` and update the `PARCELLE_IDS` array with the IDs from Step 2:

```javascript
const PARCELLE_IDS = [
  'your-parcelle-id-1',
  'your-parcelle-id-2',
  'your-parcelle-id-3',
  'your-parcelle-id-4',
  'your-parcelle-id-5',
];
```

### Step 4: Get Authentication Token

1. Start the application: `npm run dev`
2. Open http://localhost:3000 in your browser
3. Log in with your credentials
4. Open Browser DevTools (F12)
5. Go to: **Application** > **Local Storage** > **http://localhost:3000**
6. Find and copy the JWT token (starts with `eyJ...`)

### Step 5: Run Tests

```bash
./tests/performance/run-all-tests.sh http://localhost:3000 YOUR_JWT_TOKEN
```

Or using npm:
```bash
BASE_URL=http://localhost:3000 AUTH_TOKEN=YOUR_JWT_TOKEN npm run test:performance
```

## 📊 What Gets Tested

### Lighthouse Performance Audit
- ✅ First Contentful Paint (FCP) < 2s
- ✅ Largest Contentful Paint (LCP) < 3s
- ✅ Time to Interactive (TTI) < 5s
- ✅ Cumulative Layout Shift (CLS) < 0.1

### K6 Load Test (50 Concurrent Users)
- ✅ Imagery loading time p50 < 3s
- ✅ NDVI calculation time p50 < 2s
- ✅ Error rate < 5%

## 📁 Results Location

After running tests, find results in:
```
coverage/performance-[timestamp]/
├── SUMMARY.md                   # Overall summary
├── lighthouse-output.log        # Lighthouse logs
├── k6-output.log               # K6 logs
├── k6-results.json             # Detailed K6 metrics
├── k6-summary.json             # K6 summary
└── *.html                      # Lighthouse HTML reports
```

## 🎯 Quick Commands

```bash
# Run all tests
npm run test:performance

# Run only Lighthouse
npm run test:performance:lighthouse

# Run only K6
npm run test:performance:k6

# Get test data
npm run test:performance:data
```

## ⚠️ Troubleshooting

### "k6: command not found"
Install k6 using the commands in Step 1 above.

### "Application not running"
Start the application: `npm run dev`

### "401 Unauthorized"
Make sure you're using a valid JWT token from Step 4.

### "404 Parcelle not found"
Update the parcelle IDs in `tests/performance/k6-load-test.js` with actual IDs from your database.

## 📚 Full Documentation

For detailed documentation, see:
- `tests/performance/README.md` - Complete guide
- `TASK_6.4.5_PERFORMANCE_TESTS_IMPLEMENTATION.md` - Implementation details

## 🔄 CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Install K6
  run: |
    # ... k6 installation commands ...

- name: Run performance tests
  run: ./tests/performance/run-all-tests.sh http://localhost:3000 ${{ secrets.TEST_AUTH_TOKEN }}

- name: Upload results
  uses: actions/upload-artifact@v3
  with:
    name: performance-results
    path: coverage/performance-*
```

## ✅ Success Criteria

Tests pass when:
- ✅ All Lighthouse metrics meet thresholds
- ✅ K6 imagery loading p50 < 3000ms
- ✅ K6 NDVI calculation p50 < 2000ms
- ✅ Error rate < 5%
- ✅ System handles 50 concurrent users

## 🎉 You're Ready!

Run the tests and check the results. If any tests fail, see the troubleshooting section or the full documentation for optimization tips.
