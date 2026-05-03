# Requirements Document: Satellite Imagery Analysis Integration

## Introduction

This document specifies requirements for integrating satellite imagery analysis capabilities into CocoaTrack, a cocoa traceability platform for Cameroon. The system will leverage Google Earth Engine and Sentinel-2 satellite imagery to provide NDVI analysis, deforestation detection, yield prediction, and temporal analysis for cocoa parcelles (plots). This feature addresses EU Deforestation Regulation (EUDR 2024) compliance requirements and provides competitive differentiation through data-driven crop health monitoring.

## Glossary

- **Parcelle**: A cocoa plot with GPS coordinates, geometry (polygon), and associated metadata stored in the CocoaTrack system
- **NDVI**: Normalized Difference Vegetation Index, a measure of vegetation health calculated from satellite imagery (range: -1 to +1)
- **Sentinel_2**: European Space Agency satellite providing free multispectral imagery with 5-day revisit frequency and 10-20m resolution
- **Google_Earth_Engine**: Cloud-based platform for planetary-scale geospatial analysis providing free access for non-commercial use
- **EUDR**: EU Deforestation Regulation 2024, requiring proof that cocoa imported to EU was not grown on deforested land
- **Deforestation_Event**: Loss of tree cover exceeding 0.5 hectares detected through temporal satellite imagery analysis
- **Vegetation_Index**: Numerical indicator of vegetation health derived from satellite spectral bands (includes NDVI, EVI, SAVI)
- **Temporal_Analysis**: Comparison of satellite imagery across multiple time periods to detect changes
- **Cooperative_Manager**: User role responsible for overseeing multiple parcelles and planteurs within a cooperative
- **Agronomist**: User role providing technical agricultural guidance and intervention recommendations
- **Certification_Auditor**: External user role verifying EUDR compliance and sustainable practices
- **Planteur**: Farmer who owns and cultivates one or more parcelles
- **Imagery_Service**: Backend service integrating with Google Earth Engine and Sentinel-2 APIs
- **Map_Overlay**: Visual layer displaying satellite imagery or analysis results on top of base map
- **KML_File**: Keyhole Markup Language file format for geographic visualization in Google Earth
- **Cloud_Cover_Threshold**: Maximum acceptable percentage of clouds in satellite imagery (typically 20% for tropical regions)
- **Offline_Cache**: Local storage of satellite data enabling functionality without internet connectivity
- **Health_Status**: Categorical assessment of parcelle vegetation health (Excellent, Good, Fair, Poor, Critical)

## Requirements

### Requirement 1: Satellite Imagery Display

**User Story:** As a Cooperative Manager, I want to view satellite imagery overlays on parcelle maps, so that I can visually assess parcelle conditions and vegetation coverage.

#### Acceptance Criteria

1. WHEN a user selects a parcelle on the map, THE Imagery_Service SHALL retrieve the most recent cloud-free Sentinel-2 imagery for that parcelle geometry
2. THE Map_Overlay SHALL display satellite imagery with opacity control ranging from 0% to 100%
3. WHEN satellite imagery is unavailable for a parcelle, THE System SHALL display a fallback message indicating the last available imagery date
4. THE Imagery_Service SHALL filter imagery to exclude scenes with cloud cover exceeding the Cloud_Cover_Threshold of 20%
5. WHEN multiple parcelles are visible in the map viewport, THE System SHALL load imagery for all visible parcelles within 3 seconds
6. THE Map_Overlay SHALL support both Leaflet and Google Maps base map providers
7. WHEN imagery loading fails, THE System SHALL log the error and display a user-friendly error message with retry option

### Requirement 2: NDVI Calculation and Visualization

**User Story:** As an Agronomist, I want to calculate and view NDVI values for parcelles, so that I can identify areas requiring intervention and monitor crop health trends.

#### Acceptance Criteria

1. WHEN a user requests NDVI analysis for a parcelle, THE Imagery_Service SHALL calculate NDVI using the formula (NIR - Red) / (NIR + Red) from Sentinel-2 bands B8 and B4
2. THE System SHALL display NDVI values with accuracy within ±5% of ground truth measurements
3. THE Map_Overlay SHALL visualize NDVI using a color gradient: red (0.0-0.2), yellow (0.2-0.4), light green (0.4-0.6), green (0.6-0.8), dark green (0.8-1.0)
4. THE System SHALL calculate mean NDVI value for the entire parcelle geometry
5. THE System SHALL display NDVI statistics including minimum, maximum, mean, and standard deviation values
6. WHEN NDVI calculation fails due to insufficient data, THE System SHALL return an error message specifying the reason
7. THE System SHALL cache calculated NDVI values for 24 hours to reduce API calls

### Requirement 3: Temporal Analysis Interface

**User Story:** As a Cooperative Manager, I want to view parcelle evolution over time using a temporal slider, so that I can track vegetation changes and identify declining parcelles.

#### Acceptance Criteria

1. THE System SHALL provide a temporal slider interface displaying available imagery dates for the past 12 months
2. WHEN a user moves the temporal slider, THE Map_Overlay SHALL update to display imagery from the selected date within 2 seconds
3. THE System SHALL retrieve imagery at monthly intervals for the temporal analysis
4. THE System SHALL display NDVI values corresponding to the selected temporal slider position
5. WHEN comparing two time periods, THE System SHALL calculate and display NDVI change as both absolute difference and percentage change
6. THE System SHALL highlight dates with significant vegetation changes (NDVI change > 0.15) on the temporal slider
7. THE System SHALL allow users to export temporal NDVI data as CSV format including date, mean NDVI, and change metrics

### Requirement 4: Deforestation Detection

**User Story:** As a Certification Auditor, I want to detect deforestation events on parcelles, so that I can verify EUDR compliance and identify non-compliant plots.

#### Acceptance Criteria

1. THE Imagery_Service SHALL detect Deforestation_Events by comparing NDVI values across consecutive time periods
2. THE System SHALL flag a Deforestation_Event when NDVI decreases by more than 0.3 over an area exceeding 0.5 hectares
3. THE System SHALL achieve 95% accuracy for detecting deforestation changes exceeding 0.5 hectares
4. WHEN a Deforestation_Event is detected, THE System SHALL create an alert record with date, location, affected area, and NDVI change
5. THE System SHALL display deforestation alerts on the parcelle detail page with visual indicators on the map
6. THE System SHALL generate a deforestation report including before/after imagery, NDVI comparison, and affected area calculation
7. THE System SHALL allow Cooperative Managers to acknowledge or dispute deforestation alerts with supporting notes

### Requirement 5: KML Export Functionality

**User Story:** As an Agronomist, I want to export parcelle data as KML files, so that I can view detailed analysis in Google Earth and share with stakeholders.

#### Acceptance Criteria

1. WHEN a user requests KML export for a parcelle, THE System SHALL generate a KML_File containing parcelle geometry, NDVI overlay, and metadata
2. THE KML_File SHALL include parcelle boundary as a polygon with current NDVI color coding
3. THE KML_File SHALL embed metadata including parcelle name, surface area, mean NDVI, last analysis date, and Health_Status
4. THE System SHALL generate KML files within 5 seconds for single parcelle export
5. THE System SHALL support batch KML export for multiple parcelles within a cooperative
6. THE KML_File SHALL be compatible with Google Earth Pro and Google Earth Web
7. WHEN KML export includes temporal data, THE System SHALL create time-enabled KML with historical NDVI overlays

### Requirement 6: Health Status Classification

**User Story:** As a Planteur, I want to see a simple health status for my parcelles, so that I can understand crop conditions without technical knowledge.

#### Acceptance Criteria

1. THE System SHALL classify parcelles into Health_Status categories based on mean NDVI: Excellent (0.7-1.0), Good (0.6-0.7), Fair (0.5-0.6), Poor (0.3-0.5), Critical (0.0-0.3)
2. THE System SHALL display Health_Status with color-coded badges: dark green (Excellent), green (Good), yellow (Fair), orange (Poor), red (Critical)
3. WHEN Health_Status changes between consecutive analyses, THE System SHALL notify the Planteur and Cooperative_Manager
4. THE System SHALL display Health_Status on parcelle list views, detail views, and map popups
5. THE System SHALL calculate Health_Status trend over the past 3 months (improving, stable, declining)
6. THE System SHALL provide simple recommendations based on Health_Status (e.g., "Consider irrigation" for Poor status)
7. THE System SHALL aggregate Health_Status statistics at cooperative level showing distribution across all parcelles

### Requirement 7: Offline Data Caching

**User Story:** As a Cooperative Manager, I want to access previously loaded satellite data offline, so that I can review parcelle conditions in areas with poor internet connectivity.

#### Acceptance Criteria

1. THE Offline_Cache SHALL store the most recent satellite imagery and NDVI data for each viewed parcelle
2. WHEN internet connectivity is unavailable, THE System SHALL load cached imagery and display a "cached data" indicator with the cache date
3. THE Offline_Cache SHALL store up to 50 parcelles of imagery data with automatic least-recently-used eviction
4. THE System SHALL prioritize caching of parcelles marked as favorites by the user
5. WHEN cached data is older than 30 days, THE System SHALL display a warning message indicating data staleness
6. THE System SHALL allow users to manually trigger cache refresh for selected parcelles when connectivity is available
7. THE Offline_Cache SHALL store NDVI statistics, Health_Status, and temporal analysis data in addition to imagery

### Requirement 8: Yield Prediction

**User Story:** As an Agronomist, I want to predict parcelle yield based on vegetation indices, so that I can forecast production and optimize resource allocation.

#### Acceptance Criteria

1. THE System SHALL calculate yield prediction using a regression model based on mean NDVI, NDVI trend, and historical yield data
2. THE System SHALL display predicted yield in kilograms per hectare with confidence interval
3. THE System SHALL achieve yield prediction accuracy within ±15% of actual yield for parcelles with historical data
4. WHEN insufficient historical data exists, THE System SHALL display yield prediction with a "low confidence" indicator
5. THE System SHALL update yield predictions monthly based on new satellite imagery
6. THE System SHALL compare predicted yield against cooperative average and regional benchmarks
7. THE System SHALL allow Agronomists to input actual yield data to improve prediction model accuracy over time

### Requirement 9: Certification Report Generation

**User Story:** As a Certification Auditor, I want to generate automated compliance reports, so that I can efficiently verify EUDR requirements and sustainable practices.

#### Acceptance Criteria

1. WHEN a user requests a certification report, THE System SHALL generate a PDF document including parcelle details, deforestation analysis, and NDVI trends
2. THE Report SHALL include before/after satellite imagery for the EUDR baseline date (December 31, 2020) and current date
3. THE Report SHALL display a compliance status indicator (Compliant, Non-Compliant, Requires Review) based on deforestation detection results
4. THE System SHALL generate certification reports within 30 seconds for single parcelle analysis
5. THE Report SHALL include a declaration statement certifying no deforestation occurred after the EUDR baseline date
6. THE System SHALL support batch report generation for all parcelles within a cooperative
7. THE Report SHALL be digitally signed with timestamp and user credentials for audit trail purposes

### Requirement 10: Cloud Cover Handling

**User Story:** As a Cooperative Manager, I want the system to handle cloud cover in tropical imagery, so that I receive reliable analysis despite Cameroon's frequent cloud coverage.

#### Acceptance Criteria

1. THE Imagery_Service SHALL filter satellite scenes to select imagery with cloud cover below the Cloud_Cover_Threshold
2. WHEN no cloud-free imagery is available within 30 days, THE System SHALL use the least cloudy available imagery and display a cloud cover warning
3. THE System SHALL apply cloud masking algorithms to exclude cloudy pixels from NDVI calculations
4. THE System SHALL display cloud cover percentage for each imagery date in the temporal slider
5. WHEN cloud cover affects more than 30% of a parcelle area, THE System SHALL mark the analysis as "partial coverage" with affected area indication
6. THE System SHALL prioritize dry season imagery (November-March) for baseline deforestation analysis
7. THE System SHALL composite multiple partially cloudy images to create cloud-free mosaics when possible

### Requirement 11: Performance and Scalability

**User Story:** As a System Administrator, I want the satellite imagery system to perform efficiently at scale, so that all users experience responsive analysis regardless of system load.

#### Acceptance Criteria

1. THE System SHALL load satellite imagery for a single parcelle within 3 seconds under normal network conditions
2. THE System SHALL support concurrent analysis requests from up to 50 users without performance degradation
3. THE Imagery_Service SHALL implement request queuing to handle peak loads exceeding concurrent user limits
4. THE System SHALL cache frequently accessed imagery and NDVI data to reduce API calls to Google Earth Engine
5. THE System SHALL achieve 99% uptime measured over monthly periods
6. WHEN Google Earth Engine API rate limits are reached, THE System SHALL queue requests and notify users of estimated processing time
7. THE System SHALL process batch operations (multiple parcelles) using asynchronous background jobs with progress indicators

### Requirement 12: Data Integration with Existing System

**User Story:** As a Developer, I want satellite imagery data to integrate seamlessly with existing parcelle data, so that users have a unified experience across all features.

#### Acceptance Criteria

1. THE System SHALL retrieve parcelle geometry from the existing Supabase parcelles table using the MultiPolygon field
2. THE System SHALL store satellite analysis results in new Supabase tables with foreign key relationships to parcelles
3. THE System SHALL display satellite imagery overlays on both existing Leaflet and Google Maps implementations
4. THE System SHALL use existing authentication and authorization mechanisms to control access to satellite features
5. THE System SHALL respect existing role-based permissions (Cooperative Managers see their cooperative's parcelles, Agronomists see assigned parcelles)
6. THE System SHALL integrate Health_Status and deforestation alerts into existing parcelle list and detail views
7. THE System SHALL maintain data consistency between satellite analysis results and parcelle metadata updates

### Requirement 13: API Rate Limit Management

**User Story:** As a System Administrator, I want to manage Google Earth Engine API rate limits, so that the system remains operational within free tier constraints.

#### Acceptance Criteria

1. THE Imagery_Service SHALL track API usage against Google Earth Engine free tier limits (250,000 requests per day)
2. WHEN API usage reaches 80% of daily limit, THE System SHALL send an alert notification to administrators
3. THE System SHALL implement exponential backoff retry logic for rate-limited API requests
4. THE System SHALL prioritize API requests based on user role (Certification Auditors > Cooperative Managers > Planteurs)
5. THE System SHALL cache API responses for 24 hours to minimize redundant requests
6. WHEN daily API limit is exceeded, THE System SHALL serve cached data and display a notification about limited functionality
7. THE System SHALL provide an admin dashboard displaying current API usage, cache hit rate, and request queue status

### Requirement 14: Error Handling and User Feedback

**User Story:** As a Cooperative Manager, I want clear error messages when satellite analysis fails, so that I understand what went wrong and what actions I can take.

#### Acceptance Criteria

1. WHEN satellite imagery is unavailable for a parcelle, THE System SHALL display a message specifying the reason (no recent imagery, cloud cover, API error)
2. WHEN NDVI calculation fails, THE System SHALL log the error with parcelle ID, timestamp, and error details for debugging
3. THE System SHALL provide user-friendly error messages avoiding technical jargon (e.g., "Satellite data temporarily unavailable" instead of "API timeout error")
4. WHEN an error occurs, THE System SHALL offer actionable next steps (retry, view cached data, contact support)
5. THE System SHALL display a loading indicator during satellite data retrieval with estimated time remaining
6. WHEN partial data is available (e.g., cloud-covered areas), THE System SHALL display the available data with clear indication of missing areas
7. THE System SHALL implement graceful degradation, allowing users to access other parcelle features when satellite analysis is unavailable

### Requirement 15: Parser and Serializer for Satellite Data

**User Story:** As a Developer, I want robust parsing and serialization of satellite imagery data, so that data exchange with Google Earth Engine is reliable and error-free.

#### Acceptance Criteria

1. WHEN receiving GeoJSON data from Google Earth Engine, THE GeoJSON_Parser SHALL parse it into internal Parcelle_Geometry objects
2. WHEN invalid GeoJSON is received, THE GeoJSON_Parser SHALL return a descriptive error indicating the specific validation failure
3. THE GeoJSON_Serializer SHALL format Parcelle_Geometry objects back into valid GeoJSON for API requests
4. FOR ALL valid Parcelle_Geometry objects, parsing then serializing then parsing SHALL produce an equivalent object (round-trip property)
5. THE NDVI_Data_Parser SHALL parse Sentinel-2 band data into structured NDVI_Result objects with validation
6. THE KML_Serializer SHALL format parcelle data and NDVI results into valid KML files conforming to KML 2.2 specification
7. FOR ALL valid NDVI_Result objects, serializing to KML then parsing SHALL preserve all essential data fields (geometry, NDVI values, metadata)

### Requirement 16: Multi-Parcelle Analysis

**User Story:** As a Cooperative Manager, I want to analyze multiple parcelles simultaneously, so that I can efficiently assess the health of all parcelles in my cooperative.

#### Acceptance Criteria

1. THE System SHALL allow users to select multiple parcelles for batch NDVI analysis
2. WHEN analyzing multiple parcelles, THE System SHALL display aggregate statistics including mean NDVI, Health_Status distribution, and deforestation alert count
3. THE System SHALL process batch analysis requests asynchronously with a progress indicator showing completed/total parcelles
4. THE System SHALL generate a comparative report showing NDVI rankings and identifying parcelles requiring attention
5. THE Map_Overlay SHALL display color-coded parcelle boundaries based on Health_Status for visual comparison
6. THE System SHALL allow filtering of parcelle lists by Health_Status, NDVI range, and deforestation alert status
7. THE System SHALL complete batch analysis for up to 100 parcelles within 5 minutes

### Requirement 17: Historical Baseline Establishment

**User Story:** As a Certification Auditor, I want to establish historical baselines for EUDR compliance, so that I can accurately assess whether deforestation occurred after December 31, 2020.

#### Acceptance Criteria

1. THE System SHALL retrieve and store satellite imagery from December 2020 as the EUDR baseline reference for each parcelle
2. THE System SHALL calculate baseline NDVI values for the EUDR reference date (December 31, 2020)
3. WHEN baseline imagery is unavailable for the exact date, THE System SHALL use the closest available cloud-free imagery within 60 days
4. THE System SHALL compare current NDVI values against the baseline to detect vegetation loss
5. THE System SHALL flag parcelles with NDVI decrease exceeding 0.3 from baseline as potential EUDR violations
6. THE System SHALL display side-by-side comparison of baseline and current imagery in certification reports
7. THE System SHALL allow manual adjustment of baseline date for parcelles with documented special circumstances

### Requirement 18: Mobile Responsiveness

**User Story:** As a Planteur, I want to view satellite imagery and health status on my mobile phone, so that I can check my parcelles while in the field.

#### Acceptance Criteria

1. THE System SHALL display satellite imagery overlays on mobile devices with screen widths from 320px to 768px
2. THE temporal slider SHALL be touch-enabled with swipe gestures for date navigation
3. THE System SHALL optimize imagery resolution for mobile devices to reduce data transfer (maximum 2MB per parcelle)
4. THE Map_Overlay SHALL support pinch-to-zoom and pan gestures on touch devices
5. THE System SHALL display simplified Health_Status indicators on mobile list views with expandable details
6. THE System SHALL load critical data (Health_Status, alerts) before loading full imagery on mobile connections
7. THE System SHALL provide a mobile-optimized layout for certification reports with responsive tables and images

### Requirement 19: Notification System for Critical Changes

**User Story:** As a Cooperative Manager, I want to receive notifications when critical vegetation changes are detected, so that I can respond quickly to potential issues.

#### Acceptance Criteria

1. WHEN a Deforestation_Event is detected, THE System SHALL send a notification to the Cooperative_Manager and assigned Agronomist
2. WHEN Health_Status declines by two or more categories (e.g., Good to Poor), THE System SHALL send an alert notification
3. THE System SHALL support notification delivery via email and in-app notification center
4. THE System SHALL allow users to configure notification preferences including frequency and severity thresholds
5. THE Notification SHALL include parcelle name, location, change description, and a direct link to the parcelle detail page
6. THE System SHALL batch notifications to avoid overwhelming users (maximum one digest per day for non-critical alerts)
7. THE System SHALL track notification delivery status and provide read receipts for critical deforestation alerts

### Requirement 20: Data Retention and Archival

**User Story:** As a System Administrator, I want to manage satellite data retention, so that storage costs remain controlled while maintaining compliance requirements.

#### Acceptance Criteria

1. THE System SHALL retain raw satellite imagery for 90 days after initial retrieval
2. THE System SHALL retain calculated NDVI values and Health_Status records indefinitely for historical trend analysis
3. THE System SHALL archive deforestation detection results for 7 years to meet EUDR compliance requirements
4. THE System SHALL compress archived imagery data to reduce storage costs by at least 50%
5. WHEN archived data is requested, THE System SHALL retrieve and decompress it within 10 seconds
6. THE System SHALL provide an admin interface for configuring retention policies per data type
7. THE System SHALL automatically purge cached data older than 30 days to free storage space

## Non-Functional Requirements

### Performance Requirements

1. THE System SHALL load satellite imagery for a single parcelle within 3 seconds under normal network conditions (100 Mbps)
2. THE System SHALL calculate NDVI values within 2 seconds for parcelles up to 50 hectares
3. THE System SHALL support 50 concurrent users without response time degradation exceeding 20%
4. THE System SHALL achieve 99% uptime measured over monthly periods

### Scalability Requirements

1. THE System SHALL support analysis of up to 10,000 parcelles within the CocoaTrack database
2. THE Imagery_Service SHALL handle up to 1,000 API requests per hour during peak usage
3. THE Offline_Cache SHALL scale to store imagery for up to 50 parcelles per user device

### Security Requirements

1. THE System SHALL enforce existing role-based access control for all satellite imagery features
2. THE System SHALL encrypt Google Earth Engine API credentials using industry-standard encryption
3. THE System SHALL log all deforestation alert acknowledgments with user ID and timestamp for audit purposes
4. THE System SHALL validate all user inputs to prevent injection attacks in geometry queries

### Compatibility Requirements

1. THE System SHALL integrate with existing Leaflet map implementation without breaking current functionality
2. THE System SHALL integrate with existing Google Maps implementation without breaking current functionality
3. THE System SHALL support modern web browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
4. THE System SHALL function on mobile devices running iOS 13+ and Android 9+

### Usability Requirements

1. THE System SHALL provide tooltips explaining NDVI values and Health_Status categories for non-technical users
2. THE System SHALL display loading indicators for all asynchronous operations exceeding 1 second
3. THE System SHALL use color-blind friendly color palettes for NDVI visualization
4. THE System SHALL provide French language support for all user-facing text and notifications

### Reliability Requirements

1. THE System SHALL implement automatic retry logic for failed Google Earth Engine API requests (maximum 3 retries with exponential backoff)
2. THE System SHALL gracefully degrade to cached data when real-time satellite data is unavailable
3. THE System SHALL maintain data consistency between satellite analysis results and parcelle records using database transactions

### Maintainability Requirements

1. THE System SHALL log all API interactions with Google Earth Engine including request parameters, response status, and execution time
2. THE System SHALL provide admin dashboard displaying system health metrics (API usage, cache hit rate, error rate)
3. THE System SHALL document all satellite data processing algorithms with references to scientific sources

## Success Metrics

1. **NDVI Accuracy**: NDVI calculation accuracy within ±5% of ground truth measurements (validated against field samples)
2. **Deforestation Detection Accuracy**: 95% accuracy for detecting changes exceeding 0.5 hectares (validated against manual imagery review)
3. **Performance**: Image loading time under 3 seconds for single parcelle (measured at 50th percentile)
4. **Reliability**: System uptime of 99% (measured monthly, excluding planned maintenance)
5. **User Adoption**: 80% of Cooperative Managers use satellite imagery feature at least monthly (measured via analytics)
6. **Yield Prediction Accuracy**: Yield predictions within ±15% of actual yield (validated after harvest season)
7. **API Efficiency**: Cache hit rate exceeding 60% to minimize Google Earth Engine API usage
8. **User Satisfaction**: Average user rating of 4.0/5.0 or higher for satellite imagery features (measured via in-app survey)

## Technical Constraints

1. THE System SHALL use Google Earth Engine free tier (non-commercial use, 250,000 requests/day limit)
2. THE System SHALL use Sentinel-2 satellite imagery (free, 10-20m resolution, 5-day revisit frequency)
3. THE System SHALL integrate with existing Next.js 14, TypeScript, Supabase, and Tailwind CSS technology stack
4. THE System SHALL work with existing Leaflet (OSM, Esri Satellite) and Google Maps (hybrid) map implementations
5. THE System SHALL handle Cameroon's tropical climate challenges including frequent cloud cover
6. THE System SHALL implement offline-first architecture where possible to support areas with limited connectivity

## Dependencies

1. Google Earth Engine API access and authentication
2. Sentinel-2 satellite imagery availability and quality
3. Existing parcelle geometry data in Supabase (MultiPolygon format)
4. Existing map implementations (Leaflet and Google Maps)
5. Network connectivity for API requests (with offline fallback)
6. Historical satellite imagery availability for EUDR baseline (December 2020)

## Out of Scope (Phase 1)

1. Advanced vegetation indices beyond NDVI (EVI, SAVI, NDMI)
2. Automated disease detection using machine learning
3. Integration with drone imagery
4. Real-time alerts (notifications will be daily batch)
5. Custom yield prediction model training interface
6. Multi-spectral analysis beyond standard Sentinel-2 bands
7. Integration with weather data APIs
8. Soil moisture analysis
9. Carbon sequestration calculations
10. Mobile native applications (mobile web only)

## Assumptions

1. Google Earth Engine free tier limits are sufficient for CocoaTrack's usage patterns
2. Sentinel-2 imagery quality and availability are adequate for Cameroon's geography
3. Users have basic understanding of satellite imagery concepts or can learn through tooltips
4. Parcelle geometry data in Supabase is accurate and up-to-date
5. Internet connectivity is available for initial data loading (offline mode for cached data only)
6. Historical yield data will be collected over time to improve prediction accuracy
7. EUDR baseline date of December 31, 2020 is fixed and will not change

## Risks and Mitigations

1. **Risk**: Cloud cover in tropical Cameroon may limit imagery availability
   - **Mitigation**: Implement cloud masking, use image compositing, prioritize dry season imagery

2. **Risk**: Google Earth Engine API rate limits may be exceeded during peak usage
   - **Mitigation**: Implement aggressive caching, request queuing, and usage monitoring

3. **Risk**: NDVI accuracy may vary due to sensor calibration or atmospheric conditions
   - **Mitigation**: Validate against ground truth samples, document accuracy limitations, apply atmospheric correction

4. **Risk**: Users may misinterpret NDVI values or Health_Status without proper training
   - **Mitigation**: Provide comprehensive tooltips, user documentation, and training materials

5. **Risk**: Deforestation detection may produce false positives (e.g., seasonal changes, harvesting)
   - **Mitigation**: Implement manual review workflow, allow alert disputes, use conservative thresholds

6. **Risk**: Historical baseline imagery may be unavailable for some parcelles
   - **Mitigation**: Use closest available date, document baseline date variance, allow manual baseline adjustment

7. **Risk**: Performance may degrade with large parcelles or complex geometries
   - **Mitigation**: Implement geometry simplification, optimize API requests, use progressive loading

8. **Risk**: Integration with existing map implementations may introduce bugs
   - **Mitigation**: Comprehensive testing, feature flags for gradual rollout, maintain backward compatibility
