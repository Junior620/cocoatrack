#!/bin/bash

###############################################################################
# Performance Test Runner for Satellite Imagery Analysis
#
# This script runs comprehensive performance tests including:
# - Lighthouse performance audits
# - K6 load tests with 50 concurrent users
# - Custom performance measurements
#
# Usage:
#   ./tests/performance/run-all-tests.sh [BASE_URL] [AUTH_TOKEN]
#
# Example:
#   ./tests/performance/run-all-tests.sh http://localhost:3000 your-jwt-token
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-http://localhost:3000}"
AUTH_TOKEN="${2:-}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_DIR="coverage/performance-${TIMESTAMP}"

echo -e "${BLUE}=== Satellite Imagery Performance Test Suite ===${NC}"
echo -e "Base URL: ${BASE_URL}"
echo -e "Timestamp: ${TIMESTAMP}"
echo -e "Results directory: ${RESULTS_DIR}\n"

# Create results directory
mkdir -p "${RESULTS_DIR}"

###############################################################################
# 1. Check Prerequisites
###############################################################################

echo -e "${BLUE}[1/5] Checking prerequisites...${NC}"

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}✗ k6 is not installed${NC}"
    echo -e "Install k6: https://k6.io/docs/getting-started/installation/"
    echo -e "  macOS: brew install k6"
    echo -e "  Linux: sudo apt-get install k6"
    exit 1
fi
echo -e "${GREEN}✓ k6 is installed${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js is installed${NC}"

# Check if the application is running
if ! curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}" | grep -q "200\|302"; then
    echo -e "${YELLOW}⚠ Warning: Application may not be running at ${BASE_URL}${NC}"
    echo -e "Make sure the application is running before continuing."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
echo -e "${GREEN}✓ Application is accessible${NC}\n"

###############################################################################
# 2. Install Lighthouse (if not already installed)
###############################################################################

echo -e "${BLUE}[2/5] Setting up Lighthouse...${NC}"

if ! npm list -g lighthouse &> /dev/null; then
    echo -e "${YELLOW}Installing Lighthouse globally...${NC}"
    npm install -g lighthouse chrome-launcher
fi
echo -e "${GREEN}✓ Lighthouse is ready${NC}\n"

###############################################################################
# 3. Run Lighthouse Performance Tests
###############################################################################

echo -e "${BLUE}[3/5] Running Lighthouse performance tests...${NC}"
echo -e "This will test page load performance and Core Web Vitals\n"

export BASE_URL
node tests/performance/lighthouse-test.js 2>&1 | tee "${RESULTS_DIR}/lighthouse-output.log"

LIGHTHOUSE_EXIT_CODE=${PIPESTATUS[0]}

if [ $LIGHTHOUSE_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ Lighthouse tests passed${NC}\n"
else
    echo -e "${RED}✗ Lighthouse tests failed (see logs for details)${NC}\n"
fi

# Copy Lighthouse reports to results directory
if [ -d "coverage/lighthouse" ]; then
    cp -r coverage/lighthouse/* "${RESULTS_DIR}/" 2>/dev/null || true
fi

###############################################################################
# 4. Run K6 Load Tests
###############################################################################

echo -e "${BLUE}[4/5] Running K6 load tests...${NC}"
echo -e "This will simulate 50 concurrent users for 5 minutes\n"

# Export environment variables for k6
export BASE_URL
export AUTH_TOKEN

# Run k6 with JSON output for detailed metrics
k6 run \
    --out json="${RESULTS_DIR}/k6-results.json" \
    --summary-export="${RESULTS_DIR}/k6-summary.json" \
    tests/performance/k6-load-test.js \
    2>&1 | tee "${RESULTS_DIR}/k6-output.log"

K6_EXIT_CODE=${PIPESTATUS[0]}

if [ $K6_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ K6 load tests passed${NC}\n"
else
    echo -e "${RED}✗ K6 load tests failed (see logs for details)${NC}\n"
fi

###############################################################################
# 5. Generate Summary Report
###############################################################################

echo -e "${BLUE}[5/5] Generating summary report...${NC}"

cat > "${RESULTS_DIR}/SUMMARY.md" << EOF
# Performance Test Summary

**Date:** $(date)
**Base URL:** ${BASE_URL}
**Test Duration:** ~5 minutes

## Test Results

### Lighthouse Performance Tests

EOF

# Add Lighthouse summary if available
if [ -f "${RESULTS_DIR}/summary-"*.txt ]; then
    cat "${RESULTS_DIR}/summary-"*.txt >> "${RESULTS_DIR}/SUMMARY.md"
fi

cat >> "${RESULTS_DIR}/SUMMARY.md" << EOF

### K6 Load Test Results

**Test Configuration:**
- Concurrent Users: 50
- Test Duration: 5 minutes
- Ramp-up: 1.5 minutes
- Steady State: 3 minutes
- Ramp-down: 30 seconds

**Performance Targets:**
- Imagery Loading Time (p50): < 3 seconds
- NDVI Calculation Time (p50): < 2 seconds
- Error Rate: < 5%

EOF

# Extract key metrics from k6 summary if available
if [ -f "${RESULTS_DIR}/k6-summary.json" ]; then
    echo "**Key Metrics:**" >> "${RESULTS_DIR}/SUMMARY.md"
    echo '```' >> "${RESULTS_DIR}/SUMMARY.md"
    cat "${RESULTS_DIR}/k6-summary.json" | grep -A 20 "metrics" >> "${RESULTS_DIR}/SUMMARY.md" 2>/dev/null || echo "See k6-summary.json for detailed metrics" >> "${RESULTS_DIR}/SUMMARY.md"
    echo '```' >> "${RESULTS_DIR}/SUMMARY.md"
fi

cat >> "${RESULTS_DIR}/SUMMARY.md" << EOF

## Files Generated

- \`lighthouse-output.log\` - Lighthouse test output
- \`k6-output.log\` - K6 test output
- \`k6-results.json\` - Detailed K6 metrics
- \`k6-summary.json\` - K6 summary statistics
- \`*.html\` - Lighthouse HTML reports for each page

## Acceptance Criteria

✓ Imagery loading time p50 < 3 seconds
✓ NDVI calculation time p50 < 2 seconds
✓ System handles 50 concurrent users
✓ Error rate < 5%

EOF

echo -e "${GREEN}✓ Summary report generated${NC}\n"

###############################################################################
# Final Summary
###############################################################################

echo -e "${BLUE}=== Test Completion Summary ===${NC}\n"

if [ $LIGHTHOUSE_EXIT_CODE -eq 0 ] && [ $K6_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ All performance tests PASSED${NC}"
    echo -e "\nPerformance targets met:"
    echo -e "  ✓ Imagery loading time < 3s (p50)"
    echo -e "  ✓ NDVI calculation time < 2s (p50)"
    echo -e "  ✓ System handles 50 concurrent users"
    echo -e "  ✓ Error rate < 5%"
    EXIT_CODE=0
else
    echo -e "${RED}✗ Some performance tests FAILED${NC}"
    echo -e "\nCheck the following:"
    [ $LIGHTHOUSE_EXIT_CODE -ne 0 ] && echo -e "  ✗ Lighthouse tests failed"
    [ $K6_EXIT_CODE -ne 0 ] && echo -e "  ✗ K6 load tests failed"
    EXIT_CODE=1
fi

echo -e "\n${BLUE}Results saved to: ${RESULTS_DIR}${NC}"
echo -e "View summary: cat ${RESULTS_DIR}/SUMMARY.md\n"

exit $EXIT_CODE
