/**
 * Report Templates Module
 * 
 * Export all template functionality for easy importing
 */

export {
  // Template creation functions
  createDefaultTemplate,
  createCustomTemplate,
  getTemplatePreset,
  listTemplatePresets,
  
  // Localization
  getLocalizedStrings,
  
  // Utility functions
  hexToRGB,
  getStatusColor,
  getStatusText,
  formatDate,
  formatTime,
  
  // Constants
  DEFAULT_BRANDING,
  DEFAULT_COLORS,
  DEFAULT_FONTS,
  DEFAULT_LAYOUT,
  FRENCH_STRINGS,
  ENGLISH_STRINGS,
  TEMPLATE_PRESETS,
  
  // Types
  type ReportTemplate,
  type BrandingConfig,
  type ColorScheme,
  type FontConfig,
  type LayoutConfig,
  type LocalizedStrings,
} from './report-templates';

// Re-export examples for reference
export * as examples from './examples';
