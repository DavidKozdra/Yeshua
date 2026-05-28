# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: globalSearchBar.spec.js >> Global Search Bar >> search bar syncs with the URL query when on /search
- Location: tests/e2e/globalSearchBar.spec.js:61:3

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator: locator('.global-search-form input[type="text"]').first()
Expected: "grace"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveValue" with timeout 5000ms
  - waiting for locator('.global-search-form input[type="text"]').first()

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
  3  | test.describe('Global Search Bar', () => {
  4  |   test('is visible on the home page', async ({ page }) => {
  5  |     await page.goto('/');
  6  |     await expect(page.locator('.global-search-shell')).toBeVisible();
  7  |   });
  8  | 
  9  |   test('is visible on the Notes page', async ({ page }) => {
  10 |     await page.goto('/notes');
  11 |     await expect(page.locator('.global-search-shell')).toBeVisible();
  12 |   });
  13 | 
  14 |   test('is hidden on the reader route', async ({ page }) => {
  15 |     await page.goto('/read/kjv/GEN/1');
  16 |     await expect(page.locator('.global-search-shell')).not.toBeVisible();
  17 |   });
  18 | 
  19 |   test('navigates to full-text search for a phrase', async ({ page }) => {
  20 |     await page.goto('/');
  21 |     const bar = page.locator('.global-search-form input[type="text"]').first();
  22 |     await bar.fill('shepherd');
  23 |     await page.locator('.global-search-form button[type="submit"]').first().click();
  24 |     await expect(page).toHaveURL(/\/search\?q=shepherd/);
  25 |   });
  26 | 
  27 |   test('jumps directly to the reader for a valid reference (Genesis 1)', async ({ page }) => {
  28 |     await page.goto('/');
  29 |     const bar = page.locator('.global-search-form input[type="text"]').first();
  30 |     await bar.fill('Genesis 1');
  31 |     await page.locator('.global-search-form button[type="submit"]').first().click();
  32 |     await expect(page).toHaveURL(/\/read\/.*\/GEN\/1/);
  33 |   });
  34 | 
  35 |   test('jumps to correct chapter for a verse reference (John 3:16)', async ({ page }) => {
  36 |     await page.goto('/');
  37 |     const bar = page.locator('.global-search-form input[type="text"]').first();
  38 |     await bar.fill('John 3:16');
  39 |     await page.locator('.global-search-form button[type="submit"]').first().click();
  40 |     await expect(page).toHaveURL(/\/read\/.*\/JHN\/3/);
  41 |   });
  42 | 
  43 |   test('shows error for a single-character query', async ({ page }) => {
  44 |     await page.goto('/');
  45 |     const bar = page.locator('.global-search-form input[type="text"]').first();
  46 |     await bar.fill('a');
  47 |     await page.locator('.global-search-form button[type="submit"]').first().click();
  48 |     await expect(page.locator('.global-search-error')).toContainText(/at least 2/i);
  49 |   });
  50 | 
  51 |   test('error clears when the user starts typing again', async ({ page }) => {
  52 |     await page.goto('/');
  53 |     const bar = page.locator('.global-search-form input[type="text"]').first();
  54 |     await bar.fill('a');
  55 |     await page.locator('.global-search-form button[type="submit"]').first().click();
  56 |     await expect(page.locator('.global-search-error')).toBeVisible();
  57 |     await bar.fill('ab');
  58 |     await expect(page.locator('.global-search-error')).not.toBeVisible();
  59 |   });
  60 | 
  61 |   test('search bar syncs with the URL query when on /search', async ({ page }) => {
  62 |     await page.goto('/search?q=grace&translation=kjv');
  63 |     const bar = page.locator('.global-search-form input[type="text"]').first();
> 64 |     await expect(bar).toHaveValue('grace');
     |                       ^ Error: expect(locator).toHaveValue(expected) failed
  65 |   });
  66 | });
  67 | 
```