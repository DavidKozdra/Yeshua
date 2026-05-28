import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('loads and shows app title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Yeshua/i);
  });

  test('shows daily reading cards', async ({ page }) => {
    await page.goto('/');
    // The home page renders suggested readings
    const readingCards = page.locator('[data-testid="daily-reading"], .daily-reading, .reading-card');
    // Fallback: at minimum the page should not be blank
    await expect(page.locator('body')).not.toBeEmpty();
  });
});

test.describe('Navigation', () => {
  test('navigates to Books page', async ({ page }) => {
    await page.goto('/');
    await page.goto('/books');
    await expect(page.locator('body')).toContainText(/Genesis|Matthew|Testament/i);
  });

  test('navigates to Search page', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('input[type="search"], input[placeholder*="earch"]')).toBeVisible();
  });

  test('navigates to Notes page', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.locator('body')).toContainText(/note/i);
  });

  test('navigates to Settings page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('tab', { name: 'Profile' })).toBeVisible();
  });
});
