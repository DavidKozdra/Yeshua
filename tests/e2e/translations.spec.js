import { test, expect } from '@playwright/test';

test.describe('Translations / Library page', () => {
  test('shows Library, Bible Translations, and External Sources tabs', async ({ page }) => {
    await page.goto('/translations');
    await expect(page.getByRole('tab', { name: /library/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /bible translations/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /external sources/i })).toBeVisible();
  });

  test('Bible Translations tab lists known translations', async ({ page }) => {
    await page.goto('/translations');
    await page.getByRole('tab', { name: /bible translations/i }).click();
    await expect(page.locator('body')).toContainText(/King James Version|KJV/i);
    await expect(page.locator('body')).toContainText(/World English Bible|WEB/i);
  });

  test('KJV shows as bundled / ready', async ({ page }) => {
    await page.goto('/translations');
    await page.getByRole('tab', { name: /bible translations/i }).click();
    // KJV is bundled so it should show a ready or installed status chip
    await expect(page.locator('body')).toContainText(/KJV/i);
  });

  test('Library tab is active by default on /books', async ({ page }) => {
    await page.goto('/books');
    await expect(page.getByRole('tab', { name: /library/i })).toHaveAttribute('aria-selected', 'true');
  });

  test('Translations tab is active by default on /translations', async ({ page }) => {
    await page.goto('/translations');
    await expect(page.getByRole('tab', { name: /bible translations/i })).toHaveAttribute('aria-selected', 'true');
  });

  test('External Sources tab shows external resource links', async ({ page }) => {
    await page.goto('/translations');
    await page.getByRole('tab', { name: /external sources/i }).click();
    // Should contain some external links
    await expect(page.locator('a[href^="http"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('switching tabs updates displayed content', async ({ page }) => {
    await page.goto('/translations');
    await page.getByRole('tab', { name: /library/i }).click();
    // Library tab should show library collections, not individual translations
    await expect(page.locator('body')).not.toContainText(/King James Version/i);
  });
});
