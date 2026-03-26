/**
 * Unit tests for receipt calculation utilities
 * 
 * Tests Requirements: 5.7, 5.8, 5.9, 5.11
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNetWeight,
  calculateLineAmount,
  calculateTotalAmount,
  calculateBalance,
  calculateProductLine,
} from '../receipt-calculations';

describe('calculateNetWeight', () => {
  it('should calculate net weight correctly for standard values', () => {
    expect(calculateNetWeight(100, 10)).toBe(90);
    expect(calculateNetWeight(50, 20)).toBe(40);
    expect(calculateNetWeight(75.5, 15)).toBe(64.18);
  });

  it('should handle zero humidity', () => {
    expect(calculateNetWeight(100, 0)).toBe(100);
  });

  it('should handle 100% humidity', () => {
    expect(calculateNetWeight(100, 100)).toBe(0);
  });

  it('should round to 2 decimal places', () => {
    expect(calculateNetWeight(100, 33.333)).toBe(66.67);
    expect(calculateNetWeight(50.5, 8.5)).toBe(46.21);
  });

  it('should throw error for negative gross weight', () => {
    expect(() => calculateNetWeight(-10, 10)).toThrow('Gross weight must be greater than zero');
  });

  it('should throw error for zero gross weight', () => {
    expect(() => calculateNetWeight(0, 10)).toThrow('Gross weight must be greater than zero');
  });

  it('should throw error for humidity below 0%', () => {
    expect(() => calculateNetWeight(100, -5)).toThrow('Humidity must be between 0% and 100%');
  });

  it('should throw error for humidity above 100%', () => {
    expect(() => calculateNetWeight(100, 105)).toThrow('Humidity must be between 0% and 100%');
  });
});

describe('calculateLineAmount', () => {
  it('should calculate line amount correctly for standard values', () => {
    expect(calculateLineAmount(90, 1000)).toBe(90000);
    expect(calculateLineAmount(46.21, 1250)).toBe(57762.5);
    expect(calculateLineAmount(100, 500)).toBe(50000);
  });

  it('should handle zero net weight', () => {
    expect(calculateLineAmount(0, 1000)).toBe(0);
  });

  it('should round to 2 decimal places', () => {
    expect(calculateLineAmount(33.333, 1000)).toBe(33333);
    expect(calculateLineAmount(10.5, 123.45)).toBe(1296.23);
  });

  it('should throw error for negative net weight', () => {
    expect(() => calculateLineAmount(-10, 1000)).toThrow('Net weight cannot be negative');
  });

  it('should throw error for zero price per kg', () => {
    expect(() => calculateLineAmount(100, 0)).toThrow('Price per kg must be greater than zero');
  });

  it('should throw error for negative price per kg', () => {
    expect(() => calculateLineAmount(100, -500)).toThrow('Price per kg must be greater than zero');
  });
});

describe('calculateTotalAmount', () => {
  it('should calculate total for single product line', () => {
    expect(calculateTotalAmount([{ amount: 90000 }])).toBe(90000);
  });

  it('should calculate total for multiple product lines', () => {
    expect(calculateTotalAmount([
      { amount: 90000 },
      { amount: 57762.5 },
      { amount: 25000 }
    ])).toBe(172762.5);
  });

  it('should return 0 for empty array', () => {
    expect(calculateTotalAmount([])).toBe(0);
  });

  it('should handle zero amounts', () => {
    expect(calculateTotalAmount([
      { amount: 0 },
      { amount: 50000 },
      { amount: 0 }
    ])).toBe(50000);
  });

  it('should round to 2 decimal places', () => {
    expect(calculateTotalAmount([
      { amount: 33.333 },
      { amount: 66.667 }
    ])).toBe(100);
  });

  it('should throw error for non-array input', () => {
    expect(() => calculateTotalAmount(null as any)).toThrow('Product lines must be an array');
    expect(() => calculateTotalAmount(undefined as any)).toThrow('Product lines must be an array');
    expect(() => calculateTotalAmount({} as any)).toThrow('Product lines must be an array');
  });

  it('should throw error for invalid amount', () => {
    expect(() => calculateTotalAmount([{ amount: -100 }])).toThrow(
      'Each product line must have a valid non-negative amount'
    );
  });

  it('should throw error for missing amount', () => {
    expect(() => calculateTotalAmount([{} as any])).toThrow(
      'Each product line must have a valid non-negative amount'
    );
  });
});

describe('calculateBalance', () => {
  it('should calculate positive balance when underpaid', () => {
    expect(calculateBalance(147762.5, 100000)).toBe(47762.5);
    expect(calculateBalance(50000, 25000)).toBe(25000);
  });

  it('should calculate zero balance when fully paid', () => {
    expect(calculateBalance(50000, 50000)).toBe(0);
    expect(calculateBalance(0, 0)).toBe(0);
  });

  it('should calculate negative balance when overpaid', () => {
    expect(calculateBalance(50000, 60000)).toBe(-10000);
    expect(calculateBalance(100, 150.5)).toBe(-50.5);
  });

  it('should round to 2 decimal places', () => {
    expect(calculateBalance(100.333, 50.111)).toBe(50.22);
  });

  it('should throw error for negative total amount', () => {
    expect(() => calculateBalance(-100, 50)).toThrow('Total amount cannot be negative');
  });

  it('should throw error for negative amount paid', () => {
    expect(() => calculateBalance(100, -50)).toThrow('Amount paid cannot be negative');
  });
});

describe('calculateProductLine', () => {
  it('should calculate both net weight and amount', () => {
    const result = calculateProductLine(100, 10, 1000);
    expect(result.netWeight).toBe(90);
    expect(result.amount).toBe(90000);
  });

  it('should handle decimal values', () => {
    const result = calculateProductLine(50.5, 8.5, 1250);
    expect(result.netWeight).toBe(46.21);
    expect(result.amount).toBe(57762.5);
  });

  it('should propagate validation errors from calculateNetWeight', () => {
    expect(() => calculateProductLine(-10, 10, 1000)).toThrow('Gross weight must be greater than zero');
    expect(() => calculateProductLine(100, 105, 1000)).toThrow('Humidity must be between 0% and 100%');
  });

  it('should propagate validation errors from calculateLineAmount', () => {
    expect(() => calculateProductLine(100, 10, 0)).toThrow('Price per kg must be greater than zero');
    expect(() => calculateProductLine(100, 10, -500)).toThrow('Price per kg must be greater than zero');
  });
});

describe('Integration: Complete receipt calculation flow', () => {
  it('should calculate complete receipt with multiple product lines', () => {
    // Product line 1: Tout Venant
    const line1 = calculateProductLine(100, 10, 1000);
    expect(line1.netWeight).toBe(90);
    expect(line1.amount).toBe(90000);

    // Product line 2: G2
    const line2 = calculateProductLine(50.5, 8.5, 1250);
    expect(line2.netWeight).toBe(46.21);
    expect(line2.amount).toBe(57762.5);

    // Total amount
    const total = calculateTotalAmount([
      { amount: line1.amount },
      { amount: line2.amount }
    ]);
    expect(total).toBe(147762.5);

    // Balance
    const balance = calculateBalance(total, 100000);
    expect(balance).toBe(47762.5);
  });

  it('should handle receipt with single product line', () => {
    const line = calculateProductLine(75, 12, 800);
    expect(line.netWeight).toBe(66);
    expect(line.amount).toBe(52800);

    const total = calculateTotalAmount([{ amount: line.amount }]);
    expect(total).toBe(52800);

    const balance = calculateBalance(total, 52800);
    expect(balance).toBe(0);
  });

  it('should handle receipt with overpayment', () => {
    const line = calculateProductLine(50, 15, 1000);
    expect(line.netWeight).toBe(42.5);
    expect(line.amount).toBe(42500);

    const total = calculateTotalAmount([{ amount: line.amount }]);
    expect(total).toBe(42500);

    const balance = calculateBalance(total, 50000);
    expect(balance).toBe(-7500);
  });
});
