import { test, expect } from '@playwright/test';

test.describe('Layout – sidebar navigation', () => {
  test('sidebar renders all nav links', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav.sidebar');
    await expect(nav.getByRole('link', { name: /home/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /read/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /notes/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /library/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /settings/i })).toBeVisible();
  });

  test('active sidebar link matches the current route', async ({ page }) => {
    await page.goto('/notes');
    const notesLink = page.locator('nav.sidebar').getByRole('link', { name: /notes/i });
    await expect(notesLink).toHaveClass(/active/);
  });

  test('sidebar brand shows "Yeshua" text', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.brand-text')).toContainText('Yeshua');
  });
});

test.describe('Layout – mobile bottom navigation', () => {
  test('bottom nav renders on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('nav.bottom-nav')).toBeVisible();
  });

  test('bottom nav contains the read link', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('nav.bottom-nav').getByRole('link', { name: /read/i })).toBeVisible();
  });
});

test.describe('Layout – skip link', () => {
  test('skip link is in the DOM', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.locator('a.skip-link');
    await expect(skipLink).toBeAttached();
    await expect(skipLink).toHaveAttribute('href', '#main-content');
  });
});

test.describe('Layout – 404', () => {
  test('unknown route shows 404 page with home link', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /go home/i })).toBeVisible();
  });

  test('404 home link navigates back to root', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await page.getByRole('link', { name: /go home/i }).click();
    await expect(page).toHaveURL('/');
  });
});
