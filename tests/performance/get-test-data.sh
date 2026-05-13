#!/bin/bash

###############################################################################
# Helper Script to Get Test Data for Performance Tests
#
# This script helps you gather the necessary data to run performance tests:
# - Parcelle IDs from the database
# - Instructions for getting an auth token
#
# Usage:
#   ./tests/performance/get-test-data.sh
###############################################################################

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=== Performance Test Data Helper ===${NC}\n"

###############################################################################
# 1. Get Parcelle IDs
###############################################################################

echo -e "${BLUE}[1/2] Fetching Parcelle IDs...${NC}\n"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}Warning: .env.local not found${NC}"
    echo -e "Please create .env.local with your database connection string"
    exit 1
fi

# Source environment variables
source .env.local

# Check if we have database URL
if [ -z "$DATABASE_URL" ] && [ -z "$SUPABASE_DB_URL" ]; then
    echo -e "${YELLOW}Warning: No database URL found in .env.local${NC}"
    echo -e "Add DATABASE_URL or SUPABASE_DB_URL to .env.local"
    exit 1
fi

DB_URL="${DATABASE_URL:-$SUPABASE_DB_URL}"

echo "Fetching 5 random parcelle IDs from database..."
echo ""

# Query database for parcelle IDs
PARCELLE_IDS=$(psql "$DB_URL" -t -c "SELECT id FROM parcelles ORDER BY RANDOM() LIMIT 5;" 2>/dev/null || echo "")

if [ -z "$PARCELLE_IDS" ]; then
    echo -e "${YELLOW}Could not fetch parcelle IDs from database${NC}"
    echo -e "You can manually query the database:"
    echo -e "  psql \"\$DATABASE_URL\" -c \"SELECT id FROM parcelles LIMIT 5;\""
    echo ""
else
    echo -e "${GREEN}Found parcelle IDs:${NC}"
    echo "$PARCELLE_IDS" | while read -r id; do
        [ -n "$id" ] && echo "  - $id"
    done
    echo ""
    
    # Generate JavaScript array
    echo -e "${GREEN}Copy this to k6-load-test.js:${NC}"
    echo "const PARCELLE_IDS = ["
    echo "$PARCELLE_IDS" | while read -r id; do
        [ -n "$id" ] && echo "  '$id',"
    done
    echo "];"
    echo ""
fi

###############################################################################
# 2. Get Auth Token Instructions
###############################################################################

echo -e "${BLUE}[2/2] Getting Auth Token...${NC}\n"

echo "To get an authentication token:"
echo ""
echo "1. Start the application:"
echo "   npm run dev"
echo ""
echo "2. Open http://localhost:3000 in your browser"
echo ""
echo "3. Log in with your credentials"
echo ""
echo "4. Open Browser DevTools (F12)"
echo ""
echo "5. Go to: Application > Local Storage > http://localhost:3000"
echo ""
echo "6. Find the key 'supabase.auth.token' or similar"
echo ""
echo "7. Copy the JWT token value (starts with 'eyJ...')"
echo ""
echo "8. Use it in the performance test:"
echo "   ./tests/performance/run-all-tests.sh http://localhost:3000 YOUR_TOKEN"
echo ""

echo -e "${GREEN}Alternative: Use Supabase CLI${NC}"
echo ""
echo "If you have Supabase CLI installed:"
echo "  supabase db query \"SELECT auth.sign_in('user@example.com', 'password');\""
echo ""

###############################################################################
# Summary
###############################################################################

echo -e "${BLUE}=== Next Steps ===${NC}\n"
echo "1. Update PARCELLE_IDS in tests/performance/k6-load-test.js"
echo "2. Get your auth token using the instructions above"
echo "3. Run the performance tests:"
echo "   ./tests/performance/run-all-tests.sh http://localhost:3000 YOUR_TOKEN"
echo ""
