import { test, expect } from '@playwright/test';

test.describe('Global Search Bar', () => {
  test('is visible on the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.global-search-shell')).toBeVisible();
  });

  test('is visible on the Notes page', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.locator('.global-search-shell')).toBeVisible();
  });

  test('is hidden on the reader route', async ({ page }) => {
    await page.goto('/read/kjv/GEN/1');
    await expect(page.locator('.global-search-shell')).not.toBeVisible();
  });

  test('navigates to full-text search for a phrase', async ({ page }) => {
    await page.goto('/');
    const bar = page.locator('.global-search-form input[type="text"]').first();
    await bar.fill('shepherd');
    await page.locator('.global-search-form button[type="submit"]').first().click();
    await expect(page).toHaveURL(/\/search\?q=shepherd/);
  });

  test('jumps directly to the reader for a valid reference (Genesis 1)', async ({ page }) => {
    await page.goto('/');
    const bar = page.locator('.global-search-form input[type="text"]').first();
    await bar.fill('Genesis 1');
    await page.locator('.global-search-form button[type="submit"]').first().click();
    await expect(page).toHaveURL(/\/read\/.*\/GEN\/1/);
  });

  test('jumps to correct chapter for a verse reference (John 3:16)', async ({ page }) => {
    await page.goto('/');
    const bar = page.locator('.global-search-form input[type="text"]').first();
    await bar.fill('John 3:16');
    await page.locator('.global-search-form button[type="submit"]').first().click();
    await expect(page).toHaveURL(/\/read\/.*\/JHN\/3/);
  });

  test('shows error for a single-character query', async ({ page }) => {
    await page.goto('/');
    const bar = page.locator('.global-search-form input[type="text"]').first();
    await bar.fill('a');
    await page.locator('.global-search-form button[type="submit"]').first().click();
    await expect(page.locator('.global-search-error')).toContainText(/at least 2/i);
  });

  test('error clears when the user starts typing again', async ({ page }) => {
    await page.goto('/');
    const bar = page.locator('.global-search-form input[type="text"]').first();
    await bar.fill('a');
    await page.locator('.global-search-form button[type="submit"]').first().click();
    await expect(page.locator('.global-search-error')).toBeVisible();
    await bar.fill('ab');
    await expect(page.locator('.global-search-error')).not.toBeVisible();
  });

  test('search bar syncs with the URL query when on /search', async ({ page }) => {
    await page.goto('/search?q=grace&translation=kjv');
    const bar = page.locator('.global-search-form input[type="text"]').first();
    await expect(bar).toHaveValue('grace');
  });
});
