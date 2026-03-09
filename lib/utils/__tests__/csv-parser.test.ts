// CocoaTrack V2 - CSV Parser Tests
// Basic unit tests for CSV parsing functionality

import { describe, it, expect } from 'vitest';
import {
  parseCSV,
  detectDelimiter,
  detectEncoding,
  generateCSVTemplate,
} from '../csv-parser';

describe('CSV Parser', () => {
  describe('detectDelimiter', () => {
    it('should detect comma delimiter', () => {
      const csv = 'nom,prénoms,CNI\nKonan,Yao,CI123';
      expect(detectDelimiter(csv)).toBe(',');
    });

    it('should detect semicolon delimiter', () => {
      const csv = 'nom;prénoms;CNI\nKonan;Yao;CI123';
      expect(detectDelimiter(csv)).toBe(';');
    });

    it('should handle mixed delimiters (prefer semicolon)', () => {
      const csv = 'nom;prénoms;CNI,extra\nKonan;Yao;CI123,data';
      expect(detectDelimiter(csv)).toBe(';');
    });
  });

  describe('detectEncoding', () => {
    it('should detect UTF-8 BOM', () => {
      const bom = new Uint8Array([0xef, 0xbb, 0xbf, 0x61, 0x62, 0x63]);
      expect(detectEncoding(bom.buffer)).toBe('UTF-8');
    });

    it('should detect UTF-8 multi-byte sequences', () => {
      // UTF-8 encoding of "é" (C3 A9)
      const utf8 = new Uint8Array([0xc3, 0xa9]);
      expect(detectEncoding(utf8.buffer)).toBe('UTF-8');
    });

    it('should default to Latin-1 for ASCII', () => {
      const ascii = new Uint8Array([0x61, 0x62, 0x63]); // "abc"
      expect(detectEncoding(ascii.buffer)).toBe('Latin-1');
    });
  });

  describe('parseCSV', () => {
    it('should parse simple CSV with comma delimiter', async () => {
      const csv = 'nom,prénoms,CNI\nKonan,Yao,CI123\nKouassi,Marie,CI456';
      const result = await parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.delimiter).toBe(',');
      expect(result.headers).toEqual(['nom', 'prénoms', 'CNI']);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        nom: 'Konan',
        prénoms: 'Yao',
        CNI: 'CI123',
      });
    });

    it('should parse CSV with semicolon delimiter', async () => {
      const csv = 'nom;prénoms;CNI\nKonan;Yao;CI123';
      const result = await parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.delimiter).toBe(';');
      expect(result.data).toHaveLength(1);
    });

    it('should skip header row', async () => {
      const csv = 'nom,prénoms\nKonan,Yao\nKouassi,Marie';
      const result = await parseCSV(csv);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].nom).toBe('Konan');
    });

    it('should handle quoted values with delimiters', async () => {
      const csv = 'nom,description\nKonan,"Yao, Jean"\nKouassi,"Marie, Anne"';
      const result = await parseCSV(csv);

      expect(result.data[0].description).toBe('Yao, Jean');
      expect(result.data[1].description).toBe('Marie, Anne');
    });

    it('should handle escaped quotes', async () => {
      const csv = 'nom,description\nKonan,"Yao ""Junior"""\nKouassi,Marie';
      const result = await parseCSV(csv);

      expect(result.data[0].description).toBe('Yao "Junior"');
    });

    it('should trim whitespace when enabled', async () => {
      const csv = 'nom,prénoms\n  Konan  ,  Yao  ';
      const result = await parseCSV(csv, { trimValues: true });

      expect(result.data[0].nom).toBe('Konan');
      expect(result.data[0].prénoms).toBe('Yao');
    });

    it('should skip empty rows', async () => {
      const csv = 'nom,prénoms\nKonan,Yao\n\n\nKouassi,Marie';
      const result = await parseCSV(csv, { skipEmptyRows: true });

      expect(result.data).toHaveLength(2);
    });

    it('should detect empty file', async () => {
      const csv = '';
      const result = await parseCSV(csv);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('EMPTY_FILE');
    });

    it('should detect missing header', async () => {
      const csv = '\n\n';
      const result = await parseCSV(csv);

      expect(result.errors).toHaveLength(1);
      // Empty file with only newlines is detected as EMPTY_FILE
      expect(result.errors[0].code).toBe('EMPTY_FILE');
    });

    it('should validate required columns', async () => {
      const csv = 'nom,prénoms\nKonan,Yao';
      const result = await parseCSV(csv, {
        expectedHeaders: ['nom', 'CNI'],
      });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_REQUIRED_COLUMNS');
      expect(result.errors[0].message).toContain('CNI');
    });

    it('should handle extra columns', async () => {
      const csv = 'nom,prénoms,extra1,extra2\nKonan,Yao,data1,data2';
      const result = await parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.data[0]).toHaveProperty('extra1', 'data1');
      expect(result.data[0]).toHaveProperty('extra2', 'data2');
    });
  });

  describe('generateCSVTemplate', () => {
    it('should generate CSV with headers and examples', () => {
      const headers = ['nom', 'prénoms', 'CNI'];
      const examples = [
        { nom: 'Konan', prénoms: 'Yao', CNI: 'CI123' },
        { nom: 'Kouassi', prénoms: 'Marie', CNI: 'CI456' },
      ];

      const csv = generateCSVTemplate(headers, examples);

      expect(csv).toContain('nom,prénoms,CNI');
      expect(csv).toContain('Konan,Yao,CI123');
      expect(csv).toContain('Kouassi,Marie,CI456');
    });

    it('should use semicolon delimiter when specified', () => {
      const headers = ['nom', 'prénoms'];
      const examples = [{ nom: 'Konan', prénoms: 'Yao' }];

      const csv = generateCSVTemplate(headers, examples, ';');

      expect(csv).toContain('nom;prénoms');
      expect(csv).toContain('Konan;Yao');
    });

    it('should quote values with delimiters', () => {
      const headers = ['nom', 'description'];
      const examples = [{ nom: 'Konan', description: 'Yao, Jean' }];

      const csv = generateCSVTemplate(headers, examples);

      expect(csv).toContain('"Yao, Jean"');
    });
  });
});
