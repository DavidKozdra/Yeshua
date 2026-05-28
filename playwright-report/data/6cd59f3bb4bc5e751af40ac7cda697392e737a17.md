# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: translations.spec.js >> Translations / Library page >> shows Library, Bible Translations, and External Sources tabs
- Location: tests/e2e/translations.spec.js:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('tab', { name: /library/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('tab', { name: /library/i })

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
  3  | test.describe('Translations / Library page', () => {
  4  |   test('shows Library, Bible Translations, and External Sources tabs', async ({ page }) => {
  5  |     await page.goto('/translations');
> 6  |     await expect(page.getByRole('tab', { name: /library/i })).toBeVisible();
     |                                                               ^ Error: expect(locator).toBeVisible() failed
  7  |     await expect(page.getByRole('tab', { name: /bible translations/i })).toBeVisible();
  8  |     await expect(page.getByRole('tab', { name: /external sources/i })).toBeVisible();
  9  |   });
  10 | 
  11 |   test('Bible Translations tab lists known translations', async ({ page }) => {
  12 |     await page.goto('/translations');
  13 |     await page.getByRole('tab', { name: /bible translations/i }).click();
  14 |     await expect(page.locator('body')).toContainText(/King James Version|KJV/i);
  15 |     await expect(page.locator('body')).toContainText(/World English Bible|WEB/i);
  16 |   });
  17 | 
  18 |   test('KJV shows as bundled / ready', async ({ page }) => {
  19 |     await page.goto('/translations');
  20 |     await page.getByRole('tab', { name: /bible translations/i }).click();
  21 |     // KJV is bundled so it should show a ready or installed status chip
  22 |     await expect(page.locator('body')).toContainText(/KJV/i);
  23 |   });
  24 | 
  25 |   test('Library tab is active by default on /books', async ({ page }) => {
  26 |     await page.goto('/books');
  27 |     await expect(page.getByRole('tab', { name: /library/i })).toHaveAttribute('aria-selected', 'true');
  28 |   });
  29 | 
  30 |   test('Translations tab is active by default on /translations', async ({ page }) => {
  31 |     await page.goto('/translations');
  32 |     await expect(page.getByRole('tab', { name: /bible translations/i })).toHaveAttribute('aria-selected', 'true');
  33 |   });
  34 | 
  35 |   test('External Sources tab shows external resource links', async ({ page }) => {
  36 |     await page.goto('/translations');
  37 |     await page.getByRole('tab', { name: /external sources/i }).click();
  38 |     // Should contain some external links
  39 |     await expect(page.locator('a[href^="http"]').first()).toBeVisible({ timeout: 5000 });
  40 |   });
  41 | 
  42 |   test('switching tabs updates displayed content', async ({ page }) => {
  43 |     await page.goto('/translations');
  44 |     await page.getByRole('tab', { name: /library/i }).click();
  45 |     // Library tab should show library collections, not individual translations
  46 |     await expect(page.locator('body')).not.toContainText(/King James Version/i);
  47 |   });
  48 | });
  49 | 
```