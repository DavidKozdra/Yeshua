import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('shows the app greeting', async ({ page }) => {
    await page.goto('/');
    // Default greeting when no name is set
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
  });

  test('shows personalised greeting after name is saved', async ({ page }) => {
    // Set a name via settings first
    await page.goto('/settings');
    await page.getByLabel('Profile name').fill('David');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /welcome back, david/i })).toBeVisible();
    // Cleanup
    await page.goto('/settings');
    await page.getByLabel('Profile name').fill('');
    await page.getByRole('button', { name: 'Save' }).click();
  });

  test('shows three recommended reading cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /recommended for today/i })).toBeVisible();
    const cards = page.locator('.reading-card');
    await expect(cards).toHaveCount(3);
  });

  test('clicking a reading card navigates to the reader', async ({ page }) => {
    await page.goto('/');
    const firstCard = page.locator('.reading-card').first();
    await firstCard.click();
    await expect(page).toHaveURL(/\/read\//);
  });

  test('shows Library section with a clickable link', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /open library/i })).toBeVisible();
  });

  test('Library button navigates to /books', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /open library/i }).click();
    await expect(page).toHaveURL(/\/books/);
  });

  test('shows Study & Research section with external links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /study & research/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /bible project/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /blue letter bible/i })).toBeVisible();
  });

  test('shows Continue Reading section after visiting the reader', async ({ page }) => {
    // Visit a chapter first to set lastRead
    await page.goto('/read/kjv/GEN/1');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /continue reading/i })).toBeVisible();
    await expect(page.locator('.continue-card')).toBeVisible();
  });

  test('Continue Reading card navigates back to the reader', async ({ page }) => {
    await page.goto('/read/kjv/GEN/1');
    await page.goto('/');
    await page.locator('.continue-card').first().click();
    await expect(page).toHaveURL(/\/read\//);
  });
});
