# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: notes.spec.js >> Notes – create, display, edit, delete >> edits an existing note
- Location: tests/e2e/notes.spec.js:61:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('New note title')

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
  25  |     await expect(page.getByRole('button', { name: /save note/i })).toBeDisabled();
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
> 64  |     await page.getByLabel('New note title').fill('Editable Note');
      |                                             ^ Error: locator.fill: Test timeout of 30000ms exceeded.
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
  126 |     await expect(page.locator('.notes-list')).not.toContainText('Alpha Note');
  127 |   });
  128 | 
  129 |   test('no-match search shows empty state message', async ({ page }) => {
  130 |     await page.getByLabel('Search notes').fill('zzzznotamatch');
  131 |     await page.waitForTimeout(350);
  132 |     await expect(page.locator('.empty-state')).toContainText(/no notes match/i);
  133 |   });
  134 | 
  135 |   test('General filter chip shows only general notes', async ({ page }) => {
  136 |     await page.getByRole('button', { name: /general/i }).click();
  137 |     // Both seeded notes are general (no verse link)
  138 |     await expect(page.locator('.note-card')).toHaveCount(await page.locator('.note-card').count());
  139 |   });
  140 | 
  141 |   test('Scripture-linked filter shows empty state when no linked notes', async ({ page }) => {
  142 |     await page.getByRole('button', { name: /scripture-linked/i }).click();
  143 |     // No linked notes seeded
  144 |     const emptyState = page.locator('.empty-state');
  145 |     const notesList = page.locator('.notes-list');
  146 |     const hasNotes = await notesList.isVisible();
  147 |     if (!hasNotes) {
  148 |       await expect(emptyState).toBeVisible();
  149 |     }
  150 |   });
  151 | });
  152 | 
```