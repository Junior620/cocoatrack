# Certification Reports Documentation

## Overview

Certification reports are automated PDF documents that provide comprehensive EUDR (EU Deforestation Regulation 2024) compliance analysis for cocoa parcelles. These reports combine satellite imagery analysis, NDVI trends, and deforestation detection to certify that cocoa was not grown on deforested land after December 31, 2020.

## Purpose

Certification reports serve multiple critical functions:

1. **EUDR Compliance Verification**: Provide evidence that parcelles meet EU deforestation requirements
2. **Audit Trail**: Create timestamped, digitally signed documentation for regulatory audits
3. **Stakeholder Communication**: Share compliance status with buyers, certifiers, and regulators
4. **Risk Assessment**: Identify parcelles requiring additional investigation or intervention

## Report Contents

### 1. Header Section

**Included Information**:
- Report title: "Rapport de Certification EUDR" (French) or "EUDR Certification Report" (English)
- Report generation date and time
- Report ID (unique identifier for tracking)
- Cooperative name and logo (if configured)
- Report language (French or English)

**Purpose**: Establishes report identity and provenance for audit purposes.

### 2. Parcelle Information

**Included Information**:
- Parcelle name/identifier
- Planteur (farmer) name
- Cooperative affiliation
- Surface area (hectares)
- GPS coordinates (centroid)
- Parcelle geometry (polygon boundary)
- Registration date in CocoaTrack system

**Purpose**: Uniquely identifies the parcelle being certified and provides context for analysis.

### 3. EUDR Compliance Status

**Compliance Indicators**:
- **Compliant**: No deforestation detected after baseline date (December 31, 2020)
- **Non-Compliant**: Deforestation detected exceeding 0.5 hectares with NDVI decrease > 0.3
- **Requires Review**: Borderline cases, insufficient data, or disputed alerts

**Visual Indicators**:
- Color-coded status badge (green, red, yellow)
- Compliance percentage (if applicable)
- Risk level assessment (Low, Medium, High)

**Purpose**: Provides immediate, clear compliance determination for auditors and stakeholders.

### 4. Baseline Analysis (December 31, 2020)

**Included Information**:
- Baseline imagery date (exact date or closest available within 60 days)
- Baseline NDVI value (mean, min, max, standard deviation)
- Baseline health status classification
- Cloud cover percentage for baseline imagery
- Imagery acquisition date variance (if not exactly Dec 31, 2020)

**Baseline Imagery**:
- Satellite imagery thumbnail (Sentinel-2 true color composite)
- NDVI visualization overlay with color gradient
- Parcelle boundary overlay

**Purpose**: Establishes the reference point for deforestation detection as required by EUDR.

### 5. Current Analysis

**Included Information**:
- Current imagery date (most recent cloud-free imagery)
- Current NDVI value (mean, min, max, standard deviation)
- Current health status classification
- Cloud cover percentage for current imagery
- Days since baseline (temporal span)

**Current Imagery**:
- Satellite imagery thumbnail (Sentinel-2 true color composite)
- NDVI visualization overlay with color gradient
- Parcelle boundary overlay

**Purpose**: Provides current state for comparison against baseline to detect changes.

### 6. Before/After Comparison

**Visual Comparison**:
- Side-by-side imagery (baseline vs. current)
- Side-by-side NDVI visualization (baseline vs. current)
- Difference map highlighting areas of change

**Quantitative Comparison**:
- NDVI change (absolute difference)
- NDVI change percentage
- Affected area (hectares and percentage of total)
- Change significance assessment

**Change Detection**:
- Areas of vegetation loss (red highlighting)
- Areas of vegetation gain (green highlighting)
- Stable areas (no highlighting)

**Purpose**: Enables visual and quantitative assessment of vegetation changes over time.

### 7. NDVI Trend Analysis

**Temporal Chart**:
- Line chart showing NDVI evolution from baseline to current date
- Monthly data points (or available imagery dates)
- Significant change markers (NDVI change > 0.15)
- Trend line (improving, stable, declining)

**Statistical Summary**:
- Overall trend direction (improving, stable, declining)
- Number of significant changes detected
- Average NDVI over period
- NDVI volatility (standard deviation over time)

**Purpose**: Provides context for understanding vegetation dynamics beyond single point-in-time comparison.

### 8. Deforestation Alerts

**Alert Summary**:
- Total number of deforestation alerts
- Alert status breakdown (pending, acknowledged, disputed, resolved)
- Most recent alert date
- Total affected area across all alerts

**Alert Details** (for each alert):
- Detection date
- Affected area (hectares and percentage)
- NDVI change magnitude
- Alert status
- Acknowledgment/dispute information (if applicable)
- User notes or explanations

**Purpose**: Documents all detected deforestation events and their resolution status.

### 9. Health Status Assessment

**Current Health Status**:
- Health status classification (Excellent, Good, Fair, Poor, Critical)
- Color-coded badge with status
- Health status trend (improving, stable, declining over past 3 months)

**Health Status Thresholds**:
- Excellent: NDVI 0.7-1.0 (dark green)
- Good: NDVI 0.6-0.7 (green)
- Fair: NDVI 0.5-0.6 (yellow)
- Poor: NDVI 0.3-0.5 (orange)
- Critical: NDVI 0.0-0.3 (red)

**Recommendations**:
- Suggested interventions based on health status
- Monitoring frequency recommendations
- Risk mitigation strategies

**Purpose**: Provides actionable insights for agronomic management beyond compliance assessment.

### 10. Methodology Section

**Technical Details**:
- Satellite data source (Sentinel-2)
- Imagery resolution (10-20 meters)
- NDVI calculation formula: (NIR - Red) / (NIR + Red)
- Spectral bands used (B4 Red, B8 NIR)
- Cloud cover filtering threshold (20%)
- Deforestation detection thresholds (NDVI decrease > 0.3, area > 0.5 ha)

**Data Quality Indicators**:
- Cloud cover percentage for all imagery used
- Number of imagery dates analyzed
- Temporal coverage (date range)
- Data gaps or limitations

**Purpose**: Provides transparency about analysis methods for technical review and validation.

### 11. Certification Declaration

**Declaration Statement** (French):
```
Je certifie que, sur la base de l'analyse par imagerie satellite effectuée, 
la parcelle [Nom de la parcelle] n'a pas subi de déforestation après le 
31 décembre 2020, conformément au Règlement de l'UE sur la déforestation 
(EUDR 2024).
```

**Declaration Statement** (English):
```
I certify that, based on satellite imagery analysis conducted, the plot 
[Plot Name] has not undergone deforestation after December 31, 2020, in 
compliance with the EU Deforestation Regulation (EUDR 2024).
```

**Certification Metadata**:
- Certifying user name and role
- Certification date and time
- Digital signature (timestamp + user credentials)
- Report version number

**Purpose**: Provides formal certification statement with audit trail for regulatory compliance.

### 12. Footer Section

**Included Information**:
- Page numbers (e.g., "Page 1 of 5")
- Report generation timestamp
- CocoaTrack system version
- Disclaimer text (if applicable)
- Contact information for inquiries

**Purpose**: Maintains document integrity and provides reference information.

## Report Generation Options

### Language Selection

**Supported Languages**:
- **French (fr)**: Default language for Cameroon operations
- **English (en)**: For international stakeholders and EU auditors

**Language Scope**:
- All text labels and descriptions
- Health status classifications
- Recommendations
- Certification declaration
- Methodology explanations

### Content Customization

**Optional Sections** (can be included/excluded):
- `includeBeforeAfter`: Before/after imagery comparison (default: true)
- `includeNDVITrend`: Temporal NDVI trend chart (default: true)
- `includeYieldPrediction`: Yield prediction data (default: false)
- `includeMethodology`: Technical methodology section (default: true)

**Baseline Date Override**:
- Default: December 31, 2020 (EUDR requirement)
- Can be manually adjusted for parcelles with documented special circumstances
- Adjustment requires justification note in report

### Template Selection

**Available Templates**:
1. **Standard Template**: Default CocoaTrack branding
2. **Cooperative Template**: Custom branding with cooperative logo and colors
3. **Minimalist Template**: Clean, text-focused layout for formal audits
4. **Detailed Template**: Extended technical details for scientific review

**Template Customization**:
- Primary color (cooperative brand color)
- Secondary color (accent color)
- Logo image (cooperative logo)
- Font family (professional fonts only)

## EUDR Compliance Requirements

### Regulation Overview

**EU Deforestation Regulation (EUDR 2024)**:
- Applies to cocoa and other commodities imported to the European Union
- Requires proof that products were not grown on deforested land
- Baseline date: December 31, 2020
- Enforcement begins: December 30, 2024 (large operators), June 30, 2025 (SMEs)

**Key Requirements**:
1. **Due Diligence**: Operators must conduct due diligence on supply chain
2. **Geolocation Data**: GPS coordinates required for all production plots
3. **Deforestation-Free**: No deforestation after December 31, 2020
4. **Traceability**: Full traceability from farm to first buyer
5. **Documentation**: Maintain records for 5 years minimum

### Compliance Criteria

**Deforestation Definition** (EUDR):
- Conversion of forest to agricultural or other non-forest use
- Includes both complete forest removal and significant degradation
- Threshold: Loss of tree cover exceeding 0.5 hectares

**CocoaTrack Detection Criteria**:
- NDVI decrease > 0.3 from baseline (30% vegetation loss)
- Affected area > 0.5 hectares
- Change persistent across multiple imagery dates
- Excludes seasonal variations and normal agricultural practices

**Compliance Determination**:
- **Compliant**: No deforestation detected meeting above criteria
- **Non-Compliant**: Deforestation detected exceeding thresholds
- **Requires Review**: Borderline cases, data quality issues, or disputed alerts

### Data Requirements

**Minimum Data for Certification**:
1. Baseline imagery from December 2020 (±60 days acceptable)
2. Current imagery (within past 6 months recommended)
3. Parcelle geometry (GPS polygon boundary)
4. Parcelle registration date
5. Planteur identification

**Data Quality Standards**:
- Cloud cover < 20% for baseline and current imagery
- Imagery resolution: 10-20 meters (Sentinel-2 standard)
- Minimum 10 pixels within parcelle boundary for NDVI calculation
- Temporal coverage: At least 2 imagery dates (baseline + current)

### Audit Trail Requirements

**Documentation Retention**:
- Certification reports: 7 years (EUDR requirement)
- Satellite imagery metadata: 7 years
- NDVI calculation results: Indefinite (for trend analysis)
- Deforestation alerts: 7 years
- User acknowledgments/disputes: 7 years

**Audit Trail Components**:
- Report generation timestamp
- Certifying user identity and role
- Data sources and versions
- Calculation methodology
- Any manual adjustments or overrides
- Review and approval history

## Report Examples

### Example 1: Compliant Parcelle

**Scenario**: Established cocoa plot with stable vegetation, no deforestation detected.

**Report Highlights**:
- Compliance Status: **Compliant** ✓
- Baseline NDVI (Dec 2020): 0.72 (Excellent)
- Current NDVI (May 2026): 0.68 (Good)
- NDVI Change: -0.04 (-5.6%)
- Affected Area: 0 hectares
- Deforestation Alerts: 0
- Health Status: Good (stable trend)

**Interpretation**: Parcelle shows normal seasonal variation with no significant vegetation loss. Fully compliant with EUDR requirements.

### Example 2: Non-Compliant Parcelle

**Scenario**: Parcelle with significant vegetation loss detected in 2023.

**Report Highlights**:
- Compliance Status: **Non-Compliant** ✗
- Baseline NDVI (Dec 2020): 0.75 (Excellent)
- Current NDVI (May 2026): 0.28 (Poor)
- NDVI Change: -0.47 (-62.7%)
- Affected Area: 1.2 hectares (80% of parcelle)
- Deforestation Alerts: 1 (pending)
- Health Status: Poor (declining trend)

**Interpretation**: Significant vegetation loss detected exceeding EUDR thresholds. Parcelle does not meet compliance requirements. Investigation and remediation required.

### Example 3: Requires Review

**Scenario**: Parcelle with borderline NDVI change and high cloud cover in baseline imagery.

**Report Highlights**:
- Compliance Status: **Requires Review** ⚠
- Baseline NDVI (Jan 2021): 0.58 (Fair) - Cloud cover: 35%
- Current NDVI (May 2026): 0.32 (Poor)
- NDVI Change: -0.26 (-44.8%)
- Affected Area: 0.4 hectares (estimated)
- Deforestation Alerts: 1 (disputed by cooperative)
- Health Status: Poor (declining trend)

**Interpretation**: NDVI change approaches deforestation threshold, but baseline data quality is questionable due to high cloud cover. Manual review recommended to verify change and assess data quality.

### Example 4: Compliant with Seasonal Variation

**Scenario**: Parcelle showing seasonal NDVI fluctuation but no persistent vegetation loss.

**Report Highlights**:
- Compliance Status: **Compliant** ✓
- Baseline NDVI (Dec 2020): 0.65 (Good)
- Current NDVI (May 2026): 0.71 (Excellent)
- NDVI Change: +0.06 (+9.2%)
- Affected Area: 0 hectares
- Deforestation Alerts: 0
- Health Status: Excellent (improving trend)
- NDVI Trend: Shows seasonal pattern with overall improvement

**Interpretation**: Parcelle shows healthy vegetation with seasonal variation. NDVI improvement indicates good management practices. Fully compliant with EUDR requirements.

## Generating Reports

### Via API

**Endpoint**: `POST /api/satellite/reports/certification`

**Request Example**:
```json
{
  "parcelleId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "options": {
    "includeBeforeAfter": true,
    "includeNDVITrend": true,
    "includeYieldPrediction": false,
    "baselineDate": "2020-12-31",
    "language": "fr"
  }
}
```

**Response Example**:
```json
{
  "reportUrl": "https://storage.supabase.co/certification-reports/report-123.pdf",
  "reportId": "report-123",
  "generatedAt": "2026-05-08T14:30:00Z",
  "expiresAt": "2027-05-08T14:30:00Z",
  "fileSize": 2457600,
  "pageCount": 5
}
```

### Via User Interface

**Steps**:
1. Navigate to parcelle detail page
2. Click "Generate Report" button in satellite analysis section
3. Select report options in modal:
   - Language (French/English)
   - Include before/after comparison
   - Include NDVI trend chart
   - Include yield prediction (optional)
4. Click "Generate" button
5. Wait for report generation (typically 10-30 seconds)
6. Download PDF when ready

**Batch Generation**:
1. Navigate to parcelle list page
2. Select multiple parcelles using checkboxes
3. Click "Batch Actions" → "Generate Reports"
4. Select report options (applied to all parcelles)
5. Click "Generate Batch"
6. Monitor progress indicator
7. Download ZIP archive containing all reports

### Programmatic Generation

**Using ExportService**:
```typescript
import { ExportService } from '@/lib/satellite/services/export.service';

const exportService = new ExportService();

const reportUrl = await exportService.generateCertificationReport(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  {
    includeBeforeAfter: true,
    includeNDVITrend: true,
    includeYieldPrediction: false,
    baselineDate: new Date('2020-12-31'),
    language: 'fr'
  }
);

console.log('Report generated:', reportUrl);
```

## Report Storage and Access

### Storage Location

**Supabase Storage Bucket**: `certification-reports`

**Bucket Configuration**:
- Access: Private (authenticated users only)
- Retention: 1 year (automatic deletion after expiration)
- Size limit: 10 MB per report
- Allowed file types: PDF only

**File Naming Convention**:
```
certification-{parcelleId}-{timestamp}.pdf
```

Example: `certification-a1b2c3d4-e5f6-7890-abcd-ef1234567890-20260508143000.pdf`

### Access Control

**Role-Based Access**:
- **Certification Auditors**: Can generate and view all reports
- **Cooperative Managers**: Can generate and view reports for their cooperative's parcelles
- **Agronomists**: Can generate and view reports for assigned parcelles
- **Planteurs**: Can view reports for their own parcelles (read-only)
- **Admin**: Full access to all reports

**Row-Level Security (RLS)**:
- Reports are linked to parcelles via `parcelle_id`
- Access controlled by existing parcelle RLS policies
- Audit log tracks all report generation and access events

### Report Expiration

**Automatic Expiration**:
- Reports expire after 1 year from generation date
- Expired reports are automatically deleted from storage
- Metadata retained in database for audit trail

**Re-generation**:
- Expired reports can be re-generated on demand
- Re-generated reports use current data (not historical snapshot)
- Original generation date preserved in audit log

## Best Practices

### When to Generate Reports

**Recommended Timing**:
1. **Initial Certification**: When parcelle is first registered in system
2. **Annual Renewal**: Once per year for ongoing compliance
3. **Pre-Shipment**: Before cocoa shipment to EU buyers
4. **Audit Preparation**: In advance of certification audits
5. **Alert Response**: After deforestation alert is acknowledged or resolved

**Avoid Generating**:
- During rainy season when cloud cover is high (April-October in Cameroon)
- Immediately after parcelle registration (wait for baseline imagery)
- When recent imagery is unavailable (check imagery dates first)

### Data Quality Considerations

**Ensure Quality Before Generation**:
1. **Verify Parcelle Geometry**: Ensure GPS polygon is accurate and complete
2. **Check Imagery Availability**: Confirm baseline and current imagery exist
3. **Review Cloud Cover**: Prefer imagery with < 20% cloud cover
4. **Validate NDVI Calculation**: Ensure NDVI has been calculated successfully
5. **Review Alerts**: Acknowledge or dispute any pending deforestation alerts

**Handle Data Gaps**:
- If baseline imagery unavailable, use closest date within 60 days
- Document any date variance in report notes
- If current imagery is old (> 6 months), note staleness in report
- For high cloud cover, consider generating multiple reports across dates

### Report Interpretation

**For Auditors**:
- Focus on compliance status indicator (Compliant/Non-Compliant/Requires Review)
- Review before/after imagery comparison for visual verification
- Check deforestation alert status and resolution
- Verify baseline date is December 31, 2020 or documented exception
- Confirm digital signature and timestamp for authenticity

**For Cooperative Managers**:
- Use reports to identify high-risk parcelles requiring intervention
- Track compliance status across all parcelles in cooperative
- Generate batch reports for portfolio-level assessment
- Share reports with buyers to demonstrate due diligence

**For Agronomists**:
- Use health status and NDVI trend for agronomic recommendations
- Identify parcelles with declining vegetation for field visits
- Correlate NDVI changes with known events (pruning, disease, drought)
- Use yield predictions for harvest planning

### Troubleshooting

**Common Issues**:

1. **Report Generation Fails**:
   - Check that parcelle has valid geometry
   - Verify baseline imagery is available
   - Ensure NDVI has been calculated
   - Check API rate limits (Google Earth Engine)

2. **Compliance Status "Requires Review"**:
   - Review data quality indicators (cloud cover, imagery dates)
   - Check for disputed deforestation alerts
   - Verify baseline date is appropriate
   - Consider manual review by agronomist or auditor

3. **Missing Before/After Imagery**:
   - Baseline imagery may be unavailable for December 2020
   - Use closest available date and document variance
   - Consider using alternative baseline date with justification

4. **Report Download Fails**:
   - Check user permissions (RLS policies)
   - Verify report has not expired (1-year retention)
   - Check network connectivity
   - Try re-generating report if expired

## Technical Specifications

### PDF Generation

**Library**: PDFKit (Node.js PDF generation library)

**Document Properties**:
- Page size: A4 (210mm × 297mm)
- Orientation: Portrait
- Margins: 20mm (top, bottom, left, right)
- Font: Helvetica (standard PDF font)
- Font sizes: 24pt (title), 16pt (headings), 12pt (body), 10pt (captions)

**Image Embedding**:
- Satellite imagery: JPEG format, 300 DPI
- NDVI visualization: PNG format with transparency
- Charts: SVG converted to PNG, 300 DPI
- Logos: PNG format with transparency

### Performance

**Generation Time**:
- Single parcelle: 10-30 seconds (typical)
- Batch (10 parcelles): 2-5 minutes
- Batch (100 parcelles): 15-30 minutes

**Optimization Strategies**:
- Cache satellite imagery and NDVI results
- Generate imagery thumbnails asynchronously
- Use background jobs for batch generation
- Compress PDF to reduce file size

### File Size

**Typical Sizes**:
- Minimal report (no imagery): 100-200 KB
- Standard report (with imagery): 1-3 MB
- Detailed report (with trend charts): 2-5 MB
- Batch report (10 parcelles): 10-30 MB (ZIP archive)

**Size Optimization**:
- Compress imagery to 80% JPEG quality
- Resize imagery to 800×600 pixels for thumbnails
- Use vector graphics for charts when possible
- Remove embedded fonts (use standard PDF fonts)

## Related Documentation

- [EUDR Compliance Guide](./eudr-compliance.md)
- [Deforestation Detection](./deforestation-detection.md)
- [NDVI Calculation](./ndvi-calculation.md)
- [Export Service Documentation](./export.md)
- [Report Templates](./report-templates.md)
- [API Documentation](../api/satellite.md)

## Support

For questions or issues with certification reports:
- Technical support: [support@cocoatrack.com](mailto:support@cocoatrack.com)
- EUDR compliance questions: [compliance@cocoatrack.com](mailto:compliance@cocoatrack.com)
- Documentation feedback: [docs@cocoatrack.com](mailto:docs@cocoatrack.com)
