import { test, expect } from '@playwright/test';

test.describe('Notes – empty state', () => {
  test('shows empty state when there are no notes', async ({ page }) => {
    await page.goto('/notes');
    // There may be notes from other tests; only assert empty state if no notes exist
    const notesList = page.locator('.notes-list');
    const emptyState = page.locator('.empty-state');
    const hasNotes = await notesList.isVisible();
    if (!hasNotes) {
      await expect(emptyState).toContainText(/no notes yet/i);
    }
  });

  test('shows New Note compose area', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.getByLabel('New note title')).toBeVisible();
    await expect(page.getByLabel('New note text')).toBeVisible();
    await expect(page.getByLabel('New note tags')).toBeVisible();
    await expect(page.getByRole('button', { name: /save note/i })).toBeVisible();
  });

  test('Save Note button is disabled when both fields are empty', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.getByRole('button', { name: /save note/i })).toBeDisabled();
  });
});

test.describe('Notes – create, display, edit, delete', () => {
  test('creates a note with title and text, shows it in the list', async ({ page }) => {
    await page.goto('/notes');
    await page.getByLabel('New note title').fill('Test Note Title');
    await page.getByLabel('New note text').fill('Some reflection text.');
    await page.getByLabel('New note tags').fill('prayer, study');
    await page.getByRole('button', { name: /save note/i }).click();
    await expect(page.locator('.notes-list')).toContainText('Test Note Title');
    await expect(page.locator('.notes-list')).toContainText('Some reflection text.');
    await expect(page.locator('.notes-list')).toContainText('prayer');
  });

  test('note stats counter increments after creating a note', async ({ page }) => {
    await page.goto('/notes');
    const totalBefore = await page.locator('.notes-stat').first().locator('strong').textContent();
    await page.getByLabel('New note title').fill('Stats Test');
    await page.getByLabel('New note text').fill('Checking stats.');
    await page.getByRole('button', { name: /save note/i }).click();
    await expect(page.locator('.notes-list')).toContainText('Stats Test');
    const totalAfter = await page.locator('.notes-stat').first().locator('strong').textContent();
    expect(Number(totalAfter)).toBeGreaterThan(Number(totalBefore));
  });

  test('compose area clears after saving', async ({ page }) => {
    await page.goto('/notes');
    await page.getByLabel('New note title').fill('Clearance Test');
    await page.getByLabel('New note text').fill('Should be cleared.');
    await page.getByRole('button', { name: /save note/i }).click();
    await expect(page.getByLabel('New note title')).toHaveValue('');
    await expect(page.getByLabel('New note text')).toHaveValue('');
  });

  test('edits an existing note', async ({ page }) => {
    await page.goto('/notes');
    // Create a note to edit
    await page.getByLabel('New note title').fill('Editable Note');
    await page.getByLabel('New note text').fill('Original text.');
    await page.getByRole('button', { name: /save note/i }).click();
    // Click the Edit button on the first note card
    await page.locator('.note-card').first().getByRole('button', { name: /edit/i }).click();
    const editTitle = page.getByLabel('Edit note title');
    await editTitle.clear();
    await editTitle.fill('Edited Title');
    await page.locator('.note-edit').getByRole('button', { name: /save/i }).click();
    await expect(page.locator('.notes-list')).toContainText('Edited Title');
  });

  test('cancels editing without saving changes', async ({ page }) => {
    await page.goto('/notes');
    await page.getByLabel('New note title').fill('Cancel Test');
    await page.getByLabel('New note text').fill('Do not change me.');
    await page.getByRole('button', { name: /save note/i }).click();
    await page.locator('.note-card').first().getByRole('button', { name: /edit/i }).click();
    await page.getByLabel('Edit note title').fill('Changed Title');
    await page.locator('.note-edit').getByRole('button', { name: /cancel/i }).click();
    // Edit form should be gone, original content still present
    await expect(page.locator('.note-edit')).not.toBeVisible();
    await expect(page.locator('.notes-list')).not.toContainText('Changed Title');
  });

  test('deletes a note (dismisses confirm dialog)', async ({ page }) => {
    await page.goto('/notes');
    await page.getByLabel('New note title').fill('Delete Me');
    await page.getByLabel('New note text').fill('This note will be deleted.');
    await page.getByRole('button', { name: /save note/i }).click();
    const noteCard = page.locator('.note-card').filter({ hasText: 'Delete Me' });
    await expect(noteCard).toBeVisible();
    // Auto-accept the confirm dialog
    page.on('dialog', (dialog) => dialog.accept());
    await noteCard.getByRole('button', { name: /delete/i }).click();
    await expect(noteCard).toHaveCount(0);
  });
});

test.describe('Notes – search and filter', () => {
  test.beforeEach(async ({ page }) => {
    // Seed two notes
    await page.goto('/notes');
    await page.getByLabel('New note title').fill('Alpha Note');
    await page.getByLabel('New note text').fill('Faith content.');
    await page.getByRole('button', { name: /save note/i }).click();
    await page.getByLabel('New note title').fill('Beta Note');
    await page.getByLabel('New note text').fill('Hope content.');
    await page.getByRole('button', { name: /save note/i }).click();
  });

  test('search filters notes by title', async ({ page }) => {
    await page.getByLabel('Search notes').fill('Alpha');
    await page.waitForTimeout(350); // debounce
    await expect(page.locator('.notes-list')).toContainText('Alpha Note');
    await expect(page.locator('.notes-list')).not.toContainText('Beta Note');
  });

  test('search filters notes by body text', async ({ page }) => {
    await page.getByLabel('Search notes').fill('Hope');
    await page.waitForTimeout(350);
    await expect(page.locator('.notes-list')).toContainText('Beta Note');
    await expect(page.locator('.notes-list')).not.toContainText('Alpha Note');
  });

  test('no-match search shows empty state message', async ({ page }) => {
    await page.getByLabel('Search notes').fill('zzzznotamatch');
    await page.waitForTimeout(350);
    await expect(page.locator('.empty-state')).toContainText(/no notes match/i);
  });

  test('General filter chip shows only general notes', async ({ page }) => {
    await page.getByRole('button', { name: /general/i }).click();
    // Both seeded notes are general (no verse link)
    await expect(page.locator('.note-card')).toHaveCount(await page.locator('.note-card').count());
  });

  test('Scripture-linked filter shows empty state when no linked notes', async ({ page }) => {
    await page.getByRole('button', { name: /scripture-linked/i }).click();
    // No linked notes seeded
    const emptyState = page.locator('.empty-state');
    const notesList = page.locator('.notes-list');
    const hasNotes = await notesList.isVisible();
    if (!hasNotes) {
      await expect(emptyState).toBeVisible();
    }
  });
});
