#!/usr/bin/env node
/**
 * Downloads the entire KJV Bible from the API and bundles it into a single JSON file.
 * Output: src/data/kjv-bundle.json
 *
 * Structure: { "GEN:1": [{verse, text}, ...], "GEN:2": [...], ... }
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-kjv/books';

const BOOKS = [
  { id: 'GEN', name: 'genesis', chapters: 50 },
  { id: 'EXO', name: 'exodus', chapters: 40 },
  { id: 'LEV', name: 'leviticus', chapters: 27 },
  { id: 'NUM', name: 'numbers', chapters: 36 },
  { id: 'DEU', name: 'deuteronomy', chapters: 34 },
  { id: 'JOS', name: 'joshua', chapters: 24 },
  { id: 'JDG', name: 'judges', chapters: 21 },
  { id: 'RUT', name: 'ruth', chapters: 4 },
  { id: '1SA', name: '1 samuel', chapters: 31 },
  { id: '2SA', name: '2 samuel', chapters: 24 },
  { id: '1KI', name: '1 kings', chapters: 22 },
  { id: '2KI', name: '2 kings', chapters: 25 },
  { id: '1CH', name: '1 chronicles', chapters: 29 },
  { id: '2CH', name: '2 chronicles', chapters: 36 },
  { id: 'EZR', name: 'ezra', chapters: 10 },
  { id: 'NEH', name: 'nehemiah', chapters: 13 },
  { id: 'EST', name: 'esther', chapters: 10 },
  { id: 'JOB', name: 'job', chapters: 42 },
  { id: 'PSA', name: 'psalms', chapters: 150 },
  { id: 'PRO', name: 'proverbs', chapters: 31 },
  { id: 'ECC', name: 'ecclesiastes', chapters: 12 },
  { id: 'SNG', name: 'song of solomon', chapters: 8 },
  { id: 'ISA', name: 'isaiah', chapters: 66 },
  { id: 'JER', name: 'jeremiah', chapters: 52 },
  { id: 'LAM', name: 'lamentations', chapters: 5 },
  { id: 'EZK', name: 'ezekiel', chapters: 48 },
  { id: 'DAN', name: 'daniel', chapters: 12 },
  { id: 'HOS', name: 'hosea', chapters: 14 },
  { id: 'JOL', name: 'joel', chapters: 3 },
  { id: 'AMO', name: 'amos', chapters: 9 },
  { id: 'OBA', name: 'obadiah', chapters: 1 },
  { id: 'JON', name: 'jonah', chapters: 4 },
  { id: 'MIC', name: 'micah', chapters: 7 },
  { id: 'NAM', name: 'nahum', chapters: 3 },
  { id: 'HAB', name: 'habakkuk', chapters: 3 },
  { id: 'ZEP', name: 'zephaniah', chapters: 3 },
  { id: 'HAG', name: 'haggai', chapters: 2 },
  { id: 'ZEC', name: 'zechariah', chapters: 14 },
  { id: 'MAL', name: 'malachi', chapters: 4 },
  { id: 'MAT', name: 'matthew', chapters: 28 },
  { id: 'MRK', name: 'mark', chapters: 16 },
  { id: 'LUK', name: 'luke', chapters: 24 },
  { id: 'JHN', name: 'john', chapters: 21 },
  { id: 'ACT', name: 'acts', chapters: 28 },
  { id: 'ROM', name: 'romans', chapters: 16 },
  { id: '1CO', name: '1 corinthians', chapters: 16 },
  { id: '2CO', name: '2 corinthians', chapters: 13 },
  { id: 'GAL', name: 'galatians', chapters: 6 },
  { id: 'EPH', name: 'ephesians', chapters: 6 },
  { id: 'PHP', name: 'philippians', chapters: 4 },
  { id: 'COL', name: 'colossians', chapters: 4 },
  { id: '1TH', name: '1 thessalonians', chapters: 5 },
  { id: '2TH', name: '2 thessalonians', chapters: 3 },
  { id: '1TI', name: '1 timothy', chapters: 6 },
  { id: '2TI', name: '2 timothy', chapters: 4 },
  { id: 'TIT', name: 'titus', chapters: 3 },
  { id: 'PHM', name: 'philemon', chapters: 1 },
  { id: 'HEB', name: 'hebrews', chapters: 13 },
  { id: 'JAS', name: 'james', chapters: 5 },
  { id: '1PE', name: '1 peter', chapters: 5 },
  { id: '2PE', name: '2 peter', chapters: 3 },
  { id: '1JN', name: '1 john', chapters: 5 },
  { id: '2JN', name: '2 john', chapters: 1 },
  { id: '3JN', name: '3 john', chapters: 1 },
  { id: 'JUD', name: 'jude', chapters: 1 },
  { id: 'REV', name: 'revelation', chapters: 22 },
];

const CONCURRENCY = 10;

function normalizeVerses(verses) {
  const normalized = [];
  const seenVerses = new Set();

  for (const entry of verses) {
    const verse = Number(entry?.verse);
    if (!Number.isInteger(verse) || verse < 1 || seenVerses.has(verse)) {
      continue;
    }

    seenVerses.add(verse);
    normalized.push({
      verse,
      text: typeof entry?.text === 'string' ? entry.text : String(entry?.text ?? ''),
    });
  }

  return normalized;
}

async function fetchChapter(book, chapter) {
  const url = `${API_BASE}/${encodeURIComponent(book.name)}/chapters/${chapter}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed: ${book.id} ${chapter} (${res.status})`);
  const data = await res.json();

  let verses;
  if (data.data && Array.isArray(data.data)) {
    verses = data.data.map((v) => ({ verse: Number(v.verse), text: v.text }));
  } else if (Array.isArray(data)) {
    verses = data.map((v) => ({ verse: Number(v.verse), text: v.text }));
  } else if (data.verses) {
    verses = data.verses.map((v) => ({ verse: Number(v.verse), text: v.text }));
  } else {
    throw new Error(`Unexpected format for ${book.id} ${chapter}`);
  }
  return normalizeVerses(verses);
}

async function main() {
  const tasks = [];
  for (const book of BOOKS) {
    for (let ch = 1; ch <= book.chapters; ch++) {
      tasks.push({ book, chapter: ch });
    }
  }

  const totalChapters = tasks.length;
  console.log(`Downloading ${totalChapters} chapters...`);

  const bundle = {};
  let done = 0;
  let errors = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const task = tasks[idx++];
      const key = `${task.book.id}:${task.chapter}`;
      try {
        bundle[key] = await fetchChapter(task.book, task.chapter);
        done++;
        if (done % 50 === 0) {
          process.stdout.write(`\r  ${done}/${totalChapters} chapters downloaded`);
        }
      } catch (err) {
        errors.push(`${key}: ${err.message}`);
        done++;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`\n  ${done}/${totalChapters} complete, ${errors.length} errors`);

  if (errors.length > 0) {
    console.log('Errors:', errors.join('\n  '));
  }

  const outDir = path.join(__dirname, '..', 'src', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'kjv-bundle.json');
  fs.writeFileSync(outPath, JSON.stringify(bundle));

  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`Written to ${outPath} (${sizeMB} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
