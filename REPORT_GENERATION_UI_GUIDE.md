# Report Generation UI - User Guide

## Overview

The report generation UI allows users to create certification reports for parcelles directly from the parcelle detail page. This feature is part of the satellite imagery analysis integration and supports EUDR compliance reporting.

## Accessing the Feature

1. Navigate to any parcelle detail page: `/parcelles/[id]`
2. Look for the **"Générer Rapport"** button in the header section
3. The button appears next to the KML Export button (only for active parcelles)

## Using the Report Generator

### Step 1: Open Report Options

Click the **"Générer Rapport"** button to open the configuration modal.

### Step 2: Configure Report Options

The modal presents several configuration options:

#### Language Selection
- **Français** (default) - Report in French
- **English** - Report in English

#### Baseline Date
- Default: **31 décembre 2020** (EUDR baseline)
- Can be customized using the date picker
- This date is used for deforestation detection comparison

#### Sections to Include

**Imagerie avant/après** (checked by default)
- Visual comparison between baseline and current date
- Shows satellite imagery side-by-side

**Tendance NDVI** (checked by default)
- Graph showing vegetation index evolution over 12 months
- Helps identify health trends

**Prédiction de rendement** (unchecked by default)
- Estimated yield based on satellite analysis
- Includes confidence level

### Step 3: Generate Report

1. Review your configuration
2. Click **"Générer le rapport"** button
3. Wait for generation (up to 30 seconds)
4. Progress indicator shows "Génération en cours..."

### Step 4: Download Report

Once generation is complete:

1. **Success message appears** with green checkmark
2. **Download button** - Opens report in new tab for download
3. **"Ouvrir dans un nouvel onglet"** link - Alternative way to access report
4. **Close button** - Dismiss the download link

## Report Contents

The generated PDF report includes:

### Standard Sections
- Parcelle identification (code, surface, location)
- Planteur information
- Current conformity status
- Deforestation analysis results
- EUDR compliance status

### Optional Sections (based on configuration)
- Before/after satellite imagery comparison
- NDVI trend chart (12-month history)
- Yield prediction with confidence interval

## Error Handling

If report generation fails:

1. **Error message displays** with red alert styling
2. **Error details** explain what went wrong
3. **Close button** allows dismissing the error
4. **Retry** by clicking "Générer Rapport" again

Common errors:
- No satellite data available for the parcelle
- API rate limit exceeded
- Network connectivity issues
- Invalid configuration options

## Tips for Best Results

### For EUDR Compliance Reports
- Use the default baseline date (2020-12-31)
- Include "Imagerie avant/après" section
- Include "Tendance NDVI" to show vegetation changes
- Generate reports in French for Cameroon authorities

### For Agronomist Reports
- Include "Tendance NDVI" for health monitoring
- Include "Prédiction de rendement" for planning
- Use English if sharing with international partners

### For Certification Audits
- Include all sections for comprehensive documentation
- Use default EUDR baseline date
- Generate reports for all parcelles in a cooperative
- Keep reports for audit trail (stored in Supabase)

## Technical Details

### Report Storage
- Reports are stored in Supabase Storage
- Bucket: `certification-reports`
- Retention: 1 year
- Access: Private (authenticated users only)

### Report Format
- File format: PDF
- Naming convention: `report-{parcelleCode}-{timestamp}.pdf`
- Average file size: 2-5 MB (depending on sections included)

### Generation Time
- Typical: 10-15 seconds
- Maximum: 30 seconds
- Factors affecting time:
  - Number of sections included
  - Availability of cached satellite data
  - Current API load

## Permissions

Report generation is available to users with:
- `parcelles:read` permission (minimum)
- Access to the specific parcelle (based on cooperative/role)

## Keyboard Shortcuts

When modal is open:
- **Escape** - Close modal
- **Enter** - Generate report (when focused on generate button)
- **Tab** - Navigate between options

## Mobile Support

The report generation UI is fully responsive:
- Modal adapts to mobile screen sizes
- Touch-friendly buttons and checkboxes
- Optimized for tablets and smartphones
- Download links work on mobile browsers

## Troubleshooting

### "No satellite data available"
- NDVI has not been calculated for this parcelle
- Click "Recalculer NDVI" button first
- Wait for calculation to complete
- Try generating report again

### "Failed to generate report"
- Check internet connectivity
- Verify parcelle has required data
- Try again in a few minutes
- Contact support if issue persists

### Report not downloading
- Check browser popup blocker settings
- Try "Ouvrir dans un nouvel onglet" link instead
- Verify browser allows downloads from the site
- Check browser download settings

## Related Features

- **KML Export** - Export parcelle geometry for Google Earth
- **NDVI Calculation** - Calculate vegetation health index
- **Temporal Analysis** - View historical satellite data
- **Deforestation Alerts** - Monitor vegetation loss

## Support

For issues or questions about report generation:
1. Check this guide for common solutions
2. Review the error message details
3. Contact your system administrator
4. Report bugs to the development team

## Future Enhancements

Planned improvements:
- Batch report generation for multiple parcelles
- Custom report templates
- Scheduled automatic report generation
- Email delivery of reports
- Report comparison between parcelles
- Multi-language support (Spanish, Portuguese)
