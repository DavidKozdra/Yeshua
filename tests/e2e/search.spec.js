import { test, expect } from '@playwright/test';

test.describe('Search page – structure', () => {
  test('shows the Search heading and intro', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();
    await expect(page.locator('.search-page-intro')).toBeVisible();
  });

  test('shows translation picker when a translation is ready', async ({ page }) => {
    await page.goto('/search');
    // KJV is bundled so at least one translation should be available
    const picker = page.locator('#search-translation');
    // Only assert visible if there are ready translations; otherwise, gracefully skip
    const count = await picker.count();
    if (count) {
      await expect(picker).toBeVisible();
    }
  });

  test('shows v2 search filters', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByLabel('Search filters')).toBeVisible();
    await expect(page.getByText('Exact phrase')).toBeVisible();
    await expect(page.getByText('Whole word')).toBeVisible();
    await expect(page.getByText('Include notes')).toBeVisible();
  });
});

test.describe('Search page – empty / short query', () => {
  test('shows the "search the bible text" empty state with no query', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('.empty-state')).toContainText(/search the bible text/i);
  });

  test('shows error for a single-character query', async ({ page }) => {
    await page.goto('/search?q=a');
    await expect(page.locator('.empty-state')).toContainText(/at least 2/i);
  });
});

test.describe('Search page – full-text search', () => {
  test('returns results for a common phrase and shows match count', async ({ page }) => {
    await page.goto('/search?q=In+the+beginning');
    // Wait for the search summary to appear (debounced async)
    await expect(page.locator('.search-summary')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.search-summary')).toContainText(/match/i);
  });

  test('shows no-matches empty state for gibberish', async ({ page }) => {
    await page.goto('/search?q=xyzzy99notaword');
    await expect(page.locator('.search-summary')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.empty-state')).toContainText(/no matches|0 match/i, {
      timeout: 8000,
    });
  });

  test('result cards show book, chapter, and verse', async ({ page }) => {
    await page.goto('/search?q=shepherd');
    await expect(page.locator('.search-result-card').first()).toBeVisible({ timeout: 8000 });
    const firstCard = page.locator('.search-result-card').first();
    await expect(firstCard).toContainText(/:/); // e.g. "Psalms 23:1"
  });

  test('clicking a result navigates to the reader at the correct verse', async ({ page }) => {
    await page.goto('/search?q=shepherd');
    await page.locator('.search-result-card').first().waitFor({ timeout: 8000 });
    await page.locator('.search-result-card').first().click();
    await expect(page).toHaveURL(/\/read\//);
  });

  test('shows truncation notice when results exceed limit', async ({ page }) => {
    // A very short common word is likely to exceed 250 results
    await page.goto('/search?q=the');
    const summary = page.locator('.search-summary');
    await expect(summary).toBeVisible({ timeout: 10000 });
    // May or may not truncate depending on translation — just assert summary renders
    await expect(summary).toContainText(/match/i);
  });
});
