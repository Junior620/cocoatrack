# Report Templates Documentation

## Overview

The satellite imagery analysis system includes professional, customizable report templates for EUDR compliance certification. Templates support multiple languages, company branding, and custom color schemes.

## Features

### Multi-Language Support

Reports can be generated in:
- **French (fr)**: Default language for Cameroon operations
- **English (en)**: For international stakeholders

All text strings are fully localized, including:
- Section titles and headers
- Field labels and values
- Status indicators
- Compliance declarations
- Footer text

### Company Branding

Templates support full company branding customization:

```typescript
interface BrandingConfig {
  companyName: string;        // Company name displayed in header
  logoUrl?: string;           // Optional logo image URL
  logoWidth?: number;         // Logo width in mm
  logoHeight?: number;        // Logo height in mm
  tagline?: string;           // Company tagline/subtitle
  website?: string;           // Company website
  email?: string;             // Contact email
  phone?: string;             // Contact phone
}
```

**Example:**
```typescript
const branding: BrandingConfig = {
  companyName: 'CocoaTrack',
  tagline: 'Satellite Analysis System',
  website: 'www.cocoatrack.com',
  email: 'support@cocoatrack.com',
};
```

### Color Schemes

Templates use customizable color schemes for consistent branding:

```typescript
interface ColorScheme {
  primary: string;      // Main brand color (hex)
  secondary: string;    // Secondary brand color (hex)
  success: string;      // Success/compliant color (hex)
  warning: string;      // Warning/review color (hex)
  danger: string;       // Danger/non-compliant color (hex)
  text: string;         // Main text color (hex)
  textLight: string;    // Light text color (hex)
  background: string;   // Background color (hex)
  border: string;       // Border color (hex)
}
```

**Default CocoaTrack Colors:**
```typescript
{
  primary: '#2d5016',    // Dark green
  secondary: '#6FAF3D',  // Light green
  success: '#22c55e',    // Green
  warning: '#fbbf24',    // Yellow
  danger: '#ef4444',     // Red
  text: '#1f2937',       // Dark gray
  textLight: '#6b7280',  // Light gray
  background: '#ffffff', // White
  border: '#e5e7eb',     // Light gray border
}
```

### Font Configuration

Customize fonts for different text elements:

```typescript
interface FontConfig {
  heading: string;  // Font family for headings
  body: string;     // Font family for body text
  mono: string;     // Font family for monospace text
}
```

**Default Fonts:**
```typescript
{
  heading: 'helvetica',
  body: 'helvetica',
  mono: 'courier',
}
```

### Layout Configuration

Control spacing and margins:

```typescript
interface LayoutConfig {
  pageMargin: number;      // Page margin in mm (default: 20)
  sectionSpacing: number;  // Spacing between sections in mm (default: 10)
  headerHeight: number;    // Header height in mm (default: 40)
  footerHeight: number;    // Footer height in mm (default: 15)
}
```

## Template Presets

### 1. Default Template (Green Theme)

The standard CocoaTrack template with green branding.

```typescript
import { createDefaultTemplate } from '@/lib/satellite/templates/report-templates';

const template = createDefaultTemplate('fr'); // or 'en'
```

**Use case:** Standard reports for CocoaTrack operations

### 2. Professional Template (Blue Theme)

Professional blue theme for formal reports.

```typescript
import { getTemplatePreset } from '@/lib/satellite/templates/report-templates';

const template = getTemplatePreset('professional');
```

**Colors:**
- Primary: Blue (#1e40af)
- Secondary: Light blue (#3b82f6)

**Use case:** Formal certification reports for international auditors

### 3. Minimalist Template (Gray Theme)

Clean, minimalist gray theme.

```typescript
const template = getTemplatePreset('minimalist');
```

**Colors:**
- Primary: Dark gray (#374151)
- Secondary: Medium gray (#6b7280)

**Use case:** Simple, distraction-free reports

### 4. High Contrast Template

High contrast theme for improved accessibility.

```typescript
const template = getTemplatePreset('highContrast');
```

**Colors:**
- Primary: Black (#000000)
- Secondary: Dark gray (#1f2937)

**Use case:** Reports for users with visual impairments

## Creating Custom Templates

### Basic Custom Template

```typescript
import { createCustomTemplate } from '@/lib/satellite/templates/report-templates';

const customTemplate = createCustomTemplate(
  'fr', // language
  {
    // Custom branding
    companyName: 'My Cooperative',
    tagline: 'Sustainable Cocoa Production',
    email: 'contact@mycoop.cm',
  },
  {
    // Custom colors
    primary: '#1a5f3d',
    secondary: '#4ade80',
  }
);
```

### Advanced Custom Template

```typescript
const advancedTemplate = createCustomTemplate(
  'en',
  {
    // Branding
    companyName: 'Global Cocoa Certification',
    logoUrl: '/logos/company-logo.png',
    logoWidth: 40,
    logoHeight: 15,
    tagline: 'Certified Sustainable Cocoa',
    website: 'www.globalcocoa.org',
    email: 'certification@globalcocoa.org',
    phone: '+237 XXX XXX XXX',
  },
  {
    // Colors
    primary: '#0f766e',
    secondary: '#14b8a6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#dc2626',
    text: '#111827',
    textLight: '#6b7280',
    background: '#ffffff',
    border: '#d1d5db',
  },
  {
    // Fonts
    heading: 'helvetica',
    body: 'times',
    mono: 'courier',
  },
  {
    // Layout
    pageMargin: 25,
    sectionSpacing: 12,
    headerHeight: 45,
    footerHeight: 18,
  }
);
```

## Using Templates in Report Generation

### Basic Usage

```typescript
import { exportService } from '@/lib/satellite/services/export.service';
import { createDefaultTemplate } from '@/lib/satellite/templates/report-templates';

// Create template
const template = createDefaultTemplate('fr');

// Generate report with template
const reportUrl = await exportService.generateCertificationReport(
  reportData,
  {
    language: 'fr',
    includeBeforeAfter: true,
    includeNDVITrend: true,
    includeYieldPrediction: false,
    baselineDate: new Date('2020-12-31'),
  },
  template // Pass custom template
);
```

### Using Preset Templates

```typescript
import { getTemplatePreset } from '@/lib/satellite/templates/report-templates';

// Use professional blue theme
const template = getTemplatePreset('professional');

const reportUrl = await exportService.generateCertificationReport(
  reportData,
  options,
  template
);
```

### Dynamic Template Selection

```typescript
// Select template based on user preference or cooperative settings
function getCooperativeTemplate(cooperativeId: string, language: 'fr' | 'en') {
  // Fetch cooperative branding from database
  const branding = getCooperativeBranding(cooperativeId);
  
  // Create custom template with cooperative branding
  return createCustomTemplate(
    language,
    {
      companyName: branding.name,
      logoUrl: branding.logoUrl,
      email: branding.email,
    },
    {
      primary: branding.primaryColor,
      secondary: branding.secondaryColor,
    }
  );
}

// Use in report generation
const template = getCooperativeTemplate(cooperativeId, 'fr');
const reportUrl = await exportService.generateCertificationReport(
  reportData,
  options,
  template
);
```

## Report Sections

Reports include the following sections (all customizable via templates):

### 1. Header
- Company logo (optional)
- Company name and tagline
- Report title and subtitle
- Decorative line with brand color

### 2. Parcelle Information
- Code, label, surface area
- Village, region
- Farmer name
- Styled table with brand colors

### 3. Compliance Status
- Large status indicator box
- Color-coded: Green (compliant), Red (non-compliant), Yellow (requires review)
- Alert count and pending alerts
- Compliance declaration (if compliant)

### 4. NDVI Trend (optional)
- Period covered
- Data points count
- Average, minimum, maximum NDVI
- Significant changes count
- Styled table

### 5. Deforestation Analysis (if alerts exist)
- Table of all deforestation events
- Date, NDVI change, affected area, status
- Red header for emphasis

### 6. Before/After Comparison (optional)
- EUDR baseline date
- Baseline imagery date and cloud cover
- Current imagery date and cloud cover
- Note about imagery availability

### 7. Yield Prediction (optional)
- Harvest season
- Predicted yield (kg/ha)
- Confidence level and interval
- Model version

### 8. Digital Signature
- Generation timestamp
- Generated by (user name)
- Digital signature hash
- Positioned near bottom of last page

### 9. Footer (all pages)
- Page numbers
- Company branding
- System name

## Localization

### Available Languages

- **French (fr)**: Default for Cameroon
- **English (en)**: For international use

### Adding New Languages

To add a new language:

1. Create localized strings object:

```typescript
export const SPANISH_STRINGS: LocalizedStrings = {
  reportTitle: 'Informe de Certificación EUDR',
  reportSubtitle: 'Análisis Satelital y Detección de Deforestación',
  // ... all other strings
};
```

2. Update `getLocalizedStrings` function:

```typescript
export function getLocalizedStrings(language: 'fr' | 'en' | 'es'): LocalizedStrings {
  switch (language) {
    case 'fr': return FRENCH_STRINGS;
    case 'en': return ENGLISH_STRINGS;
    case 'es': return SPANISH_STRINGS;
    default: return FRENCH_STRINGS;
  }
}
```

3. Update type definitions to include new language code.

## Best Practices

### 1. Consistent Branding

Use the same template across all reports for a cooperative:

```typescript
// Store template configuration in database
const cooperativeTemplate = {
  language: 'fr',
  branding: { /* ... */ },
  colors: { /* ... */ },
};

// Retrieve and use consistently
const template = createCustomTemplate(
  cooperativeTemplate.language,
  cooperativeTemplate.branding,
  cooperativeTemplate.colors
);
```

### 2. Accessibility

For reports that may be viewed by users with visual impairments:

```typescript
// Use high contrast template
const template = getTemplatePreset('highContrast');
```

### 3. Professional Reports

For formal certification or audit reports:

```typescript
// Use professional blue theme
const template = getTemplatePreset('professional');
```

### 4. Language Selection

Always match the language to the recipient:

```typescript
// For local cooperatives in Cameroon
const template = createDefaultTemplate('fr');

// For international auditors
const template = createDefaultTemplate('en');
```

## API Reference

### Functions

#### `createDefaultTemplate(language)`
Creates a default CocoaTrack template.

**Parameters:**
- `language`: `'fr' | 'en'` - Report language

**Returns:** `ReportTemplate`

#### `createCustomTemplate(language, branding?, colors?, fonts?, layout?)`
Creates a custom template with specified options.

**Parameters:**
- `language`: `'fr' | 'en'` - Report language
- `branding?`: `Partial<BrandingConfig>` - Custom branding
- `colors?`: `Partial<ColorScheme>` - Custom colors
- `fonts?`: `Partial<FontConfig>` - Custom fonts
- `layout?`: `Partial<LayoutConfig>` - Custom layout

**Returns:** `ReportTemplate`

#### `getTemplatePreset(name)`
Gets a predefined template preset.

**Parameters:**
- `name`: `'default' | 'professional' | 'minimalist' | 'highContrast'`

**Returns:** `ReportTemplate`

#### `listTemplatePresets()`
Lists all available template presets.

**Returns:** `Array<{ name: string; description: string }>`

#### `getLocalizedStrings(language)`
Gets localized strings for a language.

**Parameters:**
- `language`: `'fr' | 'en'`

**Returns:** `LocalizedStrings`

#### `hexToRGB(hex)`
Converts hex color to RGB array.

**Parameters:**
- `hex`: `string` - Hex color code (e.g., '#2d5016')

**Returns:** `[number, number, number]` - RGB values

#### `getStatusColor(status, colors)`
Gets color for compliance status.

**Parameters:**
- `status`: `'compliant' | 'non-compliant' | 'requires-review'`
- `colors`: `ColorScheme`

**Returns:** `[number, number, number]` - RGB values

#### `getStatusText(status, strings)`
Gets localized text for compliance status.

**Parameters:**
- `status`: `'compliant' | 'non-compliant' | 'requires-review'`
- `strings`: `LocalizedStrings`

**Returns:** `string` - Localized status text

#### `formatDate(date, language)`
Formats date according to language.

**Parameters:**
- `date`: `Date`
- `language`: `'fr' | 'en'`

**Returns:** `string` - Formatted date

#### `formatTime(date, language)`
Formats time according to language.

**Parameters:**
- `date`: `Date`
- `language`: `'fr' | 'en'`

**Returns:** `string` - Formatted time

## Examples

### Example 1: Basic Report with Default Template

```typescript
import { exportService } from '@/lib/satellite/services/export.service';
import { createDefaultTemplate } from '@/lib/satellite/templates/report-templates';

const template = createDefaultTemplate('fr');

const reportUrl = await exportService.generateCertificationReport(
  {
    parcelle: parcelleData,
    complianceStatus: 'compliant',
    deforestation: [],
    ndviTrend: temporalData,
    generatedBy: 'Jean Dupont',
  },
  {
    language: 'fr',
    includeBeforeAfter: true,
    includeNDVITrend: true,
    includeYieldPrediction: false,
    baselineDate: new Date('2020-12-31'),
  },
  template
);
```

### Example 2: Custom Branded Report

```typescript
const customTemplate = createCustomTemplate(
  'fr',
  {
    companyName: 'Coopérative du Sud',
    tagline: 'Cacao Durable',
    email: 'contact@coopdusud.cm',
  },
  {
    primary: '#1a5f3d',
    secondary: '#4ade80',
  }
);

const reportUrl = await exportService.generateCertificationReport(
  reportData,
  options,
  customTemplate
);
```

### Example 3: Multi-Language Report Generation

```typescript
// Generate French version
const frTemplate = createDefaultTemplate('fr');
const frReportUrl = await exportService.generateCertificationReport(
  reportData,
  { ...options, language: 'fr' },
  frTemplate
);

// Generate English version
const enTemplate = createDefaultTemplate('en');
const enReportUrl = await exportService.generateCertificationReport(
  reportData,
  { ...options, language: 'en' },
  enTemplate
);
```

## Troubleshooting

### Issue: Colors not appearing correctly

**Solution:** Ensure hex colors include the `#` prefix:
```typescript
// Correct
primary: '#2d5016'

// Incorrect
primary: '2d5016'
```

### Issue: Logo not displaying

**Solution:** Logo display requires image loading implementation. Currently, logo URL is stored but not rendered. To implement:

1. Load image data from URL
2. Convert to base64 or compatible format
3. Use jsPDF's `addImage()` method

### Issue: Text overflow in tables

**Solution:** Adjust page margins or font sizes in layout configuration:
```typescript
{
  pageMargin: 25, // Increase margins
  sectionSpacing: 8, // Reduce spacing
}
```

### Issue: Wrong language strings

**Solution:** Ensure language parameter matches template language:
```typescript
const template = createDefaultTemplate('fr');
const options = { language: 'fr', /* ... */ }; // Must match
```

## Future Enhancements

Planned improvements for report templates:

1. **Logo Support**: Full implementation of logo image rendering
2. **Chart Integration**: Add NDVI trend charts to reports
3. **Map Integration**: Include static map images of parcelles
4. **Custom Sections**: Allow adding custom sections to reports
5. **Template Gallery**: Web UI for browsing and selecting templates
6. **Template Editor**: Visual editor for creating custom templates
7. **More Languages**: Add Spanish, Portuguese, German
8. **Watermarks**: Optional watermark support for draft reports
9. **Digital Signatures**: Cryptographic signing of reports
10. **QR Codes**: Add QR codes linking to online verification

## Related Documentation

- [Export Service Documentation](./export-service.md)
- [Certification Reports Guide](./certification-reports.md)
- [API Documentation](../api/satellite.md)
- [EUDR Compliance Guide](./eudr-compliance.md)
