# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings.spec.js >> Settings – page structure >> Profile tab is active by default
- Location: tests/e2e/settings.spec.js:18:3

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: getByRole('tab', { name: 'Profile' })
Expected: "true"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByRole('tab', { name: 'Profile' })

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
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | // Helper: navigate to settings and activate a named tab
  4   | async function openSettingsTab(page, tabLabel) {
  5   |   await page.goto('/settings');
  6   |   await page.getByRole('tab', { name: tabLabel }).click();
  7   | }
  8   | 
  9   | test.describe('Settings – page structure', () => {
  10  |   test('loads the settings page with all four tabs', async ({ page }) => {
  11  |     await page.goto('/settings');
  12  |     await expect(page.getByRole('tab', { name: 'Profile' })).toBeVisible();
  13  |     await expect(page.getByRole('tab', { name: 'Reader' })).toBeVisible();
  14  |     await expect(page.getByRole('tab', { name: 'Accessibility' })).toBeVisible();
  15  |     await expect(page.getByRole('tab', { name: 'Notifications' })).toBeVisible();
  16  |   });
  17  | 
  18  |   test('Profile tab is active by default', async ({ page }) => {
  19  |     await page.goto('/settings');
> 20  |     await expect(page.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
      |                                                              ^ Error: expect(locator).toHaveAttribute(expected) failed
  21  |   });
  22  | });
  23  | 
  24  | test.describe('Settings – Profile tab', () => {
  25  |   test('shows name input and save button', async ({ page }) => {
  26  |     await openSettingsTab(page, 'Profile');
  27  |     await expect(page.getByLabel('Profile name')).toBeVisible();
  28  |     await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  29  |   });
  30  | 
  31  |   test('saves a profile name and shows confirmation', async ({ page }) => {
  32  |     await openSettingsTab(page, 'Profile');
  33  |     const input = page.getByLabel('Profile name');
  34  |     await input.fill('TestUser');
  35  |     await page.getByRole('button', { name: 'Save' }).click();
  36  |     await expect(page.getByText('Profile name saved.')).toBeVisible();
  37  |   });
  38  | 
  39  |   test('saving name via Enter key works', async ({ page }) => {
  40  |     await openSettingsTab(page, 'Profile');
  41  |     const input = page.getByLabel('Profile name');
  42  |     await input.fill('KeyboardUser');
  43  |     await input.press('Enter');
  44  |     await expect(page.getByText('Profile name saved.')).toBeVisible();
  45  |   });
  46  | 
  47  |   test('shows Export Data, Import Data, and Delete All Data buttons', async ({ page }) => {
  48  |     await openSettingsTab(page, 'Profile');
  49  |     await expect(page.getByRole('button', { name: /export data/i })).toBeVisible();
  50  |     await expect(page.getByRole('button', { name: /import data/i })).toBeVisible();
  51  |     await expect(page.getByRole('button', { name: /delete all data/i })).toBeVisible();
  52  |     await expect(page.getByLabel('Import mode')).toBeVisible();
  53  |   });
  54  | });
  55  | 
  56  | test.describe('Settings – Reader tab', () => {
  57  |   test('shows theme buttons for all built-in themes', async ({ page }) => {
  58  |     await openSettingsTab(page, 'Reader');
  59  |     for (const theme of ['Dark', 'Light', 'Sepia', 'Cool', 'Princess']) {
  60  |       await expect(page.getByRole('button', { name: new RegExp(theme, 'i') }).first()).toBeVisible();
  61  |     }
  62  |   });
  63  | 
  64  |   test('clicking a theme button marks it active', async ({ page }) => {
  65  |     await openSettingsTab(page, 'Reader');
  66  |     const lightBtn = page.getByRole('button', { name: /light/i }).first();
  67  |     await lightBtn.click();
  68  |     await expect(lightBtn).toHaveClass(/active/);
  69  |   });
  70  | 
  71  |   test('shows Create Custom Theme button', async ({ page }) => {
  72  |     await openSettingsTab(page, 'Reader');
  73  |     await expect(page.getByRole('button', { name: /create custom theme/i })).toBeVisible();
  74  |   });
  75  | 
  76  |   test('custom theme modal opens and closes', async ({ page }) => {
  77  |     await openSettingsTab(page, 'Reader');
  78  |     await page.getByRole('button', { name: /create custom theme/i }).click();
  79  |     await expect(page.getByRole('dialog')).toBeVisible();
  80  |     await page.getByRole('button', { name: /cancel/i }).click();
  81  |     await expect(page.getByRole('dialog')).not.toBeVisible();
  82  |   });
  83  | 
  84  |   test('custom theme modal requires a name to save', async ({ page }) => {
  85  |     await openSettingsTab(page, 'Reader');
  86  |     await page.getByRole('button', { name: /create custom theme/i }).click();
  87  |     await page.getByRole('button', { name: /save theme/i }).click();
  88  |     await expect(page.getByRole('dialog')).toContainText(/enter a theme name/i);
  89  |   });
  90  | 
  91  |   test('font size controls are present and functional', async ({ page }) => {
  92  |     await openSettingsTab(page, 'Reader');
  93  |     const decrease = page.getByRole('button', { name: /decrease font size/i });
  94  |     const increase = page.getByRole('button', { name: /increase font size/i });
  95  |     const display = page.locator('.font-size-value');
  96  |     await expect(decrease).toBeVisible();
  97  |     await expect(increase).toBeVisible();
  98  |     const before = await display.textContent();
  99  |     await increase.click();
  100 |     const after = await display.textContent();
  101 |     expect(before).not.toBe(after);
  102 |   });
  103 | 
  104 |   test('line height select is present with expected options', async ({ page }) => {
  105 |     await openSettingsTab(page, 'Reader');
  106 |     const select = page.getByLabel('Line height');
  107 |     await expect(select).toBeVisible();
  108 |     await expect(select.locator('option')).toHaveCount(4);
  109 |   });
  110 | 
  111 |   test('default translation select is visible', async ({ page }) => {
  112 |     await openSettingsTab(page, 'Reader');
  113 |     await expect(page.getByLabel('Default translation')).toBeVisible();
  114 |   });
  115 | 
  116 |   test('toggles for verse numbers, Words of Christ in Red, and one-verse-per-line are present', async ({ page }) => {
  117 |     await openSettingsTab(page, 'Reader');
  118 |     // Checkboxes are inside toggle labels — locate by nearby text
  119 |     await expect(page.getByText('Verse Numbers', { exact: true })).toBeVisible();
  120 |     await expect(page.getByText('Words of Christ in Red', { exact: true })).toBeVisible();
```