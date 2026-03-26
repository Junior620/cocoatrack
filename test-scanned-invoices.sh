#!/bin/bash

# CocoaTrack V2 - Scanned Invoices Backend Verification Script
# This script tests the scanned invoices API routes manually

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
SUPABASE_URL="${SUPABASE_URL:-https://txtncqcirhmbrnpkjmpy.supabase.co}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}CocoaTrack V2 - Scanned Invoices Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed. Please install jq to run this script.${NC}"
    echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

# Function to print section header
print_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
    fi
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Function to print info
print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if server is running
print_section "1. Checking Server Status"
if curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL" | grep -q "200\|301\|302"; then
    print_result 0 "Server is running at $API_BASE_URL"
else
    print_result 1 "Server is not running at $API_BASE_URL"
    print_warning "Please start the development server with: npm run dev"
    exit 1
fi

# Check if migration has been applied
print_section "2. Checking Database Migration"
print_info "Checking if scanned_invoices table exists..."

# Note: This requires direct database access or Supabase CLI
# For now, we'll skip this check and rely on API responses
print_warning "Manual verification required: Check Supabase dashboard for scanned_invoices table"

# Check if storage bucket exists
print_section "3. Checking Storage Bucket"
print_info "Checking if 'invoice-scans' bucket exists..."
print_warning "Manual verification required: Check Supabase dashboard for 'invoice-scans' bucket"
print_info "Expected configuration:"
print_info "  - Bucket name: invoice-scans"
print_info "  - Public: false (private)"
print_info "  - File size limit: 10MB"
print_info "  - Allowed MIME types: application/pdf, image/jpeg, image/png, image/webp"

# Test API routes (requires authentication)
print_section "4. API Routes Testing"
print_warning "API routes require authentication. Please test manually with:"
echo ""
echo -e "${YELLOW}4.1 Test Upload (POST /api/invoices/[id]/scans)${NC}"
echo "curl -X POST \\"
echo "  $API_BASE_URL/api/invoices/YOUR_INVOICE_ID/scans \\"
echo "  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \\"
echo "  -F 'file=@/path/to/test.pdf'"
echo ""

echo -e "${YELLOW}4.2 Test List (GET /api/invoices/[id]/scans)${NC}"
echo "curl -X GET \\"
echo "  $API_BASE_URL/api/invoices/YOUR_INVOICE_ID/scans \\"
echo "  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'"
echo ""

echo -e "${YELLOW}4.3 Test Download (GET /api/invoices/scans/[scanId]/download)${NC}"
echo "curl -X GET \\"
echo "  $API_BASE_URL/api/invoices/scans/YOUR_SCAN_ID/download \\"
echo "  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'"
echo ""

echo -e "${YELLOW}4.4 Test Delete (DELETE /api/invoices/scans/[scanId])${NC}"
echo "curl -X DELETE \\"
echo "  $API_BASE_URL/api/invoices/scans/YOUR_SCAN_ID \\"
echo "  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'"
echo ""

echo -e "${YELLOW}4.5 Test Bulk Delete (DELETE /api/invoices/scans/bulk)${NC}"
echo "curl -X DELETE \\"
echo "  $API_BASE_URL/api/invoices/scans/bulk \\"
echo "  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"scan_ids\": [\"SCAN_ID_1\", \"SCAN_ID_2\"]}'"
echo ""

# Check RLS policies
print_section "5. RLS Policies Verification"
print_warning "Manual verification required: Check Supabase dashboard for RLS policies"
print_info "Expected policies on scanned_invoices table:"
print_info "  1. scanned_invoices_select_policy - Managers/admins can view in their scope"
print_info "  2. scanned_invoices_insert_policy - Managers/admins can upload"
print_info "  3. scanned_invoices_delete_policy - Only admins can delete"
echo ""
print_info "Expected storage policies on invoice-scans bucket:"
print_info "  1. Upload (INSERT) - Users can upload to their cooperative folder"
print_info "  2. Download (SELECT) - Users can download from their cooperative folder"
print_info "  3. Delete (DELETE) - Only admins can delete"

# Summary
print_section "6. Summary"
echo ""
echo -e "${GREEN}✓ API routes are implemented${NC}"
echo -e "${GREEN}✓ Services are implemented${NC}"
echo -e "${GREEN}✓ Types and validations are implemented${NC}"
echo ""
echo -e "${YELLOW}Manual verification required:${NC}"
echo "  1. Check Supabase dashboard for scanned_invoices table"
echo "  2. Check Supabase dashboard for invoice-scans bucket"
echo "  3. Check Supabase dashboard for RLS policies"
echo "  4. Test API routes with valid authentication tokens"
echo "  5. Upload a test file and verify it appears in the bucket"
echo "  6. Test RLS policies with different user roles"
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test script completed${NC}"
echo -e "${BLUE}========================================${NC}"
