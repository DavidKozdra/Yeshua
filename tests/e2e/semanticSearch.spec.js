import { test, expect } from '@playwright/test';

test.describe('Search page – semantic mode', () => {
  test('exposes the semantic mode option', async ({ page }) => {
    await page.goto('/search');
    const modeSelect = page.locator('.search-filters select').first();
    await expect(modeSelect).toBeVisible();
    await expect(modeSelect.locator('option', { hasText: 'Semantic' })).toHaveCount(1);
  });

  test('semantic mode hides keyword-only controls and switches the intro', async ({ page }) => {
    await page.goto('/search?mode=semantic');
    await expect(page.locator('.search-page-intro')).toContainText(/by meaning/i);
    // Translation picker is hidden (semantic locks to KJV).
    await expect(page.locator('#search-translation')).toHaveCount(0);
    // Keyword-only checkboxes are disabled.
    await expect(page.getByText('Exact phrase').locator('..').locator('input')).toBeDisabled();
  });

  test('end-to-end: loads model + embeddings and ranks conceptually related verses', async ({
    page,
  }) => {
    // Regression guard for two real failures this feature hit:
    //  1. transformers.js probing for local model files (tokenizer/config.json) that the
    //     SPA served as index.html -> "Unexpected token '<' ... is not valid JSON".
    //  2. a broken embeddings asset URL returning index.html.
    // The only honest proof is real result cards rendering — NOT just "some state appeared".

    // Any model/asset file served as HTML means a fallback (the root cause) is happening.
    const htmlServedAssets = [];
    page.on('response', (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      if (/tokenizer|config\.json|\.onnx|\.bin|embeddings/i.test(url) && contentType.includes('text/html')) {
        htmlServedAssets.push(url);
      }
    });

    await page.goto('/search?q=do+not+be+afraid&mode=semantic');

    // First run downloads the model from Hugging Face, so allow generous time, but the
    // assertion is strict: real verse cards MUST appear.
    await expect(page.locator('.search-result-card').first()).toBeVisible({ timeout: 120000 });

    // The error/empty state must NOT be what rendered.
    await expect(page.locator('.empty-state')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/Unexpected token|not valid JSON/i);

    // No model or data file may have been served as HTML.
    expect(htmlServedAssets, `assets served as HTML: ${htmlServedAssets.join(', ')}`).toEqual([]);

    // Summary reflects semantic mode (and is grammatically correct).
    await expect(page.locator('.search-summary')).toContainText(/related verses? for/i);
    await expect(page.locator('.search-summary')).not.toContainText(/versees/i);

    // Top hit for "do not be afraid" should be a fear/afraid verse even though the query
    // words don't all appear in it — that's the semantic part.
    await expect(page.locator('.search-result-card').first()).toContainText(/afraid|fear|dread/i);
  });
});
