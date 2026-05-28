# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: notes.spec.js >> Notes – empty state >> Save Note button is disabled when both fields are empty
- Location: tests/e2e/notes.spec.js:23:3

# Error details

```
Error: expect(locator).toBeDisabled() failed

Locator: getByRole('button', { name: /save note/i })
Expected: disabled
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeDisabled" with timeout 5000ms
  - waiting for getByRole('button', { name: /save note/i })

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
  3   | test.describe('Notes – empty state', () => {
  4   |   test('shows empty state when there are no notes', async ({ page }) => {
  5   |     await page.goto('/notes');
  6   |     // There may be notes from other tests; only assert empty state if no notes exist
  7   |     const notesList = page.locator('.notes-list');
  8   |     const emptyState = page.locator('.empty-state');
  9   |     const hasNotes = await notesList.isVisible();
  10  |     if (!hasNotes) {
  11  |       await expect(emptyState).toContainText(/no notes yet/i);
  12  |     }
  13  |   });
  14  | 
  15  |   test('shows New Note compose area', async ({ page }) => {
  16  |     await page.goto('/notes');
  17  |     await expect(page.getByLabel('New note title')).toBeVisible();
  18  |     await expect(page.getByLabel('New note text')).toBeVisible();
  19  |     await expect(page.getByLabel('New note tags')).toBeVisible();
  20  |     await expect(page.getByRole('button', { name: /save note/i })).toBeVisible();
  21  |   });
  22  | 
  23  |   test('Save Note button is disabled when both fields are empty', async ({ page }) => {
  24  |     await page.goto('/notes');
> 25  |     await expect(page.getByRole('button', { name: /save note/i })).toBeDisabled();
      |                                                                    ^ Error: expect(locator).toBeDisabled() failed
  26  |   });
  27  | });
  28  | 
  29  | test.describe('Notes – create, display, edit, delete', () => {
  30  |   test('creates a note with title and text, shows it in the list', async ({ page }) => {
  31  |     await page.goto('/notes');
  32  |     await page.getByLabel('New note title').fill('Test Note Title');
  33  |     await page.getByLabel('New note text').fill('Some reflection text.');
  34  |     await page.getByLabel('New note tags').fill('prayer, study');
  35  |     await page.getByRole('button', { name: /save note/i }).click();
  36  |     await expect(page.locator('.notes-list')).toContainText('Test Note Title');
  37  |     await expect(page.locator('.notes-list')).toContainText('Some reflection text.');
  38  |     await expect(page.locator('.notes-list')).toContainText('prayer');
  39  |   });
  40  | 
  41  |   test('note stats counter increments after creating a note', async ({ page }) => {
  42  |     await page.goto('/notes');
  43  |     const totalBefore = await page.locator('.notes-stat').first().locator('strong').textContent();
  44  |     await page.getByLabel('New note title').fill('Stats Test');
  45  |     await page.getByLabel('New note text').fill('Checking stats.');
  46  |     await page.getByRole('button', { name: /save note/i }).click();
  47  |     await expect(page.locator('.notes-list')).toContainText('Stats Test');
  48  |     const totalAfter = await page.locator('.notes-stat').first().locator('strong').textContent();
  49  |     expect(Number(totalAfter)).toBeGreaterThan(Number(totalBefore));
  50  |   });
  51  | 
  52  |   test('compose area clears after saving', async ({ page }) => {
  53  |     await page.goto('/notes');
  54  |     await page.getByLabel('New note title').fill('Clearance Test');
  55  |     await page.getByLabel('New note text').fill('Should be cleared.');
  56  |     await page.getByRole('button', { name: /save note/i }).click();
  57  |     await expect(page.getByLabel('New note title')).toHaveValue('');
  58  |     await expect(page.getByLabel('New note text')).toHaveValue('');
  59  |   });
  60  | 
  61  |   test('edits an existing note', async ({ page }) => {
  62  |     await page.goto('/notes');
  63  |     // Create a note to edit
  64  |     await page.getByLabel('New note title').fill('Editable Note');
  65  |     await page.getByLabel('New note text').fill('Original text.');
  66  |     await page.getByRole('button', { name: /save note/i }).click();
  67  |     // Click the Edit button on the first note card
  68  |     await page.locator('.note-card').first().getByRole('button', { name: /edit/i }).click();
  69  |     const editTitle = page.getByLabel('Edit note title');
  70  |     await editTitle.clear();
  71  |     await editTitle.fill('Edited Title');
  72  |     await page.locator('.note-edit').getByRole('button', { name: /save/i }).click();
  73  |     await expect(page.locator('.notes-list')).toContainText('Edited Title');
  74  |   });
  75  | 
  76  |   test('cancels editing without saving changes', async ({ page }) => {
  77  |     await page.goto('/notes');
  78  |     await page.getByLabel('New note title').fill('Cancel Test');
  79  |     await page.getByLabel('New note text').fill('Do not change me.');
  80  |     await page.getByRole('button', { name: /save note/i }).click();
  81  |     await page.locator('.note-card').first().getByRole('button', { name: /edit/i }).click();
  82  |     await page.getByLabel('Edit note title').fill('Changed Title');
  83  |     await page.locator('.note-edit').getByRole('button', { name: /cancel/i }).click();
  84  |     // Edit form should be gone, original content still present
  85  |     await expect(page.locator('.note-edit')).not.toBeVisible();
  86  |     await expect(page.locator('.notes-list')).not.toContainText('Changed Title');
  87  |   });
  88  | 
  89  |   test('deletes a note (dismisses confirm dialog)', async ({ page }) => {
  90  |     await page.goto('/notes');
  91  |     await page.getByLabel('New note title').fill('Delete Me');
  92  |     await page.getByLabel('New note text').fill('This note will be deleted.');
  93  |     await page.getByRole('button', { name: /save note/i }).click();
  94  |     const noteCard = page.locator('.note-card').filter({ hasText: 'Delete Me' });
  95  |     await expect(noteCard).toBeVisible();
  96  |     // Auto-accept the confirm dialog
  97  |     page.on('dialog', (dialog) => dialog.accept());
  98  |     await noteCard.getByRole('button', { name: /delete/i }).click();
  99  |     await expect(noteCard).toHaveCount(0);
  100 |   });
  101 | });
  102 | 
  103 | test.describe('Notes – search and filter', () => {
  104 |   test.beforeEach(async ({ page }) => {
  105 |     // Seed two notes
  106 |     await page.goto('/notes');
  107 |     await page.getByLabel('New note title').fill('Alpha Note');
  108 |     await page.getByLabel('New note text').fill('Faith content.');
  109 |     await page.getByRole('button', { name: /save note/i }).click();
  110 |     await page.getByLabel('New note title').fill('Beta Note');
  111 |     await page.getByLabel('New note text').fill('Hope content.');
  112 |     await page.getByRole('button', { name: /save note/i }).click();
  113 |   });
  114 | 
  115 |   test('search filters notes by title', async ({ page }) => {
  116 |     await page.getByLabel('Search notes').fill('Alpha');
  117 |     await page.waitForTimeout(350); // debounce
  118 |     await expect(page.locator('.notes-list')).toContainText('Alpha Note');
  119 |     await expect(page.locator('.notes-list')).not.toContainText('Beta Note');
  120 |   });
  121 | 
  122 |   test('search filters notes by body text', async ({ page }) => {
  123 |     await page.getByLabel('Search notes').fill('Hope');
  124 |     await page.waitForTimeout(350);
  125 |     await expect(page.locator('.notes-list')).toContainText('Beta Note');
```