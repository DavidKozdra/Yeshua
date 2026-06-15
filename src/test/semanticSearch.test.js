import { describe, it, expect, vi, beforeEach } from 'vitest';

// NOTE: this suite mocks the embedder, the embeddings binary, and the index import, so it
// only covers the pure scoring/filter/result-shape logic. It deliberately does NOT prove
// the model or assets actually load in a real app — that integration path (which broke with
// "Unexpected token '<'") is guarded by tests/e2e/semanticSearch.spec.js against the build.

// Three verses with deterministic 2-d "embeddings" (padded to a tiny dim for the test).
// Query vector [1, 0] is closest to verse A, then B, then C.
const DIMS = 2;
const VECTORS = new Int8Array([
  100, 0, // A: GEN 1:1
  70, 70, // B: EXO 2:2  (NT/OT mix for filter test)
  0, 100, // C: MAT 3:3
]);
const INDEX = {
  model: 'test',
  dims: DIMS,
  count: 3,
  verses: [
    { b: 'GEN', c: 1, v: 1, s: 0.01 },
    { b: 'EXO', c: 2, v: 2, s: 0.01 },
    { b: 'MAT', c: 3, v: 3, s: 0.01 },
  ],
};

// Mock the index JSON import.
vi.mock('../data/kjv-embeddings-index.json', () => ({ default: INDEX }));

// Mock the transformers pipeline: query "fear" -> vector aligned with verse A.
vi.mock('@xenova/transformers', () => ({
  env: {},
  pipeline: vi.fn(async () => async () => ({ data: new Float32Array([1, 0]) })),
}));

// Mock the search.js helpers reused by semanticSearch.
vi.mock('../utils/search', () => ({
  isBookAllowed: (bookId, filters = {}) => {
    if (filters.books?.length && !filters.books.includes(bookId)) return false;
    if (filters.testament === 'NT' && bookId !== 'MAT') return false;
    if (filters.testament === 'OT' && bookId === 'MAT') return false;
    return true;
  },
  loadTranslationBundle: async () => ({
    'GEN:1': [{ verse: 1, text: 'In the beginning' }],
    'EXO:2': [{ verse: 2, text: 'And the child grew' }],
    'MAT:3': [{ verse: 3, text: 'Repent ye' }],
  }),
}));

beforeEach(() => {
  vi.resetModules();
  global.fetch = vi.fn(async () => ({
    ok: true,
    headers: { get: () => 'application/octet-stream' },
    arrayBuffer: async () => VECTORS.buffer,
  }));
});

async function importFresh() {
  return import('../utils/semanticSearch');
}

describe('searchSemantic', () => {
  it('returns empty result for blank query', async () => {
    const { searchSemantic } = await importFresh();
    const out = await searchSemantic('   ');
    expect(out).toEqual({ query: '', results: [], totalMatches: 0, truncated: false });
  });

  it('ranks verses by semantic similarity to the query', async () => {
    const { searchSemantic } = await importFresh();
    const out = await searchSemantic('fear', { minScore: -1 });
    expect(out.results.map((r) => r.bookId)).toEqual(['GEN', 'EXO', 'MAT']);
    // Scores are monotonically non-increasing.
    const scores = out.results.map((r) => r.score);
    expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
    expect(scores[1]).toBeGreaterThanOrEqual(scores[2]);
  });

  it('rehydrates verse text and result shape from the bundle', async () => {
    const { searchSemantic } = await importFresh();
    const out = await searchSemantic('fear', { minScore: -1, maxResults: 1 });
    expect(out.results[0]).toMatchObject({
      sourceType: 'bible',
      type: 'Scripture',
      bookId: 'GEN',
      chapter: 1,
      verse: 1,
      text: 'In the beginning',
    });
    expect(out.truncated).toBe(true);
    expect(out.totalMatches).toBe(3);
  });

  it('respects the book filter', async () => {
    const { searchSemantic } = await importFresh();
    const out = await searchSemantic('fear', { minScore: -1, books: ['MAT'] });
    expect(out.results.map((r) => r.bookId)).toEqual(['MAT']);
  });

  it('respects the testament filter', async () => {
    const { searchSemantic } = await importFresh();
    const out = await searchSemantic('fear', { minScore: -1, testament: 'NT' });
    expect(out.results.map((r) => r.bookId)).toEqual(['MAT']);
  });

  it('throws AbortError when the signal is already aborted', async () => {
    const { searchSemantic } = await importFresh();
    const controller = new AbortController();
    controller.abort();
    await expect(searchSemantic('fear', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('gives a clear error (not a JSON parse error) when the asset is served as HTML', async () => {
    // Simulates a stale service worker / SPA-fallback returning index.html for the .bin.
    global.fetch = vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'text/html; charset=utf-8' },
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    const { searchSemantic } = await importFresh();
    await expect(searchSemantic('fear', { minScore: -1 })).rejects.toThrow(/refreshing the app/i);
  });
});
