/**
 * Report Templates
 * 
 * Professional templates for EUDR compliance certification reports
 * with support for French and English languages, company branding,
 * and customizable styling.
 */

/**
 * Report template configuration
 */
export interface ReportTemplate {
  name: string;
  language: 'fr' | 'en';
  branding: BrandingConfig;
  colors: ColorScheme;
  fonts: FontConfig;
  layout: LayoutConfig;
}

/**
 * Company branding configuration
 */
export interface BrandingConfig {
  companyName: string;
  logoUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  tagline?: string;
  website?: string;
  email?: string;
  phone?: string;
}

/**
 * Color scheme for the report
 */
export interface ColorScheme {
  primary: string; // Main brand color (hex)
  secondary: string; // Secondary brand color (hex)
  success: string; // Success/compliant color (hex)
  warning: string; // Warning/review color (hex)
  danger: string; // Danger/non-compliant color (hex)
  text: string; // Main text color (hex)
  textLight: string; // Light text color (hex)
  background: string; // Background color (hex)
  border: string; // Border color (hex)
}

/**
 * Font configuration
 */
export interface FontConfig {
  heading: string; // Font family for headings
  body: string; // Font family for body text
  mono: string; // Font family for monospace text
}

/**
 * Layout configuration
 */
export interface LayoutConfig {
  pageMargin: number; // Page margin in mm
  sectionSpacing: number; // Spacing between sections in mm
  headerHeight: number; // Header height in mm
  footerHeight: number; // Footer height in mm
}

/**
 * Localized text strings for reports
 */
export interface LocalizedStrings {
  // Header
  reportTitle: string;
  reportSubtitle: string;
  
  // Sections
  parcelleInfoTitle: string;
  complianceStatusTitle: string;
  ndviTrendTitle: string;
  deforestationAnalysisTitle: string;
  beforeAfterTitle: string;
  yieldPredictionTitle: string;
  
  // Fields
  code: string;
  label: string;
  surfaceArea: string;
  village: string;
  region: string;
  farmer: string;
  date: string;
  ndviChange: string;
  affectedArea: string;
  status: string;
  period: string;
  dataPoints: string;
  averageNDVI: string;
  minimumNDVI: string;
  maximumNDVI: string;
  significantChanges: string;
  harvestSeason: string;
  predictedYield: string;
  confidenceLevel: string;
  confidenceInterval: string;
  modelVersion: string;
  
  // Status values
  compliant: string;
  nonCompliant: string;
  requiresReview: string;
  pending: string;
  acknowledged: string;
  disputed: string;
  resolved: string;
  
  // Confidence levels
  high: string;
  medium: string;
  low: string;
  
  // Messages
  alertsDetected: string;
  pendingAlerts: string;
  complianceDeclaration: string;
  eudrBaselineDate: string;
  baselineImagery: string;
  currentImagery: string;
  cloudCover: string;
  imageryNote: string;
  
  // Footer
  pageOf: string;
  reportGenerated: string;
  generatedBy: string;
  digitalSignature: string;
  systemName: string;
}

/**
 * Default CocoaTrack branding
 */
export const DEFAULT_BRANDING: BrandingConfig = {
  companyName: 'CocoaTrack',
  tagline: 'Satellite Analysis System',
  website: 'www.cocoatrack.com',
  email: 'support@cocoatrack.com',
};

/**
 * Default color scheme (CocoaTrack green theme)
 */
export const DEFAULT_COLORS: ColorScheme = {
  primary: '#2d5016', // Dark green
  secondary: '#6FAF3D', // Light green
  success: '#22c55e', // Green
  warning: '#fbbf24', // Yellow
  danger: '#ef4444', // Red
  text: '#1f2937', // Dark gray
  textLight: '#6b7280', // Light gray
  background: '#ffffff', // White
  border: '#e5e7eb', // Light gray border
};

/**
 * Default font configuration
 */
export const DEFAULT_FONTS: FontConfig = {
  heading: 'helvetica',
  body: 'helvetica',
  mono: 'courier',
};

/**
 * Default layout configuration
 */
export const DEFAULT_LAYOUT: LayoutConfig = {
  pageMargin: 20,
  sectionSpacing: 10,
  headerHeight: 40,
  footerHeight: 15,
};

/**
 * French language strings
 */
export const FRENCH_STRINGS: LocalizedStrings = {
  // Header
  reportTitle: 'Rapport de Certification EUDR',
  reportSubtitle: 'Analyse Satellite et Détection de Déforestation',
  
  // Sections
  parcelleInfoTitle: 'Informations de la Parcelle',
  complianceStatusTitle: 'Statut de Conformité EUDR',
  ndviTrendTitle: 'Évolution NDVI',
  deforestationAnalysisTitle: 'Analyse de Déforestation',
  beforeAfterTitle: 'Comparaison Avant/Après',
  yieldPredictionTitle: 'Prévision de Rendement',
  
  // Fields
  code: 'Code',
  label: 'Label',
  surfaceArea: 'Surface',
  village: 'Village',
  region: 'Région',
  farmer: 'Planteur',
  date: 'Date',
  ndviChange: 'Changement NDVI',
  affectedArea: 'Zone Affectée',
  status: 'Statut',
  period: 'Période',
  dataPoints: 'Points de données',
  averageNDVI: 'NDVI moyen',
  minimumNDVI: 'NDVI minimum',
  maximumNDVI: 'NDVI maximum',
  significantChanges: 'Changements significatifs',
  harvestSeason: 'Saison de récolte',
  predictedYield: 'Rendement prévu',
  confidenceLevel: 'Niveau de confiance',
  confidenceInterval: 'Intervalle de confiance',
  modelVersion: 'Version du modèle',
  
  // Status values
  compliant: 'CONFORME',
  nonCompliant: 'NON CONFORME',
  requiresReview: 'NÉCESSITE RÉVISION',
  pending: 'En attente',
  acknowledged: 'Reconnu',
  disputed: 'Contesté',
  resolved: 'Résolu',
  
  // Confidence levels
  high: 'Élevée',
  medium: 'Moyenne',
  low: 'Faible',
  
  // Messages
  alertsDetected: 'Alertes de déforestation détectées',
  pendingAlerts: 'en attente',
  complianceDeclaration: 'Cette parcelle ne présente aucune preuve de déforestation après le 31 décembre 2020, conformément au règlement EUDR 2024.',
  eudrBaselineDate: 'Date de référence EUDR',
  baselineImagery: 'Imagerie de référence',
  currentImagery: 'Imagerie actuelle',
  cloudCover: 'Couverture nuageuse',
  imageryNote: 'Note: Les images satellite sont disponibles via les URLs stockées dans le système.',
  
  // Footer
  pageOf: 'sur',
  reportGenerated: 'Rapport généré le',
  generatedBy: 'Généré par',
  digitalSignature: 'Signature numérique',
  systemName: 'Système d\'Analyse Satellite',
};

/**
 * English language strings
 */
export const ENGLISH_STRINGS: LocalizedStrings = {
  // Header
  reportTitle: 'EUDR Certification Report',
  reportSubtitle: 'Satellite Analysis and Deforestation Detection',
  
  // Sections
  parcelleInfoTitle: 'Parcelle Information',
  complianceStatusTitle: 'EUDR Compliance Status',
  ndviTrendTitle: 'NDVI Trend',
  deforestationAnalysisTitle: 'Deforestation Analysis',
  beforeAfterTitle: 'Before/After Comparison',
  yieldPredictionTitle: 'Yield Prediction',
  
  // Fields
  code: 'Code',
  label: 'Label',
  surfaceArea: 'Surface Area',
  village: 'Village',
  region: 'Region',
  farmer: 'Farmer',
  date: 'Date',
  ndviChange: 'NDVI Change',
  affectedArea: 'Affected Area',
  status: 'Status',
  period: 'Period',
  dataPoints: 'Data Points',
  averageNDVI: 'Average NDVI',
  minimumNDVI: 'Minimum NDVI',
  maximumNDVI: 'Maximum NDVI',
  significantChanges: 'Significant Changes',
  harvestSeason: 'Harvest Season',
  predictedYield: 'Predicted Yield',
  confidenceLevel: 'Confidence Level',
  confidenceInterval: 'Confidence Interval',
  modelVersion: 'Model Version',
  
  // Status values
  compliant: 'COMPLIANT',
  nonCompliant: 'NON-COMPLIANT',
  requiresReview: 'REQUIRES REVIEW',
  pending: 'Pending',
  acknowledged: 'Acknowledged',
  disputed: 'Disputed',
  resolved: 'Resolved',
  
  // Confidence levels
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  
  // Messages
  alertsDetected: 'Deforestation alerts detected',
  pendingAlerts: 'pending',
  complianceDeclaration: 'This parcelle shows no evidence of deforestation after December 31, 2020, in compliance with EUDR 2024 regulation.',
  eudrBaselineDate: 'EUDR Baseline Date',
  baselineImagery: 'Baseline Imagery',
  currentImagery: 'Current Imagery',
  cloudCover: 'Cloud cover',
  imageryNote: 'Note: Satellite imagery is available via URLs stored in the system.',
  
  // Footer
  pageOf: 'of',
  reportGenerated: 'Report generated on',
  generatedBy: 'Generated by',
  digitalSignature: 'Digital signature',
  systemName: 'Satellite Analysis System',
};

/**
 * Get localized strings for a language
 */
export function getLocalizedStrings(language: 'fr' | 'en'): LocalizedStrings {
  return language === 'fr' ? FRENCH_STRINGS : ENGLISH_STRINGS;
}

/**
 * Create a default report template
 */
export function createDefaultTemplate(language: 'fr' | 'en' = 'fr'): ReportTemplate {
  return {
    name: 'default',
    language,
    branding: DEFAULT_BRANDING,
    colors: DEFAULT_COLORS,
    fonts: DEFAULT_FONTS,
    layout: DEFAULT_LAYOUT,
  };
}

/**
 * Create a custom report template
 */
export function createCustomTemplate(
  language: 'fr' | 'en',
  customBranding?: Partial<BrandingConfig>,
  customColors?: Partial<ColorScheme>,
  customFonts?: Partial<FontConfig>,
  customLayout?: Partial<LayoutConfig>
): ReportTemplate {
  return {
    name: 'custom',
    language,
    branding: { ...DEFAULT_BRANDING, ...customBranding },
    colors: { ...DEFAULT_COLORS, ...customColors },
    fonts: { ...DEFAULT_FONTS, ...customFonts },
    layout: { ...DEFAULT_LAYOUT, ...customLayout },
  };
}

/**
 * Convert hex color to RGB array
 */
export function hexToRGB(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return [r, g, b];
}

/**
 * Get status color based on compliance status
 */
export function getStatusColor(
  status: 'compliant' | 'non-compliant' | 'requires-review',
  colors: ColorScheme
): [number, number, number] {
  switch (status) {
    case 'compliant':
      return hexToRGB(colors.success);
    case 'non-compliant':
      return hexToRGB(colors.danger);
    case 'requires-review':
      return hexToRGB(colors.warning);
  }
}

/**
 * Get status text based on compliance status
 */
export function getStatusText(
  status: 'compliant' | 'non-compliant' | 'requires-review',
  strings: LocalizedStrings
): string {
  switch (status) {
    case 'compliant':
      return strings.compliant;
    case 'non-compliant':
      return strings.nonCompliant;
    case 'requires-review':
      return strings.requiresReview;
  }
}

/**
 * Format date according to language
 */
export function formatDate(date: Date, language: 'fr' | 'en'): string {
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  return new Date(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format time according to language
 */
export function formatTime(date: Date, language: 'fr' | 'en'): string {
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  return new Date(date).toLocaleTimeString(locale);
}

/**
 * Predefined template presets
 */
export const TEMPLATE_PRESETS = {
  /**
   * Default CocoaTrack template (green theme)
   */
  default: createDefaultTemplate('fr'),
  
  /**
   * Professional blue theme
   */
  professional: createCustomTemplate(
    'en',
    {
      companyName: 'CocoaTrack',
      tagline: 'Professional Satellite Analysis',
    },
    {
      primary: '#1e40af', // Blue
      secondary: '#3b82f6', // Light blue
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      text: '#111827',
      textLight: '#6b7280',
      background: '#ffffff',
      border: '#d1d5db',
    }
  ),
  
  /**
   * Minimalist gray theme
   */
  minimalist: createCustomTemplate(
    'en',
    {
      companyName: 'CocoaTrack',
      tagline: 'Satellite Analysis',
    },
    {
      primary: '#374151', // Dark gray
      secondary: '#6b7280', // Medium gray
      success: '#059669',
      warning: '#d97706',
      danger: '#dc2626',
      text: '#111827',
      textLight: '#9ca3af',
      background: '#ffffff',
      border: '#e5e7eb',
    }
  ),
  
  /**
   * High contrast theme for accessibility
   */
  highContrast: createCustomTemplate(
    'fr',
    {
      companyName: 'CocoaTrack',
      tagline: 'Système d\'Analyse Satellite',
    },
    {
      primary: '#000000', // Black
      secondary: '#1f2937', // Dark gray
      success: '#047857',
      warning: '#b45309',
      danger: '#b91c1c',
      text: '#000000',
      textLight: '#374151',
      background: '#ffffff',
      border: '#000000',
    }
  ),
};

/**
 * Get template by name
 */
export function getTemplatePreset(name: keyof typeof TEMPLATE_PRESETS): ReportTemplate {
  return TEMPLATE_PRESETS[name];
}

/**
 * List available template presets
 */
export function listTemplatePresets(): Array<{ name: string; description: string }> {
  return [
    {
      name: 'default',
      description: 'Default CocoaTrack template with green theme',
    },
    {
      name: 'professional',
      description: 'Professional blue theme for formal reports',
    },
    {
      name: 'minimalist',
      description: 'Minimalist gray theme for clean, simple reports',
    },
    {
      name: 'highContrast',
      description: 'High contrast theme for improved accessibility',
    },
  ];
}
