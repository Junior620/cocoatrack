// CocoaTrack V2 - CSV Import Integration Example
// Demonstrates how CSV parser and validation work together

import { parseCSV } from '../csv-parser';
import { validatePlanteurRows } from '@/lib/validations/planteur-import';

/**
 * Example: Complete CSV import workflow
 * 
 * This demonstrates the integration between:
 * 1. CSV parsing (delimiter detection, encoding, header validation)
 * 2. Row validation (field validation, error collection)
 * 3. Result aggregation (valid/invalid counts)
 */
export async function exampleCSVImportWorkflow() {
  // Sample CSV content (could be from file upload)
  const csvContent = `nom,prénoms,CNI,téléphone,superficie
Konan,Yao,CI123456,+2250701234567,5.5
Kouassi,Marie,CI789012,+2250709876543,3.2
Tra Bi,Jean,,+2250701111111,
,Invalid,CI999,+225070999,2.0
Doe,John,INVALID@CNI,not-a-phone,-5`;

  // Step 1: Parse CSV
  console.log('Step 1: Parsing CSV...');
  const parseResult = await parseCSV(csvContent);
  
  console.log(`- Detected delimiter: ${parseResult.delimiter}`);
  console.log(`- Detected encoding: ${parseResult.encoding}`);
  console.log(`- Headers found: ${parseResult.headers.join(', ')}`);
  console.log(`- Total rows: ${parseResult.data.length}`);
  
  if (parseResult.errors.length > 0) {
    console.log('- Parse errors:', parseResult.errors);
    return;
  }

  // Step 2: Validate rows
  console.log('\nStep 2: Validating rows...');
  const validationResults = validatePlanteurRows(parseResult.data);
  
  const validRows = validationResults.filter((r) => r.isValid);
  const invalidRows = validationResults.filter((r) => !r.isValid);
  
  console.log(`- Valid rows: ${validRows.length}`);
  console.log(`- Invalid rows: ${invalidRows.length}`);
  
  // Step 3: Display results
  console.log('\nStep 3: Results summary:');
  
  console.log('\nValid rows:');
  validRows.forEach((row) => {
    console.log(`  Row ${row.rowNumber}: ${row.data?.nom} ${row.data?.prénoms || ''}`);
  });
  
  console.log('\nInvalid rows:');
  invalidRows.forEach((row) => {
    console.log(`  Row ${row.rowNumber}:`);
    row.errors.forEach((error) => {
      console.log(`    - ${error.field}: ${error.message} (${error.code})`);
    });
  });
  
  // Step 4: Return structured result
  return {
    total: parseResult.data.length,
    valid: validRows.length,
    invalid: invalidRows.length,
    validData: validRows.map((r) => r.data),
    errors: invalidRows.map((r) => ({
      rowNumber: r.rowNumber,
      errors: r.errors,
    })),
  };
}

/**
 * Example output:
 * 
 * Step 1: Parsing CSV...
 * - Detected delimiter: ,
 * - Detected encoding: UTF-8
 * - Headers found: nom, prénoms, CNI, téléphone, superficie
 * - Total rows: 5
 * 
 * Step 2: Validating rows...
 * - Valid rows: 3
 * - Invalid rows: 2
 * 
 * Step 3: Results summary:
 * 
 * Valid rows:
 *   Row 1: Konan Yao
 *   Row 2: Kouassi Marie
 *   Row 3: Tra Bi Jean
 * 
 * Invalid rows:
 *   Row 4:
 *     - nom: Le nom est obligatoire (NAME_REQUIRED)
 *   Row 5:
 *     - CNI: Format CNI invalide... (INVALID_CNI_FORMAT)
 *     - téléphone: Format de téléphone invalide (INVALID_PHONE_FORMAT)
 *     - superficie: La superficie doit être un nombre positif (INVALID_SUPERFICIE)
 */
