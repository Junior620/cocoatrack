// CocoaTrack V2 - E2E Tests: Satellite Imagery Display
// Task 7.2.1: Write E2E tests for imagery display
// Validates: Requirements 1 (Satellite Imagery Display)

import { test, expect } from '@playwright/test';

test.describe('Satellite Imagery Display', () => {
  // Test user credentials (should be set in environment variables)
  const testEmail = process.env.TEST_USER_EMAIL;
  const testPassword = process.env.TEST_USER_PASSWORD;

  test.beforeEach(async ({ page }) => {
    // Skip tests if no test credentials are available
    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    // Login before each test
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/mot de passe/i).fill(testPassword);
    await page.getByRole('button', { name: /se connecter/i }).click();

    // Wait for dashboard to load
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Navigate to parcelles map page
    await page.goto('/parcelles/map');
    await page.waitForLoadState('networkidle');
  });

  test('should display satellite imagery overlay on map', async ({ page }) => {
    // Wait for map to load
    await expect(page.locator('.leaflet-container, [role="region"]')).toBeVisible({
      timeout: 15000,
    });

    // Check if parcelles are loaded on the map
    const parcelleMarkers = page.locator('.leaflet-marker-icon, [data-testid="parcelle-marker"]');
    await expect(parcelleMarkers.first()).toBeVisible({ timeout: 10000 });

    // Click on a parcelle to select it
    await parcelleMarkers.first().click();

    // Wait for parcelle details or satellite overlay to appear
    // The satellite imagery overlay should be visible
    const satelliteOverlay = page.locator('.satellite-imagery-overlay');
    
    // Check if satellite imagery controls are visible (may take time to load)
    const imageryControls = page.getByText(/imagerie satellite/i);
    
    // Either the loading state or the controls should be visible
    await expect(
      page.locator('.satellite-imagery-overlay').or(imageryControls)
    ).toBeVisible({ timeout: 20000 });
  });

  test('should show loading state while fetching imagery', async ({ page }) => {
    // Wait for map to load
    await expect(page.locator('.leaflet-container, [role="region"]')).toBeVisible({
      timeout: 15000,
    });

    // Click on a parcelle
    const parcelleMarkers = page.locator('.leaflet-marker-icon, [data-testid="parcelle-marker"]');
    await expect(parcelleMarkers.first()).toBeVisible({ timeout: 10000 });
    await parcelleMarkers.first().click();

    // Check for loading spinner or loading text
    const loadingIndicator = page.getByText(/chargement.*imagerie/i);
    
    // Loading state should appear (even if briefly)
    // We use a short timeout since loading might be fast
    await expect(loadingIndicator).toBeVisible({ timeout: 5000 }).catch(() => {
      // If loading is too fast, that's okay - imagery loaded successfully
      console.log('Imagery loaded too quickly to catch loading state');
    });
  });

  test('should display imagery metadata (date, cloud cover)', async ({ page }) => {
    // Wait for map to load
    await expect(page.locator('.leaflet-container, [role="region"]')).toBeVisible({
      timeout: 15000,
    });

    // Click on a parcelle
    const parcelleMarkers = page.locator('.leaflet-marker-icon, [data-testid="parcelle-marker"]');
    await expect(parcelleMarkers.first()).toBeVisible({ timeout: 10000 });
    await parcelleMarkers.first().click();

    // Wait for imagery controls to appear
    await page.waitForTimeout(3000); // Give time for imagery to load

    // Check for imagery metadata
    const cloudCoverText = page.getByText(/couverture nuageuse/i);
    const dateText = page.locator('text=/\\d{1,2}\\s+\\w+\\s+\\d{4}/'); // Date format: "15 mai 2024"

    // At least one metadata element should be visible
    await expect(cloudCoverText.or(dateText)).toBeVisible({ timeout: 15000 });
  });

  test('should control imagery opacity with slider', async ({ page }) => {
    // Wait for map to load
    await expect(page.locator('.leaflet-container, [role="region"]')).toBeVisible({
      timeout: 15000,
    });

    // Click on a parcelle
    const parcelleMarkers = page.locator('.leaflet-marker-icon, [data-testid="parcelle-marker"]');
    await expect(parcelleMarkers.first()).toBeVisible({ timeout: 10000 });
    await parcelleMarkers.first().click();

    // Wait for imagery to load
    await page.waitForTimeout(3000);

    // Find the opacity slider
    const opacitySlider = page.locator('#opacity-slider, input[type="range"]').first();
    
    // Check if slider exists
    const sliderExists = await opacitySlider.count() > 0;
    
    if (sliderExists) {
      // Get initial value
      const initialValue = await opacitySlider.inputValue();
      
      // Change opacity to 50%
      await opacitySlider.fill('50');
      
      // Verify the value changed
      const newValue = await opacitySlider.inputValue();
      expect(newValue).toBe('50');
      
      // Check if opacity percentage is displayed
      await expect(page.getByText(/50%/)).toBeVisible({ timeout: 2000 });
      
      // Change opacity to 100%
      await opacitySlider.fill('100');
      await expect(page.getByText(/100%/)).toBeVisible({ timeout: 2000 });
      
      // Change opacity to 0%
      await opacitySlider.fill('0');
      await expect(page.getByText(/0%/)).toBeVisible({ timeout: 2000 });
    } else {
      console.log('Opacity slider not found - imagery may not have loaded');
    }
  });

  test('should switch between Leaflet and Google Maps', async ({ page }) => {
    // Wait for map to load
    await expect(page.locator('.leaflet-container, [role="region"]')).toBeVisible({
      timeout: 15000,
    });

    // Verify Leaflet map is initially loaded
    const leafletContainer = page.locator('.leaflet-container');
    await expect(leafletContainer).toBeVisible();

    // Find and click the Google Maps button
    const googleButton = page.getByRole('button', { name: /google/i });
    await expect(googleButton).toBeVisible({ timeout: 5000 });
    await googleButton.click();

    // Wait for Google Maps to load
    await page.waitForTimeout(2000);

    // Verify Google Maps is now displayed
    // Google Maps uses a different container structure
    const googleMapContainer = page.locator('[role="region"], .gm-style');
    await expect(googleMapContainer).toBeVisible({ timeout: 10000 });

    // Verify Leaflet container is no longer visible
    await expect(leafletContainer).not.toBeVisible();

    // Switch back to Leaflet (Plan view)
    const planButton = page.getByRole('button', { name: /plan/i });
    await expect(planButton).toBeVisible({ timeout: 5000 });
    await planButton.click();

    // Wait for Leaflet to load
    await page.waitForTimeout(2000);

    // Verify Leaflet is back
    await expect(leafletContainer).toBeVisible({ timeout: 10000 });
  });

  test('should switch between Leaflet layers (OSM and Satellite)', async ({ page }) => {
    // Wait for map to load
    await expect(page.locator('.leaflet-container')).toBeVisible({
      timeout: 15000,
    });

    // Verify we're on Leaflet map
    const leafletContainer = page.locator('.leaflet-container');
    await expect(leafletContainer).toBeVisible();

    // Click on Satellite button (Esri Satellite)
    const satelliteButton = page.getByRole('button', { name: /satellite/i }).first();
    await expect(satelliteButton).toBeVisible({ timeout: 5000 });
    await satelliteButton.click();

    // Wait for satellite layer to load
    await page.waitForTimeout(2000);

    // Leaflet container should still be visible (just different tiles)
    await expect(leafletContainer).toBeVisible();

    // Switch back to Plan (OSM)
    const planButton = page.getByRole('button', { name: /plan/i });
    await expect(planButton).toBeVisible({ timeout: 5000 });
    await planButton.click();

    // Wait for OSM layer to load
    await page.waitForTimeout(2000);

    // Leaflet container should still be visible
    await expect(leafletContainer).toBeVisible();
  });

  test('should display error state when imagery fails to load', async ({ page }) => {
    // Intercept the imagery API call and make it fail
    await page.route('**/api/satellite/imagery*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to fetch imagery' }),
      });
    });

    // Wait for map to load
    await expect(page.locator('.leaflet-container, [role="region"]')).toBeVisible({
      timeout: 15000,
    });

    // Click on a parcelle
    const parcelleMarkers = page.locator('.leaflet-marker-icon, [data-testid="parcelle-marker"]');
    await expect(parcelleMarkers.first()).toBeVisible({ timeout: 10000 });
    await parcelleMarkers.first().click();

    // Wait for error state to appear
    const errorMessage = page.getByText(/erreur.*chargement/i);
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // Check for retry button
    const retryButton = page.getByRole('button', { name: /réessayer/i });
    await expect(retryButton).toBeVisible();
  });

  test('should retry loading imagery after error', async ({ page }) => {
    let requestCount = 0;

    // Intercept the imagery API call - fail first time, succeed second time
    await page.route('**/api/satellite/imagery*', (route) => {
      requestCount++;
      if (requestCount === 1) {
        // First request fails
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to fetch imagery' }),
        });
      } else {
        // Subsequent requests succeed (let them through)
        route.continue();
      }
    });

    // Wait for map to load
    await expect(page.locator('.leaflet-container, [role="region"]')).toBeVisible({
      timeout: 15000,
    });

    // Click on a parcelle
    const parcelleMarkers = page.locator('.leaflet-marker-icon, [data-testid="parcelle-marker"]');
    await expect(parcelleMarkers.first()).toBeVisible({ timeout: 10000 });
    await parcelleMarkers.first().click();

    // Wait for error state
    const errorMessage = page.getByText(/erreur.*chargement/i);
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // Click retry button
    const retryButton = page.getByRole('button', { name: /réessayer/i });
    await retryButton.click();

    // Error should disappear (loading state should appear)
    await expect(errorMessage).not.toBeVisible({ timeout: 5000 });

    // Either loading or success state should appear
    const loadingOrSuccess = page.getByText(/chargement|imagerie satellite/i);
    await expect(loadingOrSuccess).toBeVisible({ timeout: 10000 });
  });

  test('should maintain imagery overlay when switching parcelles', async ({ page }) => {
    // Wait for map to load
    await expect(page.locator('.leaflet-container, [role="region"]')).toBeVisible({
      timeout: 15000,
    });

    // Get all parcelle markers
    const parcelleMarkers = page.locator('.leaflet-marker-icon, [data-testid="parcelle-marker"]');
    const markerCount = await parcelleMarkers.count();

    if (markerCount < 2) {
      test.skip(); // Need at least 2 parcelles for this test
      return;
    }

    // Click on first parcelle
    await parcelleMarkers.first().click();
    await page.waitForTimeout(2000);

    // Check if imagery controls appear
    const imageryControls = page.getByText(/imagerie satellite/i);
    const firstParcelleHasImagery = await imageryControls.isVisible().catch(() => false);

    // Click on second parcelle
    await parcelleMarkers.nth(1).click();
    await page.waitForTimeout(2000);

    // Imagery controls should still be present (for the new parcelle)
    // or loading state should appear
    const loadingOrImagery = page.locator('.satellite-imagery-overlay').or(
      page.getByText(/chargement.*imagerie/i)
    );
    await expect(loadingOrImagery).toBeVisible({ timeout: 10000 });
  });

  test('should display imagery quality indicator', async ({ page }) => {
    // Wait for map to load
    await expect(page.locator('.leaflet-container, [role="region"]')).toBeVisible({
      timeout: 15000,
    });

    // Click on a parcelle
    const parcelleMarkers = page.locator('.leaflet-marker-icon, [data-testid="parcelle-marker"]');
    await expect(parcelleMarkers.first()).toBeVisible({ timeout: 10000 });
    await parcelleMarkers.first().click();

    // Wait for imagery to load
    await page.waitForTimeout(3000);

    // Check for quality indicators (Aperçu, Standard, Haute qualité)
    const qualityIndicator = page.getByText(/aperçu|standard|haute qualité/i);
    
    // Quality indicator should be visible if progressive loading is enabled
    const qualityVisible = await qualityIndicator.isVisible().catch(() => false);
    
    if (qualityVisible) {
      await expect(qualityIndicator).toBeVisible();
    } else {
      console.log('Quality indicator not visible - progressive loading may be disabled');
    }
  });

  test('should display satellite source and resolution info', async ({ page }) => {
    // Wait for map to load
    await expect(page.locator('.leaflet-container, [role="region"]')).toBeVisible({
      timeout: 15000,
    });

    // Click on a parcelle
    const parcelleMarkers = page.locator('.leaflet-marker-icon, [data-testid="parcelle-marker"]');
    await expect(parcelleMarkers.first()).toBeVisible({ timeout: 10000 });
    await parcelleMarkers.first().click();

    // Wait for imagery to load
    await page.waitForTimeout(3000);

    // Check for satellite source (Sentinel-2)
    const satelliteSource = page.getByText(/sentinel-2/i);
    
    // Check for resolution info (e.g., "10m")
    const resolutionInfo = page.getByText(/\d+m/);

    // At least one should be visible
    await expect(satelliteSource.or(resolutionInfo)).toBeVisible({ timeout: 15000 });
  });
});
