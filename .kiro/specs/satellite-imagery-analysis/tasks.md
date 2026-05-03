# Implementation Tasks: Satellite Imagery Analysis Integration

This document provides a detailed breakdown of implementation tasks for the satellite imagery analysis feature, organized by the 8 phases defined in the design document.

## Task Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed
- `[!]` Blocked

---

## Phase 1: Foundation (Weeks 1-2)

**Goal**: Set up Google Earth Engine integration, create database schema, and implement basic imagery retrieval.

### 1.1 Google Earth Engine Setup

- [x] **Task 1.1.1**: Create Google Earth Engine account
  - Sign up for GEE account at https://earthengine.google.com
  - Request access for non-commercial use
  - Wait for approval (typically 1-2 days)
  - **Acceptance**: GEE account approved and accessible

- [x] **Task 1.1.2**: Create GEE service account
  - Create new Google Cloud project for CocoaTrack
  - Enable Earth Engine API in Google Cloud Console
  - Create service account with Earth Engine permissions
  - Download service account JSON key file
  - **Acceptance**: Service account created with valid credentials

- [x] **Task 1.1.3**: Configure GEE credentials in environment
  - Add `GOOGLE_EARTH_ENGINE_API_KEY` to `.env.local`
  - Add `GOOGLE_EARTH_ENGINE_PROJECT_ID` to `.env.local`
  - Add `GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT` to `.env.local`
  - Update `.env.local.example` with placeholder values
  - Add credentials to Vercel environment variables (production)
  - **Acceptance**: Environment variables configured and accessible

- [x] **Task 1.1.4**: Test GEE API connection
  - Create test script to authenticate with GEE
  - Verify access to Sentinel-2 image collection
  - Test basic query (retrieve one image)
  - Document any rate limits or restrictions encountered
  - **Acceptance**: Successfully retrieve test imagery from GEE

### 1.2 Database Schema

- [x] **Task 1.2.1**: Create `satellite_imagery` table migration
  - Create migration file: `supabase/migrations/YYYYMMDD_create_satellite_imagery.sql`
  - Define table schema with all columns (id, parcelle_id, acquisition_date, cloud_cover_percent, etc.)
  - Add foreign key constraint to parcelles table
  - Add unique constraint on (parcelle_id, acquisition_date)
  - Create indexes on parcelle_id, acquisition_date, cloud_cover_percent
  - **Acceptance**: Migration runs successfully, table created with correct schema

- [x] **Task 1.2.2**: Create `ndvi_results` table migration
  - Create migration file: `supabase/migrations/YYYYMMDD_create_ndvi_results.sql`
  - Define table schema with NDVI statistics columns
  - Add CHECK constraints for NDVI value ranges (-1 to 1)
  - Add CHECK constraint for health_status enum values
  - Create indexes on parcelle_id, calculation_date, health_status, mean_ndvi
  - **Acceptance**: Migration runs successfully, table created with constraints

- [x] **Task 1.2.3**: Create `deforestation_events` table migration
  - Create migration file: `supabase/migrations/YYYYMMDD_create_deforestation_events.sql`
  - Define table schema with detection and status columns
  - Add foreign keys to parcelles and profiles tables
  - Add CHECK constraint for status enum values
  - Create indexes on parcelle_id, status, detection_date
  - **Acceptance**: Migration runs successfully, table created with relationships

- [x] **Task 1.2.4**: Create `yield_predictions` table migration
  - Create migration file: `supabase/migrations/YYYYMMDD_create_yield_predictions.sql`
  - Define table schema with prediction and confidence columns
  - Add JSONB column for input_features
  - Create indexes on parcelle_id, harvest_season, prediction_date
  - **Acceptance**: Migration runs successfully, table supports JSONB queries

- [x] **Task 1.2.5**: Create `satellite_cache_metadata` table migration
  - Create migration file: `supabase/migrations/YYYYMMDD_create_satellite_cache_metadata.sql`
  - Define table schema for cache management
  - Add unique constraint on cache_key
  - Create indexes on parcelle_id, expires_at, last_accessed_at
  - **Acceptance**: Migration runs successfully, cache tracking enabled

- [x] **Task 1.2.6**: Create `satellite_audit_logs` table migration
  - Create migration file: `supabase/migrations/YYYYMMDD_create_satellite_audit_logs.sql`
  - Define table schema for audit logging
  - Add foreign keys to profiles and parcelles
  - Create indexes on user_id, parcelle_id, event_type, created_at
  - **Acceptance**: Migration runs successfully, audit logging enabled

- [x] **Task 1.2.7**: Create RLS policies for satellite tables
  - Create migration file: `supabase/migrations/YYYYMMDD_satellite_rls_policies.sql`
  - Add SELECT policy for satellite_imagery (based on parcelle access)
  - Add SELECT policy for ndvi_results (based on parcelle access)
  - Add SELECT policy for deforestation_events (based on parcelle access)
  - Add INSERT/UPDATE policies for cooperative managers and agronomists
  - Test policies with different user roles
  - **Acceptance**: RLS policies enforce correct access control

- [x] **Task 1.2.8**: Create Supabase Storage buckets
  - Create `satellite-imagery` bucket (private, 90-day retention)
  - Create `ndvi-rasters` bucket (private, 30-day retention)
  - Create `kml-exports` bucket (private, 7-day retention)
  - Create `certification-reports` bucket (private, 1-year retention)
  - Configure bucket policies and size limits
  - **Acceptance**: All storage buckets created and accessible

### 1.3 ImageryService Implementation

- [x] **Task 1.3.1**: Create TypeScript types for satellite data
  - Create `lib/satellite/types/index.ts`
  - Define `ImageryData` interface
  - Define `NDVIResult` interface
  - Define `DeforestationEvent` interface
  - Define `TemporalDataPoint` interface
  - Define `YieldPrediction` interface
  - Define error types (ImageryUnavailableError, RateLimitError, etc.)
  - **Acceptance**: All types defined and exported

- [x] **Task 1.3.2**: Implement GEE authentication helper
  - Create `lib/satellite/utils/gee-auth.ts`
  - Implement function to authenticate with service account
  - Implement function to refresh authentication token
  - Add error handling for authentication failures
  - **Acceptance**: Authentication works with service account credentials

- [x] **Task 1.3.3**: Implement ImageryService class
  - Create `lib/satellite/services/imagery.service.ts`
  - Implement `getImagery()` method to retrieve Sentinel-2 imagery
  - Implement `getAvailableDates()` method to list imagery dates
  - Implement `getBands()` method to retrieve specific spectral bands
  - Add cloud cover filtering logic (default 20% threshold)
  - Add error handling and retry logic with exponential backoff
  - **Acceptance**: Service retrieves imagery from GEE successfully

- [x] **Task 1.3.4**: Implement imagery tile generation
  - Add method to convert GEE imagery to tile URL
  - Implement tile caching in Supabase Storage
  - Add tile URL generation for Leaflet/Google Maps
  - Optimize tile size and resolution for web display
  - **Acceptance**: Imagery tiles generated and accessible via URL

- [x] **Task 1.3.5**: Write unit tests for ImageryService
  - Create `tests/satellite/services/imagery.service.test.ts`
  - Mock GEE API responses
  - Test successful imagery retrieval
  - Test cloud cover filtering
  - Test error handling (rate limits, unavailable imagery)
  - Test retry logic
  - **Acceptance**: All tests pass, >80% code coverage

### 1.4 API Endpoints for Imagery

- [x] **Task 1.4.1**: Create GET /api/satellite/imagery endpoint
  - Create `app/api/satellite/imagery/route.ts`
  - Implement GET handler with query parameters (parcelleId, date, cloudCoverThreshold)
  - Add authentication check (Supabase JWT)
  - Add authorization check (user can access parcelle)
  - Call ImageryService to retrieve imagery
  - Return imagery data with cache status
  - Add error handling with proper HTTP status codes
  - **Acceptance**: Endpoint returns imagery data for valid requests

- [x] **Task 1.4.2**: Implement request validation
  - Add Zod schema for request validation
  - Validate parcelleId format (UUID)
  - Validate date format (ISO 8601)
  - Validate cloudCoverThreshold range (0-100)
  - Return 400 Bad Request for invalid inputs
  - **Acceptance**: Invalid requests rejected with clear error messages

- [x] **Task 1.4.3**: Add rate limiting to imagery endpoint
  - Implement rate limiting middleware (100 req/min per user)
  - Track API usage in Redis or memory
  - Return 429 Too Many Requests when limit exceeded
  - Add rate limit headers (X-RateLimit-*)
  - **Acceptance**: Rate limiting enforces limits correctly

- [x] **Task 1.4.4**: Write integration tests for imagery API
  - Create `tests/api/satellite/imagery.test.ts`
  - Test successful imagery retrieval
  - Test authentication requirement
  - Test authorization (user can only access own parcelles)
  - Test rate limiting
  - Test error responses
  - **Acceptance**: All API tests pass

### 1.5 Map Integration

- [x] **Task 1.5.1**: Create SatelliteImageryOverlay component
  - Create `components/satellite/SatelliteImageryOverlay.tsx`
  - Define component props (parcelleId, date, opacity, callbacks)
  - Implement loading state
  - Implement error state with retry button
  - Add opacity slider control (0-100%)
  - **Acceptance**: Component renders with loading/error states

- [x] **Task 1.5.2**: Integrate overlay with LeafletMap
  - Update `components/parcelles/LeafletMap.tsx`
  - Add satellite imagery layer using L.TileLayer
  - Implement layer toggle (show/hide satellite overlay)
  - Add opacity control integration
  - Ensure overlay respects parcelle bounds
  - **Acceptance**: Satellite imagery displays on Leaflet map

- [x] **Task 1.5.3**: Integrate overlay with GoogleMapClient
  - Update `components/parcelles/GoogleMapClient.tsx`
  - Add satellite imagery layer using google.maps.ImageMapType
  - Implement layer toggle (show/hide satellite overlay)
  - Add opacity control integration
  - Ensure overlay respects parcelle bounds
  - **Acceptance**: Satellite imagery displays on Google Maps

- [x] **Task 1.5.4**: Add satellite toggle to MapViewSwitcher
  - Update `components/parcelles/MapViewSwitcher.tsx`
  - Add "Satellite Overlay" toggle button
  - Persist toggle state in component state
  - Pass toggle state to map components
  - **Acceptance**: Users can toggle satellite overlay on/off

- [x] **Task 1.5.5**: Write component tests
  - Create `tests/components/satellite/SatelliteImageryOverlay.test.tsx`
  - Test component rendering
  - Test loading state display
  - Test error state display
  - Test opacity control
  - **Acceptance**: All component tests pass

### 1.6 Phase 1 Documentation

- [x] **Task 1.6.1**: Document GEE setup process
  - Create `docs/satellite/gee-setup.md`
  - Document account creation steps
  - Document service account setup
  - Document credential configuration
  - Add troubleshooting section
  - **Acceptance**: Documentation complete and clear

- [x] **Task 1.6.2**: Document database schema
  - Update `docs/database/schema.md`
  - Document all new satellite tables
  - Document relationships and constraints
  - Add ER diagram for satellite tables
  - **Acceptance**: Schema documentation complete

- [x] **Task 1.6.3**: Document API endpoints
  - Create `docs/api/satellite.md`
  - Document GET /api/satellite/imagery endpoint
  - Include request/response examples
  - Document error codes
  - Add authentication requirements
  - **Acceptance**: API documentation complete

---

## Phase 2: NDVI Calculation (Weeks 3-4)

**Goal**: Implement NDVI calculation, create NDVI visualization layer, and add health status classification.

### 2.1 NDVIService Implementation

- [ ] **Task 2.1.1**: Implement NDVI calculation logic
  - Create `lib/satellite/services/ndvi.service.ts`
  - Implement `calculateNDVI()` method using formula (NIR - Red) / (NIR + Red)
  - Retrieve Sentinel-2 bands B4 (Red) and B8 (NIR) from ImageryService
  - Calculate pixel-wise NDVI values
  - Handle edge cases (division by zero when NIR + Red = 0)
  - **Acceptance**: NDVI calculated correctly for test imagery

- [ ] **Task 2.1.2**: Implement NDVI statistics calculation
  - Add method to calculate mean, min, max, std dev from NDVI array
  - Implement efficient array processing for large parcelles
  - Add validation for minimum pixel count (require at least 10 pixels)
  - **Acceptance**: Statistics calculated correctly for various array sizes

- [ ] **Task 2.1.3**: Implement health status classification
  - Add `calculateHealthStatus()` method
  - Map NDVI ranges to health status: Excellent (0.7-1.0), Good (0.6-0.7), Fair (0.5-0.6), Poor (0.3-0.5), Critical (0.0-0.3)
  - Return health status enum value
  - **Acceptance**: Health status correctly classified for all NDVI ranges

- [ ] **Task 2.1.4**: Implement NDVI caching
  - Add `getCachedNDVI()` method to check database cache
  - Add `cacheNDVI()` method to store results in database
  - Implement 24-hour cache TTL logic
  - Add force recalculate option to bypass cache
  - **Acceptance**: NDVI results cached and retrieved correctly

- [ ] **Task 2.1.5**: Implement NDVI trend calculation
  - Add `getNDVITrend()` method to analyze historical NDVI
  - Calculate trend over past 3 months (improving, stable, declining)
  - Use linear regression or simple comparison logic
  - **Acceptance**: Trend calculated correctly from historical data

- [ ] **Task 2.1.6**: Write property-based tests for NDVI calculation
  - Create `tests/satellite/properties/ndvi.properties.test.ts`
  - Implement Property 2: NDVI calculation formula correctness
  - Implement Property 4: NDVI statistics calculation correctness
  - Use fast-check library with 100+ iterations
  - **Acceptance**: All property tests pass with random inputs

- [ ] **Task 2.1.7**: Write unit tests for NDVIService
  - Create `tests/satellite/services/ndvi.service.test.ts`
  - Test NDVI calculation with known inputs
  - Test statistics calculation
  - Test health status classification
  - Test caching behavior
  - Test error handling
  - **Acceptance**: All tests pass, >80% code coverage

### 2.2 NDVI API Endpoints

- [ ] **Task 2.2.1**: Create POST /api/satellite/ndvi endpoint
  - Create `app/api/satellite/ndvi/route.ts`
  - Implement POST handler with body (parcelleId, date, forceRecalculate)
  - Add authentication and authorization checks
  - Call NDVIService to calculate NDVI
  - Store result in database
  - Return NDVI result with cache status
  - **Acceptance**: Endpoint calculates and returns NDVI data

- [ ] **Task 2.2.2**: Create GET /api/satellite/health-status/:parcelleId endpoint
  - Create `app/api/satellite/health-status/[parcelleId]/route.ts`
  - Implement GET handler to retrieve current health status
  - Include NDVI value, trend, and recommendation
  - Add caching with 24-hour TTL
  - **Acceptance**: Endpoint returns health status for parcelle

- [ ] **Task 2.2.3**: Write integration tests for NDVI API
  - Create `tests/api/satellite/ndvi.test.ts`
  - Test NDVI calculation endpoint
  - Test health status endpoint
  - Test caching behavior
  - Test authorization
  - **Acceptance**: All API tests pass

### 2.3 NDVI Visualization Components

- [ ] **Task 2.3.1**: Create NDVILayer component
  - Create `components/satellite/NDVILayer.tsx`
  - Define component props (parcelleId, date, showLegend, callback)
  - Implement NDVI color mapping (red to dark green gradient)
  - Add legend display with color scale
  - Implement loading and error states
  - **Acceptance**: Component renders NDVI visualization

- [ ] **Task 2.3.2**: Implement NDVI color mapping utility
  - Create `lib/satellite/utils/ndvi-colors.ts`
  - Implement function to map NDVI value to RGB color
  - Use color gradient: red (0.0-0.2), yellow (0.2-0.4), light green (0.4-0.6), green (0.6-0.8), dark green (0.8-1.0)
  - Ensure color-blind friendly palette
  - **Acceptance**: Color mapping works for all NDVI values

- [ ] **Task 2.3.3**: Integrate NDVILayer with LeafletMap
  - Update `components/parcelles/LeafletMap.tsx`
  - Add NDVI layer as overlay using L.ImageOverlay or L.TileLayer
  - Implement layer toggle
  - Add opacity control
  - **Acceptance**: NDVI layer displays on Leaflet map

- [ ] **Task 2.3.4**: Integrate NDVILayer with GoogleMapClient
  - Update `components/parcelles/GoogleMapClient.tsx`
  - Add NDVI layer as overlay using google.maps.GroundOverlay
  - Implement layer toggle
  - Add opacity control
  - **Acceptance**: NDVI layer displays on Google Maps

- [ ] **Task 2.3.5**: Create HealthStatusBadge component
  - Create `components/satellite/HealthStatusBadge.tsx`
  - Define component props (status, showTrend, trend, size)
  - Implement color-coded badge display
  - Add trend indicator (arrow up/down/stable)
  - Support multiple sizes (sm, md, lg)
  - **Acceptance**: Badge displays health status with correct colors

- [ ] **Task 2.3.6**: Write property-based tests for color mapping
  - Create `tests/satellite/properties/ndvi-colors.properties.test.ts`
  - Implement Property 3: NDVI color mapping correctness
  - Test all NDVI ranges map to correct colors
  - **Acceptance**: Property tests pass for color mapping

- [ ] **Task 2.3.7**: Write component tests
  - Create `tests/components/satellite/NDVILayer.test.tsx`
  - Create `tests/components/satellite/HealthStatusBadge.test.tsx`
  - Test component rendering
  - Test color mapping
  - Test legend display
  - **Acceptance**: All component tests pass

### 2.4 Health Status Integration

- [ ] **Task 2.4.1**: Add health status to parcelle list view
  - Update `app/(dashboard)/parcelles/page.tsx`
  - Add HealthStatusBadge column to parcelle table
  - Fetch health status data for visible parcelles
  - Add sorting by health status
  - **Acceptance**: Health status displayed in parcelle list

- [ ] **Task 2.4.2**: Add health status to parcelle detail view
  - Update parcelle detail page component
  - Display large HealthStatusBadge with trend
  - Show NDVI value and last calculation date
  - Add "Recalculate NDVI" button
  - Display health status recommendation
  - **Acceptance**: Health status displayed on detail page

- [ ] **Task 2.4.3**: Add health status to map popups
  - Update map popup component
  - Add HealthStatusBadge to popup content
  - Show NDVI value in popup
  - **Acceptance**: Health status displayed in map popups

- [ ] **Task 2.4.4**: Implement health status filtering
  - Add filter dropdown to parcelle list
  - Allow filtering by health status (Excellent, Good, Fair, Poor, Critical)
  - Update query to filter parcelles
  - **Acceptance**: Users can filter parcelles by health status

### 2.5 Custom Hooks

- [ ] **Task 2.5.1**: Create useNDVI hook
  - Create `hooks/satellite/useNDVI.ts`
  - Implement hook to fetch and calculate NDVI
  - Add loading, error, and data states
  - Implement `calculate()` function to trigger calculation
  - Add automatic calculation option (autoCalculate prop)
  - **Acceptance**: Hook manages NDVI calculation state

- [ ] **Task 2.5.2**: Create useSatelliteImagery hook
  - Create `hooks/satellite/useSatelliteImagery.ts`
  - Implement hook to fetch satellite imagery
  - Add loading, error, and data states
  - Implement `refetch()` function
  - Add cache management
  - **Acceptance**: Hook manages imagery fetching state

- [ ] **Task 2.5.3**: Write hook tests
  - Create `tests/hooks/satellite/useNDVI.test.ts`
  - Create `tests/hooks/satellite/useSatelliteImagery.test.ts`
  - Test hook state management
  - Test loading and error states
  - Test data fetching
  - **Acceptance**: All hook tests pass

### 2.6 Phase 2 Documentation

- [ ] **Task 2.6.1**: Document NDVI calculation
  - Create `docs/satellite/ndvi-calculation.md`
  - Explain NDVI formula and interpretation
  - Document health status thresholds
  - Add examples with imagery
  - **Acceptance**: NDVI documentation complete

- [ ] **Task 2.6.2**: Update API documentation
  - Update `docs/api/satellite.md`
  - Document POST /api/satellite/ndvi endpoint
  - Document GET /api/satellite/health-status endpoint
  - Add request/response examples
  - **Acceptance**: API documentation updated

---

## Phase 3: Temporal Analysis (Weeks 5-6)

**Goal**: Implement temporal slider, add temporal data retrieval, and create change detection logic.

### 3.1 Temporal Data Service

- [ ] **Task 3.1.1**: Implement temporal data retrieval
  - Add `getTemporalData()` method to NDVIService
  - Retrieve NDVI results for date range
  - Support daily, weekly, monthly intervals
  - Fill gaps in data with interpolation or null values
  - **Acceptance**: Temporal data retrieved for date range

- [ ] **Task 3.1.2**: Implement change detection algorithm
  - Add `detectSignificantChanges()` method
  - Identify dates with NDVI change > 0.15 from previous
  - Calculate absolute and percentage change
  - Flag significant changes in timeline
  - **Acceptance**: Significant changes detected correctly

- [ ] **Task 3.1.3**: Implement temporal statistics
  - Add method to calculate overall trend (improving, stable, declining)
  - Calculate total data points and significant changes count
  - Compute average NDVI over period
  - **Acceptance**: Temporal statistics calculated correctly

- [ ] **Task 3.1.4**: Write property-based tests for temporal logic
  - Create `tests/satellite/properties/temporal.properties.test.ts`
  - Implement Property 5: Monthly interval calculation
  - Implement Property 6: NDVI change calculation
  - Implement Property 7: Significant change detection
  - **Acceptance**: All property tests pass

- [ ] **Task 3.1.5**: Write unit tests for temporal service
  - Create `tests/satellite/services/temporal.test.ts`
  - Test temporal data retrieval
  - Test change detection
  - Test trend calculation
  - **Acceptance**: All tests pass, >80% coverage

### 3.2 Temporal API Endpoint

- [ ] **Task 3.2.1**: Create GET /api/satellite/temporal endpoint
  - Create `app/api/satellite/temporal/route.ts`
  - Implement GET handler with query params (parcelleId, startDate, endDate, interval)
  - Add authentication and authorization
  - Call temporal service to retrieve data
  - Return timeline with summary statistics
  - **Acceptance**: Endpoint returns temporal data

- [ ] **Task 3.2.2**: Implement temporal data caching
  - Add Redis caching for temporal queries
  - Use cache key: `temporal:{parcelleId}:{startDate}:{endDate}:{interval}`
  - Set 24-hour TTL
  - Invalidate cache on new NDVI calculation
  - **Acceptance**: Temporal data cached efficiently

- [ ] **Task 3.2.3**: Write integration tests for temporal API
  - Create `tests/api/satellite/temporal.test.ts`
  - Test temporal data retrieval
  - Test different intervals (daily, weekly, monthly)
  - Test caching behavior
  - **Acceptance**: All API tests pass

### 3.3 TemporalSlider Component

- [ ] **Task 3.3.1**: Create TemporalSlider component
  - Create `components/satellite/TemporalSlider.tsx`
  - Define component props (parcelleId, startDate, endDate, interval, onDateChange)
  - Implement slider UI with date markers
  - Add play/pause animation feature
  - Display cloud cover percentage for each date
  - Highlight dates with significant changes
  - **Acceptance**: Slider component renders and functions

- [ ] **Task 3.3.2**: Implement keyboard navigation
  - Add arrow key support (left/right to move between dates)
  - Add space bar to play/pause animation
  - Add home/end keys to jump to start/end
  - **Acceptance**: Keyboard navigation works correctly

- [ ] **Task 3.3.3**: Implement touch gestures for mobile
  - Add swipe gesture support for date navigation
  - Add pinch gesture for zoom (if applicable)
  - Ensure slider is touch-friendly on mobile devices
  - **Acceptance**: Touch gestures work on mobile

- [ ] **Task 3.3.4**: Add temporal data visualization
  - Create line chart showing NDVI over time
  - Highlight current selected date on chart
  - Show significant change markers on chart
  - Add tooltip with NDVI value on hover
  - **Acceptance**: Chart displays temporal NDVI data

- [ ] **Task 3.3.5**: Write component tests
  - Create `tests/components/satellite/TemporalSlider.test.tsx`
  - Test slider rendering
  - Test date selection
  - Test keyboard navigation
  - Test animation
  - **Acceptance**: All component tests pass

### 3.4 Temporal Analysis Integration

- [ ] **Task 3.4.1**: Integrate TemporalSlider with map view
  - Update map page to include TemporalSlider
  - Connect slider date selection to imagery/NDVI display
  - Update map layers when date changes
  - Add loading indicator during date change
  - **Acceptance**: Temporal slider controls map display

- [ ] **Task 3.4.2**: Add temporal analysis to parcelle detail page
  - Add temporal chart to parcelle detail view
  - Display NDVI trend over past 12 months
  - Show significant change events on timeline
  - Add date range selector
  - **Acceptance**: Temporal analysis displayed on detail page

- [ ] **Task 3.4.3**: Implement CSV export for temporal data
  - Add "Export CSV" button to temporal view
  - Generate CSV with columns: date, mean_ndvi, min_ndvi, max_ndvi, change_from_previous
  - Trigger download in browser
  - **Acceptance**: CSV export works correctly

- [ ] **Task 3.4.4**: Write property-based tests for CSV serialization
  - Create `tests/satellite/properties/csv-export.properties.test.ts`
  - Implement Property 8: Temporal CSV serialization
  - Test CSV format correctness
  - **Acceptance**: Property tests pass for CSV export

### 3.5 Custom Hooks

- [ ] **Task 3.5.1**: Create useTemporalAnalysis hook
  - Create `hooks/satellite/useTemporalAnalysis.ts`
  - Implement hook to fetch temporal data
  - Add state for selected date
  - Implement `setSelectedDate()` function
  - Calculate NDVI change from baseline
  - **Acceptance**: Hook manages temporal analysis state

- [ ] **Task 3.5.2**: Write hook tests
  - Create `tests/hooks/satellite/useTemporalAnalysis.test.ts`
  - Test temporal data fetching
  - Test date selection
  - Test change calculation
  - **Acceptance**: All hook tests pass

### 3.6 Phase 3 Documentation

- [ ] **Task 3.6.1**: Document temporal analysis
  - Create `docs/satellite/temporal-analysis.md`
  - Explain temporal slider usage
  - Document change detection algorithm
  - Add examples and screenshots
  - **Acceptance**: Temporal analysis documentation complete

- [ ] **Task 3.6.2**: Update API documentation
  - Update `docs/api/satellite.md`
  - Document GET /api/satellite/temporal endpoint
  - Add request/response examples
  - **Acceptance**: API documentation updated

---

## Phase 4: Deforestation Detection (Weeks 7-8)

**Goal**: Implement deforestation detection algorithm, create alert management system, and add notification system.

### 4.1 DeforestationService Implementation

- [ ] **Task 4.1.1**: Implement deforestation detection algorithm
  - Create `lib/satellite/services/deforestation.service.ts`
  - Implement `detectDeforestation()` method
  - Compare baseline NDVI (Dec 31, 2020) with current NDVI
  - Flag deforestation if NDVI decrease > 0.3 and area > 0.5 hectares
  - Calculate affected area in hectares and percentage
  - **Acceptance**: Deforestation detected correctly for test cases

- [ ] **Task 4.1.2**: Implement baseline imagery retrieval
  - Add method to retrieve EUDR baseline imagery (Dec 31, 2020)
  - Handle case where exact date unavailable (use closest within 60 days)
  - Cache baseline NDVI for each parcelle
  - **Acceptance**: Baseline imagery retrieved and cached

- [ ] **Task 4.1.3**: Implement alert creation
  - Add method to create deforestation_events record
  - Store baseline NDVI, current NDVI, change, affected area
  - Set status to 'pending'
  - Generate alert ID
  - **Acceptance**: Alerts created in database correctly

- [ ] **Task 4.1.4**: Implement alert management methods
  - Add `getAlerts()` method to retrieve alerts for parcelle
  - Add `acknowledgeAlert()` method to mark alert as acknowledged
  - Add `disputeAlert()` method to mark alert as disputed
  - Update alert status and metadata
  - **Acceptance**: Alert management methods work correctly

- [ ] **Task 4.1.5**: Write property-based tests for deforestation detection
  - Create `tests/satellite/properties/deforestation.properties.test.ts`
  - Implement Property 9: Deforestation detection threshold
  - Implement Property 10: Alert record completeness
  - Implement Property 12: Alert status transitions
  - **Acceptance**: All property tests pass

- [ ] **Task 4.1.6**: Write unit tests for DeforestationService
  - Create `tests/satellite/services/deforestation.service.test.ts`
  - Test detection algorithm with various scenarios
  - Test alert creation
  - Test alert management
  - **Acceptance**: All tests pass, >80% coverage

### 4.2 Deforestation API Endpoints

- [ ] **Task 4.2.1**: Create GET /api/satellite/deforestation endpoint
  - Create `app/api/satellite/deforestation/route.ts`
  - Implement GET handler with query params (parcelleId, status)
  - Add authentication and authorization
  - Call DeforestationService to retrieve alerts
  - Return alerts with summary statistics
  - **Acceptance**: Endpoint returns deforestation alerts

- [ ] **Task 4.2.2**: Create POST /api/satellite/deforestation/check endpoint
  - Create `app/api/satellite/deforestation/check/route.ts`
  - Implement POST handler with body (parcelleId, baselineDate, currentDate)
  - Trigger deforestation detection
  - Create alerts if deforestation detected
  - Return new alerts
  - **Acceptance**: Endpoint triggers detection and creates alerts

- [ ] **Task 4.2.3**: Create PATCH /api/satellite/deforestation/:alertId endpoint
  - Create `app/api/satellite/deforestation/[alertId]/route.ts`
  - Implement PATCH handler with body (action, notes, reason)
  - Support 'acknowledge' and 'dispute' actions
  - Update alert status and metadata
  - Log action in audit log
  - **Acceptance**: Endpoint updates alert status correctly

- [ ] **Task 4.2.4**: Write integration tests for deforestation API
  - Create `tests/api/satellite/deforestation.test.ts`
  - Test alert retrieval
  - Test detection trigger
  - Test alert acknowledgment
  - Test alert dispute
  - Test authorization (only managers/agronomists can acknowledge)
  - **Acceptance**: All API tests pass

### 4.3 Deforestation Alert Components

- [ ] **Task 4.3.1**: Create DeforestationAlert component
  - Create `components/satellite/DeforestationAlert.tsx`
  - Define component props (alert, onAcknowledge, onDispute)
  - Display alert details (date, area, NDVI change)
  - Show before/after imagery comparison
  - Add acknowledge and dispute buttons
  - Implement modal for acknowledgment notes
  - **Acceptance**: Component displays alert with actions

- [ ] **Task 4.3.2**: Create alert list view
  - Create component to display list of alerts
  - Group alerts by status (pending, acknowledged, disputed)
  - Add filtering by status and date range
  - Show alert count badges
  - **Acceptance**: Alert list displays all alerts

- [ ] **Task 4.3.3**: Add alerts to parcelle detail page
  - Update parcelle detail page to show deforestation alerts
  - Display alert count badge
  - Show most recent alert prominently
  - Add "View All Alerts" link
  - **Acceptance**: Alerts displayed on parcelle detail page

- [ ] **Task 4.3.4**: Add alert indicators to map
  - Add visual indicator on map for parcelles with pending alerts
  - Use red border or icon to highlight affected parcelles
  - Show alert count in map popup
  - **Acceptance**: Map shows deforestation alert indicators

- [ ] **Task 4.3.5**: Write component tests
  - Create `tests/components/satellite/DeforestationAlert.test.tsx`
  - Test alert display
  - Test acknowledge action
  - Test dispute action
  - **Acceptance**: All component tests pass

### 4.4 Notification System

- [ ] **Task 4.4.1**: Create notification service
  - Create `lib/notifications/notification.service.ts`
  - Implement method to send email notifications
  - Implement method to create in-app notifications
  - Support notification templates
  - **Acceptance**: Notification service sends notifications

- [ ] **Task 4.4.2**: Implement deforestation alert notifications
  - Add notification trigger when deforestation detected
  - Send notification to cooperative manager
  - Send notification to assigned agronomist
  - Include alert details and link to parcelle
  - **Acceptance**: Notifications sent when alerts created

- [ ] **Task 4.4.3**: Implement health status change notifications
  - Add notification trigger when health status declines by 2+ categories
  - Send notification to cooperative manager and planteur
  - Include health status details and recommendations
  - **Acceptance**: Notifications sent for significant health changes

- [ ] **Task 4.4.4**: Create notification preferences UI
  - Add notification settings to user profile page
  - Allow users to configure notification frequency
  - Allow users to set severity thresholds
  - Support email and in-app notification toggles
  - **Acceptance**: Users can configure notification preferences

- [ ] **Task 4.4.5**: Implement notification batching
  - Batch non-critical notifications into daily digest
  - Send critical alerts immediately
  - Avoid notification spam (max 1 digest per day)
  - **Acceptance**: Notifications batched correctly

### 4.5 Background Jobs

- [ ] **Task 4.5.1**: Create periodic deforestation detection job
  - Create background job to check all parcelles for deforestation
  - Run job weekly (configurable schedule)
  - Process parcelles in batches to avoid rate limits
  - Log job execution and results
  - **Acceptance**: Job runs on schedule and detects deforestation

- [ ] **Task 4.5.2**: Implement job monitoring
  - Add logging for job start, progress, completion
  - Track job execution time and success rate
  - Send alert if job fails
  - **Acceptance**: Job execution monitored and logged

### 4.6 Custom Hooks

- [ ] **Task 4.6.1**: Create useDeforestation hook
  - Create `hooks/satellite/useDeforestation.ts`
  - Implement hook to fetch deforestation alerts
  - Add methods to acknowledge and dispute alerts
  - Add method to trigger detection check
  - **Acceptance**: Hook manages deforestation alert state

- [ ] **Task 4.6.2**: Write hook tests
  - Create `tests/hooks/satellite/useDeforestation.test.ts`
  - Test alert fetching
  - Test acknowledge action
  - Test dispute action
  - **Acceptance**: All hook tests pass

### 4.7 Phase 4 Documentation

- [ ] **Task 4.7.1**: Document deforestation detection
  - Create `docs/satellite/deforestation-detection.md`
  - Explain detection algorithm and thresholds
  - Document EUDR compliance requirements
  - Add examples and screenshots
  - **Acceptance**: Deforestation documentation complete

- [ ] **Task 4.7.2**: Update API documentation
  - Update `docs/api/satellite.md`
  - Document deforestation endpoints
  - Add request/response examples
  - **Acceptance**: API documentation updated

---

## Phase 5: Export and Reports (Weeks 9-10)

**Goal**: Implement KML export, create certification report generation, and add yield prediction.

### 5.1 ExportService Implementation

- [ ] **Task 5.1.1**: Implement KML serialization
  - Create `lib/satellite/services/export.service.ts`
  - Implement `exportKML()` method
  - Generate KML XML structure with parcelle geometry
  - Add NDVI color coding to KML styles
  - Include metadata in KML description
  - **Acceptance**: KML files generated correctly

- [ ] **Task 5.1.2**: Implement temporal KML generation
  - Add support for time-enabled KML (TimeSpan elements)
  - Include historical NDVI overlays
  - Format timestamps in ISO 8601
  - **Acceptance**: Temporal KML displays in Google Earth

- [ ] **Task 5.1.3**: Implement batch KML export
  - Add method to export multiple parcelles in single KML
  - Create folder structure in KML for organization
  - Optimize file size for large exports
  - **Acceptance**: Batch KML export works for 10+ parcelles

- [ ] **Task 5.1.4**: Implement CSV export
  - Add `exportTemporalCSV()` method
  - Generate CSV with temporal NDVI data
  - Include columns: date, mean_ndvi, min_ndvi, max_ndvi, std_dev, health_status, change_from_previous
  - Format dates and numbers correctly
  - **Acceptance**: CSV export generates valid CSV files

- [ ] **Task 5.1.5**: Write property-based tests for KML generation
  - Create `tests/satellite/properties/kml.properties.test.ts`
  - Implement Property 13: KML structure and content
  - Implement Property 14: Batch KML completeness
  - Implement Property 15: KML specification compliance
  - Implement Property 16: Time-enabled KML structure
  - **Acceptance**: All property tests pass for KML

- [ ] **Task 5.1.6**: Write unit tests for ExportService
  - Create `tests/satellite/services/export.service.test.ts`
  - Test KML generation
  - Test CSV generation
  - Test batch export
  - **Acceptance**: All tests pass, >80% coverage

### 5.2 Export API Endpoints

- [ ] **Task 5.2.1**: Create POST /api/satellite/export/kml endpoint
  - Create `app/api/satellite/export/kml/route.ts`
  - Implement POST handler with body (parcelleIds, options)
  - Generate KML file
  - Upload to Supabase Storage
  - Return file URL with expiration
  - **Acceptance**: Endpoint generates and returns KML file

- [ ] **Task 5.2.2**: Create POST /api/satellite/export/csv endpoint
  - Create `app/api/satellite/export/csv/route.ts`
  - Implement POST handler with body (parcelleId, startDate, endDate)
  - Generate CSV content
  - Return CSV as downloadable response
  - **Acceptance**: Endpoint returns CSV file

- [ ] **Task 5.2.3**: Write integration tests for export API
  - Create `tests/api/satellite/export.test.ts`
  - Test KML export
  - Test CSV export
  - Test batch export
  - **Acceptance**: All API tests pass

### 5.3 Export UI Components

- [ ] **Task 5.3.1**: Create KMLExportButton component
  - Create `components/satellite/KMLExportButton.tsx`
  - Define component props (parcelleIds, options, onComplete)
  - Add export options modal (include temporal, include NDVI)
  - Show progress indicator during export
  - Trigger download when complete
  - **Acceptance**: Component exports KML on click

- [ ] **Task 5.3.2**: Add export buttons to parcelle views
  - Add KML export button to parcelle detail page
  - Add batch export button to parcelle list page
  - Add CSV export button to temporal analysis view
  - **Acceptance**: Export buttons accessible from relevant views

- [ ] **Task 5.3.3**: Write component tests
  - Create `tests/components/satellite/KMLExportButton.test.tsx`
  - Test button rendering
  - Test export trigger
  - Test progress display
  - **Acceptance**: All component tests pass

### 5.4 Certification Report Generation

- [ ] **Task 5.4.1**: Implement PDF report generation
  - Add `generateCertificationReport()` method to ExportService
  - Use PDF library (e.g., jsPDF, PDFKit) to generate PDF
  - Include parcelle details, deforestation analysis, NDVI trends
  - Add before/after imagery comparison
  - Include compliance status indicator
  - Add digital signature with timestamp
  - **Acceptance**: PDF reports generated correctly

- [ ] **Task 5.4.2**: Implement report templates
  - Create report template for EUDR compliance
  - Support French and English languages
  - Include company branding (logo, colors)
  - Make template customizable
  - **Acceptance**: Reports use professional template

- [ ] **Task 5.4.3**: Implement batch report generation
  - Add method to generate reports for multiple parcelles
  - Create ZIP archive for batch downloads
  - Show progress indicator for batch generation
  - **Acceptance**: Batch report generation works

- [ ] **Task 5.4.4**: Create POST /api/satellite/reports/certification endpoint
  - Create `app/api/satellite/reports/certification/route.ts`
  - Implement POST handler with body (parcelleId, options)
  - Generate PDF report
  - Upload to Supabase Storage
  - Return report URL with expiration
  - Log report generation in audit log
  - **Acceptance**: Endpoint generates certification report

- [ ] **Task 5.4.5**: Add report generation UI
  - Add "Generate Report" button to parcelle detail page
  - Add report options modal (language, include sections)
  - Show progress indicator during generation
  - Display download link when complete
  - **Acceptance**: Users can generate reports from UI

- [ ] **Task 5.4.6**: Write integration tests for reports
  - Create `tests/api/satellite/reports.test.ts`
  - Test report generation
  - Test batch generation
  - Test different options
  - **Acceptance**: All report tests pass

### 5.5 Yield Prediction

- [ ] **Task 5.5.1**: Implement yield prediction model
  - Create `lib/satellite/services/yield-prediction.service.ts`
  - Implement simple regression model based on NDVI
  - Use mean NDVI, NDVI trend, and historical yield data
  - Calculate confidence interval
  - Determine confidence level (high, medium, low)
  - **Acceptance**: Yield predictions generated

- [ ] **Task 5.5.2**: Implement model training
  - Add method to train model with historical data
  - Store model parameters in database
  - Support model versioning
  - **Acceptance**: Model can be trained with new data

- [ ] **Task 5.5.3**: Create yield prediction API endpoint
  - Create `app/api/satellite/yield-prediction/route.ts`
  - Implement POST handler to generate prediction
  - Store prediction in database
  - Return prediction with confidence interval
  - **Acceptance**: Endpoint returns yield prediction

- [ ] **Task 5.5.4**: Add yield prediction to parcelle detail page
  - Display predicted yield in kg/ha
  - Show confidence interval and level
  - Compare with cooperative average
  - Add "Update Actual Yield" form after harvest
  - **Acceptance**: Yield prediction displayed on detail page

- [ ] **Task 5.5.5**: Implement actual yield tracking
  - Add form to input actual yield after harvest
  - Store actual yield in yield_predictions table
  - Use actual yield to improve model accuracy
  - **Acceptance**: Actual yield can be recorded

### 5.6 Phase 5 Documentation

- [ ] **Task 5.6.1**: Document export functionality
  - Create `docs/satellite/export.md`
  - Explain KML export options
  - Document CSV format
  - Add usage examples
  - **Acceptance**: Export documentation complete

- [ ] **Task 5.6.2**: Document certification reports
  - Create `docs/satellite/certification-reports.md`
  - Explain report contents
  - Document EUDR compliance requirements
  - Add report examples
  - **Acceptance**: Report documentation complete

- [ ] **Task 5.6.3**: Update API documentation
  - Update `docs/api/satellite.md`
  - Document export endpoints
  - Document report endpoints
  - Document yield prediction endpoint
  - **Acceptance**: API documentation updated

---

## Phase 6: Caching and Optimization (Weeks 11-12)

**Goal**: Implement multi-layer caching, add offline support, and optimize performance.

### 6.1 IndexedDB Cache Implementation

- [ ] **Task 6.1.1**: Implement IndexedDB cache class
  - Create `lib/satellite/cache/indexeddb-cache.ts`
  - Implement database initialization
  - Create object stores for imagery and NDVI data
  - Add indexes for efficient querying
  - **Acceptance**: IndexedDB database created

- [ ] **Task 6.1.2**: Implement cache storage methods
  - Add `cacheImagery()` method to store imagery blobs
  - Add `cacheNDVI()` method to store NDVI results
  - Add metadata storage (cache date, size)
  - **Acceptance**: Data stored in IndexedDB correctly

- [ ] **Task 6.1.3**: Implement cache retrieval methods
  - Add `getCachedImagery()` method
  - Add `getCachedNDVI()` method
  - Check cache expiration (30-day TTL)
  - **Acceptance**: Cached data retrieved correctly

- [ ] **Task 6.1.4**: Implement LRU eviction
  - Add `evictLRU()` method
  - Track last accessed timestamp
  - Evict oldest entries when limit reached (50 parcelles)
  - Protect favorite parcelles from eviction
  - **Acceptance**: LRU eviction works correctly

- [ ] **Task 6.1.5**: Implement cache management UI
  - Add cache statistics display (size, count, hit rate)
  - Add "Clear Cache" button
  - Add "Refresh Cache" button for selected parcelles
  - Show cache status indicator (cached, stale, not cached)
  - **Acceptance**: Users can manage cache from UI

- [ ] **Task 6.1.6**: Write unit tests for IndexedDB cache
  - Create `tests/satellite/cache/indexeddb-cache.test.ts`
  - Test cache storage and retrieval
  - Test LRU eviction
  - Test expiration handling
  - **Acceptance**: All cache tests pass

### 6.2 Redis Cache Implementation

- [ ] **Task 6.2.1**: Set up Redis connection
  - Add Redis client configuration
  - Add connection pooling
  - Add error handling and reconnection logic
  - **Acceptance**: Redis connection established

- [ ] **Task 6.2.2**: Implement Redis caching in services
  - Add Redis caching to ImageryService
  - Add Redis caching to NDVIService
  - Add Redis caching to temporal queries
  - Use appropriate cache keys and TTLs
  - **Acceptance**: Services use Redis cache

- [ ] **Task 6.2.3**: Implement cache invalidation
  - Add method to invalidate cache on NDVI calculation
  - Add method to invalidate cache on alert acknowledgment
  - Add method to invalidate cache on parcelle update
  - **Acceptance**: Cache invalidated correctly

- [ ] **Task 6.2.4**: Implement cache warming
  - Create background job to pre-cache favorite parcelles
  - Run job daily at 2 AM
  - Pre-cache recent imagery and NDVI
  - Pre-generate temporal data for last 3 months
  - **Acceptance**: Cache warming job runs successfully

- [ ] **Task 6.2.5**: Add cache monitoring
  - Track cache hit rate
  - Track cache size and memory usage
  - Log cache performance metrics
  - Add alerts for low hit rate (<50%)
  - **Acceptance**: Cache performance monitored

### 6.3 Offline Support

- [ ] **Task 6.3.1**: Implement offline detection
  - Add service worker for offline detection
  - Add online/offline event listeners
  - Show offline indicator in UI
  - **Acceptance**: Offline status detected correctly

- [ ] **Task 6.3.2**: Implement offline mode for imagery
  - Serve cached imagery when offline
  - Display "cached data" indicator with cache date
  - Show warning for stale data (>30 days)
  - **Acceptance**: Imagery accessible offline

- [ ] **Task 6.3.3**: Implement offline mode for NDVI
  - Serve cached NDVI results when offline
  - Disable NDVI calculation when offline
  - Show cached data indicator
  - **Acceptance**: NDVI data accessible offline

- [ ] **Task 6.3.4**: Implement request queuing for offline
  - Queue API requests when offline
  - Retry queued requests when back online
  - Show pending request count in UI
  - **Acceptance**: Requests queued and retried correctly

- [ ] **Task 6.3.5**: Test offline functionality
  - Test imagery display offline
  - Test NDVI display offline
  - Test request queuing
  - Test online/offline transitions
  - **Acceptance**: Offline mode works correctly

### 6.4 Performance Optimization

- [ ] **Task 6.4.1**: Optimize imagery loading
  - Implement progressive image loading
  - Use WebP format for smaller file sizes
  - Implement lazy loading for off-screen imagery
  - Add image compression
  - **Acceptance**: Imagery loads faster

- [ ] **Task 6.4.2**: Optimize NDVI calculation
  - Use Web Workers for heavy calculations
  - Implement calculation batching
  - Optimize array processing algorithms
  - **Acceptance**: NDVI calculation faster

- [ ] **Task 6.4.3**: Optimize database queries
  - Add missing indexes
  - Optimize complex queries
  - Use query result caching
  - Implement pagination for large result sets
  - **Acceptance**: Database queries faster

- [ ] **Task 6.4.4**: Implement code splitting
  - Split satellite feature code into separate bundle
  - Lazy load satellite components
  - Reduce initial bundle size
  - **Acceptance**: Initial page load faster

- [ ] **Task 6.4.5**: Run performance tests
  - Use Lighthouse to measure performance
  - Run load tests with k6
  - Test with 50 concurrent users
  - Measure imagery loading time (target <3s p50)
  - Measure NDVI calculation time (target <2s p50)
  - **Acceptance**: Performance targets met

### 6.5 Phase 6 Documentation

- [ ] **Task 6.5.1**: Document caching strategy
  - Create `docs/satellite/caching.md`
  - Explain multi-layer caching architecture
  - Document cache TTLs and eviction policies
  - Add cache management guide
  - **Acceptance**: Caching documentation complete

- [ ] **Task 6.5.2**: Document offline support
  - Create `docs/satellite/offline-mode.md`
  - Explain offline functionality
  - Document limitations in offline mode
  - Add troubleshooting guide
  - **Acceptance**: Offline documentation complete

---

## Phase 7: Testing and Refinement (Weeks 13-14)

**Goal**: Complete test coverage, perform user acceptance testing, and fix bugs.

### 7.1 Property-Based Testing

- [ ] **Task 7.1.1**: Complete all property-based tests
  - Ensure all 23 properties from design document are implemented
  - Run tests with 100+ iterations
  - Fix any failing properties
  - **Acceptance**: All property tests pass

- [ ] **Task 7.1.2**: Add property tests for GeoJSON parsing
  - Create `tests/satellite/properties/geojson.properties.test.ts`
  - Implement Property 21: GeoJSON round-trip preservation
  - Test with various geometry types
  - **Acceptance**: GeoJSON property tests pass

- [ ] **Task 7.1.3**: Add property tests for health status
  - Create `tests/satellite/properties/health-status.properties.test.ts`
  - Implement Property 17: Health status classification and color mapping
  - Implement Property 18: Health status trend calculation
  - Implement Property 19: Health status recommendations
  - Implement Property 20: Health status distribution aggregation
  - **Acceptance**: Health status property tests pass

### 7.2 Integration Testing

- [ ] **Task 7.2.1**: Write E2E tests for imagery display
  - Create `tests/e2e/satellite/imagery-display.spec.ts`
  - Test imagery loading on map
  - Test opacity control
  - Test map switching (Leaflet ↔ Google Maps)
  - **Acceptance**: E2E imagery tests pass

- [ ] **Task 7.2.2**: Write E2E tests for NDVI analysis
  - Create `tests/e2e/satellite/ndvi-analysis.spec.ts`
  - Test NDVI calculation flow
  - Test health status display
  - Test NDVI visualization
  - **Acceptance**: E2E NDVI tests pass

- [ ] **Task 7.2.3**: Write E2E tests for temporal analysis
  - Create `tests/e2e/satellite/temporal-analysis.spec.ts`
  - Test temporal slider interaction
  - Test date selection
  - Test CSV export
  - **Acceptance**: E2E temporal tests pass

- [ ] **Task 7.2.4**: Write E2E tests for deforestation alerts
  - Create `tests/e2e/satellite/deforestation-alerts.spec.ts`
  - Test alert display
  - Test alert acknowledgment
  - Test alert dispute
  - **Acceptance**: E2E deforestation tests pass

- [ ] **Task 7.2.5**: Write E2E tests for export functionality
  - Create `tests/e2e/satellite/export.spec.ts`
  - Test KML export
  - Test CSV export
  - Test report generation
  - **Acceptance**: E2E export tests pass

### 7.3 Performance Testing

- [ ] **Task 7.3.1**: Run load tests
  - Use k6 to simulate 50 concurrent users
  - Test sustained load for 10 minutes
  - Test spike from 10 to 100 users
  - Measure response times and error rates
  - **Acceptance**: System handles load without degradation

- [ ] **Task 7.3.2**: Run stress tests
  - Gradually increase load until system breaks
  - Identify bottlenecks
  - Document breaking point
  - **Acceptance**: Breaking point identified and documented

- [ ] **Task 7.3.3**: Run soak tests
  - Run 20 concurrent users for 2 hours
  - Monitor for memory leaks
  - Monitor cache behavior
  - **Acceptance**: No memory leaks or performance degradation

- [ ] **Task 7.3.4**: Optimize based on test results
  - Fix identified bottlenecks
  - Optimize slow queries
  - Improve caching strategy if needed
  - **Acceptance**: Performance improved

### 7.4 User Acceptance Testing

- [ ] **Task 7.4.1**: Conduct UAT with cooperative managers
  - Recruit 3-5 cooperative managers for testing
  - Provide test scenarios and tasks
  - Collect feedback on satellite imagery display
  - Collect feedback on health status indicators
  - **Acceptance**: UAT completed, feedback collected

- [ ] **Task 7.4.2**: Conduct UAT with agronomists
  - Recruit 2-3 agronomists for testing
  - Test NDVI analysis workflow
  - Test temporal analysis features
  - Test recommendation system
  - **Acceptance**: UAT completed, feedback collected

- [ ] **Task 7.4.3**: Conduct UAT with certification auditors
  - Recruit 1-2 auditors for testing
  - Test deforestation detection
  - Test certification report generation
  - Test EUDR compliance features
  - **Acceptance**: UAT completed, feedback collected

- [ ] **Task 7.4.4**: Conduct UAT with planteurs
  - Recruit 3-5 planteurs for testing
  - Test mobile responsiveness
  - Test health status display
  - Test offline mode
  - **Acceptance**: UAT completed, feedback collected

- [ ] **Task 7.4.5**: Analyze UAT feedback
  - Compile all feedback
  - Prioritize issues and improvements
  - Create bug tickets for critical issues
  - Create enhancement tickets for nice-to-haves
  - **Acceptance**: Feedback analyzed and prioritized

### 7.5 Bug Fixes and Refinements

- [ ] **Task 7.5.1**: Fix critical bugs from UAT
  - Address all P0/P1 bugs
  - Test fixes thoroughly
  - Deploy fixes to staging
  - **Acceptance**: Critical bugs fixed

- [ ] **Task 7.5.2**: Implement high-priority UX improvements
  - Address top UX feedback items
  - Improve error messages
  - Improve loading indicators
  - Improve mobile experience
  - **Acceptance**: UX improvements implemented

- [ ] **Task 7.5.3**: Refine UI based on feedback
  - Adjust colors and styling
  - Improve component layouts
  - Add missing tooltips
  - Improve accessibility
  - **Acceptance**: UI refinements complete

- [ ] **Task 7.5.4**: Optimize mobile experience
  - Test on various mobile devices
  - Fix mobile-specific issues
  - Optimize touch interactions
  - Reduce data usage on mobile
  - **Acceptance**: Mobile experience optimized

### 7.6 Code Quality

- [ ] **Task 7.6.1**: Run code quality checks
  - Run ESLint and fix all errors
  - Run TypeScript compiler and fix all errors
  - Run Prettier to format code
  - **Acceptance**: No linting or type errors

- [ ] **Task 7.6.2**: Improve code coverage
  - Identify untested code paths
  - Write additional tests to reach 80% coverage
  - Focus on critical paths (NDVI, deforestation)
  - **Acceptance**: Code coverage >80%

- [ ] **Task 7.6.3**: Perform code review
  - Review all satellite feature code
  - Check for security vulnerabilities
  - Check for performance issues
  - Ensure code follows best practices
  - **Acceptance**: Code review complete, issues addressed

- [ ] **Task 7.6.4**: Update code documentation
  - Add JSDoc comments to all public methods
  - Document complex algorithms
  - Add inline comments for clarity
  - **Acceptance**: Code well-documented

### 7.7 Phase 7 Documentation

- [ ] **Task 7.7.1**: Document testing strategy
  - Create `docs/satellite/testing.md`
  - Document test types and coverage
  - Document how to run tests
  - Add troubleshooting guide
  - **Acceptance**: Testing documentation complete

- [ ] **Task 7.7.2**: Document known issues
  - Create `docs/satellite/known-issues.md`
  - List any known limitations
  - Document workarounds
  - Add plans for future improvements
  - **Acceptance**: Known issues documented

---

## Phase 8: Documentation and Deployment (Week 15)

**Goal**: Complete documentation, deploy to production, and train users.

### 8.1 User Documentation

- [ ] **Task 8.1.1**: Write user guide for satellite imagery
  - Create `docs/user-guide/satellite-imagery.md`
  - Explain how to view satellite imagery
  - Add screenshots and examples
  - Write in French (primary language)
  - **Acceptance**: User guide complete

- [ ] **Task 8.1.2**: Write user guide for NDVI analysis
  - Create `docs/user-guide/ndvi-analysis.md`
  - Explain NDVI concept in simple terms
  - Explain health status indicators
  - Add interpretation guide
  - **Acceptance**: NDVI guide complete

- [ ] **Task 8.1.3**: Write user guide for temporal analysis
  - Create `docs/user-guide/temporal-analysis.md`
  - Explain how to use temporal slider
  - Explain how to interpret changes
  - Add examples
  - **Acceptance**: Temporal guide complete

- [ ] **Task 8.1.4**: Write user guide for deforestation alerts
  - Create `docs/user-guide/deforestation-alerts.md`
  - Explain alert system
  - Explain how to acknowledge/dispute alerts
  - Add EUDR compliance information
  - **Acceptance**: Deforestation guide complete

- [ ] **Task 8.1.5**: Write user guide for export and reports
  - Create `docs/user-guide/export-reports.md`
  - Explain KML export
  - Explain certification reports
  - Add usage examples
  - **Acceptance**: Export guide complete

### 8.2 Video Tutorials

- [ ] **Task 8.2.1**: Create video tutorial: Getting started with satellite imagery
  - Record 5-minute tutorial
  - Show how to enable satellite overlay
  - Show how to view NDVI
  - Add French voiceover or subtitles
  - **Acceptance**: Video tutorial published

- [ ] **Task 8.2.2**: Create video tutorial: Understanding health status
  - Record 3-minute tutorial
  - Explain health status colors
  - Show how to interpret NDVI values
  - Add recommendations
  - **Acceptance**: Video tutorial published

- [ ] **Task 8.2.3**: Create video tutorial: Temporal analysis
  - Record 4-minute tutorial
  - Show how to use temporal slider
  - Show how to detect changes
  - Show how to export data
  - **Acceptance**: Video tutorial published

- [ ] **Task 8.2.4**: Create video tutorial: Deforestation alerts
  - Record 5-minute tutorial
  - Explain alert system
  - Show how to manage alerts
  - Explain EUDR compliance
  - **Acceptance**: Video tutorial published

### 8.3 API Documentation

- [ ] **Task 8.3.1**: Complete API reference documentation
  - Finalize `docs/api/satellite.md`
  - Document all endpoints with examples
  - Add authentication guide
  - Add error code reference
  - **Acceptance**: API documentation complete

- [ ] **Task 8.3.2**: Generate API documentation site
  - Use tool like Swagger/OpenAPI
  - Generate interactive API docs
  - Deploy to docs subdomain
  - **Acceptance**: Interactive API docs available

- [ ] **Task 8.3.3**: Create API usage examples
  - Create example code in TypeScript
  - Show common use cases
  - Add error handling examples
  - **Acceptance**: API examples complete

### 8.4 Deployment Preparation

- [ ] **Task 8.4.1**: Create deployment checklist
  - List all pre-deployment tasks
  - List all environment variables needed
  - List all database migrations
  - List all third-party services (GEE, Redis)
  - **Acceptance**: Deployment checklist complete

- [ ] **Task 8.4.2**: Set up production environment variables
  - Add GEE credentials to Vercel
  - Add Redis connection string
  - Add Supabase credentials
  - Verify all environment variables
  - **Acceptance**: Production environment configured

- [ ] **Task 8.4.3**: Run database migrations on production
  - Back up production database
  - Run all satellite-related migrations
  - Verify migrations successful
  - Test RLS policies
  - **Acceptance**: Production database migrated

- [ ] **Task 8.4.4**: Create Supabase Storage buckets in production
  - Create all required storage buckets
  - Configure bucket policies
  - Test file upload/download
  - **Acceptance**: Storage buckets created

- [ ] **Task 8.4.5**: Set up monitoring and alerts
  - Configure error tracking (Sentry)
  - Set up performance monitoring
  - Configure alert thresholds
  - Test alert delivery
  - **Acceptance**: Monitoring configured

- [ ] **Task 8.4.6**: Create rollback plan
  - Document rollback procedure
  - Create rollback scripts for migrations
  - Test rollback on staging
  - **Acceptance**: Rollback plan documented and tested

### 8.5 Deployment

- [ ] **Task 8.5.1**: Deploy to staging environment
  - Deploy code to staging
  - Run smoke tests
  - Verify all features work
  - Check performance metrics
  - **Acceptance**: Staging deployment successful

- [ ] **Task 8.5.2**: Perform final QA on staging
  - Test all critical user flows
  - Test on multiple devices and browsers
  - Verify data accuracy
  - Check for any regressions
  - **Acceptance**: QA passed on staging

- [ ] **Task 8.5.3**: Deploy to production
  - Schedule deployment during low-traffic window
  - Deploy code to production
  - Monitor error rates and performance
  - Verify all features work
  - **Acceptance**: Production deployment successful

- [ ] **Task 8.5.4**: Monitor post-deployment
  - Monitor error rates for 24 hours
  - Monitor performance metrics
  - Monitor user feedback
  - Address any critical issues immediately
  - **Acceptance**: No critical issues in first 24 hours

- [ ] **Task 8.5.5**: Announce feature launch
  - Send announcement email to users
  - Post announcement in app
  - Update website with new feature info
  - **Acceptance**: Feature launch announced

### 8.6 User Training

- [ ] **Task 8.6.1**: Conduct training session for cooperative managers
  - Schedule 2-hour training session
  - Cover all satellite features
  - Demonstrate use cases
  - Answer questions
  - Provide training materials
  - **Acceptance**: Training session completed

- [ ] **Task 8.6.2**: Conduct training session for agronomists
  - Schedule 2-hour training session
  - Focus on NDVI analysis and recommendations
  - Demonstrate temporal analysis
  - Cover deforestation detection
  - **Acceptance**: Training session completed

- [ ] **Task 8.6.3**: Conduct training session for certification auditors
  - Schedule 1-hour training session
  - Focus on EUDR compliance features
  - Demonstrate report generation
  - Cover deforestation alerts
  - **Acceptance**: Training session completed

- [ ] **Task 8.6.4**: Create training materials
  - Create PDF training guide
  - Create quick reference cards
  - Create FAQ document
  - Distribute to all users
  - **Acceptance**: Training materials distributed

- [ ] **Task 8.6.5**: Set up support channel
  - Create dedicated support email/chat
  - Train support team on satellite features
  - Create support ticket system
  - **Acceptance**: Support channel operational

### 8.7 Post-Launch Activities

- [ ] **Task 8.7.1**: Gather initial user feedback
  - Send feedback survey to users
  - Monitor support tickets
  - Track feature usage analytics
  - Identify common issues or confusion
  - **Acceptance**: Feedback collected and analyzed

- [ ] **Task 8.7.2**: Create feature adoption dashboard
  - Track key metrics (imagery views, NDVI calculations, exports)
  - Monitor user adoption rate
  - Identify low-adoption features
  - **Acceptance**: Dashboard created and monitored

- [ ] **Task 8.7.3**: Plan iteration 1 improvements
  - Prioritize feedback and issues
  - Create roadmap for next iteration
  - Schedule development work
  - **Acceptance**: Iteration 1 plan created

- [ ] **Task 8.7.4**: Conduct retrospective
  - Review what went well
  - Review what could be improved
  - Document lessons learned
  - Share with team
  - **Acceptance**: Retrospective completed

### 8.8 Final Documentation

- [ ] **Task 8.8.1**: Create project summary document
  - Document feature overview
  - Document architecture decisions
  - Document key metrics and success criteria
  - Document future roadmap
  - **Acceptance**: Project summary complete

- [ ] **Task 8.8.2**: Update README
  - Add satellite feature section to main README
  - Document setup instructions
  - Add links to documentation
  - **Acceptance**: README updated

- [ ] **Task 8.8.3**: Archive project artifacts
  - Archive design documents
  - Archive meeting notes
  - Archive test results
  - Organize in project repository
  - **Acceptance**: Artifacts archived

---

## Ongoing Maintenance Tasks

These tasks should be performed regularly after the initial implementation.

### Weekly Tasks

- [ ] **Monitor GEE API usage**
  - Check daily API usage against limits
  - Monitor for approaching rate limits
  - Optimize queries if usage is high

- [ ] **Review deforestation alerts**
  - Check for new alerts
  - Verify alert accuracy
  - Follow up on pending alerts

- [ ] **Monitor system performance**
  - Check response times
  - Check error rates
  - Check cache hit rates

### Monthly Tasks

- [ ] **Review and update NDVI baselines**
  - Update baseline imagery for new parcelles
  - Verify baseline accuracy
  - Document any baseline adjustments

- [ ] **Analyze feature usage**
  - Review usage analytics
  - Identify underutilized features
  - Plan improvements based on usage

- [ ] **Update documentation**
  - Update user guides based on feedback
  - Add new FAQ entries
  - Update API documentation if needed

### Quarterly Tasks

- [ ] **Rotate GEE API keys**
  - Generate new API keys
  - Update environment variables
  - Remove old keys

- [ ] **Review and optimize caching strategy**
  - Analyze cache performance
  - Adjust TTLs if needed
  - Optimize cache warming

- [ ] **Conduct user satisfaction survey**
  - Survey users on satellite features
  - Collect improvement suggestions
  - Plan enhancements

### Annual Tasks

- [ ] **Validate NDVI accuracy**
  - Collect ground truth measurements
  - Compare with calculated NDVI
  - Adjust algorithms if needed

- [ ] **Validate deforestation detection accuracy**
  - Review all deforestation alerts
  - Compare with manual imagery review
  - Calculate accuracy metrics

- [ ] **Validate yield prediction accuracy**
  - Compare predictions with actual yields
  - Calculate prediction error
  - Retrain model with new data

- [ ] **Review EUDR compliance**
  - Verify compliance with latest EUDR requirements
  - Update reports if regulations change
  - Audit certification reports

---

## Success Metrics Tracking

Track these metrics to measure feature success:

### Technical Metrics

- [ ] **NDVI Calculation Accuracy**: ±5% of ground truth (validate quarterly)
- [ ] **Deforestation Detection Accuracy**: ≥95% (validate annually)
- [ ] **Imagery Loading Time**: <3 seconds (p50), <5 seconds (p95)
- [ ] **NDVI Calculation Time**: <2 seconds (p50), <4 seconds (p95)
- [ ] **System Uptime**: ≥99% (measure monthly)
- [ ] **Cache Hit Rate**: ≥60%
- [ ] **API Usage**: Stay within GEE free tier limits

### User Adoption Metrics

- [ ] **User Adoption Rate**: ≥80% of cooperative managers use feature monthly
- [ ] **Imagery Views**: Track monthly views
- [ ] **NDVI Calculations**: Track monthly calculations
- [ ] **Deforestation Alerts**: Track alert creation and resolution rate
- [ ] **Report Generation**: Track monthly report downloads
- [ ] **Export Usage**: Track KML and CSV exports

### Business Metrics

- [ ] **Yield Prediction Accuracy**: ±15% of actual yield
- [ ] **User Satisfaction**: ≥4.0/5.0 rating (survey quarterly)
- [ ] **Support Tickets**: Track volume and resolution time
- [ ] **Feature Requests**: Track and prioritize
- [ ] **EUDR Compliance**: 100% of parcelles compliant

---

## Risk Mitigation

### Identified Risks and Mitigation Plans

#### Risk 1: Cloud Cover Limiting Imagery Availability
**Mitigation**:
- Implement cloud masking algorithms
- Use image compositing to create cloud-free mosaics
- Prioritize dry season imagery (November-March)
- Set realistic expectations with users about data availability

#### Risk 2: GEE API Rate Limits
**Mitigation**:
- Implement aggressive caching (24-hour TTL)
- Monitor API usage daily
- Implement request queuing when approaching limits
- Prioritize requests by user role
- Consider upgrading to paid tier if needed

#### Risk 3: NDVI Accuracy in Tropical Conditions
**Mitigation**:
- Validate NDVI calculations with ground truth measurements
- Adjust thresholds based on local conditions
- Consider alternative vegetation indices (EVI, SAVI) if needed
- Document accuracy limitations clearly

#### Risk 4: User Adoption Challenges
**Mitigation**:
- Provide comprehensive training
- Create simple, intuitive UI
- Offer ongoing support
- Gather and act on user feedback quickly
- Demonstrate clear value proposition (EUDR compliance, yield improvement)

#### Risk 5: Performance Issues at Scale
**Mitigation**:
- Implement multi-layer caching
- Optimize database queries
- Use background jobs for heavy processing
- Monitor performance continuously
- Scale infrastructure as needed

---

## Appendix: Task Dependencies

### Critical Path

The following tasks are on the critical path and must be completed in order:

1. **Phase 1**: GEE Setup → Database Schema → ImageryService → API Endpoints → Map Integration
2. **Phase 2**: NDVIService → NDVI API → NDVI Components → Health Status Integration
3. **Phase 3**: Temporal Service → Temporal API → TemporalSlider → Integration
4. **Phase 4**: DeforestationService → Deforestation API → Alert Components → Notifications
5. **Phase 5**: ExportService → Export API → Report Generation
6. **Phase 6**: Caching Implementation → Offline Support → Performance Optimization
7. **Phase 7**: Testing → UAT → Bug Fixes
8. **Phase 8**: Documentation → Deployment → Training

### Parallel Work Opportunities

These tasks can be worked on in parallel:

- **Frontend and Backend**: Frontend components can be developed with mocked data while backend services are being implemented
- **Testing**: Unit tests can be written alongside feature development
- **Documentation**: User documentation can be written while features are being developed
- **Multiple Phases**: Different team members can work on different phases simultaneously (e.g., one person on Phase 2 while another works on Phase 3)

---

## Appendix: Estimated Effort

### Total Effort Estimate: 15 weeks (3 months)

**Phase 1**: 2 weeks (80 hours)
**Phase 2**: 2 weeks (80 hours)
**Phase 3**: 2 weeks (80 hours)
**Phase 4**: 2 weeks (80 hours)
**Phase 5**: 2 weeks (80 hours)
**Phase 6**: 2 weeks (80 hours)
**Phase 7**: 2 weeks (80 hours)
**Phase 8**: 1 week (40 hours)

**Total**: 600 hours

### Team Composition Recommendation

- **1 Full-stack Developer**: Lead implementation (all phases)
- **1 Frontend Developer**: UI components and integration (Phases 2-5)
- **1 Backend Developer**: Services and API endpoints (Phases 1-4)
- **1 QA Engineer**: Testing and validation (Phases 6-7)
- **1 Technical Writer**: Documentation (Phase 8)

With this team, the project can be completed in approximately 10-12 weeks with parallel work.

---

## Conclusion

This task list provides a comprehensive breakdown of all implementation work required for the satellite imagery analysis feature. Each task includes clear acceptance criteria to ensure quality and completeness.

**Key Success Factors**:
1. Complete all property-based tests to ensure correctness
2. Implement robust caching to manage API costs
3. Provide excellent user experience with clear visualizations
4. Ensure EUDR compliance for certification requirements
5. Gather and act on user feedback continuously

**Next Steps**:
1. Review and approve this task list
2. Assign tasks to team members
3. Set up project tracking (e.g., Jira, Linear)
4. Begin Phase 1 implementation
5. Hold weekly progress reviews

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-03  
**Status**: Ready for Implementation


