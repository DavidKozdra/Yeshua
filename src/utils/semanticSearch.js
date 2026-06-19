/**
 * Client-side semantic Bible search.
 *
 * Two assets power this, both produced offline by a build script:
 *   - `kjv-embeddings.bin`        — every KJV verse embedded with MODEL_ID and
 *                                   int8-quantized into one flat byte array.
 *   - `kjv-embeddings-index.json` — parallel metadata (book/chapter/verse +
 *                                   per-verse quantization scale) plus dims/count.
 *
 * At query time we embed the user's text with the *same* model in the browser
 * (via transformers.js) and rank verses by cosine similarity. No server needed.
 */
import { getBookById } from './bibleData';
import { isBookAllowed, loadTranslationBundle } from './search';
import embeddingsBinUrl from '../data/kjv-embeddings.bin?url';

// The embedding model. Must match the model used to build the verse embeddings,
// or query and verse vectors won't live in the same space.
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const DIMS = 384; // output dimensions of MODEL_ID (fallback if the index omits it)
const TRANSLATION_ID = 'kjv'; // the only translation we have embeddings for

// Lazy, module-scoped caches so the heavy assets/model load at most once per
// session. Each holds the in-flight promise; on failure it's reset to allow retry.
let embeddingsPromise = null;
let embedderPromise = null;

/**
 * Fetch and validate the pre-computed verse embeddings + their index, caching
 * the result for the session. Resolves to `{ vectors, verses, count, dims }`.
 */
async function loadEmbeddings() {
  if (!embeddingsPromise) {
    embeddingsPromise = (async () => {
      // Binary vectors and JSON metadata load in parallel.
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
      const index = indexModule.default ?? indexModule; // handle both ESM shapes
      const vectors = new Int8Array(buffer);
      const dims = index.dims || DIMS;
      // The flat vector array must be exactly count × dims; a mismatch means the
      // .bin and .json were built separately or one is stale.
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

/**
 * Lazily build (and cache) the transformers.js feature-extraction pipeline that
 * turns query text into a vector. The model weights download on first use and
 * are then served from the browser/service-worker cache for offline use.
 */
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

/**
 * Embed a query string into a normalized Float32Array of length DIMS.
 * Mean pooling + L2-normalize matches how the verse vectors were produced, so a
 * plain dot product against them yields cosine similarity.
 */
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
 * Semantic (meaning-based) search over the bundled KJV.
 *
 * Embeds the query into the same vector space as the pre-computed verse
 * embeddings, then ranks every verse by cosine similarity. Unlike keyword
 * search this matches on meaning, so "fear not" can surface "be not afraid".
 *
 * Returns the same result shape as `searchContent` (so the Search page renders
 * results unchanged) with an extra per-result `score` (~cosine similarity).
 *
 * @param {string} query              Natural-language search text.
 * @param {object} [options]
 * @param {number} [options.maxResults=250] Cap on returned results (ranking still
 *                                          considers all verses; this only slices the top).
 * @param {AbortSignal} [options.signal]    Cancels the search; throws AbortError when aborted.
 * @param {number} [options.minScore=0.2]   Drop verses below this similarity to cut noise.
 * @param {string[]} [options.books=[]]     Restrict to these book IDs (empty = all books).
 * @param {string} [options.testament='']   Restrict to 'old' / 'new' (empty = both).
 * @returns {Promise<{query, results, totalMatches, truncated}>}
 */
export async function searchSemantic(
  query,
  { maxResults = 250, signal, minScore = 0.2, books = [], testament = '' } = {}
) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    return { query: '', results: [], totalMatches: 0, truncated: false };
  }

  // Kick off the three independent loads at once: the verse embeddings, the
  // query's own embedding, and the verse text bundle (for rendering results).
  const [{ vectors, verses, dims }, queryVector, bundle] = await Promise.all([
    loadEmbeddings(),
    embedQuery(normalizedQuery),
    loadTranslationBundle(TRANSLATION_ID),
  ]);

  // Bail early if the caller cancelled while the assets were loading.
  if (signal?.aborted) throw new DOMException('Search aborted', 'AbortError');

  const filters = { books, testament };
  const scored = [];

  // Score every in-scope verse. `vectors` is one flat Int8Array, so verse i's
  // row starts at i * dims; `meta.s` is that row's quantization scale.
  for (let i = 0; i < verses.length; i += 1) {
    const meta = verses[i];
    if (!isBookAllowed(meta.b, filters)) continue;
    const score = scoreRow(queryVector, vectors, i * dims, dims, meta.s);
    if (score < minScore) continue; // below the relevance floor — skip
    scored.push({ i, score });
  }

  // Cancellation can land mid-scan on large corpora; check again before sorting.
  if (signal?.aborted) throw new DOMException('Search aborted', 'AbortError');

  // Most similar first. `totalMatches` is the full count above minScore, even
  // though we only hydrate the top `maxResults` below.
  scored.sort((a, b) => b.score - a.score);
  const totalMatches = scored.length;

  // Hydrate only the top slice into full result objects (with verse text).
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

/**
 * Resolve a verse's display text from the translation bundle. The embeddings
 * index only stores book/chapter/verse coordinates, so we look the text up here.
 * Returns '' if the chapter or verse isn't present in the bundle.
 */
function lookupVerseText(bundle, meta) {
  const chapterVerses = bundle?.[`${meta.b}:${meta.c}`];
  if (!Array.isArray(chapterVerses)) return '';
  const match = chapterVerses.find((entry) => entry.verse === meta.v);
  return match?.text || '';
}
