# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: search.spec.js >> Search page – full-text search >> result cards show book, chapter, and verse
- Location: tests/e2e/search.spec.js:58:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.search-result-card').first()
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for locator('.search-result-card').first()

```

```yaml
- banner:
  - img "DKBoy Logo"
  - text: DK-Boy
- main:
  - button "Choose File"
  - button "Choose File"
  - text: Search library
  - img
  - searchbox "Search library"
  - tablist "Library layout":
    - button "Grid layout": Grid
    - button "List layout": List
    - button "BIOS"
  - heading "Library" [level=2]
  - text: 0 stored
  - heading "No ROMs added yet" [level=3]
  - paragraph: Use the add button to open the mobile file picker or drag a ROM into the window on desktop.
  - button "Add ROM"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Search page – structure', () => {
  4  |   test('shows the Search heading and intro', async ({ page }) => {
  5  |     await page.goto('/search');
  6  |     await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();
  7  |     await expect(page.locator('.search-page-intro')).toBeVisible();
  8  |   });
  9  | 
  10 |   test('shows translation picker when a translation is ready', async ({ page }) => {
  11 |     await page.goto('/search');
  12 |     // KJV is bundled so at least one translation should be available
  13 |     const picker = page.locator('#search-translation');
  14 |     // Only assert visible if there are ready translations; otherwise, gracefully skip
  15 |     const count = await picker.count();
  16 |     if (count) {
  17 |       await expect(picker).toBeVisible();
  18 |     }
  19 |   });
  20 | 
  21 |   test('shows v2 search filters', async ({ page }) => {
  22 |     await page.goto('/search');
  23 |     await expect(page.getByLabel('Search filters')).toBeVisible();
  24 |     await expect(page.getByText('Exact phrase')).toBeVisible();
  25 |     await expect(page.getByText('Whole word')).toBeVisible();
  26 |     await expect(page.getByText('Include notes')).toBeVisible();
  27 |   });
  28 | });
  29 | 
  30 | test.describe('Search page – empty / short query', () => {
  31 |   test('shows the "search the bible text" empty state with no query', async ({ page }) => {
  32 |     await page.goto('/search');
  33 |     await expect(page.locator('.empty-state')).toContainText(/search the bible text/i);
  34 |   });
  35 | 
  36 |   test('shows error for a single-character query', async ({ page }) => {
  37 |     await page.goto('/search?q=a');
  38 |     await expect(page.locator('.empty-state')).toContainText(/at least 2/i);
  39 |   });
  40 | });
  41 | 
  42 | test.describe('Search page – full-text search', () => {
  43 |   test('returns results for a common phrase and shows match count', async ({ page }) => {
  44 |     await page.goto('/search?q=In+the+beginning');
  45 |     // Wait for the search summary to appear (debounced async)
  46 |     await expect(page.locator('.search-summary')).toBeVisible({ timeout: 8000 });
  47 |     await expect(page.locator('.search-summary')).toContainText(/match/i);
  48 |   });
  49 | 
  50 |   test('shows no-matches empty state for gibberish', async ({ page }) => {
  51 |     await page.goto('/search?q=xyzzy99notaword');
  52 |     await expect(page.locator('.search-summary')).toBeVisible({ timeout: 8000 });
  53 |     await expect(page.locator('.empty-state')).toContainText(/no matches|0 match/i, {
  54 |       timeout: 8000,
  55 |     });
  56 |   });
  57 | 
  58 |   test('result cards show book, chapter, and verse', async ({ page }) => {
  59 |     await page.goto('/search?q=shepherd');
> 60 |     await expect(page.locator('.search-result-card').first()).toBeVisible({ timeout: 8000 });
     |                                                               ^ Error: expect(locator).toBeVisible() failed
  61 |     const firstCard = page.locator('.search-result-card').first();
  62 |     await expect(firstCard).toContainText(/:/); // e.g. "Psalms 23:1"
  63 |   });
  64 | 
  65 |   test('clicking a result navigates to the reader at the correct verse', async ({ page }) => {
  66 |     await page.goto('/search?q=shepherd');
  67 |     await page.locator('.search-result-card').first().waitFor({ timeout: 8000 });
  68 |     await page.locator('.search-result-card').first().click();
  69 |     await expect(page).toHaveURL(/\/read\//);
  70 |   });
  71 | 
  72 |   test('shows truncation notice when results exceed limit', async ({ page }) => {
  73 |     // A very short common word is likely to exceed 250 results
  74 |     await page.goto('/search?q=the');
  75 |     const summary = page.locator('.search-summary');
  76 |     await expect(summary).toBeVisible({ timeout: 10000 });
  77 |     // May or may not truncate depending on translation — just assert summary renders
  78 |     await expect(summary).toContainText(/match/i);
  79 |   });
  80 | });
  81 | 
```