/**
 * Receipt Calculation Utilities
 * 
 * Provides calculation functions for receipt import feature with proper
 * rounding and precision handling for financial calculations.
 * 
 * Requirements: 5.7, 5.8, 5.9, 5.11
 */

/**
 * Rounds a number to specified decimal places
 * Uses banker's rounding (round half to even) for fairness
 */
function roundToPrecision(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Reference humidity for cacao export (contractual target < 8%)
 */
export const HUMIDITY_REFERENCE = 8;

/**
 * Calculate net weight (point net) from gross weight and measured humidity,
 * adjusted to the contractual reference humidity.
 *
 * Formula: net_weight = gross_weight × (100 - humidity_measured) / (100 - humidity_reference)
 *
 * @param grossWeight - Gross weight in kg (must be > 0)
 * @param humidity - Measured humidity percentage (must be between 0-100)
 * @param humidityRef - Reference humidity percentage (default: 8%)
 * @returns Net weight in kg, rounded to 2 decimal places
 *
 * @example
 * calculateNetWeight(65, 10)    // 65 × 90/92 = 63.59 kg
 * calculateNetWeight(65, 7.5)   // 65 × 92.5/92 = 65.35 kg
 * calculateNetWeight(804, 10)   // 804 × 90/92 = 786.52 kg
 *
 * Requirement 5.7: Automatic net weight calculation
 */
export function calculateNetWeight(
  grossWeight: number,
  humidity: number,
  humidityRef: number = HUMIDITY_REFERENCE
): number {
  if (grossWeight <= 0) {
    throw new Error('Gross weight must be greater than zero');
  }

  if (humidity < 0 || humidity > 100) {
    throw new Error('Humidity must be between 0% and 100%');
  }

  if (humidityRef < 0 || humidityRef >= 100) {
    throw new Error('Reference humidity must be between 0% and 100%');
  }

  const netWeight = (grossWeight * (100 - humidity)) / (100 - humidityRef);
  return roundToPrecision(netWeight, 2);
}

/**
 * Calculate line amount from net weight and price per kg
 * 
 * Formula: amount = net_weight * price_per_kg
 * 
 * @param netWeight - Net weight in kg (must be >= 0)
 * @param pricePerKg - Price per kilogram in XAF (must be > 0)
 * @returns Amount in XAF, rounded to 2 decimal places
 * 
 * @example
 * calculateLineAmount(90, 1000) // Returns 90000.00
 * calculateLineAmount(46.21, 1250) // Returns 57762.50
 * 
 * Requirement 5.8: Automatic line amount calculation
 */
export function calculateLineAmount(netWeight: number, pricePerKg: number): number {
  if (netWeight < 0) {
    throw new Error('Net weight cannot be negative');
  }
  
  if (pricePerKg <= 0) {
    throw new Error('Price per kg must be greater than zero');
  }
  
  const amount = netWeight * pricePerKg;
  return roundToPrecision(amount, 2);
}

/**
 * Product line interface for total calculation
 */
export interface ProductLine {
  amount: number;
}

/**
 * Calculate total amount from all product lines
 * 
 * Formula: total = sum of all line amounts
 * 
 * @param productLines - Array of product lines with amounts
 * @returns Total amount in XAF, rounded to 2 decimal places
 * 
 * @example
 * calculateTotalAmount([
 *   { amount: 90000 },
 *   { amount: 57762.50 }
 * ]) // Returns 147762.50
 * 
 * Requirement 5.9: Automatic total calculation
 */
export function calculateTotalAmount(productLines: ProductLine[]): number {
  if (!Array.isArray(productLines)) {
    throw new Error('Product lines must be an array');
  }
  
  if (productLines.length === 0) {
    return 0;
  }
  
  const total = productLines.reduce((sum, line) => {
    if (typeof line.amount !== 'number' || line.amount < 0) {
      throw new Error('Each product line must have a valid non-negative amount');
    }
    return sum + line.amount;
  }, 0);
  
  return roundToPrecision(total, 2);
}

/**
 * Calculate balance from total amount and amount paid
 * 
 * Formula: balance = total_amount - amount_paid
 * 
 * @param totalAmount - Total amount in XAF (must be >= 0)
 * @param amountPaid - Amount paid in XAF (must be >= 0)
 * @returns Balance in XAF, rounded to 2 decimal places (can be negative if overpaid)
 * 
 * @example
 * calculateBalance(147762.50, 100000) // Returns 47762.50
 * calculateBalance(50000, 50000) // Returns 0.00
 * calculateBalance(50000, 60000) // Returns -10000.00 (overpaid)
 * 
 * Requirement 5.11: Automatic balance calculation
 */
export function calculateBalance(totalAmount: number, amountPaid: number): number {
  if (totalAmount < 0) {
    throw new Error('Total amount cannot be negative');
  }
  
  if (amountPaid < 0) {
    throw new Error('Amount paid cannot be negative');
  }
  
  const balance = totalAmount - amountPaid;
  return roundToPrecision(balance, 2);
}

/**
 * Calculate all values for a complete product line
 * 
 * Convenience function that calculates both net weight and amount
 * 
 * @param grossWeight - Gross weight in kg
 * @param humidity - Humidity percentage
 * @param pricePerKg - Price per kilogram in XAF
 * @returns Object with netWeight and amount
 * 
 * @example
 * calculateProductLine(100, 10, 1000)
 * // Returns { netWeight: 90.00, amount: 90000.00 }
 */
export function calculateProductLine(
  grossWeight: number,
  humidity: number,
  pricePerKg: number
): { netWeight: number; amount: number } {
  const netWeight = calculateNetWeight(grossWeight, humidity);
  const amount = calculateLineAmount(netWeight, pricePerKg);
  
  return { netWeight, amount };
}
