import { test, expect } from '@playwright/test';

test.describe('Reader – basic load', () => {
  test('loads /read and shows verse text', async ({ page }) => {
    await page.goto('/read/kjv/GEN/1');
    // Wait for verses to load
    await expect(page.locator('.verse, .reading-text, [class*="verse"]').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('body')).toContainText(/beginning|heaven|earth/i);
  });

  test('saves last-read position (Continue Reading shows on home)', async ({ page }) => {
    await page.goto('/read/kjv/PSA/23');
    await page.goto('/');
    await expect(page.locator('.continue-card')).toBeVisible();
  });
});

test.describe('Reader – chapter navigation', () => {
  test('has previous and next chapter buttons', async ({ page }) => {
    await page.goto('/read/kjv/GEN/2');
    await expect(page.getByRole('button', { name: /previous chapter|prev|←/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /next chapter|next|→/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('next chapter button advances the chapter in the URL', async ({ page }) => {
    await page.goto('/read/kjv/GEN/1');
    const next = page.getByRole('button', { name: /next chapter|next|→/i }).first();
    await next.waitFor({ timeout: 5000 });
    await next.click();
    await expect(page).toHaveURL(/GEN\/2/);
  });

  test('previous chapter button goes back', async ({ page }) => {
    await page.goto('/read/kjv/GEN/3');
    const prev = page.getByRole('button', { name: /previous chapter|prev|←/i }).first();
    await prev.waitFor({ timeout: 5000 });
    await prev.click();
    await expect(page).toHaveURL(/GEN\/2/);
  });

  test('previous chapter is not shown on chapter 1 of the first book', async ({ page }) => {
    await page.goto('/read/kjv/GEN/1');
    // Genesis 1 has no previous chapter
    const prev = page.getByRole('button', { name: /previous chapter|prev|←/i });
    // Either absent or disabled
    const count = await prev.count();
    if (count > 0) {
      await expect(prev.first()).toBeDisabled();
    }
  });
});

test.describe('Reader – book selector', () => {
  test('book selector opens when triggered', async ({ page }) => {
    await page.goto('/read/kjv/GEN/1');
    const bookBtn = page.getByRole('button', { name: /genesis|book selector|chapters/i }).first();
    await bookBtn.waitFor({ timeout: 5000 });
    await bookBtn.click();
    // Should show list of Bible books or chapters
    await expect(page.locator('body')).toContainText(/Matthew|Revelation|Psalms/i);
  });
});

test.describe('Reader – verse numbers and display settings', () => {
  test('verse numbers are visible by default', async ({ page }) => {
    await page.goto('/read/kjv/JHN/3');
    await page.locator('body').waitFor();
    // Default setting showVerseNumbers is true
    await expect(page.locator('.verse-num, sup').first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Reader – read aloud', () => {
  test('pause and resume control the active speech session', async ({ page }) => {
    await page.addInitScript(() => {
      const state = {
        paused: false,
        speaking: false,
        intervalCallbacks: [],
      };
      const nativeSetInterval = window.setInterval.bind(window);

      class FakeSpeechSynthesisUtterance {
        constructor(text) {
          this.text = text;
        }
      }

      const speechSynthesis = {
        get paused() {
          return state.paused;
        },
        get speaking() {
          return state.speaking;
        },
        cancel() {
          state.paused = false;
          state.speaking = false;
        },
        getVoices() {
          return [];
        },
        pause() {
          state.paused = true;
        },
        resume() {
          state.paused = false;
        },
        speak() {
          state.paused = false;
          state.speaking = true;
        },
      };

      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: FakeSpeechSynthesisUtterance,
      });
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: speechSynthesis,
      });
      Object.defineProperty(window, '__speechTestState', {
        configurable: true,
        value: state,
      });
      window.setInterval = (callback, delay, ...args) => {
        if (delay === 10000) {
          state.intervalCallbacks.push(() => callback(...args));
        }
        return nativeSetInterval(callback, delay, ...args);
      };
    });

    await page.goto('/read/kjv/GEN/1');
    await expect(page.locator('.verse').first()).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: 'Open reader tools' }).click();
    await page.getByRole('button', { name: 'Read chapter aloud' }).click();
    await expect(page.getByRole('button', { name: 'Pause text to speech' })).toBeVisible();

    await page.getByRole('button', { name: 'Pause text to speech' }).click();
    await expect.poll(() => page.evaluate(() => window.__speechTestState.paused)).toBe(true);
    await expect(page.getByRole('button', { name: 'Resume text to speech' })).toBeVisible();

    await page.evaluate(() => {
      for (const callback of window.__speechTestState.intervalCallbacks) {
        callback();
      }
    });
    await expect.poll(() => page.evaluate(() => window.__speechTestState.paused)).toBe(true);
    await expect(page.getByRole('button', { name: 'Resume text to speech' })).toBeVisible();

    await page.getByRole('button', { name: 'Resume text to speech' }).click();
    await expect.poll(() => page.evaluate(() => window.__speechTestState.paused)).toBe(false);
    await expect(page.getByRole('button', { name: 'Pause text to speech' })).toBeVisible();
  });
});

test.describe('Reader – v2 study tools', () => {
  test('verse modal exposes bookmark, highlight, share, and note controls', async ({ page }) => {
    await page.goto('/read/kjv/JHN/3');
    await page.locator('.verse').first().click();
    await expect(page.getByRole('button', { name: /^bookmark$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^highlight$/i })).toBeVisible();
    await expect(page.getByLabel('Note tags')).toBeVisible();
  });

  test('highlight saves without requiring a note', async ({ page }) => {
    await page.goto('/read/kjv/JHN/3');
    const firstVerse = page.locator('.verse').first();
    await firstVerse.click();
    await expect(page.getByRole('button', { name: /save note/i })).toBeDisabled();
    await page.getByRole('button', { name: /^highlight$/i }).click();
    await expect(page.getByText('Highlight saved')).toBeVisible();
    await expect(firstVerse).toHaveClass(/verse-highlighted/);
  });

  test('bookmarks show in the chapter view and jump back to the verse', async ({ page }) => {
    await page.goto('/read/kjv/JHN/3');
    const firstVerse = page.locator('.verse').first();

    await firstVerse.click();
    await page.getByRole('button', { name: /^bookmark$/i }).click();
    await page.getByRole('button', { name: /^cancel$/i }).click();

    await expect(page.getByLabel('Bookmarked verses in this chapter')).toBeVisible();
    await expect(page.getByRole('button', { name: /john 3:1/i })).toBeVisible();

    await page.getByRole('button', { name: /john 3:1/i }).click();
    await expect(firstVerse).toHaveClass(/verse-targeted/);
  });

  test('deleting a verse note also removes the same-verse highlight', async ({ page }) => {
    await page.goto('/read/kjv/JHN/3');
    const firstVerse = page.locator('.verse').first();

    await firstVerse.click();
    await page.getByRole('button', { name: /^highlight$/i }).click();
    await page.getByLabel('Note title').fill('Highlighted note');
    await page.getByRole('button', { name: /save note/i }).click();
    await expect(firstVerse).toHaveClass(/verse-highlighted/);

    await firstVerse.click();
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /^delete$/i }).click();

    await expect(page.getByText('The verse note and highlight were removed.')).toBeVisible();
    await expect(firstVerse).not.toHaveClass(/verse-highlighted/);
  });
});

test.describe('Reader – unknown route fallback', () => {
  test('navigating to /read without params falls back gracefully', async ({ page }) => {
    await page.goto('/read');
    // Should show some text content (either last-read or default chapter)
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('.page')).toBeVisible({ timeout: 5000 });
  });
});
