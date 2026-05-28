# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: reading.spec.js >> Reader – chapter navigation >> next chapter button advances the chapter in the URL
- Location: tests/e2e/reading.spec.js:25:3

# Error details

```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /next chapter|next|→/i }).first() to be visible

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
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Reader – basic load', () => {
  4   |   test('loads /read and shows verse text', async ({ page }) => {
  5   |     await page.goto('/read/kjv/GEN/1');
  6   |     // Wait for verses to load
  7   |     await expect(page.locator('.verse, .reading-text, [class*="verse"]').first()).toBeVisible({ timeout: 8000 });
  8   |     await expect(page.locator('body')).toContainText(/beginning|heaven|earth/i);
  9   |   });
  10  | 
  11  |   test('saves last-read position (Continue Reading shows on home)', async ({ page }) => {
  12  |     await page.goto('/read/kjv/PSA/23');
  13  |     await page.goto('/');
  14  |     await expect(page.locator('.continue-card')).toBeVisible();
  15  |   });
  16  | });
  17  | 
  18  | test.describe('Reader – chapter navigation', () => {
  19  |   test('has previous and next chapter buttons', async ({ page }) => {
  20  |     await page.goto('/read/kjv/GEN/2');
  21  |     await expect(page.getByRole('button', { name: /previous chapter|prev|←/i }).first()).toBeVisible({ timeout: 5000 });
  22  |     await expect(page.getByRole('button', { name: /next chapter|next|→/i }).first()).toBeVisible({ timeout: 5000 });
  23  |   });
  24  | 
  25  |   test('next chapter button advances the chapter in the URL', async ({ page }) => {
  26  |     await page.goto('/read/kjv/GEN/1');
  27  |     const next = page.getByRole('button', { name: /next chapter|next|→/i }).first();
> 28  |     await next.waitFor({ timeout: 5000 });
      |                ^ TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
  29  |     await next.click();
  30  |     await expect(page).toHaveURL(/GEN\/2/);
  31  |   });
  32  | 
  33  |   test('previous chapter button goes back', async ({ page }) => {
  34  |     await page.goto('/read/kjv/GEN/3');
  35  |     const prev = page.getByRole('button', { name: /previous chapter|prev|←/i }).first();
  36  |     await prev.waitFor({ timeout: 5000 });
  37  |     await prev.click();
  38  |     await expect(page).toHaveURL(/GEN\/2/);
  39  |   });
  40  | 
  41  |   test('previous chapter is not shown on chapter 1 of the first book', async ({ page }) => {
  42  |     await page.goto('/read/kjv/GEN/1');
  43  |     // Genesis 1 has no previous chapter
  44  |     const prev = page.getByRole('button', { name: /previous chapter|prev|←/i });
  45  |     // Either absent or disabled
  46  |     const count = await prev.count();
  47  |     if (count > 0) {
  48  |       await expect(prev.first()).toBeDisabled();
  49  |     }
  50  |   });
  51  | });
  52  | 
  53  | test.describe('Reader – book selector', () => {
  54  |   test('book selector opens when triggered', async ({ page }) => {
  55  |     await page.goto('/read/kjv/GEN/1');
  56  |     const bookBtn = page.getByRole('button', { name: /genesis|book selector|chapters/i }).first();
  57  |     await bookBtn.waitFor({ timeout: 5000 });
  58  |     await bookBtn.click();
  59  |     // Should show list of Bible books or chapters
  60  |     await expect(page.locator('body')).toContainText(/Matthew|Revelation|Psalms/i);
  61  |   });
  62  | });
  63  | 
  64  | test.describe('Reader – verse numbers and display settings', () => {
  65  |   test('verse numbers are visible by default', async ({ page }) => {
  66  |     await page.goto('/read/kjv/JHN/3');
  67  |     await page.locator('body').waitFor();
  68  |     // Default setting showVerseNumbers is true
  69  |     await expect(page.locator('.verse-num, sup').first()).toBeVisible({ timeout: 8000 });
  70  |   });
  71  | });
  72  | 
  73  | test.describe('Reader – v2 study tools', () => {
  74  |   test('verse modal exposes bookmark, highlight, share, and note controls', async ({ page }) => {
  75  |     await page.goto('/read/kjv/JHN/3');
  76  |     await page.locator('.verse').first().click();
  77  |     await expect(page.getByRole('button', { name: /^bookmark$/i })).toBeVisible();
  78  |     await expect(page.getByRole('button', { name: /^highlight$/i })).toBeVisible();
  79  |     await expect(page.getByLabel('Note tags')).toBeVisible();
  80  |   });
  81  | 
  82  |   test('highlight saves without requiring a note', async ({ page }) => {
  83  |     await page.goto('/read/kjv/JHN/3');
  84  |     const firstVerse = page.locator('.verse').first();
  85  |     await firstVerse.click();
  86  |     await expect(page.getByRole('button', { name: /save note/i })).toBeDisabled();
  87  |     await page.getByRole('button', { name: /^highlight$/i }).click();
  88  |     await expect(page.getByText('Highlight saved')).toBeVisible();
  89  |     await expect(firstVerse).toHaveClass(/verse-highlighted/);
  90  |   });
  91  | 
  92  |   test('bookmarks show in the chapter view and jump back to the verse', async ({ page }) => {
  93  |     await page.goto('/read/kjv/JHN/3');
  94  |     const firstVerse = page.locator('.verse').first();
  95  | 
  96  |     await firstVerse.click();
  97  |     await page.getByRole('button', { name: /^bookmark$/i }).click();
  98  |     await page.getByRole('button', { name: /^cancel$/i }).click();
  99  | 
  100 |     await expect(page.getByLabel('Bookmarked verses in this chapter')).toBeVisible();
  101 |     await expect(page.getByRole('button', { name: /john 3:1/i })).toBeVisible();
  102 | 
  103 |     await page.getByRole('button', { name: /john 3:1/i }).click();
  104 |     await expect(firstVerse).toHaveClass(/verse-targeted/);
  105 |   });
  106 | 
  107 |   test('deleting a verse note also removes the same-verse highlight', async ({ page }) => {
  108 |     await page.goto('/read/kjv/JHN/3');
  109 |     const firstVerse = page.locator('.verse').first();
  110 | 
  111 |     await firstVerse.click();
  112 |     await page.getByRole('button', { name: /^highlight$/i }).click();
  113 |     await page.getByLabel('Note title').fill('Highlighted note');
  114 |     await page.getByRole('button', { name: /save note/i }).click();
  115 |     await expect(firstVerse).toHaveClass(/verse-highlighted/);
  116 | 
  117 |     await firstVerse.click();
  118 |     page.on('dialog', (dialog) => dialog.accept());
  119 |     await page.getByRole('button', { name: /^delete$/i }).click();
  120 | 
  121 |     await expect(page.getByText('The verse note and highlight were removed.')).toBeVisible();
  122 |     await expect(firstVerse).not.toHaveClass(/verse-highlighted/);
  123 |   });
  124 | });
  125 | 
  126 | test.describe('Reader – unknown route fallback', () => {
  127 |   test('navigating to /read without params falls back gracefully', async ({ page }) => {
  128 |     await page.goto('/read');
```