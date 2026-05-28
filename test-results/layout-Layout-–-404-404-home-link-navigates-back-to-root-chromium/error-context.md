# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: layout.spec.js >> Layout – 404 >> 404 home link navigates back to root
- Location: tests/e2e/layout.spec.js:56:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: /go home/i })

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
  3  | test.describe('Layout – sidebar navigation', () => {
  4  |   test('sidebar renders all nav links', async ({ page }) => {
  5  |     await page.goto('/');
  6  |     const nav = page.locator('nav.sidebar');
  7  |     await expect(nav.getByRole('link', { name: /home/i })).toBeVisible();
  8  |     await expect(nav.getByRole('link', { name: /read/i })).toBeVisible();
  9  |     await expect(nav.getByRole('link', { name: /notes/i })).toBeVisible();
  10 |     await expect(nav.getByRole('link', { name: /library/i })).toBeVisible();
  11 |     await expect(nav.getByRole('link', { name: /settings/i })).toBeVisible();
  12 |   });
  13 | 
  14 |   test('active sidebar link matches the current route', async ({ page }) => {
  15 |     await page.goto('/notes');
  16 |     const notesLink = page.locator('nav.sidebar').getByRole('link', { name: /notes/i });
  17 |     await expect(notesLink).toHaveClass(/active/);
  18 |   });
  19 | 
  20 |   test('sidebar brand shows "Yeshua" text', async ({ page }) => {
  21 |     await page.goto('/');
  22 |     await expect(page.locator('.brand-text')).toContainText('Yeshua');
  23 |   });
  24 | });
  25 | 
  26 | test.describe('Layout – mobile bottom navigation', () => {
  27 |   test('bottom nav renders on mobile viewport', async ({ page }) => {
  28 |     await page.setViewportSize({ width: 390, height: 844 });
  29 |     await page.goto('/');
  30 |     await expect(page.locator('nav.bottom-nav')).toBeVisible();
  31 |   });
  32 | 
  33 |   test('bottom nav contains the read link', async ({ page }) => {
  34 |     await page.setViewportSize({ width: 390, height: 844 });
  35 |     await page.goto('/');
  36 |     await expect(page.locator('nav.bottom-nav').getByRole('link', { name: /read/i })).toBeVisible();
  37 |   });
  38 | });
  39 | 
  40 | test.describe('Layout – skip link', () => {
  41 |   test('skip link is in the DOM', async ({ page }) => {
  42 |     await page.goto('/');
  43 |     const skipLink = page.locator('a.skip-link');
  44 |     await expect(skipLink).toBeAttached();
  45 |     await expect(skipLink).toHaveAttribute('href', '#main-content');
  46 |   });
  47 | });
  48 | 
  49 | test.describe('Layout – 404', () => {
  50 |   test('unknown route shows 404 page with home link', async ({ page }) => {
  51 |     await page.goto('/this-does-not-exist');
  52 |     await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible();
  53 |     await expect(page.getByRole('link', { name: /go home/i })).toBeVisible();
  54 |   });
  55 | 
  56 |   test('404 home link navigates back to root', async ({ page }) => {
  57 |     await page.goto('/this-does-not-exist');
> 58 |     await page.getByRole('link', { name: /go home/i }).click();
     |                                                        ^ Error: locator.click: Test timeout of 30000ms exceeded.
  59 |     await expect(page).toHaveURL('/');
  60 |   });
  61 | });
  62 | 
```