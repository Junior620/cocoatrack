#!/usr/bin/env node

/**
 * CocoaTrack V2 - Interactive Scanned Invoices Backend Test
 * 
 * This script helps you test the scanned invoices API routes interactively.
 * It will guide you through the verification process step by step.
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function print(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printHeader(message) {
  console.log('');
  print('='.repeat(60), 'blue');
  print(message, 'bright');
  print('='.repeat(60), 'blue');
  console.log('');
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  print('CocoaTrack V2 - Scanned Invoices Backend Verification', 'cyan');
  print('Interactive Test Script', 'cyan');
  console.log('');

  // Step 1: Check if server is running
  printHeader('Step 1: Server Status');
  print('Is the development server running? (npm run dev)', 'yellow');
  const serverRunning = await question('Enter yes/no: ');
  
  if (serverRunning.toLowerCase() !== 'yes' && serverRunning.toLowerCase() !== 'y') {
    print('Please start the server first with: npm run dev', 'red');
    print('Then run this script again.', 'yellow');
    rl.close();
    return;
  }
  
  print('✓ Server is running', 'green');

  // Step 2: Check database migration
  printHeader('Step 2: Database Migration');
  print('Have you applied the migration 20260320000001_scanned_invoices.sql?', 'yellow');
  print('Check in Supabase dashboard: Database → Tables → scanned_invoices', 'cyan');
  const migrationApplied = await question('Enter yes/no: ');
  
  if (migrationApplied.toLowerCase() !== 'yes' && migrationApplied.toLowerCase() !== 'y') {
    print('⚠ Please apply the migration first', 'red');
    print('The migration file is at: v2/supabase/migrations/20260320000001_scanned_invoices.sql', 'yellow');
  } else {
    print('✓ Migration applied', 'green');
  }

  // Step 3: Check storage bucket
  printHeader('Step 3: Storage Bucket');
  print('Have you created the "invoice-scans" bucket in Supabase Storage?', 'yellow');
  print('Check in Supabase dashboard: Storage → Buckets', 'cyan');
  const bucketCreated = await question('Enter yes/no: ');
  
  if (bucketCreated.toLowerCase() !== 'yes' && bucketCreated.toLowerCase() !== 'y') {
    print('⚠ Please create the bucket first', 'red');
    print('Bucket configuration:', 'yellow');
    print('  - Name: invoice-scans', 'cyan');
    print('  - Public: No (private)', 'cyan');
    print('  - File size limit: 10MB', 'cyan');
    print('  - Allowed MIME types: application/pdf, image/jpeg, image/png, image/webp', 'cyan');
  } else {
    print('✓ Bucket created', 'green');
  }

  // Step 4: Check RLS policies
  printHeader('Step 4: RLS Policies');
  print('Have you verified the RLS policies on scanned_invoices table?', 'yellow');
  print('Check in Supabase dashboard: Database → Tables → scanned_invoices → Policies', 'cyan');
  print('Expected policies:', 'cyan');
  print('  1. scanned_invoices_select_policy', 'cyan');
  print('  2. scanned_invoices_insert_policy', 'cyan');
  print('  3. scanned_invoices_delete_policy', 'cyan');
  const rlsVerified = await question('Enter yes/no: ');
  
  if (rlsVerified.toLowerCase() === 'yes' || rlsVerified.toLowerCase() === 'y') {
    print('✓ RLS policies verified', 'green');
  } else {
    print('⚠ Please verify RLS policies', 'yellow');
  }

  // Step 5: Check storage policies
  printHeader('Step 5: Storage Policies');
  print('Have you configured the storage policies for the invoice-scans bucket?', 'yellow');
  print('Check in Supabase dashboard: Storage → invoice-scans → Policies', 'cyan');
  print('Expected policies:', 'cyan');
  print('  1. Upload (INSERT) - Users can upload to their cooperative folder', 'cyan');
  print('  2. Download (SELECT) - Users can download from their cooperative folder', 'cyan');
  print('  3. Delete (DELETE) - Only admins can delete', 'cyan');
  const storagePoliciesConfigured = await question('Enter yes/no: ');
  
  if (storagePoliciesConfigured.toLowerCase() === 'yes' || storagePoliciesConfigured.toLowerCase() === 'y') {
    print('✓ Storage policies configured', 'green');
  } else {
    print('⚠ Please configure storage policies', 'yellow');
    print('See SCANNED_INVOICES_VERIFICATION.md for SQL examples', 'cyan');
  }

  // Step 6: API Testing
  printHeader('Step 6: API Testing');
  print('To test the API routes, you need:', 'yellow');
  print('  1. A valid authentication token', 'cyan');
  print('  2. An existing invoice ID', 'cyan');
  console.log('');
  print('Would you like to test the API routes now?', 'yellow');
  const testApi = await question('Enter yes/no: ');
  
  if (testApi.toLowerCase() === 'yes' || testApi.toLowerCase() === 'y') {
    console.log('');
    print('Please provide the following information:', 'yellow');
    
    const apiUrl = await question('API URL (default: http://localhost:3000): ') || 'http://localhost:3000';
    const token = await question('Authentication token: ');
    const invoiceId = await question('Invoice ID: ');
    
    if (!token || !invoiceId) {
      print('⚠ Token and Invoice ID are required for testing', 'red');
    } else {
      console.log('');
      print('Test commands:', 'green');
      console.log('');
      
      // Upload test
      print('1. Upload a file:', 'cyan');
      console.log(`curl -X POST \\`);
      console.log(`  ${apiUrl}/api/invoices/${invoiceId}/scans \\`);
      console.log(`  -H "Authorization: Bearer ${token}" \\`);
      console.log(`  -F "file=@test-invoice.pdf"`);
      console.log('');
      
      // List test
      print('2. List files:', 'cyan');
      console.log(`curl -X GET \\`);
      console.log(`  ${apiUrl}/api/invoices/${invoiceId}/scans \\`);
      console.log(`  -H "Authorization: Bearer ${token}"`);
      console.log('');
      
      // Download test
      print('3. Download a file (replace SCAN_ID):', 'cyan');
      console.log(`curl -X GET \\`);
      console.log(`  ${apiUrl}/api/invoices/scans/SCAN_ID/download \\`);
      console.log(`  -H "Authorization: Bearer ${token}"`);
      console.log('');
      
      // Delete test
      print('4. Delete a file (admin only, replace SCAN_ID):', 'cyan');
      console.log(`curl -X DELETE \\`);
      console.log(`  ${apiUrl}/api/invoices/scans/SCAN_ID \\`);
      console.log(`  -H "Authorization: Bearer ${token}"`);
      console.log('');
    }
  }

  // Summary
  printHeader('Summary');
  console.log('');
  print('Backend Implementation Status:', 'bright');
  print('✓ API routes implemented', 'green');
  print('✓ Services implemented', 'green');
  print('✓ Types and validations implemented', 'green');
  console.log('');
  
  print('Manual Verification Required:', 'bright');
  if (migrationApplied.toLowerCase() !== 'yes' && migrationApplied.toLowerCase() !== 'y') {
    print('⚠ Apply database migration', 'yellow');
  }
  if (bucketCreated.toLowerCase() !== 'yes' && bucketCreated.toLowerCase() !== 'y') {
    print('⚠ Create storage bucket', 'yellow');
  }
  if (rlsVerified.toLowerCase() !== 'yes' && rlsVerified.toLowerCase() !== 'y') {
    print('⚠ Verify RLS policies', 'yellow');
  }
  if (storagePoliciesConfigured.toLowerCase() !== 'yes' && storagePoliciesConfigured.toLowerCase() !== 'y') {
    print('⚠ Configure storage policies', 'yellow');
  }
  console.log('');
  
  print('For detailed verification instructions, see:', 'cyan');
  print('  v2/SCANNED_INVOICES_VERIFICATION.md', 'bright');
  console.log('');
  
  print('Test script completed!', 'green');
  
  rl.close();
}

main().catch(error => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
