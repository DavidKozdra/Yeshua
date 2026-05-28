# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: home.spec.js >> Home page >> clicking a reading card navigates to the reader
- Location: tests/e2e/home.spec.js:30:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.reading-card').first()

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
  3  | test.describe('Home page', () => {
  4  |   test('shows the app greeting', async ({ page }) => {
  5  |     await page.goto('/');
  6  |     // Default greeting when no name is set
  7  |     await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
  8  |   });
  9  | 
  10 |   test('shows personalised greeting after name is saved', async ({ page }) => {
  11 |     // Set a name via settings first
  12 |     await page.goto('/settings');
  13 |     await page.getByLabel('Profile name').fill('David');
  14 |     await page.getByRole('button', { name: 'Save' }).click();
  15 |     await page.goto('/');
  16 |     await expect(page.getByRole('heading', { name: /welcome back, david/i })).toBeVisible();
  17 |     // Cleanup
  18 |     await page.goto('/settings');
  19 |     await page.getByLabel('Profile name').fill('');
  20 |     await page.getByRole('button', { name: 'Save' }).click();
  21 |   });
  22 | 
  23 |   test('shows three recommended reading cards', async ({ page }) => {
  24 |     await page.goto('/');
  25 |     await expect(page.getByRole('heading', { name: /recommended for today/i })).toBeVisible();
  26 |     const cards = page.locator('.reading-card');
  27 |     await expect(cards).toHaveCount(3);
  28 |   });
  29 | 
  30 |   test('clicking a reading card navigates to the reader', async ({ page }) => {
  31 |     await page.goto('/');
  32 |     const firstCard = page.locator('.reading-card').first();
> 33 |     await firstCard.click();
     |                     ^ Error: locator.click: Test timeout of 30000ms exceeded.
  34 |     await expect(page).toHaveURL(/\/read\//);
  35 |   });
  36 | 
  37 |   test('shows Library section with a clickable link', async ({ page }) => {
  38 |     await page.goto('/');
  39 |     await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();
  40 |     await expect(page.getByRole('button', { name: /open library/i })).toBeVisible();
  41 |   });
  42 | 
  43 |   test('Library button navigates to /books', async ({ page }) => {
  44 |     await page.goto('/');
  45 |     await page.getByRole('button', { name: /open library/i }).click();
  46 |     await expect(page).toHaveURL(/\/books/);
  47 |   });
  48 | 
  49 |   test('shows Study & Research section with external links', async ({ page }) => {
  50 |     await page.goto('/');
  51 |     await expect(page.getByRole('heading', { name: /study & research/i })).toBeVisible();
  52 |     await expect(page.getByRole('link', { name: /bible project/i })).toBeVisible();
  53 |     await expect(page.getByRole('link', { name: /blue letter bible/i })).toBeVisible();
  54 |   });
  55 | 
  56 |   test('shows Continue Reading section after visiting the reader', async ({ page }) => {
  57 |     // Visit a chapter first to set lastRead
  58 |     await page.goto('/read/kjv/GEN/1');
  59 |     await expect(page.locator('.verse').first()).toBeVisible({ timeout: 8000 });
  60 |     await page.goto('/');
  61 |     await expect(page.getByRole('heading', { name: /continue reading/i })).toBeVisible();
  62 |     await expect(page.getByRole('button', { name: /continue reading/i })).toBeVisible();
  63 |   });
  64 | 
  65 |   test('Continue Reading card navigates back to the reader', async ({ page }) => {
  66 |     await page.goto('/read/kjv/GEN/1');
  67 |     await expect(page.locator('.verse').first()).toBeVisible({ timeout: 8000 });
  68 |     await page.goto('/');
  69 |     await page.getByRole('button', { name: /continue reading/i }).click();
  70 |     await expect(page).toHaveURL(/\/read\//);
  71 |   });
  72 | });
  73 | 
```