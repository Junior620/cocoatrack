// CocoaTrack V2 - Planteur Import Validation Tests
// Basic unit tests for validation functionality

import { describe, it, expect } from 'vitest';
import {
  validatePlanteurRow,
  validatePlanteurRows,
  hasValidationErrors,
  getFieldErrors,
  formatValidationErrors,
} from '../planteur-import';

describe('Planteur Import Validation', () => {
  describe('validatePlanteurRow', () => {
    it('should validate a valid row', () => {
      const row = {
        nom: 'Konan',
        prénoms: 'Yao',
        CNI: 'CI123456',
        téléphone: '+2250701234567',
        superficie: '5.5',
        age: '35',
        genre: 'M',
      };

      const result = validatePlanteurRow(row);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual({
        nom: 'Konan',
        prénoms: 'Yao',
        CNI: 'CI123456',
        téléphone: '+2250701234567',
        superficie: 5.5,
        age: 35,
        genre: 'M',
      });
    });

    it('should validate row with only required fields', () => {
      const row = {
        nom: 'Konan',
        prénoms: '',
        CNI: '',
        téléphone: '',
        superficie: '',
      };

      const result = validatePlanteurRow(row);

      expect(result.isValid).toBe(true);
      expect(result.data?.nom).toBe('Konan');
      expect(result.data?.prénoms).toBeUndefined();
      expect(result.data?.CNI).toBeUndefined();
    });

    it('should reject row with missing nom', () => {
      const row = {
        nom: '',
        prénoms: 'Yao',
        CNI: 'CI123',
        téléphone: '+225070123456',
        superficie: '5',
      };

      const result = validatePlanteurRow(row);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('nom');
      expect(result.errors[0].code).toBe('NAME_REQUIRED');
    });

    it('should reject row with whitespace-only nom', () => {
      const row = {
        nom: '   ',
        prénoms: 'Yao',
        CNI: 'CI123',
        téléphone: '+225070123456',
        superficie: '5',
      };

      const result = validatePlanteurRow(row);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('nom');
    });

    it('should reject row with invalid CNI format', () => {
      const row = {
        nom: 'Konan',
        prénoms: 'Yao',
        CNI: 'CI-123@456',
        téléphone: '+225070123456',
        superficie: '5',
      };

      const result = validatePlanteurRow(row);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'CNI')).toBe(true);
      expect(result.errors.find((e) => e.field === 'CNI')?.code).toBe('INVALID_CNI_FORMAT');
    });

    it('should reject row with invalid phone format', () => {
      const row = {
        nom: 'Konan',
        prénoms: 'Yao',
        CNI: 'CI123',
        téléphone: 'invalid@phone',
        superficie: '5',
      };

      const result = validatePlanteurRow(row);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'téléphone')).toBe(true);
      expect(result.errors.find((e) => e.field === 'téléphone')?.code).toBe('INVALID_PHONE_FORMAT');
    });

    it('should reject row with negative superficie', () => {
      const row = {
        nom: 'Konan',
        prénoms: 'Yao',
        CNI: 'CI123',
        téléphone: '+225070123456',
        superficie: '-5',
      };

      const result = validatePlanteurRow(row);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'superficie')).toBe(true);
      expect(result.errors.find((e) => e.field === 'superficie')?.code).toBe('INVALID_SUPERFICIE');
    });

    it('should reject row with non-numeric superficie', () => {
      const row = {
        nom: 'Konan',
        prénoms: 'Yao',
        CNI: 'CI123',
        téléphone: '+225070123456',
        superficie: 'abc',
      };

      const result = validatePlanteurRow(row);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'superficie')).toBe(true);
    });

    it('should collect multiple validation errors', () => {
      const row = {
        nom: '',
        prénoms: 'Yao',
        CNI: 'CI-123@',
        téléphone: 'invalid',
        superficie: '-5',
      };

      const result = validatePlanteurRow(row);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors.some((e) => e.field === 'nom')).toBe(true);
      expect(result.errors.some((e) => e.field === 'CNI')).toBe(true);
      expect(result.errors.some((e) => e.field === 'téléphone')).toBe(true);
    });

    it('should trim whitespace from fields', () => {
      const row = {
        nom: '  Konan  ',
        prénoms: '  Yao  ',
        CNI: '  CI123  ',
        téléphone: '  +225070123456  ',
        superficie: '  5.5  ',
      };

      const result = validatePlanteurRow(row);

      expect(result.isValid).toBe(true);
      expect(result.data?.nom).toBe('Konan');
      expect(result.data?.prénoms).toBe('Yao');
      expect(result.data?.CNI).toBe('CI123');
    });

    it('should accept genre F and M (case insensitive)', () => {
      for (const genre of ['F', 'M', 'f', 'm']) {
        const row = { nom: 'Konan', genre };
        const result = validatePlanteurRow(row);
        expect(result.isValid).toBe(true);
        expect(result.data?.genre).toBe(genre.toUpperCase());
      }
    });

    it('should reject invalid genre values', () => {
      const row = { nom: 'Konan', genre: 'X' };
      const result = validatePlanteurRow(row);
      expect(result.isValid).toBe(false);
      expect(result.errors.find((e) => e.field === 'genre')?.code).toBe('INVALID_GENRE');
    });

    it('should accept valid age', () => {
      const row = { nom: 'Konan', age: '42' };
      const result = validatePlanteurRow(row);
      expect(result.isValid).toBe(true);
      expect(result.data?.age).toBe(42);
    });

    it('should reject negative or zero age', () => {
      for (const age of ['-1', '0']) {
        const row = { nom: 'Konan', age };
        const result = validatePlanteurRow(row);
        expect(result.isValid).toBe(false);
        expect(result.errors.find((e) => e.field === 'age')?.code).toBe('INVALID_AGE');
      }
    });

    it('should reject non-integer age', () => {
      const row = { nom: 'Konan', age: '25.5' };
      const result = validatePlanteurRow(row);
      expect(result.isValid).toBe(false);
      expect(result.errors.find((e) => e.field === 'age')?.code).toBe('INVALID_AGE');
    });

    it('should accept empty age and genre', () => {
      const row = { nom: 'Konan', age: '', genre: '' };
      const result = validatePlanteurRow(row);
      expect(result.isValid).toBe(true);
      expect(result.data?.age).toBeUndefined();
      expect(result.data?.genre).toBeUndefined();
    });

    it('should accept valid phone formats', () => {
      const validPhones = [
        '+2250701234567',
        '07 01 23 45 67',
        '(225) 07-01-23-45-67',
        '0701234567',
      ];

      for (const phone of validPhones) {
        const row = {
          nom: 'Konan',
          prénoms: 'Yao',
          CNI: 'CI123',
          téléphone: phone,
          superficie: '5',
        };

        const result = validatePlanteurRow(row);
        expect(result.isValid).toBe(true);
      }
    });
  });

  describe('validatePlanteurRows', () => {
    it('should validate multiple rows', () => {
      const rows = [
        { nom: 'Konan', prénoms: 'Yao', CNI: 'CI123', téléphone: '+225070123456', superficie: '5' },
        { nom: 'Kouassi', prénoms: 'Marie', CNI: 'CI456', téléphone: '+225070987654', superficie: '3' },
      ];

      const results = validatePlanteurRows(rows);

      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[0].rowNumber).toBe(1);
      expect(results[1].isValid).toBe(true);
      expect(results[1].rowNumber).toBe(2);
    });

    it('should return errors for invalid rows', () => {
      const rows = [
        { nom: 'Konan', prénoms: 'Yao', CNI: 'CI123', téléphone: '+225070123456', superficie: '5' },
        { nom: '', prénoms: 'Marie', CNI: 'CI456', téléphone: 'invalid', superficie: '-3' },
      ];

      const results = validatePlanteurRows(rows);

      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[1].errors.length).toBeGreaterThan(0);
    });
  });

  describe('hasValidationErrors', () => {
    it('should return true when errors exist', () => {
      const errors = [
        { field: 'nom', message: 'Required', code: 'NAME_REQUIRED' },
      ];

      expect(hasValidationErrors(errors)).toBe(true);
    });

    it('should return false when no errors', () => {
      expect(hasValidationErrors([])).toBe(false);
    });
  });

  describe('getFieldErrors', () => {
    it('should return errors for specific field', () => {
      const errors = [
        { field: 'nom', message: 'Required', code: 'NAME_REQUIRED' },
        { field: 'CNI', message: 'Invalid format', code: 'INVALID_CNI_FORMAT' },
        { field: 'nom', message: 'Too long', code: 'NAME_TOO_LONG' },
      ];

      const nomErrors = getFieldErrors(errors, 'nom');

      expect(nomErrors).toHaveLength(2);
      expect(nomErrors).toContain('Required');
      expect(nomErrors).toContain('Too long');
    });

    it('should return empty array for field with no errors', () => {
      const errors = [
        { field: 'nom', message: 'Required', code: 'NAME_REQUIRED' },
      ];

      const cniErrors = getFieldErrors(errors, 'CNI');

      expect(cniErrors).toHaveLength(0);
    });
  });

  describe('formatValidationErrors', () => {
    it('should format errors as string', () => {
      const errors = [
        { field: 'nom', message: 'Required', code: 'NAME_REQUIRED' },
        { field: 'CNI', message: 'Invalid format', code: 'INVALID_CNI_FORMAT' },
      ];

      const formatted = formatValidationErrors(errors);

      expect(formatted).toContain('nom: Required');
      expect(formatted).toContain('CNI: Invalid format');
    });

    it('should return empty string for no errors', () => {
      const formatted = formatValidationErrors([]);

      expect(formatted).toBe('');
    });
  });
});
