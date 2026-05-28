# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.js >> Home page >> loads and shows app title
- Location: tests/e2e/navigation.spec.js:4:3

# Error details

```
Error: expect(page).toHaveTitle(expected) failed

Expected pattern: /Yeshua/i
Received string:  "DKBoy — Play GBA & GBC Games in Your Browser"
Timeout: 5000ms

Call log:
  - Expect "toHaveTitle" with timeout 5000ms
    14 × unexpected value "DKBoy — Play GBA & GBC Games in Your Browser"

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
  3  | test.describe('Home page', () => {
  4  |   test('loads and shows app title', async ({ page }) => {
  5  |     await page.goto('/');
> 6  |     await expect(page).toHaveTitle(/Yeshua/i);
     |                        ^ Error: expect(page).toHaveTitle(expected) failed
  7  |   });
  8  | 
  9  |   test('shows daily reading cards', async ({ page }) => {
  10 |     await page.goto('/');
  11 |     // The home page renders suggested readings
  12 |     const readingCards = page.locator('[data-testid="daily-reading"], .daily-reading, .reading-card');
  13 |     // Fallback: at minimum the page should not be blank
  14 |     await expect(page.locator('body')).not.toBeEmpty();
  15 |   });
  16 | });
  17 | 
  18 | test.describe('Navigation', () => {
  19 |   test('navigates to Books page', async ({ page }) => {
  20 |     await page.goto('/');
  21 |     await page.goto('/books');
  22 |     await expect(page.locator('body')).toContainText(/Genesis|Matthew|Testament/i);
  23 |   });
  24 | 
  25 |   test('navigates to Search page', async ({ page }) => {
  26 |     await page.goto('/search');
  27 |     await expect(page.locator('input[type="search"], input[placeholder*="earch"]')).toBeVisible();
  28 |   });
  29 | 
  30 |   test('navigates to Notes page', async ({ page }) => {
  31 |     await page.goto('/notes');
  32 |     await expect(page.locator('body')).toContainText(/note/i);
  33 |   });
  34 | 
  35 |   test('navigates to Settings page', async ({ page }) => {
  36 |     await page.goto('/settings');
  37 |     await expect(page.getByRole('tab', { name: 'Profile' })).toBeVisible();
  38 |   });
  39 | });
  40 | 
```