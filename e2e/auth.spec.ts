// CocoaTrack V2 - E2E Tests: Authentication Flow
// Task 8.10: Flow login → dashboard
// Validates: Requirements 2.1, 2.2, 13.3

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    // Check login form elements
    await expect(page.getByRole('heading', { name: /connexion/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /se connecter/i })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/login');

    // Submit empty form
    await page.getByRole('button', { name: /se connecter/i }).click();

    // Check for validation errors
    await expect(page.getByText(/email.*requis|required/i)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel(/mot de passe/i).fill('wrongpassword');
    await page.getByRole('button', { name: /se connecter/i }).click();

    // Check for error message
    await expect(page.getByText(/invalide|incorrect|erreur/i)).toBeVisible({ timeout: 10000 });
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected route
    await page.goto('/dashboard');

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    // Note: This test requires a valid test user in the database
    // Skip if no test credentials are available
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    await page.goto('/login');

    // Fill in valid credentials
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/mot de passe/i).fill(testPassword);
    await page.getByRole('button', { name: /se connecter/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Dashboard should be visible
    await expect(page.getByRole('heading', { name: /tableau de bord|dashboard/i })).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Note: This test requires a valid test user in the database
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    // Login first
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/mot de passe/i).fill(testPassword);
    await page.getByRole('button', { name: /se connecter/i }).click();

    // Wait for dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Click logout button
    await page.getByRole('button', { name: /déconnexion|logout/i }).click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
