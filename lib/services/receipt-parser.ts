/**
 * Receipt Parser Service
 * 
 * Parses OCR-extracted text from collection receipts (RECU DE COLLECTE D'ACHAT)
 * to extract structured data using regex patterns.
 * 
 * Requirements: 14.1-14.13
 */

import type {
  ParsedReceipt,
  ProductLine,
  LocationData,
  PaymentMode,
  PaymentData,
  ConfidenceLevel,
} from '@/types/receipts';

/**
 * Actors data extracted from receipt
 */
interface ActorsData {
  seller: string | null;
  buyer: string | null;
}

/**
 * Receipt Parser Service
 * Extracts structured data from OCR text of collection receipts
 */
export class ReceiptParser {
  /**
   * Parse OCR text and extract all receipt fields
   * 
   * @param text - OCR-extracted text from PDF
   * @returns Parsed receipt data with confidence indicators
   * 
   * Requirements: 14.1-14.13
   */
  parse(text: string): ParsedReceipt {
    const confidence: Record<string, ConfidenceLevel> = {};

    const contractNumber = this.extractContractNumber(text);
    confidence.contractNumber = contractNumber ? 'high' : 'low';

    const receiptNumber = this.extractReceiptNumber(text);
    confidence.receiptNumber = receiptNumber ? 'high' : 'low';

    const campaign = this.extractCampaign(text);
    confidence.campaign = campaign ? 'high' : 'low';

    const transactionDate = this.extractDate(text);
    confidence.transactionDate = transactionDate ? 'high' : 'low';

    const location = this.extractLocation(text);
    confidence.location = location ? 'medium' : 'low';

    const actors = this.extractActors(text);
    confidence.seller = actors.seller ? 'medium' : 'low';
    confidence.buyer = actors.buyer ? 'medium' : 'low';

    const professionalCard = this.extractProfessionalCard(text);
    confidence.professionalCard = professionalCard ? 'high' : 'low';

    const productLines = this.extractProductLines(text);
    confidence.productLines = productLines.length > 0 ? 'medium' : 'low';

    const payment = this.extractPayment(text);
    confidence.payment = payment ? 'medium' : 'low';

    return {
      contractNumber,
      receiptNumber,
      campaign,
      transactionDate,
      seller: actors.seller,
      buyer: actors.buyer,
      professionalCard,
      location,
      productLines,
      payment,
      confidence,
    };
  }

  /**
   * Extract contract number from OCR text
   * Pattern: N°CONT.M041912772280M-CM/DLA/03/2025/00320
   * 
   * @param text - OCR text
   * @returns Contract number or null
   * 
   * Requirement 14.1: Extract contract number pattern
   */
  extractContractNumber(text: string): string | null {
    // Pattern for SCPB contract numbers
    // Format: N°CONT.{alphanumeric}-{path}/{date}/{number}
    const patterns = [
      /N°\s*CONT\.([A-Z0-9]+(?:-[A-Z0-9\/]+)*)/i,
      /N°\s*CONTRAT\.([A-Z0-9]+(?:-[A-Z0-9\/]+)*)/i,
      /CONTRAT\s*N°\s*[:.]?\s*([A-Z0-9]+(?:-[A-Z0-9\/]+)*)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract receipt number from OCR text
   * Pattern: N° 0000004
   * 
   * @param text - OCR text
   * @returns Receipt number or null
   * 
   * Requirement 14.2: Extract receipt number pattern
   */
  extractReceiptNumber(text: string): string | null {
    // Pattern for receipt numbers
    // Format: N° followed by digits (with optional leading zeros)
    const patterns = [
      /(?:RECU|RECEPISSE).*?N°\s*[:.]?\s*(\d{4,})/i,
      /N°\s*[:.]?\s*(\d{4,})/,
      /NUMERO\s*[:.]?\s*(\d{4,})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract campaign from OCR text
   * Pattern: cacaoyère 2023/2024
   * 
   * @param text - OCR text
   * @returns Campaign or null
   * 
   * Requirement 14.3: Extract campaign pattern
   */
  extractCampaign(text: string): string | null {
    // Pattern for campaign
    // Format: "cacaoyère YYYY/YYYY" or "campagne YYYY/YYYY"
    const patterns = [
      /(?:cacaoy[eè]re|campagne)\s+(\d{4}\/\d{4})/i,
      /(?:saison|p[eé]riode)\s+(\d{4}\/\d{4})/i,
      /(\d{4}\/\d{4})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract transaction date from OCR text
   * Format: DD.MM.YYYY
   * 
   * @param text - OCR text
   * @returns Date in ISO format (YYYY-MM-DD) or null
   * 
   * Requirement 14.4: Extract date in DD.MM.YYYY format
   */
  extractDate(text: string): string | null {
    // Pattern for date in DD.MM.YYYY format
    const patterns = [
      /(?:date|le)\s*[:.]?\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/i,
      /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        const year = match[3];
        
        // Validate date
        const date = new Date(`${year}-${month}-${day}`);
        if (!isNaN(date.getTime())) {
          return `${year}-${month}-${day}`;
        }
      }
    }

    return null;
  }

  /**
   * Extract location data from OCR text
   * Extracts: region, department, arrondissement, village
   * 
   * @param text - OCR text
   * @returns Location data or null
   * 
   * Requirement 14.5: Extract location hierarchy
   */
  extractLocation(text: string): LocationData | null {
    const location: LocationData = {};

    // Extract region
    const regionMatch = text.match(/R[eé]gion\s*[:.]?\s*([^\n]+)/i);
    if (regionMatch && regionMatch[1]) {
      location.region = regionMatch[1].trim();
    }

    // Extract department
    const departmentMatch = text.match(/D[eé]partement\s*[:.]?\s*([^\n]+)/i);
    if (departmentMatch && departmentMatch[1]) {
      location.department = departmentMatch[1].trim();
    }

    // Extract arrondissement
    const arrondissementMatch = text.match(/Arrondissement\s*[:.]?\s*([^\n]+)/i);
    if (arrondissementMatch && arrondissementMatch[1]) {
      location.arrondissement = arrondissementMatch[1].trim();
    }

    // Extract village
    const villageMatch = text.match(/Village\s*[:.]?\s*([^\n]+)/i);
    if (villageMatch && villageMatch[1]) {
      location.village = villageMatch[1].trim();
    }

    // Return null if no location data found
    return Object.keys(location).length > 0 ? location : null;
  }

  /**
   * Extract seller and buyer names from OCR text
   * 
   * @param text - OCR text
   * @returns Actors data (seller and buyer)
   * 
   * Requirements 14.6, 14.7: Extract seller and buyer names
   */
  extractActors(text: string): ActorsData {
    let seller: string | null = null;
    let buyer: string | null = null;

    // Extract seller (planteur/vendeur/producteur)
    const sellerPatterns = [
      /(?:Nom\s+du\s+vendeur|vendeur|producteur)\s*[:.]?\s*([^\n]+)/i,
      /(?:planteur|nom\s+planteur)\s*[:.]?\s*([^\n]+)/i,
    ];

    for (const pattern of sellerPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        seller = match[1].trim();
        break;
      }
    }

    // Extract buyer (acheteur/collecteur/chef planteur)
    const buyerPatterns = [
      /(?:Nom\s+de\s+l['']acheteur|acheteur)\s*[:.]?\s*([^\n]+)/i,
      /(?:collecteur|chef\s+planteur)\s*[:.]?\s*([^\n]+)/i,
    ];

    for (const pattern of buyerPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        buyer = match[1].trim();
        break;
      }
    }

    return { seller, buyer };
  }

  /**
   * Extract professional card number from OCR text
   * 
   * @param text - OCR text
   * @returns Professional card number or null
   * 
   * Requirement 14.8: Extract professional card number
   */
  extractProfessionalCard(text: string): string | null {
    // Pattern for professional card number
    const patterns = [
      /Carte\s+professionnelle\s+N°\s*[:.]?\s*([A-Z0-9]+)/i,
      /Carte\s+prof\.?\s+N°\s*[:.]?\s*([A-Z0-9]+)/i,
      /N°\s+carte\s*[:.]?\s*([A-Z0-9]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract product lines from table structure in OCR text
   * 
   * @param text - OCR text
   * @returns Array of product lines
   * 
   * Requirement 14.9: Extract product lines from table
   */
  extractProductLines(text: string): ProductLine[] {
    const productLines: ProductLine[] = [];

    // Look for table structure with columns:
    // TYPE COMMERCIAUX | POIDS BRUT | HUMIDITE | POIDS NET | PRIX/KG | MONTANT
    
    const lines = text.split('\n');
    
    // Find table header — be tolerant: look for any line with TYPE + (POIDS or HUMIDITE or MONTANT)
    let tableStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toUpperCase();
      if (
        (line.includes('TYPE') || line.includes('COMMERCI')) &&
        (line.includes('POIDS') || line.includes('HUMIDITE') || line.includes('MONTANT'))
      ) {
        tableStartIndex = i + 1;
        break;
      }
    }

    // Fallback: look for "Tout Venant" or "G2" keywords directly
    if (tableStartIndex === -1) {
      for (let i = 0; i < lines.length; i++) {
        const upper = lines[i].toUpperCase();
        if (upper.includes('TOUT VENANT') || upper.includes('TOUT-VENANT') || /\bG2\b/.test(upper)) {
          tableStartIndex = i;
          break;
        }
      }
    }

    if (tableStartIndex === -1) {
      return productLines;
    }

    // Parse table rows
    for (let i = tableStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;
      
      // Stop at footer keywords
      if (/^(total|signature|mode\s+de\s+paiement|montant\s+vers|espèces|autres)/i.test(line)) {
        break;
      }

      const productLine = this.parseProductLine(line);
      if (productLine) {
        productLines.push(productLine);
      }
    }

    return productLines;
  }

  /**
   * Parse a single product line from text
   * 
   * @param line - Text line containing product data
   * @returns Product line or null
   */
  private parseProductLine(line: string): ProductLine | null {
    // Convert comma decimals to dots
    const parseNumber = (str: string) => parseFloat(str.replace(',', '.'));

    // Extract commercial type (text before first pipe or before first large number)
    let commercialType = 'Unknown';
    let dataSection = line;
    
    // Try to extract text before pipe
    const pipeMatch = line.match(/^([^|]+)\|(.+)$/);
    if (pipeMatch) {
      commercialType = pipeMatch[1].trim();
      dataSection = pipeMatch[2]; // Rest of the line after the type
    } else {
      // Try to extract text before first number > 10 (to avoid catching "G2" digits)
      const typeMatch = line.match(/^([A-Za-zÀ-ÿ0-9\s]+?)(?=\s+\d{2,})/);
      if (typeMatch) {
        commercialType = typeMatch[1].trim();
        dataSection = line.substring(typeMatch[0].length);
      }
    }

    // Skip if commercial type is empty or looks like a header/footer
    if (!commercialType || commercialType.length < 2 || commercialType === 'Unknown') {
      return null;
    }

    // Extract numbers from the data section (excluding the commercial type)
    const numbers = dataSection.match(/\d+(?:[.,]\d+)?/g);
    
    if (!numbers || numbers.length < 4) {
      return null;
    }

    // Parse numbers (expecting: grossWeight, humidity, netWeight, pricePerKg, amount)
    // But we'll use at least 4 numbers: grossWeight, humidity, pricePerKg, amount
    const grossWeight = parseNumber(numbers[0]);
    const humidity = parseNumber(numbers[1]);
    
    // If we have 5+ numbers, assume format: gross, humidity, net, price, amount
    // If we have 4 numbers, assume format: gross, humidity, price, amount
    let pricePerKg: number;
    let amount: number;
    
    if (numbers.length >= 5) {
      pricePerKg = parseNumber(numbers[3]);
      amount = parseNumber(numbers[4]);
    } else {
      pricePerKg = parseNumber(numbers[2]);
      amount = parseNumber(numbers[3]);
    }

    // Calculate net weight
    const netWeight = grossWeight * (1 - humidity / 100);

    // Validate extracted data
    if (
      grossWeight > 0 &&
      humidity >= 0 &&
      humidity <= 100 &&
      pricePerKg > 0 &&
      amount > 0
    ) {
      return {
        commercialType,
        grossWeight,
        humidity,
        netWeight: Math.round(netWeight * 100) / 100,
        pricePerKg,
        amount,
      };
    }

    return null;
  }

  /**
   * Extract payment information from OCR text
   * 
   * @param text - OCR text
   * @returns Payment data or null
   * 
   * Requirements 14.10, 14.11: Extract payment mode and amount
   */
  extractPayment(text: string): PaymentData | null {
    let mode: PaymentMode | undefined;

    // Extract payment mode
    if (/esp[eè]ces/i.test(text)) {
      mode = 'Espèces';
    } else if (/autres/i.test(text)) {
      mode = 'Autres';
    }

    // Return null if no mode found
    if (!mode) {
      return null;
    }

    // Extract amount paid
    let amountPaid = 0;
    const amountPatterns = [
      /Montant\s+vers[eé]\s*[:.]?\s*(\d+(?:[.,]\d+)?)/i,
      /Vers[eé]\s*[:.]?\s*(\d+(?:[.,]\d+)?)/i,
      /Pay[eé]\s*[:.]?\s*(\d+(?:[.,]\d+)?)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        amountPaid = parseFloat(match[1].replace(',', '.'));
        break;
      }
    }

    // Return PaymentData with required fields
    return {
      mode,
      amountPaid,
    };
  }

  /**
   * Calculate confidence level based on extraction quality
   * 
   * @param value - Extracted value
   * @param pattern - Regex pattern used
   * @returns Confidence level
   */
  private calculateConfidence(
    value: string | null,
    pattern: RegExp
  ): ConfidenceLevel {
    if (!value) {
      return 'low';
    }

    // High confidence if exact pattern match
    if (pattern.test(value)) {
      return 'high';
    }

    // Medium confidence if partial match
    return 'medium';
  }
}

/**
 * Create a new receipt parser instance
 */
export function createReceiptParser(): ReceiptParser {
  return new ReceiptParser();
}

// Export singleton instance
export const receiptParser = new ReceiptParser();
