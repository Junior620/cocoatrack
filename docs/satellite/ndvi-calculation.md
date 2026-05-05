# NDVI Calculation Guide

## Table of Contents

1. [Introduction](#introduction)
2. [What is NDVI?](#what-is-ndvi)
3. [The NDVI Formula](#the-ndvi-formula)
4. [Understanding NDVI Values](#understanding-ndvi-values)
5. [Health Status Classification](#health-status-classification)
6. [Sentinel-2 Bands Used](#sentinel-2-bands-used)
7. [Calculation Process](#calculation-process)
8. [Interpreting NDVI Results](#interpreting-ndvi-results)
9. [Visual Examples](#visual-examples)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Introduction

This document explains how CocoaTrack calculates and interprets the Normalized Difference Vegetation Index (NDVI) for cocoa parcelles using Sentinel-2 satellite imagery. NDVI is a key indicator of vegetation health and is used throughout the platform for crop monitoring, deforestation detection, and yield prediction.

## What is NDVI?

**NDVI (Normalized Difference Vegetation Index)** is a numerical indicator that measures the health and density of vegetation using satellite imagery. It works by comparing the amount of near-infrared (NIR) light reflected by plants versus visible red light.

### Why NDVI Works

Healthy vegetation:
- **Absorbs** most visible red light (for photosynthesis)
- **Reflects** most near-infrared light (to prevent overheating)

Unhealthy or sparse vegetation:
- Reflects more red light
- Reflects less near-infrared light

By comparing these two wavelengths, NDVI provides a reliable measure of vegetation health.

## The NDVI Formula

### Mathematical Formula

```
NDVI = (NIR - Red) / (NIR + Red)
```

Where:
- **NIR** = Near-Infrared reflectance (Sentinel-2 Band 8)
- **Red** = Red light reflectance (Sentinel-2 Band 4)

### Value Range

NDVI values always fall between **-1.0** and **+1.0**:

| NDVI Range | Typical Surface Type |
|------------|---------------------|
| -1.0 to 0.0 | Water, snow, clouds, bare rock |
| 0.0 to 0.2 | Bare soil, sand, urban areas |
| 0.2 to 0.4 | Sparse vegetation, grassland |
| 0.4 to 0.6 | Moderate vegetation, shrubs |
| 0.6 to 0.8 | Dense vegetation, healthy crops |
| 0.8 to 1.0 | Very dense vegetation, tropical forests |

### Example Calculation

For a healthy cocoa tree:
- NIR reflectance = 0.50 (50%)
- Red reflectance = 0.10 (10%)

```
NDVI = (0.50 - 0.10) / (0.50 + 0.10)
     = 0.40 / 0.60
     = 0.67
```

This NDVI value of **0.67** indicates **good vegetation health**.

## Understanding NDVI Values

### For Cocoa Parcelles

Typical NDVI ranges for cocoa plantations in Cameroon:

| NDVI Range | Vegetation Condition | What It Means |
|------------|---------------------|---------------|
| **0.7 - 1.0** | Excellent | Dense canopy, optimal health, mature trees |
| **0.6 - 0.7** | Good | Healthy vegetation, good coverage |
| **0.5 - 0.6** | Fair | Moderate health, may need attention |
| **0.3 - 0.5** | Poor | Stressed vegetation, intervention needed |
| **0.0 - 0.3** | Critical | Severe stress, bare soil, or deforestation |

### Factors Affecting NDVI

NDVI values can be influenced by:

1. **Seasonal Changes**
   - Dry season (November-March): Lower NDVI due to leaf drop
   - Rainy season (April-October): Higher NDVI with new growth

2. **Tree Age**
   - Young plantations (1-3 years): NDVI 0.3-0.5
   - Mature plantations (5+ years): NDVI 0.6-0.8

3. **Management Practices**
   - Well-maintained parcelles: Higher NDVI
   - Neglected parcelles: Lower NDVI

4. **Environmental Stress**
   - Drought: Decreased NDVI
   - Disease: Localized NDVI reduction
   - Pest damage: Patchy NDVI patterns

## Health Status Classification

CocoaTrack automatically classifies parcelles into five health status categories based on mean NDVI values.

### Classification Thresholds

```typescript
function calculateHealthStatus(meanNDVI: number): HealthStatus {
  if (meanNDVI >= 0.7) return 'excellent';
  if (meanNDVI >= 0.6) return 'good';
  if (meanNDVI >= 0.5) return 'fair';
  if (meanNDVI >= 0.3) return 'poor';
  return 'critical';
}
```

### Health Status Details

#### 🟢 Excellent (NDVI 0.7-1.0)
- **Color**: Dark Green (#2d5016)
- **Meaning**: Optimal vegetation health with dense canopy coverage
- **Action**: Maintain current management practices
- **Typical Scenario**: Mature, well-maintained cocoa plantation

#### 🟢 Good (NDVI 0.6-0.7)
- **Color**: Green (#6FAF3D)
- **Meaning**: Healthy vegetation with good coverage
- **Action**: Continue regular monitoring
- **Typical Scenario**: Healthy plantation with normal seasonal variation

#### 🟡 Fair (NDVI 0.5-0.6)
- **Color**: Yellow (#fbbf24)
- **Meaning**: Moderate vegetation health, may need attention
- **Action**: Investigate potential issues, consider interventions
- **Typical Scenario**: Young plantation or seasonal stress

#### 🟠 Poor (NDVI 0.3-0.5)
- **Color**: Orange (#E68A1F)
- **Meaning**: Stressed vegetation requiring intervention
- **Action**: Immediate investigation and corrective measures needed
- **Typical Scenario**: Drought stress, disease, or poor management
- **Recommendations**: 
  - Check irrigation systems
  - Inspect for pests and diseases
  - Review fertilization schedule
  - Consider pruning or replanting

#### 🔴 Critical (NDVI 0.0-0.3)
- **Color**: Red (#ef4444)
- **Meaning**: Severe vegetation stress or loss
- **Action**: Urgent intervention required
- **Typical Scenario**: Deforestation, severe disease, or abandoned parcelle
- **Recommendations**:
  - Conduct field visit immediately
  - Assess for deforestation or land use change
  - Evaluate replanting needs
  - Check EUDR compliance

## Sentinel-2 Bands Used

CocoaTrack uses the European Space Agency's Sentinel-2 satellite constellation for NDVI calculation.

### Band Specifications

| Band | Name | Wavelength | Resolution | Purpose |
|------|------|------------|------------|---------|
| **B4** | Red | 665 nm | 10 m | Visible red light (absorbed by chlorophyll) |
| **B8** | NIR | 842 nm | 10 m | Near-infrared (reflected by healthy vegetation) |

### Why Sentinel-2?

- **Free and open access**: No cost for imagery
- **High resolution**: 10-meter spatial resolution
- **Frequent revisits**: 5-day revisit frequency
- **Multispectral**: 13 spectral bands for various analyses
- **Global coverage**: Covers all cocoa-growing regions

## Calculation Process

### Step-by-Step Process

1. **Parcelle Selection**
   - User selects a parcelle on the map
   - System retrieves parcelle geometry (polygon coordinates)

2. **Imagery Retrieval**
   - Query Google Earth Engine for Sentinel-2 imagery
   - Filter by date range and cloud cover (<20%)
   - Select most recent cloud-free image

3. **Band Extraction**
   - Extract Band 4 (Red) values for parcelle area
   - Extract Band 8 (NIR) values for parcelle area
   - Apply cloud masking to exclude cloudy pixels

4. **NDVI Calculation**
   - Calculate NDVI for each pixel: `(NIR - Red) / (NIR + Red)`
   - Handle edge cases (division by zero when NIR + Red = 0)

5. **Statistical Analysis**
   - Calculate mean NDVI across all pixels
   - Calculate minimum, maximum, and standard deviation
   - Determine health status based on mean NDVI

6. **Result Storage**
   - Store NDVI results in database
   - Cache for 24 hours to reduce API calls
   - Generate visualization overlay

### Code Example

```typescript
// Simplified NDVI calculation
async function calculateNDVI(parcelleId: string, date: Date): Promise<NDVIResult> {
  // 1. Get parcelle geometry
  const parcelle = await getParcelle(parcelleId);
  
  // 2. Retrieve Sentinel-2 bands
  const bands = await imageryService.getBands(
    parcelle.geometry,
    date,
    ['B4', 'B8']
  );
  
  // 3. Calculate NDVI for each pixel
  const ndviPixels = bands.B8.map((nir, index) => {
    const red = bands.B4[index];
    const denominator = nir + red;
    
    // Handle division by zero
    if (denominator === 0) return 0;
    
    return (nir - red) / denominator;
  });
  
  // 4. Calculate statistics
  const meanNDVI = calculateMean(ndviPixels);
  const minNDVI = Math.min(...ndviPixels);
  const maxNDVI = Math.max(...ndviPixels);
  const stdDevNDVI = calculateStdDev(ndviPixels);
  
  // 5. Determine health status
  const healthStatus = calculateHealthStatus(meanNDVI);
  
  // 6. Return result
  return {
    parcelleId,
    calculationDate: date,
    meanNDVI,
    minNDVI,
    maxNDVI,
    stdDevNDVI,
    healthStatus
  };
}
```

## Interpreting NDVI Results

### NDVI Statistics

When you calculate NDVI for a parcelle, you receive several statistical measures:

#### Mean NDVI
- **Definition**: Average NDVI value across the entire parcelle
- **Use**: Primary indicator of overall vegetation health
- **Example**: Mean NDVI of 0.65 indicates good overall health

#### Minimum NDVI
- **Definition**: Lowest NDVI value within the parcelle
- **Use**: Identifies problem areas or bare spots
- **Example**: Min NDVI of 0.20 may indicate a clearing or dead trees

#### Maximum NDVI
- **Definition**: Highest NDVI value within the parcelle
- **Use**: Shows best-performing areas
- **Example**: Max NDVI of 0.85 indicates very healthy vegetation

#### Standard Deviation
- **Definition**: Measure of NDVI variation across the parcelle
- **Use**: Indicates uniformity of vegetation
- **Low std dev (< 0.1)**: Uniform vegetation coverage
- **High std dev (> 0.2)**: Patchy or uneven vegetation

### NDVI Trends

Tracking NDVI over time reveals important patterns:

#### Improving Trend
- NDVI increasing over 3+ months
- **Indicates**: Recovery, new growth, improved management
- **Action**: Continue current practices

#### Stable Trend
- NDVI relatively constant (±0.05)
- **Indicates**: Consistent health, mature plantation
- **Action**: Maintain monitoring schedule

#### Declining Trend
- NDVI decreasing over 3+ months
- **Indicates**: Stress, disease, poor management, or deforestation
- **Action**: Investigate cause and implement interventions

### Significant Changes

CocoaTrack flags significant NDVI changes:

- **Threshold**: NDVI change > 0.15 between measurements
- **Example**: Drop from 0.70 to 0.50 (ΔNDVI = -0.20)
- **Triggers**: Alert notification to cooperative manager
- **Requires**: Field investigation and corrective action

## Visual Examples

### NDVI Color Visualization

CocoaTrack displays NDVI values using a color gradient for easy interpretation:

```
NDVI Value    Color           Hex Code    Vegetation Condition
─────────────────────────────────────────────────────────────────
0.0 - 0.2     Red             #ef4444     Very poor / bare soil
0.2 - 0.4     Yellow          #fbbf24     Poor / sparse vegetation
0.4 - 0.6     Light Green     #84cc16     Moderate vegetation
0.6 - 0.8     Green           #22c55e     Good / healthy vegetation
0.8 - 1.0     Dark Green      #15803d     Excellent / dense vegetation
```

### Example Scenarios

#### Scenario 1: Healthy Mature Plantation
```
Parcelle: PAR-001
Surface: 2.5 hectares
Mean NDVI: 0.72
Min NDVI: 0.65
Max NDVI: 0.82
Std Dev: 0.08
Health Status: Excellent ✅
Interpretation: Dense, uniform canopy with optimal health
```

#### Scenario 2: Young Plantation
```
Parcelle: PAR-002
Surface: 1.8 hectares
Mean NDVI: 0.48
Min NDVI: 0.35
Max NDVI: 0.58
Std Dev: 0.12
Health Status: Fair ⚠️
Interpretation: Developing plantation with moderate coverage
Action: Monitor growth, ensure adequate irrigation
```

#### Scenario 3: Stressed Plantation
```
Parcelle: PAR-003
Surface: 3.2 hectares
Mean NDVI: 0.38
Min NDVI: 0.15
Max NDVI: 0.52
Std Dev: 0.18
Health Status: Poor ⚠️
Interpretation: Significant stress with patchy vegetation
Action: Immediate field visit required
Recommendations:
  - Check for drought stress
  - Inspect for pest/disease
  - Review management practices
```

#### Scenario 4: Deforestation Alert
```
Parcelle: PAR-004
Baseline NDVI (Dec 2020): 0.75
Current NDVI (May 2026): 0.22
NDVI Change: -0.53
Affected Area: 1.2 hectares
Health Status: Critical 🚨
Alert: Potential EUDR violation detected
Action: Urgent investigation required
```

## Best Practices

### When to Calculate NDVI

1. **Regular Monitoring**
   - Monthly during growing season
   - Quarterly during dry season
   - After significant weather events

2. **Before Key Decisions**
   - Before harvest planning
   - Before applying interventions
   - For certification audits

3. **Temporal Analysis**
   - Compare same season across years
   - Track recovery after interventions
   - Establish baseline for new parcelles

### Optimizing NDVI Accuracy

1. **Choose Cloud-Free Imagery**
   - Cloud cover < 20% recommended
   - Avoid rainy season if possible
   - Use dry season (Nov-Mar) for baselines

2. **Consider Seasonal Variations**
   - Expect lower NDVI in dry season
   - Account for natural leaf drop
   - Compare similar time periods

3. **Validate with Field Observations**
   - Conduct field visits for anomalies
   - Correlate NDVI with ground truth
   - Document management activities

4. **Use Temporal Context**
   - Don't rely on single measurement
   - Track trends over 3-6 months
   - Compare with historical data

### Interpreting Edge Cases

#### Low NDVI in Healthy Parcelle
**Possible Causes**:
- Recent pruning or maintenance
- Seasonal leaf drop (dry season)
- Young plantation still developing
- Cloud shadows not fully masked

**Action**: Check imagery date and field records

#### High NDVI Variation (High Std Dev)
**Possible Causes**:
- Mixed land use (cocoa + other crops)
- Uneven tree age distribution
- Patchy disease or pest damage
- Gaps in canopy coverage

**Action**: Investigate spatial patterns on map

#### Sudden NDVI Drop
**Possible Causes**:
- Deforestation or clearing
- Severe weather damage
- Disease outbreak
- Harvest or pruning activity

**Action**: Immediate field verification required

## Troubleshooting

### Common Issues and Solutions

#### Issue: "No imagery available"
**Cause**: No cloud-free Sentinel-2 imagery for selected date
**Solution**: 
- Try different date (±7 days)
- Increase cloud cover threshold
- Use temporal slider to find available dates

#### Issue: "NDVI calculation failed"
**Cause**: Insufficient valid pixels after cloud masking
**Solution**:
- Select imagery with lower cloud cover
- Try different date
- Check if parcelle geometry is valid

#### Issue: "Unexpected low NDVI"
**Cause**: Various factors (see edge cases above)
**Solution**:
1. Check imagery date and season
2. Review recent field activities
3. Compare with previous measurements
4. Conduct field visit if persistent

#### Issue: "NDVI doesn't match field observations"
**Cause**: Timing mismatch or imagery quality issues
**Solution**:
1. Verify imagery acquisition date
2. Check cloud cover percentage
3. Look for cloud shadows on map
4. Try more recent imagery

### Getting Help

If you encounter issues with NDVI calculation:

1. **Check System Status**: Verify Google Earth Engine API is operational
2. **Review Documentation**: Consult this guide and API documentation
3. **Contact Support**: Provide parcelle ID, date, and error message
4. **Field Verification**: When in doubt, conduct a field visit

---

## Additional Resources

### Scientific References

1. **Rouse et al. (1974)**: Original NDVI paper - "Monitoring vegetation systems in the Great Plains with ERTS"
2. **Tucker (1979)**: "Red and photographic infrared linear combinations for monitoring vegetation"
3. **ESA Sentinel-2 User Guide**: https://sentinel.esa.int/web/sentinel/user-guides/sentinel-2-msi

### Related Documentation

- [Satellite Imagery Setup Guide](./gee-setup.md)
- [API Documentation](../api/satellite.md)
- [Deforestation Detection Guide](./deforestation-detection.md)
- [Temporal Analysis Guide](./temporal-analysis.md)

### External Tools

- **Google Earth Engine**: https://earthengine.google.com
- **Sentinel Hub EO Browser**: https://apps.sentinel-hub.com/eo-browser
- **USGS EarthExplorer**: https://earthexplorer.usgs.gov

---

**Last Updated**: May 3, 2026  
**Version**: 1.0  
**Maintained by**: CocoaTrack Development Team
