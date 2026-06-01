#!/usr/bin/env node

/**
 * Script to format Google Earth Engine private key for Vercel
 * 
 * Usage:
 *   node scripts/format-gee-key.js path/to/service-account.json
 * 
 * This will output the correctly formatted private key that you can
 * copy-paste directly into Vercel's GOOGLE_EARTH_ENGINE_PRIVATE_KEY variable.
 */

const fs = require('fs');
const path = require('path');

// Get the JSON file path from command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Error: Please provide the path to your service account JSON file');
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/format-gee-key.js path/to/service-account.json');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/format-gee-key.js ~/Downloads/ste-scpb-abc123.json');
  process.exit(1);
}

const jsonFilePath = args[0];

// Check if file exists
if (!fs.existsSync(jsonFilePath)) {
  console.error(`❌ Error: File not found: ${jsonFilePath}`);
  process.exit(1);
}

try {
  // Read and parse the JSON file
  const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
  const serviceAccount = JSON.parse(fileContent);

  // Validate required fields
  if (!serviceAccount.private_key) {
    console.error('❌ Error: No "private_key" field found in JSON file');
    process.exit(1);
  }

  if (!serviceAccount.client_email) {
    console.error('❌ Error: No "client_email" field found in JSON file');
    process.exit(1);
  }

  if (!serviceAccount.project_id) {
    console.error('❌ Error: No "project_id" field found in JSON file');
    process.exit(1);
  }

  // Extract the private key (already has \n characters)
  const privateKey = serviceAccount.private_key;

  // Display results
  console.log('');
  console.log('✅ Successfully extracted Google Earth Engine credentials!');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📋 COPY THESE VALUES TO VERCEL ENVIRONMENT VARIABLES');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  console.log('1️⃣  GOOGLE_EARTH_ENGINE_PROJECT_ID');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(serviceAccount.project_id);
  console.log('');
  
  console.log('2️⃣  GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(serviceAccount.client_email);
  console.log('');
  
  console.log('3️⃣  GOOGLE_EARTH_ENGINE_PRIVATE_KEY');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('⚠️  IMPORTANT: Copy the ENTIRE value below (including quotes)');
  console.log('');
  console.log(JSON.stringify(privateKey));
  console.log('');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📝 INSTRUCTIONS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('1. Go to: https://vercel.com/dashboard');
  console.log('2. Select your CocoaTrack project');
  console.log('3. Go to: Settings → Environment Variables');
  console.log('4. Add or update each variable above');
  console.log('5. Select: Production, Preview, Development (all 3)');
  console.log('6. Save and redeploy your application');
  console.log('');
  console.log('✅ The private key is already in the correct format with \\n');
  console.log('✅ Just copy-paste the entire value (with quotes)');
  console.log('');

  // Also save to a temporary file for easy copying
  const outputFile = path.join(__dirname, 'gee-credentials.txt');
  const output = `
GOOGLE_EARTH_ENGINE_PROJECT_ID
${serviceAccount.project_id}

GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT
${serviceAccount.client_email}

GOOGLE_EARTH_ENGINE_PRIVATE_KEY
${JSON.stringify(privateKey)}
`;

  fs.writeFileSync(outputFile, output.trim());
  console.log(`💾 Credentials also saved to: ${outputFile}`);
  console.log('   (You can delete this file after copying to Vercel)');
  console.log('');

} catch (error) {
  console.error('❌ Error processing file:', error.message);
  process.exit(1);
}
