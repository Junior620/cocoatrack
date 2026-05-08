# Report Templates

Professional, customizable templates for EUDR compliance certification reports.

## Overview

This module provides a flexible template system for generating PDF certification reports with:

- **Multi-language support** (French and English)
- **Custom branding** (company name, logo, colors)
- **Multiple themes** (default, professional, minimalist, high contrast)
- **Full customization** (colors, fonts, layout)

## Quick Start

### Basic Usage

```typescript
import { createDefaultTemplate } from '@/lib/satellite/templates/report-templates';
import { exportService } from '@/lib/satellite/services/export.service';

// Create default French template
const template = createDefaultTemplate('fr');

// Generate report with template
const reportUrl = await exportService.generateCertificationReport(
  reportData,
  options,
  template
);
```

### Custom Branding

```typescript
import { createCustomTemplate } from '@/lib/satellite/templates/report-templates';

const template = createCustomTemplate(
  'fr',
  {
    companyName: 'Ma Coopérative',
    email: 'contact@macoop.cm',
  },
  {
    primary: '#1a5f3d',
    secondary: '#4ade80',
  }
);
```

### Using Presets

```typescript
import { getTemplatePreset } from '@/lib/satellite/templates/report-templates';

// Professional blue theme
const template = getTemplatePreset('professional');

// High contrast for accessibility
const accessibleTemplate = getTemplatePreset('highContrast');
```

## Available Presets

| Preset | Description | Primary Color | Use Case |
|--------|-------------|---------------|----------|
| `default` | CocoaTrack green theme | #2d5016 | Standard reports |
| `professional` | Professional blue theme | #1e40af | Formal certification |
| `minimalist` | Clean gray theme | #374151 | Simple reports |
| `highContrast` | High contrast black theme | #000000 | Accessibility |

## Features

### 1. Multi-Language Support

Generate reports in French or English with fully localized text:

```typescript
const frTemplate = createDefaultTemplate('fr');
const enTemplate = createDefaultTemplate('en');
```

### 2. Custom Branding

Add your cooperative's branding:

```typescript
const template = createCustomTemplate('fr', {
  companyName: 'Coopérative du Sud',
  tagline: 'Cacao Durable',
  email: 'contact@coopdusud.cm',
  phone: '+237 XXX XXX XXX',
  website: 'www.coopdusud.cm',
});
```

### 3. Color Customization

Use your brand colors:

```typescript
const template = createCustomTemplate('fr', undefined, {
  primary: '#1a5f3d',    // Your brand color
  secondary: '#4ade80',  // Secondary color
  success: '#10b981',    // Success indicators
  warning: '#f59e0b',    // Warnings
  danger: '#dc2626',     // Alerts
});
```

### 4. Font Customization

Customize fonts for different elements:

```typescript
const template = createCustomTemplate('fr', undefined, undefined, {
  heading: 'helvetica',
  body: 'times',
  mono: 'courier',
});
```

### 5. Layout Customization

Adjust spacing and margins:

```typescript
const template = createCustomTemplate('fr', undefined, undefined, undefined, {
  pageMargin: 25,
  sectionSpacing: 12,
  headerHeight: 45,
  footerHeight: 18,
});
```

## API Reference

### Functions

#### `createDefaultTemplate(language)`
Creates a default CocoaTrack template.

```typescript
const template = createDefaultTemplate('fr');
```

#### `createCustomTemplate(language, branding?, colors?, fonts?, layout?)`
Creates a custom template with specified options.

```typescript
const template = createCustomTemplate(
  'fr',
  { companyName: 'My Coop' },
  { primary: '#1a5f3d' }
);
```

#### `getTemplatePreset(name)`
Gets a predefined template preset.

```typescript
const template = getTemplatePreset('professional');
```

#### `listTemplatePresets()`
Lists all available template presets.

```typescript
const presets = listTemplatePresets();
// [
//   { name: 'default', description: '...' },
//   { name: 'professional', description: '...' },
//   ...
// ]
```

#### `getLocalizedStrings(language)`
Gets localized strings for a language.

```typescript
const strings = getLocalizedStrings('fr');
console.log(strings.reportTitle); // "Rapport de Certification EUDR"
```

### Utility Functions

#### `hexToRGB(hex)`
Converts hex color to RGB array.

```typescript
const rgb = hexToRGB('#2d5016'); // [45, 80, 22]
```

#### `getStatusColor(status, colors)`
Gets color for compliance status.

```typescript
const color = getStatusColor('compliant', template.colors);
```

#### `getStatusText(status, strings)`
Gets localized text for compliance status.

```typescript
const text = getStatusText('compliant', strings); // "CONFORME"
```

#### `formatDate(date, language)`
Formats date according to language.

```typescript
const formatted = formatDate(new Date(), 'fr'); // "15 mars 2024"
```

## Examples

See [examples.ts](./examples.ts) for comprehensive usage examples including:

1. Basic usage with default template
2. English template for international reports
3. Custom branding for a cooperative
4. Custom color scheme
5. Professional blue theme
6. High contrast for accessibility
7. Fully customized template
8. Dynamic template selection
9. Template from database
10. Compact layout
11. Multi-language generation
12. Template selection helper

## File Structure

```
lib/satellite/templates/
├── report-templates.ts    # Main template module
├── examples.ts            # Usage examples
└── README.md             # This file

tests/satellite/templates/
└── report-templates.test.ts  # Comprehensive tests

docs/satellite/
└── report-templates.md    # Full documentation
```

## Testing

Run tests with:

```bash
npm test -- tests/satellite/templates/report-templates.test.ts
```

All tests should pass:
- ✓ Template creation (default, custom, presets)
- ✓ Localization (French, English)
- ✓ Color conversion and utilities
- ✓ Template consistency
- ✓ Localization completeness

## Documentation

For complete documentation, see:
- [Full Documentation](../../../docs/satellite/report-templates.md)
- [API Documentation](../../../docs/api/satellite.md)
- [Certification Reports Guide](../../../docs/satellite/certification-reports.md)

## Integration

### With Export Service

```typescript
import { exportService } from '@/lib/satellite/services/export.service';
import { createCustomTemplate } from '@/lib/satellite/templates/report-templates';

const template = createCustomTemplate('fr', {
  companyName: 'Ma Coopérative',
});

const reportUrl = await exportService.generateCertificationReport(
  reportData,
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

### With API Endpoint

```typescript
// In API route
import { createCustomTemplate } from '@/lib/satellite/templates/report-templates';

export async function POST(request: Request) {
  const { parcelleId, templateConfig } = await request.json();
  
  // Create template from config
  const template = createCustomTemplate(
    templateConfig.language,
    templateConfig.branding,
    templateConfig.colors
  );
  
  // Generate report
  const reportUrl = await exportService.generateCertificationReport(
    reportData,
    options,
    template
  );
  
  return Response.json({ reportUrl });
}
```

## Best Practices

1. **Consistent Branding**: Use the same template across all reports for a cooperative
2. **Language Matching**: Always match template language with report options language
3. **Accessibility**: Use high contrast template for users with visual impairments
4. **Professional Reports**: Use professional preset for formal certification
5. **Custom Colors**: Ensure custom colors have sufficient contrast for readability

## Future Enhancements

- Logo image rendering
- Chart integration
- Static map images
- Custom sections
- Template gallery UI
- Visual template editor
- More languages (Spanish, Portuguese)
- Watermark support
- Cryptographic signing
- QR code generation

## Support

For issues or questions:
- Check [Full Documentation](../../../docs/satellite/report-templates.md)
- Review [Examples](./examples.ts)
- Run tests to verify setup
- Contact development team

## License

Part of CocoaTrack satellite imagery analysis system.
