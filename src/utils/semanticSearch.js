import { getBookById } from './bibleData';
import { isBookAllowed, loadTranslationBundle } from './search';
import embeddingsBinUrl from '../data/kjv-embeddings.bin?url';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const DIMS = 384;
const TRANSLATION_ID = 'kjv';

// Lazy, module-scoped caches so the heavy assets/model load at most once per session.
let embeddingsPromise = null;
let embedderPromise = null;

async function loadEmbeddings() {
  if (!embeddingsPromise) {
    embeddingsPromise = (async () => {
      const [binResponse, indexModule] = await Promise.all([
        fetch(embeddingsBinUrl),
        import('../data/kjv-embeddings-index.json'),
      ]);
      const contentType = binResponse.headers.get('content-type') || '';
      if (!binResponse.ok || contentType.includes('text/html')) {
        // A text/html body here means the asset URL fell through to the SPA shell
        // (wrong base path, stale service worker, or offline with no cache).
        throw new Error('Could not load semantic search data. Try refreshing the app.');
      }
      const buffer = await binResponse.arrayBuffer();
      const index = indexModule.default ?? indexModule;
      const vectors = new Int8Array(buffer);
      const dims = index.dims || DIMS;
      if (vectors.length !== index.count * dims) {
        throw new Error('Semantic search data is corrupt or out of date.');
      }
      return { vectors, verses: index.verses, count: index.count, dims };
    })().catch((error) => {
      embeddingsPromise = null; // allow retry on transient failure
      throw error;
    });
  }
  return embeddingsPromise;
}

async function getQueryEmbedder() {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      // Without this, transformers.js first probes for a local copy of the model at
      // `/models/<id>/...` relative to the app origin. In an SPA those paths fall back
      // to index.html, and the library then tries to JSON.parse that HTML — surfacing
      // "Unexpected token '<', \"<!DOCTYPE\"...". Force remote (Hugging Face) loading;
      // the files are runtime-cached by the service worker for offline use after first run.
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      try {
        return await pipeline('feature-extraction', MODEL_ID, { quantized: true });
      } catch (error) {
        // transformers.js JSON.parses model config/tokenizer files; if a stale service
        // worker (or a captive proxy) returns HTML, that surfaces as the cryptic
        // "Unexpected token '<', \"<!DOCTYPE\"...". Translate it into something actionable.
        if (/Unexpected token|not valid JSON|DOCTYPE/i.test(String(error?.message))) {
          throw new Error(
            'Could not load the semantic search model. Reload the app (and reconnect once if offline) to refresh it.'
          );
        }
        throw error;
      }
    })().catch((error) => {
      embedderPromise = null;
      throw error;
    });
  }
  return embedderPromise;
}

/** Embed a query string into a normalized Float32Array of length DIMS. */
async function embedQuery(query) {
  const embed = await getQueryEmbedder();
  const output = await embed(query, { pooling: 'mean', normalize: true });
  return Float32Array.from(output.data);
}

/**
 * Dot product of a normalized float query against a per-vector int8-quantized row.
 * The row was stored as round(value / scale); value ≈ row * scale. Since the stored
 * scale is constant across a row it factors out of the ranking, but we apply it so
 * returned scores approximate true cosine similarity (both vectors are unit-norm).
 */
function scoreRow(query, vectors, offset, dims, scale) {
  let sum = 0;
  for (let i = 0; i < dims; i += 1) {
    sum += query[i] * vectors[offset + i];
  }
  return sum * scale;
}

/**
 * Semantic search over the bundled KJV. Returns the same result shape as
 * `searchContent` so the Search page renders results unchanged, plus a `score`.
 */
export async function searchSemantic(
  query,
  { maxResults = 250, signal, minScore = 0.2, books = [], testament = '' } = {}
) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    return { query: '', results: [], totalMatches: 0, truncated: false };
  }

  const [{ vectors, verses, dims }, queryVector, bundle] = await Promise.all([
    loadEmbeddings(),
    embedQuery(normalizedQuery),
    loadTranslationBundle(TRANSLATION_ID),
  ]);

  if (signal?.aborted) throw new DOMException('Search aborted', 'AbortError');

  const filters = { books, testament };
  const scored = [];

  for (let i = 0; i < verses.length; i += 1) {
    const meta = verses[i];
    if (!isBookAllowed(meta.b, filters)) continue;
    const score = scoreRow(queryVector, vectors, i * dims, dims, meta.s);
    if (score < minScore) continue;
    scored.push({ i, score });
  }

  if (signal?.aborted) throw new DOMException('Search aborted', 'AbortError');

  scored.sort((a, b) => b.score - a.score);
  const totalMatches = scored.length;

  const results = scored.slice(0, maxResults).map(({ i, score }) => {
    const meta = verses[i];
    return {
      sourceType: 'bible',
      type: 'Scripture',
      bookId: meta.b,
      bookName: getBookById(meta.b)?.name || meta.b,
      chapter: meta.c,
      verse: meta.v,
      text: lookupVerseText(bundle, meta),
      score,
    };
  });

  return {
    query: normalizedQuery,
    results,
    totalMatches,
    truncated: totalMatches > maxResults,
  };
}

function lookupVerseText(bundle, meta) {
  const chapterVerses = bundle?.[`${meta.b}:${meta.c}`];
  if (!Array.isArray(chapterVerses)) return '';
  const match = chapterVerses.find((entry) => entry.verse === meta.v);
  return match?.text || '';
}
