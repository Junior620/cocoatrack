// CocoaTrack V2 - CSV Parser Utility
// Flexible CSV parsing with automatic delimiter and encoding detection
// Requirements: 1.1, 1.2, 1.3, 1.5, 9.2, 9.6

import { ParseError } from '@/types/planteur-import';

/**
 * CSV Parser configuration options
 */
export interface CSVParserOptions {
  /** Expected column headers (for validation) */
  expectedHeaders?: string[];
  /** Skip empty rows */
  skipEmptyRows?: boolean;
  /** Trim whitespace from values */
  trimValues?: boolean;
}

/**
 * CSV Parser result
 */
export interface CSVParserResult<T = Record<string, string>> {
  /** Parsed data rows (header row excluded) */
  data: T[];
  /** Detected delimiter */
  delimiter: ',' | ';';
  /** Detected encoding */
  encoding: 'UTF-8' | 'Latin-1';
  /** Column headers found in file */
  headers: string[];
  /** Parse errors (if any) */
  errors: ParseError[];
}

/**
 * Detect the delimiter used in a CSV file
 * Checks first few lines for comma vs semicolon frequency
 * 
 * Requirements: 1.1, 9.6
 * 
 * @param content - CSV file content
 * @returns Detected delimiter (',' or ';')
 */
export function detectDelimiter(content: string): ',' | ';' {
  // Take first 5 lines for analysis
  const lines = content.split('\n').slice(0, 5);
  
  let commaCount = 0;
  let semicolonCount = 0;
  
  for (const line of lines) {
    // Count delimiters outside of quoted strings
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes) {
        if (char === ',') commaCount++;
        if (char === ';') semicolonCount++;
      }
    }
  }
  
  // Return delimiter with higher count
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Detect the encoding of a CSV file
 * Checks for UTF-8 BOM and special characters
 * 
 * Requirements: 1.2
 * 
 * @param buffer - File buffer
 * @returns Detected encoding ('UTF-8' or 'Latin-1')
 */
export function detectEncoding(buffer: ArrayBuffer): 'UTF-8' | 'Latin-1' {
  const bytes = new Uint8Array(buffer);
  
  // Check for UTF-8 BOM (EF BB BF)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'UTF-8';
  }
  
  // Check for UTF-8 multi-byte sequences
  // If we find valid UTF-8 sequences, assume UTF-8
  for (let i = 0; i < Math.min(bytes.length, 1000); i++) {
    const byte = bytes[i];
    
    // Check for 2-byte UTF-8 sequence (110xxxxx 10xxxxxx)
    if ((byte & 0xe0) === 0xc0 && i + 1 < bytes.length) {
      const next = bytes[i + 1];
      if ((next & 0xc0) === 0x80) {
        return 'UTF-8';
      }
    }
    
    // Check for 3-byte UTF-8 sequence (1110xxxx 10xxxxxx 10xxxxxx)
    if ((byte & 0xf0) === 0xe0 && i + 2 < bytes.length) {
      const next1 = bytes[i + 1];
      const next2 = bytes[i + 2];
      if ((next1 & 0xc0) === 0x80 && (next2 & 0xc0) === 0x80) {
        return 'UTF-8';
      }
    }
  }
  
  // Default to Latin-1 if no UTF-8 indicators found
  return 'Latin-1';
}

/**
 * Parse a single CSV line respecting quoted values
 * Handles quotes, escaped quotes, and delimiters within quotes
 * 
 * @param line - CSV line to parse
 * @param delimiter - Delimiter to use
 * @returns Array of field values
 */
function parseCSVLine(line: string, delimiter: ',' | ';'): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote (double quote)
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // Field separator
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  // Add last field
  fields.push(currentField);
  
  return fields;
}

/**
 * Parse CSV content into array of objects
 * Automatically detects delimiter and encoding
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5, 9.2, 9.6
 * 
 * @param file - File object or string content
 * @param options - Parser options
 * @returns Parsed CSV data with metadata
 */
export async function parseCSV<T = Record<string, string>>(
  file: File | string,
  options: CSVParserOptions = {}
): Promise<CSVParserResult<T>> {
  const {
    expectedHeaders,
    skipEmptyRows = true,
    trimValues = true,
  } = options;
  
  const errors: ParseError[] = [];
  let content: string;
  let encoding: 'UTF-8' | 'Latin-1' = 'UTF-8';
  
  try {
    // Read file content
    if (typeof file === 'string') {
      content = file;
    } else {
      // Detect encoding from file buffer
      const buffer = await file.arrayBuffer();
      encoding = detectEncoding(buffer);
      
      // Decode with detected encoding
      const decoder = new TextDecoder(encoding === 'UTF-8' ? 'utf-8' : 'iso-8859-1');
      content = decoder.decode(buffer);
      
      // Remove UTF-8 BOM if present
      if (content.charCodeAt(0) === 0xfeff) {
        content = content.slice(1);
      }
    }
  } catch (error) {
    errors.push({
      message: 'Unable to read file. Please ensure it is a valid CSV file',
      code: 'FILE_READ_ERROR',
    });
    return {
      data: [],
      delimiter: ',',
      encoding: 'UTF-8',
      headers: [],
      errors,
    };
  }
  
  // Check for empty file
  if (!content || content.trim().length === 0) {
    errors.push({
      message: 'CSV file is empty',
      code: 'EMPTY_FILE',
    });
    return {
      data: [],
      delimiter: ',',
      encoding,
      headers: [],
      errors,
    };
  }
  
  // Detect delimiter
  const delimiter = detectDelimiter(content);
  
  // Split into lines
  const lines = content.split(/\r?\n/);
  
  // Check for header row
  if (lines.length === 0) {
    errors.push({
      message: 'CSV file must contain a header row with field names',
      code: 'MISSING_HEADER',
    });
    return {
      data: [],
      delimiter,
      encoding,
      headers: [],
      errors,
    };
  }
  
  // Parse header row
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine, delimiter).map((h) =>
    trimValues ? h.trim() : h
  );
  
  // Validate headers
  if (headers.length === 0 || headers.every((h) => !h)) {
    errors.push({
      message: 'CSV file must contain a header row with field names',
      code: 'MISSING_HEADER',
    });
    return {
      data: [],
      delimiter,
      encoding,
      headers: [],
      errors,
    };
  }
  
  // Check for required columns
  if (expectedHeaders && expectedHeaders.length > 0) {
    const missingHeaders = expectedHeaders.filter(
      (expected) => !headers.includes(expected)
    );
    
    if (missingHeaders.length > 0) {
      errors.push({
        message: `Missing required columns: ${missingHeaders.join(', ')}`,
        code: 'MISSING_REQUIRED_COLUMNS',
      });
      return {
        data: [],
        delimiter,
        encoding,
        headers,
        errors,
      };
    }
  }
  
  // Parse data rows (skip header row)
  const data: T[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty rows
    if (skipEmptyRows && !line) {
      continue;
    }
    
    // Parse line
    try {
      const fields = parseCSVLine(line, delimiter);
      
      // Skip if all fields are empty
      if (skipEmptyRows && fields.every((f) => !f.trim())) {
        continue;
      }
      
      // Create object from fields
      const row: Record<string, string> = {};
      
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const value = fields[j] || '';
        row[header] = trimValues ? value.trim() : value;
      }
      
      data.push(row as T);
    } catch (error) {
      errors.push({
        message: `Malformed CSV at line ${i + 1}`,
        code: 'MALFORMED_CSV',
        line: i + 1,
      });
    }
  }
  
  return {
    data,
    delimiter,
    encoding,
    headers,
    errors,
  };
}

/**
 * Generate a CSV template with headers and example data
 * 
 * Requirements: 9.5
 * 
 * @param headers - Column headers
 * @param exampleRows - Example data rows
 * @param delimiter - Delimiter to use (default: comma)
 * @returns CSV content as string
 */
export function generateCSVTemplate(
  headers: string[],
  exampleRows: Record<string, string>[],
  delimiter: ',' | ';' = ','
): string {
  const lines: string[] = [];
  
  // Add header row
  lines.push(headers.join(delimiter));
  
  // Add example rows
  for (const row of exampleRows) {
    const values = headers.map((header) => {
      const value = row[header] || '';
      // Quote values containing delimiter, quotes, or newlines
      if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    lines.push(values.join(delimiter));
  }
  
  return lines.join('\n');
}
