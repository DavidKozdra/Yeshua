# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: reading.spec.js >> Reader – unknown route fallback >> navigating to /read without params falls back gracefully
- Location: tests/e2e/reading.spec.js:127:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.page')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.page')

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
  129 |     // Should show some text content (either last-read or default chapter)
  130 |     await expect(page.locator('body')).not.toBeEmpty();
> 131 |     await expect(page.locator('.page')).toBeVisible({ timeout: 5000 });
      |                                         ^ Error: expect(locator).toBeVisible() failed
  132 |   });
  133 | });
  134 | 
```