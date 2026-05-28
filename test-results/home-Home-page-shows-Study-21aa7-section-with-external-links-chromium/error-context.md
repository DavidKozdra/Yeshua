# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: home.spec.js >> Home page >> shows Study & Research section with external links
- Location: tests/e2e/home.spec.js:49:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /study & research/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: /study & research/i })

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
  33 |     await firstCard.click();
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
> 51 |     await expect(page.getByRole('heading', { name: /study & research/i })).toBeVisible();
     |                                                                            ^ Error: expect(locator).toBeVisible() failed
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