# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: globalSearchBar.spec.js >> Global Search Bar >> jumps to correct chapter for a verse reference (John 3:16)
- Location: tests/e2e/globalSearchBar.spec.js:35:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.global-search-form input[type="text"]').first()

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - img "DKBoy Logo" [ref=e5]
    - generic [ref=e6]: DK-Boy
  - main [ref=e7]:
    - generic [ref=e8]:
      - button "Choose File" [ref=e9]
      - button "Choose File" [ref=e10]
      - generic [ref=e11]:
        - generic [ref=e12]:
          - generic [ref=e13]: Search library
          - img [ref=e14]
          - searchbox "Search library" [ref=e17]
        - tablist "Library layout" [ref=e18]:
          - button "Grid layout" [ref=e19] [cursor=pointer]:
            - img [ref=e20]
            - generic [ref=e25]: Grid
          - button "List layout" [ref=e26] [cursor=pointer]:
            - img [ref=e27]
            - generic [ref=e28]: List
          - button "BIOS" [ref=e29] [cursor=pointer]:
            - img [ref=e30]
            - generic [ref=e33]: BIOS
      - generic [ref=e34]:
        - generic [ref=e35]:
          - heading "Library" [level=2] [ref=e36]
          - generic [ref=e37]: 0 stored
        - generic [ref=e38]:
          - heading "No ROMs added yet" [level=3] [ref=e39]
          - paragraph [ref=e40]: Use the add button to open the mobile file picker or drag a ROM into the window on desktop.
      - button "Add ROM" [ref=e41] [cursor=pointer]:
        - img [ref=e43]
        - generic [ref=e44]: Add ROM
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
> 38 |     await bar.fill('John 3:16');
     |               ^ Error: locator.fill: Test timeout of 30000ms exceeded.
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
  64 |     await expect(bar).toHaveValue('grace');
  65 |   });
  66 | });
  67 | 
```