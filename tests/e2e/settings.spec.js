import { test, expect } from '@playwright/test';

// Helper: navigate to settings and activate a named tab
async function openSettingsTab(page, tabLabel) {
  await page.goto('/settings');
  await page.getByRole('tab', { name: tabLabel }).click();
}

test.describe('Settings – page structure', () => {
  test('loads the settings page with all four tabs', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('tab', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Reader' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Accessibility' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Notifications' })).toBeVisible();
  });

  test('Profile tab is active by default', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('Settings – Profile tab', () => {
  test('shows name input and save button', async ({ page }) => {
    await openSettingsTab(page, 'Profile');
    await expect(page.getByLabel('Profile name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('saves a profile name and shows confirmation', async ({ page }) => {
    await openSettingsTab(page, 'Profile');
    const input = page.getByLabel('Profile name');
    await input.fill('TestUser');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Profile name saved.')).toBeVisible();
  });

  test('saving name via Enter key works', async ({ page }) => {
    await openSettingsTab(page, 'Profile');
    const input = page.getByLabel('Profile name');
    await input.fill('KeyboardUser');
    await input.press('Enter');
    await expect(page.getByText('Profile name saved.')).toBeVisible();
  });

  test('shows Export Data, Import Data, and Delete All Data buttons', async ({ page }) => {
    await openSettingsTab(page, 'Profile');
    await expect(page.getByRole('button', { name: /export data/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /import data/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /delete all data/i })).toBeVisible();
    await expect(page.getByLabel('Import mode')).toBeVisible();
  });
});

test.describe('Settings – Reader tab', () => {
  test('shows theme buttons for all built-in themes', async ({ page }) => {
    await openSettingsTab(page, 'Reader');
    for (const theme of ['Dark', 'Light', 'Sepia', 'Cool', 'Princess']) {
      await expect(page.getByRole('button', { name: new RegExp(theme, 'i') }).first()).toBeVisible();
    }
  });

  test('clicking a theme button marks it active', async ({ page }) => {
    await openSettingsTab(page, 'Reader');
    const lightBtn = page.getByRole('button', { name: /light/i }).first();
    await lightBtn.click();
    await expect(lightBtn).toHaveClass(/active/);
  });

  test('shows Create Custom Theme button', async ({ page }) => {
    await openSettingsTab(page, 'Reader');
    await expect(page.getByRole('button', { name: /create custom theme/i })).toBeVisible();
  });

  test('custom theme modal opens and closes', async ({ page }) => {
    await openSettingsTab(page, 'Reader');
    await page.getByRole('button', { name: /create custom theme/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('custom theme modal requires a name to save', async ({ page }) => {
    await openSettingsTab(page, 'Reader');
    await page.getByRole('button', { name: /create custom theme/i }).click();
    await page.getByRole('button', { name: /save theme/i }).click();
    await expect(page.getByRole('dialog')).toContainText(/enter a theme name/i);
  });

  test('font size controls are present and functional', async ({ page }) => {
    await openSettingsTab(page, 'Reader');
    const decrease = page.getByRole('button', { name: /decrease font size/i });
    const increase = page.getByRole('button', { name: /increase font size/i });
    const display = page.locator('.font-size-value');
    await expect(decrease).toBeVisible();
    await expect(increase).toBeVisible();
    const before = await display.textContent();
    await increase.click();
    const after = await display.textContent();
    expect(before).not.toBe(after);
  });

  test('line height select is present with expected options', async ({ page }) => {
    await openSettingsTab(page, 'Reader');
    const select = page.getByLabel('Line height');
    await expect(select).toBeVisible();
    await expect(select.locator('option')).toHaveCount(4);
  });

  test('default translation select is visible', async ({ page }) => {
    await openSettingsTab(page, 'Reader');
    await expect(page.getByLabel('Default translation')).toBeVisible();
  });

  test('toggles for verse numbers, Words of Christ in Red, and one-verse-per-line are present', async ({ page }) => {
    await openSettingsTab(page, 'Reader');
    // Checkboxes are inside toggle labels — locate by nearby text
    await expect(page.getByText('Verse Numbers', { exact: true })).toBeVisible();
    await expect(page.getByText('Words of Christ in Red', { exact: true })).toBeVisible();
    await expect(page.getByText('One Verse Per Line', { exact: true })).toBeVisible();
  });

  test('Show Global Search Bar toggle is present', async ({ page }) => {
    await openSettingsTab(page, 'Reader');
    await expect(page.getByText('Show Global Search Bar')).toBeVisible();
  });

  test('TTS tool and speed controls are present', async ({ page }) => {
    await openSettingsTab(page, 'Reader');
    await expect(page.getByText('Text to Speech Tool')).toBeVisible();
    await expect(page.getByLabel('Text to speech speed')).toBeVisible();
  });

  test('Preview section is visible with book/chapter/verse selectors', async ({ page }) => {
    await openSettingsTab(page, 'Reader');
    await expect(page.getByLabel('Preview book')).toBeVisible();
    await expect(page.getByLabel('Preview chapter')).toBeVisible();
  });

  test('preview reference input accepts a valid reference', async ({ page }) => {
    await openSettingsTab(page, 'Reader');
    const refInput = page.getByLabel('Preview verse reference');
    await refInput.fill('John 3:16');
    await page.getByLabel('Reader').getByRole('button', { name: /^go$/i }).click();
    // Book selector should have updated to John
    await expect(page.getByLabel('Preview book')).toHaveValue('JHN');
  });

  test('preview reference input shows error for invalid reference', async ({ page }) => {
    await openSettingsTab(page, 'Reader');
    const refInput = page.getByLabel('Preview verse reference');
    await refInput.fill('FakeBook 99');
    await page.getByLabel('Reader').getByRole('button', { name: /^go$/i }).click();
    await expect(page.locator('.error')).toContainText(/use a reference/i);
  });
});

test.describe('Settings – Accessibility tab', () => {
  test('shows Motion and Accessibility sections', async ({ page }) => {
    await openSettingsTab(page, 'Accessibility');
    await expect(page.getByRole('heading', { name: /motion/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /accessibility/i })).toBeVisible();
  });

  test('Enable Animations toggle is present', async ({ page }) => {
    await openSettingsTab(page, 'Accessibility');
    await expect(page.getByText('Enable Animations')).toBeVisible();
  });

  test('accessibility toggles are all present', async ({ page }) => {
    await openSettingsTab(page, 'Accessibility');
    await expect(page.getByText('Enhanced Focus Indicators')).toBeVisible();
    await expect(page.getByText('Underline Links')).toBeVisible();
    await expect(page.getByText('Larger Touch Targets')).toBeVisible();
    await expect(page.getByText('High Contrast Text')).toBeVisible();
    await expect(page.getByText('Extra Letter Spacing')).toBeVisible();
    await expect(page.getByText('Extra Word Spacing')).toBeVisible();
  });

  test('Color Vision Support select has all four options', async ({ page }) => {
    await openSettingsTab(page, 'Accessibility');
    const select = page.getByLabel('Color vision support');
    await expect(select).toBeVisible();
    await expect(select.locator('option')).toHaveCount(4);
  });

  test('toggling a setting persists after page reload', async ({ page }) => {
    await openSettingsTab(page, 'Accessibility');
    // Find Underline Links checkbox
    const toggle = page.locator('.setting-row').filter({ hasText: 'Underline Links' }).locator('input[type="checkbox"]');
    const wasBefore = await toggle.isChecked();
    await toggle.evaluate((element) => element.click());
    await page.reload();
    await page.getByRole('tab', { name: 'Accessibility' }).click();
    const afterReload = page.locator('.setting-row').filter({ hasText: 'Underline Links' }).locator('input[type="checkbox"]');
    await expect(afterReload).toBeChecked({ checked: !wasBefore });
    // Restore
    await afterReload.evaluate((element) => element.click());
  });
});

test.describe('Settings – Notifications tab', () => {
  test('shows Notifications heading', async ({ page }) => {
    await openSettingsTab(page, 'Notifications');
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible();
  });

  test('Enable Browser Notifications toggle is present', async ({ page }) => {
    await openSettingsTab(page, 'Notifications');
    await expect(page.getByText('Enable Browser Notifications')).toBeVisible();
  });

  test('Weekly Reading Reminders toggle is present', async ({ page }) => {
    await openSettingsTab(page, 'Notifications');
    await expect(page.getByText('Weekly Reading Reminders')).toBeVisible();
  });

  test('Enable Holy Day Awareness toggle is present', async ({ page }) => {
    await openSettingsTab(page, 'Notifications');
    await expect(page.getByText('Enable Holy Day Awareness')).toBeVisible();
  });

  test('Holy Day Reminder Lead Time select is present', async ({ page }) => {
    await openSettingsTab(page, 'Notifications');
    await expect(page.getByLabel('Reminder lead time')).toBeVisible();
  });

  test('holy day list is visible when awareness is enabled', async ({ page }) => {
    await openSettingsTab(page, 'Notifications');
    // Ensure holy day awareness is on (default is true)
    const awarenessToggle = page.locator('.setting-row').filter({ hasText: 'Enable Holy Day Awareness' }).locator('input[type="checkbox"]');
    if (!(await awarenessToggle.isChecked())) {
      await awarenessToggle.evaluate((element) => element.click());
    }
    await expect(page.locator('.holy-day-settings-list')).toBeVisible();
  });

  test('holy day list collapses when awareness is disabled', async ({ page }) => {
    await openSettingsTab(page, 'Notifications');
    const awarenessToggle = page.locator('.setting-row').filter({ hasText: 'Enable Holy Day Awareness' }).locator('input[type="checkbox"]');
    if (await awarenessToggle.isChecked()) {
      await awarenessToggle.evaluate((element) => element.click());
    }
    await expect(page.locator('.holy-day-settings-collapsed-note')).toBeVisible();
    await expect(page.locator('.holy-day-settings-list')).not.toBeVisible();
    // Restore
    await awarenessToggle.evaluate((element) => element.click());
  });

  test('each holy day row has Shown and Alert toggles', async ({ page }) => {
    await openSettingsTab(page, 'Notifications');
    const awarenessToggle = page.locator('.setting-row').filter({ hasText: 'Enable Holy Day Awareness' }).locator('input[type="checkbox"]');
    if (!(await awarenessToggle.isChecked())) {
      await awarenessToggle.evaluate((element) => element.click());
    }
    const items = page.locator('.holy-day-setting-item');
    await expect(items).toHaveCount(12); // 12 defined holy days
    const firstItem = items.first();
    await expect(firstItem.getByText('Shown')).toBeVisible();
    await expect(firstItem.getByText('Alert')).toBeVisible();
  });
});
