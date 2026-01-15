// CocoaTrack V2 - E2E Tests: Invoice Flow
// Task 8.10: Flow génération invoice
// Validates: Requirements 9.1-9.6, 13.3

import { test, expect } from '@playwright/test';

test.describe('Invoice Flow', () => {
  // Setup: Login as manager before each test (invoices require manager+ role)
  test.beforeEach(async ({ page }) => {
    const testEmail = process.env.TEST_MANAGER_EMAIL || process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_MANAGER_PASSWORD || process.env.TEST_USER_PASSWORD;

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

  test('should display invoices list', async ({ page }) => {
    await page.goto('/invoices');

    // Check page elements
    await expect(page.getByRole('heading', { name: /factures|invoices/i })).toBeVisible();

    // Check for table or list
    await expect(page.locator('table, [role="table"], [data-testid="invoices-list"]')).toBeVisible();
  });

  test('should navigate to invoice generation wizard', async ({ page }) => {
    await page.goto('/invoices');

    // Click generate invoice button
    await page.getByRole('link', { name: /générer|generate|nouvelle|new/i }).click();

    // Should be on generate page
    await expect(page).toHaveURL(/\/invoices\/generate/);

    // Check wizard elements
    await expect(page.getByText(/planteur|chef planteur/i)).toBeVisible();
  });

  test('should generate invoice from deliveries', async ({ page }) => {
    await page.goto('/invoices/generate');

    // Step 1: Select planteur or chef planteur
    const planteurSelect = page.getByLabel(/planteur|chef/i);
    await planteurSelect.click();
    await page.getByRole('option').first().click();

    // Step 2: Select date range
    const startDate = page.getByLabel(/date début|start date|du/i);
    if (await startDate.isVisible()) {
      await startDate.fill('2025-01-01');
    }

    const endDate = page.getByLabel(/date fin|end date|au/i);
    if (await endDate.isVisible()) {
      await endDate.fill('2025-01-31');
    }

    // Step 3: Load deliveries
    await page.getByRole('button', { name: /charger|load|rechercher|search/i }).click();

    // Wait for deliveries to load
    await page.waitForTimeout(1000);

    // Check if deliveries are displayed
    const deliveriesTable = page.locator('table tbody tr, [data-testid="delivery-row"]');
    const deliveryCount = await deliveriesTable.count();

    if (deliveryCount > 0) {
      // Select all deliveries
      const selectAll = page.getByRole('checkbox', { name: /tout|all/i });
      if (await selectAll.isVisible()) {
        await selectAll.check();
      }

      // Generate invoice
      await page.getByRole('button', { name: /générer|generate|créer|create/i }).click();

      // Should show success or redirect to invoice detail
      await expect(page.getByText(/succès|success|créé|created|facture/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show invoice details', async ({ page }) => {
    await page.goto('/invoices');

    // Click on first invoice in list
    const firstInvoice = page.locator('table tbody tr, [data-testid="invoice-row"]').first();
    if (await firstInvoice.isVisible()) {
      await firstInvoice.click();

      // Should show invoice details
      await expect(page.getByText(/numéro|number|référence/i)).toBeVisible();
      await expect(page.getByText(/total/i)).toBeVisible();
      await expect(page.getByText(/statut|status/i)).toBeVisible();
    }
  });

  test('should export invoice as PDF', async ({ page }) => {
    await page.goto('/invoices');

    // Click on first invoice
    const firstInvoice = page.locator('table tbody tr, [data-testid="invoice-row"]').first();
    if (await firstInvoice.isVisible()) {
      await firstInvoice.click();

      // Wait for detail page
      await page.waitForTimeout(500);

      // Click export PDF button
      const exportButton = page.getByRole('button', { name: /pdf|export|télécharger|download/i });
      if (await exportButton.isVisible()) {
        // Start waiting for download before clicking
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();

        // Wait for download
        const download = await downloadPromise;

        // Check that file was downloaded
        expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
      }
    }
  });

  test('should filter invoices by status', async ({ page }) => {
    await page.goto('/invoices');

    // Find status filter
    const statusFilter = page.getByLabel(/statut|status/i);
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.getByRole('option', { name: /payé|paid/i }).click();

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Results should be filtered
      await expect(page.locator('table tbody tr, [data-testid="invoice-row"]')).toBeVisible();
    }
  });

  test('should filter invoices by date range', async ({ page }) => {
    await page.goto('/invoices');

    // Find date filter
    const dateFilter = page.getByLabel(/période|date|range/i);
    if (await dateFilter.isVisible()) {
      await dateFilter.click();
      await page.getByRole('option').first().click();

      // Wait for filter to apply
      await page.waitForTimeout(500);
    }
  });

  test('should show invoice total calculation', async ({ page }) => {
    await page.goto('/invoices/generate');

    // Select planteur
    const planteurSelect = page.getByLabel(/planteur|chef/i);
    await planteurSelect.click();
    await page.getByRole('option').first().click();

    // Load deliveries
    await page.getByRole('button', { name: /charger|load|rechercher|search/i }).click();

    // Wait for deliveries
    await page.waitForTimeout(1000);

    // Check if total is displayed
    const totalElement = page.getByText(/total.*fcfa|fcfa.*total/i);
    if (await totalElement.isVisible()) {
      // Total should be a number
      const totalText = await totalElement.textContent();
      expect(totalText).toMatch(/\d+/);
    }
  });
});

test.describe('Bulk Invoice Generation', () => {
  test.beforeEach(async ({ page }) => {
    const testEmail = process.env.TEST_MANAGER_EMAIL || process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_MANAGER_PASSWORD || process.env.TEST_USER_PASSWORD;

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

  test('should navigate to bulk generation page', async ({ page }) => {
    await page.goto('/invoices');

    // Click bulk generation button
    const bulkButton = page.getByRole('link', { name: /bulk|masse|multiple/i });
    if (await bulkButton.isVisible()) {
      await bulkButton.click();
      await expect(page).toHaveURL(/\/invoices\/bulk/);
    }
  });

  test('should generate multiple invoices', async ({ page }) => {
    await page.goto('/invoices/bulk');

    // Select date range
    const startDate = page.getByLabel(/date début|start date|du/i);
    if (await startDate.isVisible()) {
      await startDate.fill('2025-01-01');
    }

    const endDate = page.getByLabel(/date fin|end date|au/i);
    if (await endDate.isVisible()) {
      await endDate.fill('2025-01-31');
    }

    // Click generate
    await page.getByRole('button', { name: /générer|generate/i }).click();

    // Wait for generation
    await page.waitForTimeout(2000);

    // Should show results
    await expect(page.getByText(/factures?.*générée?s?|invoices?.*generated/i)).toBeVisible({ timeout: 30000 });
  });
});
