#!/usr/bin/env node
/**
 * Generates semantic-search embeddings for every verse in the bundled KJV.
 * Reads:  src/data/kjv-bundle.json   (shape: { "GEN:1": [{verse, text}, ...], ... })
 * Writes: src/data/kjv-embeddings.bin         (Int8Array, row-major: count * DIMS bytes)
 *         src/data/kjv-embeddings-index.json   ({ model, dims, count, verses:[{b,c,v,s}] })
 *
 * Each verse text is embedded with Xenova/all-MiniLM-L6-v2 (mean-pooled + L2-normalized),
 * then int8-quantized per vector with a stored scale `s` so the runtime can dequantize
 * back to floats: float[i] = int8[i] * s.
 *
 * Run manually whenever kjv-bundle.json changes:  npm run build:embeddings
 */

const fs = require('fs');
const path = require('path');

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const DIMS = 384;
const BATCH_SIZE = 64;

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const BUNDLE_PATH = path.join(DATA_DIR, 'kjv-bundle.json');
const BIN_PATH = path.join(DATA_DIR, 'kjv-embeddings.bin');
const INDEX_PATH = path.join(DATA_DIR, 'kjv-embeddings-index.json');

function flattenVerses(bundle) {
  const records = [];
  for (const [key, verses] of Object.entries(bundle)) {
    const [bookId, rawChapter] = key.split(':');
    const chapter = Number.parseInt(rawChapter, 10);
    if (!Array.isArray(verses)) continue;
    for (const verse of verses) {
      const text = String(verse?.text || '').trim();
      if (!text) continue;
      records.push({ b: bookId, c: chapter, v: verse.verse, text });
    }
  }
  // Stable order: by book key order in the file, then chapter, then verse.
  return records;
}

/** Quantize a normalized float vector to int8, returning { bytes: Int8Array, scale }. */
function quantize(vector) {
  let maxAbs = 0;
  for (let i = 0; i < vector.length; i += 1) {
    const a = Math.abs(vector[i]);
    if (a > maxAbs) maxAbs = a;
  }
  const scale = maxAbs > 0 ? maxAbs / 127 : 1;
  const bytes = new Int8Array(vector.length);
  for (let i = 0; i < vector.length; i += 1) {
    bytes[i] = Math.max(-127, Math.min(127, Math.round(vector[i] / scale)));
  }
  return { bytes, scale };
}

async function main() {
  if (!fs.existsSync(BUNDLE_PATH)) {
    console.error(`Missing ${BUNDLE_PATH}. Run the KJV download script first.`);
    process.exit(1);
  }

  console.log('Loading transformers.js...');
  const { pipeline } = await import('@xenova/transformers');

  console.log('Reading KJV bundle...');
  const bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, 'utf8'));
  const records = flattenVerses(bundle);
  const count = records.length;
  console.log(`Embedding ${count} verses with ${MODEL_ID}...`);

  const embed = await pipeline('feature-extraction', MODEL_ID, { quantized: true });

  const out = new Int8Array(count * DIMS);
  const index = new Array(count);
  let done = 0;

  for (let start = 0; start < count; start += BATCH_SIZE) {
    const batch = records.slice(start, start + BATCH_SIZE);
    const texts = batch.map((r) => r.text);
    // pooling: 'mean' + normalize: true => one L2-normalized vector per input.
    const output = await embed(texts, { pooling: 'mean', normalize: true });
    const data = output.data; // Float32Array, length = batch.length * DIMS
    const rows = output.dims[0];

    for (let i = 0; i < rows; i += 1) {
      const vector = data.subarray(i * DIMS, (i + 1) * DIMS);
      const { bytes, scale } = quantize(vector);
      const recordIndex = start + i;
      out.set(bytes, recordIndex * DIMS);
      const r = batch[i];
      index[recordIndex] = { b: r.b, c: r.c, v: r.v, s: scale };
    }

    done += rows;
    if (done % (BATCH_SIZE * 20) === 0 || done === count) {
      console.log(`  ${done}/${count}`);
    }
  }

  fs.writeFileSync(BIN_PATH, Buffer.from(out.buffer));
  fs.writeFileSync(
    INDEX_PATH,
    JSON.stringify({ model: MODEL_ID, dims: DIMS, count, verses: index })
  );

  console.log(`Wrote ${BIN_PATH} (${(out.byteLength / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`Wrote ${INDEX_PATH} (${count} verses)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
