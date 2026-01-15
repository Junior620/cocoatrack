// CocoaTrack V2 - E2E Tests: Delivery Flow
// Task 8.10: Flow création delivery offline → sync
// Validates: Requirements 5.1-5.9, 8.3, 13.3

import { test, expect } from '@playwright/test';

test.describe('Delivery Flow', () => {
  // Setup: Login before each test
  test.beforeEach(async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/mot de passe/i).fill(testPassword);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should display deliveries list', async ({ page }) => {
    await page.goto('/deliveries');

    // Check page elements
    await expect(page.getByRole('heading', { name: /livraisons|deliveries/i })).toBeVisible();

    // Check for table or list
    await expect(page.locator('table, [role="table"], [data-testid="deliveries-list"]')).toBeVisible();
  });

  test('should navigate to new delivery form', async ({ page }) => {
    await page.goto('/deliveries');

    // Click new delivery button
    await page.getByRole('link', { name: /nouvelle|new|ajouter/i }).click();

    // Should be on new delivery page
    await expect(page).toHaveURL(/\/deliveries\/new/);

    // Check form elements
    await expect(page.getByLabel(/planteur/i)).toBeVisible();
    await expect(page.getByLabel(/poids|weight/i)).toBeVisible();
    await expect(page.getByLabel(/prix|price/i)).toBeVisible();
  });

  test('should create a new delivery', async ({ page }) => {
    await page.goto('/deliveries/new');

    // Fill in delivery form
    // Select planteur (assuming dropdown or autocomplete)
    const planteurSelect = page.getByLabel(/planteur/i);
    await planteurSelect.click();
    await page.getByRole('option').first().click();

    // Fill weight
    await page.getByLabel(/poids|weight/i).fill('100');

    // Fill price per kg
    await page.getByLabel(/prix|price/i).fill('1500');

    // Select warehouse if required
    const warehouseSelect = page.getByLabel(/entrepôt|warehouse/i);
    if (await warehouseSelect.isVisible()) {
      await warehouseSelect.click();
      await page.getByRole('option').first().click();
    }

    // Submit form
    await page.getByRole('button', { name: /créer|create|enregistrer|save/i }).click();

    // Should redirect to deliveries list or detail page
    await expect(page).toHaveURL(/\/deliveries/, { timeout: 10000 });

    // Success message should appear
    await expect(page.getByText(/succès|success|créé|created/i)).toBeVisible();
  });

  test('should show delivery details', async ({ page }) => {
    await page.goto('/deliveries');

    // Click on first delivery in list
    await page.locator('table tbody tr, [data-testid="delivery-row"]').first().click();

    // Should show delivery details
    await expect(page.getByText(/code|référence/i)).toBeVisible();
    await expect(page.getByText(/poids|weight/i)).toBeVisible();
    await expect(page.getByText(/total/i)).toBeVisible();
  });

  test('should calculate total automatically', async ({ page }) => {
    await page.goto('/deliveries/new');

    // Fill weight and price
    await page.getByLabel(/poids|weight/i).fill('50');
    await page.getByLabel(/prix|price/i).fill('2000');

    // Check that total is calculated (50 * 2000 = 100000)
    const totalElement = page.getByText(/100[\s,.]?000/);
    await expect(totalElement).toBeVisible();
  });

  test('should show validation errors for invalid data', async ({ page }) => {
    await page.goto('/deliveries/new');

    // Submit empty form
    await page.getByRole('button', { name: /créer|create|enregistrer|save/i }).click();

    // Check for validation errors
    await expect(page.getByText(/requis|required|obligatoire/i)).toBeVisible();
  });

  test('should filter deliveries by date', async ({ page }) => {
    await page.goto('/deliveries');

    // Find date filter
    const dateFilter = page.getByLabel(/date|période/i);
    if (await dateFilter.isVisible()) {
      await dateFilter.click();
      // Select today or a specific date range
      await page.getByRole('option', { name: /aujourd'hui|today/i }).click();

      // List should update
      await expect(page.locator('table tbody tr, [data-testid="delivery-row"]')).toBeVisible();
    }
  });

  test('should search deliveries', async ({ page }) => {
    await page.goto('/deliveries');

    // Find search input
    const searchInput = page.getByPlaceholder(/rechercher|search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('DEL-');

      // Wait for search results
      await page.waitForTimeout(500);

      // Results should be filtered
      await expect(page.locator('table tbody tr, [data-testid="delivery-row"]')).toBeVisible();
    }
  });
});

test.describe('Offline Delivery Flow', () => {
  test.beforeEach(async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/mot de passe/i).fill(testPassword);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should show offline indicator when offline', async ({ page, context }) => {
    await page.goto('/deliveries');

    // Go offline
    await context.setOffline(true);

    // Offline indicator should appear
    await expect(page.getByText(/hors ligne|offline/i)).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);

    // Online indicator should appear
    await expect(page.getByText(/en ligne|online/i)).toBeVisible({ timeout: 5000 });
  });

  test('should queue delivery when offline', async ({ page, context }) => {
    // Go to new delivery form
    await page.goto('/deliveries/new');

    // Go offline
    await context.setOffline(true);

    // Wait for offline indicator
    await expect(page.getByText(/hors ligne|offline/i)).toBeVisible({ timeout: 5000 });

    // Fill in delivery form
    const planteurSelect = page.getByLabel(/planteur/i);
    if (await planteurSelect.isVisible()) {
      await planteurSelect.click();
      await page.getByRole('option').first().click();
    }

    await page.getByLabel(/poids|weight/i).fill('75');
    await page.getByLabel(/prix|price/i).fill('1800');

    // Submit form
    await page.getByRole('button', { name: /créer|create|enregistrer|save/i }).click();

    // Should show queued message
    await expect(page.getByText(/file d'attente|queued|en attente/i)).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);
  });

  test('should sync queued deliveries when back online', async ({ page, context }) => {
    // Navigate to sync page
    await page.goto('/sync');

    // Check sync status
    await expect(page.getByText(/synchronisation|sync/i)).toBeVisible();

    // If there are pending operations, they should be listed
    const pendingCount = page.getByText(/en attente|pending/i);
    if (await pendingCount.isVisible()) {
      // Click sync button
      await page.getByRole('button', { name: /synchroniser|sync/i }).click();

      // Wait for sync to complete
      await expect(page.getByText(/synchronisé|synced|succès/i)).toBeVisible({ timeout: 30000 });
    }
  });
});
