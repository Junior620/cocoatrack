/**
 * Report Templates Tests
 * 
 * Tests for report template configuration, localization,
 * and customization functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultTemplate,
  createCustomTemplate,
  getTemplatePreset,
  listTemplatePresets,
  getLocalizedStrings,
  hexToRGB,
  getStatusColor,
  getStatusText,
  formatDate,
  formatTime,
  DEFAULT_BRANDING,
  DEFAULT_COLORS,
  DEFAULT_FONTS,
  DEFAULT_LAYOUT,
  FRENCH_STRINGS,
  ENGLISH_STRINGS,
} from '@/lib/satellite/templates/report-templates';

describe('Report Templates', () => {
  describe('createDefaultTemplate', () => {
    it('should create default French template', () => {
      const template = createDefaultTemplate('fr');
      
      expect(template.name).toBe('default');
      expect(template.language).toBe('fr');
      expect(template.branding).toEqual(DEFAULT_BRANDING);
      expect(template.colors).toEqual(DEFAULT_COLORS);
      expect(template.fonts).toEqual(DEFAULT_FONTS);
      expect(template.layout).toEqual(DEFAULT_LAYOUT);
    });
    
    it('should create default English template', () => {
      const template = createDefaultTemplate('en');
      
      expect(template.name).toBe('default');
      expect(template.language).toBe('en');
    });
  });
  
  describe('createCustomTemplate', () => {
    it('should create custom template with partial branding', () => {
      const template = createCustomTemplate(
        'fr',
        { companyName: 'Custom Company' }
      );
      
      expect(template.name).toBe('custom');
      expect(template.branding.companyName).toBe('Custom Company');
      expect(template.branding.tagline).toBe(DEFAULT_BRANDING.tagline);
    });
    
    it('should create custom template with partial colors', () => {
      const template = createCustomTemplate(
        'en',
        undefined,
        { primary: '#ff0000', secondary: '#00ff00' }
      );
      
      expect(template.colors.primary).toBe('#ff0000');
      expect(template.colors.secondary).toBe('#00ff00');
      expect(template.colors.success).toBe(DEFAULT_COLORS.success);
    });
    
    it('should create custom template with all options', () => {
      const template = createCustomTemplate(
        'fr',
        { companyName: 'Test Company', email: 'test@example.com' },
        { primary: '#123456' },
        { heading: 'times' },
        { pageMargin: 25 }
      );
      
      expect(template.branding.companyName).toBe('Test Company');
      expect(template.branding.email).toBe('test@example.com');
      expect(template.colors.primary).toBe('#123456');
      expect(template.fonts.heading).toBe('times');
      expect(template.layout.pageMargin).toBe(25);
    });
  });
  
  describe('getTemplatePreset', () => {
    it('should get default preset', () => {
      const template = getTemplatePreset('default');
      
      expect(template.name).toBe('default');
      expect(template.language).toBe('fr');
    });
    
    it('should get professional preset', () => {
      const template = getTemplatePreset('professional');
      
      expect(template.name).toBe('custom');
      expect(template.colors.primary).toBe('#1e40af'); // Blue
    });
    
    it('should get minimalist preset', () => {
      const template = getTemplatePreset('minimalist');
      
      expect(template.colors.primary).toBe('#374151'); // Gray
    });
    
    it('should get high contrast preset', () => {
      const template = getTemplatePreset('highContrast');
      
      expect(template.colors.primary).toBe('#000000'); // Black
    });
  });
  
  describe('listTemplatePresets', () => {
    it('should list all available presets', () => {
      const presets = listTemplatePresets();
      
      expect(presets).toHaveLength(4);
      expect(presets[0].name).toBe('default');
      expect(presets[1].name).toBe('professional');
      expect(presets[2].name).toBe('minimalist');
      expect(presets[3].name).toBe('highContrast');
    });
    
    it('should include descriptions for all presets', () => {
      const presets = listTemplatePresets();
      
      presets.forEach(preset => {
        expect(preset.description).toBeTruthy();
        expect(typeof preset.description).toBe('string');
      });
    });
  });
  
  describe('getLocalizedStrings', () => {
    it('should return French strings', () => {
      const strings = getLocalizedStrings('fr');
      
      expect(strings).toEqual(FRENCH_STRINGS);
      expect(strings.reportTitle).toBe('Rapport de Certification EUDR');
    });
    
    it('should return English strings', () => {
      const strings = getLocalizedStrings('en');
      
      expect(strings).toEqual(ENGLISH_STRINGS);
      expect(strings.reportTitle).toBe('EUDR Certification Report');
    });
    
    it('should have all required string keys', () => {
      const frStrings = getLocalizedStrings('fr');
      const enStrings = getLocalizedStrings('en');
      
      // Check that both have the same keys
      expect(Object.keys(frStrings).sort()).toEqual(Object.keys(enStrings).sort());
    });
  });
  
  describe('hexToRGB', () => {
    it('should convert hex to RGB with hash', () => {
      const rgb = hexToRGB('#ff0000');
      expect(rgb).toEqual([255, 0, 0]);
    });
    
    it('should convert hex to RGB without hash', () => {
      const rgb = hexToRGB('00ff00');
      expect(rgb).toEqual([0, 255, 0]);
    });
    
    it('should handle lowercase hex', () => {
      const rgb = hexToRGB('#0000ff');
      expect(rgb).toEqual([0, 0, 255]);
    });
    
    it('should handle uppercase hex', () => {
      const rgb = hexToRGB('#FF00FF');
      expect(rgb).toEqual([255, 0, 255]);
    });
    
    it('should convert default primary color', () => {
      const rgb = hexToRGB(DEFAULT_COLORS.primary);
      expect(rgb).toEqual([45, 80, 22]); // #2d5016
    });
  });
  
  describe('getStatusColor', () => {
    it('should return success color for compliant status', () => {
      const color = getStatusColor('compliant', DEFAULT_COLORS);
      const expectedRGB = hexToRGB(DEFAULT_COLORS.success);
      expect(color).toEqual(expectedRGB);
    });
    
    it('should return danger color for non-compliant status', () => {
      const color = getStatusColor('non-compliant', DEFAULT_COLORS);
      const expectedRGB = hexToRGB(DEFAULT_COLORS.danger);
      expect(color).toEqual(expectedRGB);
    });
    
    it('should return warning color for requires-review status', () => {
      const color = getStatusColor('requires-review', DEFAULT_COLORS);
      const expectedRGB = hexToRGB(DEFAULT_COLORS.warning);
      expect(color).toEqual(expectedRGB);
    });
  });
  
  describe('getStatusText', () => {
    it('should return French text for compliant status', () => {
      const text = getStatusText('compliant', FRENCH_STRINGS);
      expect(text).toBe('CONFORME');
    });
    
    it('should return English text for compliant status', () => {
      const text = getStatusText('compliant', ENGLISH_STRINGS);
      expect(text).toBe('COMPLIANT');
    });
    
    it('should return French text for non-compliant status', () => {
      const text = getStatusText('non-compliant', FRENCH_STRINGS);
      expect(text).toBe('NON CONFORME');
    });
    
    it('should return English text for requires-review status', () => {
      const text = getStatusText('requires-review', ENGLISH_STRINGS);
      expect(text).toBe('REQUIRES REVIEW');
    });
  });
  
  describe('formatDate', () => {
    const testDate = new Date('2024-03-15T10:30:00Z');
    
    it('should format date in French', () => {
      const formatted = formatDate(testDate, 'fr');
      expect(formatted).toContain('2024');
      expect(formatted).toContain('15');
      // French month names
      expect(formatted.toLowerCase()).toContain('mars');
    });
    
    it('should format date in English', () => {
      const formatted = formatDate(testDate, 'en');
      expect(formatted).toContain('2024');
      expect(formatted).toContain('15');
      // English month names
      expect(formatted.toLowerCase()).toContain('march');
    });
  });
  
  describe('formatTime', () => {
    const testDate = new Date('2024-03-15T14:30:00Z');
    
    it('should format time in French', () => {
      const formatted = formatTime(testDate, 'fr');
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });
    
    it('should format time in English', () => {
      const formatted = formatTime(testDate, 'en');
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });
  });
  
  describe('Template Consistency', () => {
    it('should have consistent structure across all presets', () => {
      const presets = ['default', 'professional', 'minimalist', 'highContrast'] as const;
      
      presets.forEach(presetName => {
        const template = getTemplatePreset(presetName);
        
        // Check required properties
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('language');
        expect(template).toHaveProperty('branding');
        expect(template).toHaveProperty('colors');
        expect(template).toHaveProperty('fonts');
        expect(template).toHaveProperty('layout');
        
        // Check branding structure
        expect(template.branding).toHaveProperty('companyName');
        
        // Check colors structure
        expect(template.colors).toHaveProperty('primary');
        expect(template.colors).toHaveProperty('secondary');
        expect(template.colors).toHaveProperty('success');
        expect(template.colors).toHaveProperty('warning');
        expect(template.colors).toHaveProperty('danger');
        
        // Check fonts structure
        expect(template.fonts).toHaveProperty('heading');
        expect(template.fonts).toHaveProperty('body');
        expect(template.fonts).toHaveProperty('mono');
        
        // Check layout structure
        expect(template.layout).toHaveProperty('pageMargin');
        expect(template.layout).toHaveProperty('sectionSpacing');
        expect(template.layout).toHaveProperty('headerHeight');
        expect(template.layout).toHaveProperty('footerHeight');
      });
    });
    
    it('should have valid hex colors in all presets', () => {
      const presets = ['default', 'professional', 'minimalist', 'highContrast'] as const;
      const hexRegex = /^#?[0-9A-Fa-f]{6}$/;
      
      presets.forEach(presetName => {
        const template = getTemplatePreset(presetName);
        
        Object.values(template.colors).forEach(color => {
          expect(color).toMatch(hexRegex);
        });
      });
    });
  });
  
  describe('Localization Completeness', () => {
    it('should have matching keys in French and English strings', () => {
      const frKeys = Object.keys(FRENCH_STRINGS).sort();
      const enKeys = Object.keys(ENGLISH_STRINGS).sort();
      
      expect(frKeys).toEqual(enKeys);
    });
    
    it('should have non-empty values for all French strings', () => {
      Object.entries(FRENCH_STRINGS).forEach(([key, value]) => {
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });
    
    it('should have non-empty values for all English strings', () => {
      Object.entries(ENGLISH_STRINGS).forEach(([key, value]) => {
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });
});
