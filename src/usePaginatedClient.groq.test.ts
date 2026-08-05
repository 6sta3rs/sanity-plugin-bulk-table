import { evaluate, parse } from 'groq-js';
import { describe, expect, it } from 'vitest';

import { buildPageIdsQuery } from './usePaginatedClient';

// Verifies the server-side dedup query against groq-js, the reference GROQ
// implementation - not against a live Sanity dataset, but against the exact
// query string the production code sends (`buildPageIdsQuery` is imported,
// not re-typed here).
type Doc = { _id: string; _type: string };

function buildDataset() {
  const dataset: Doc[] = [];
  for (let i = 0; i < 60; i++) {
    dataset.push({ _id: `pub-only-${i}`, _type: 'thing' });
  }
  for (let i = 0; i < 40; i++) {
    dataset.push({ _id: `drafts.draft-only-${i}`, _type: 'thing' });
  }
  for (let i = 0; i < 50; i++) {
    dataset.push({ _id: `paired-${i}`, _type: 'thing' });
    dataset.push({ _id: `drafts.paired-${i}`, _type: 'thing' });
  }
  for (let i = 0; i < 10; i++) {
    dataset.push({ _id: `versions.release1.ver-${i}`, _type: 'thing' });
  }
  for (let i = 0; i < 10; i++) {
    dataset.push({ _id: `other-${i}`, _type: 'otherThing' });
  }
  return dataset;
}

const DEDUPED_TOTAL = 60 + 40 + 50; // pub-only + draft-only + paired, one entry each

async function runQuery(dataset: Doc[], start: number, end: number) {
  const orderQuery = '| order(_id asc)';
  const query = buildPageIdsQuery('', orderQuery, start, end);
  const tree = parse(query);
  const value = await evaluate(tree, {
    dataset,
    params: { type: 'thing' },
  });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- groq-js's StreamValue#get() is typed `unknown`; the query shape (`._id`) guarantees a string[] here.
  return (await value.get()) as string[];
}

describe('buildPageIdsQuery (verified against groq-js)', () => {
  it('excludes published docs that have a draft, versions.** docs, and other types', async () => {
    const dataset = buildDataset();
    const result = await runQuery(dataset, 0, 1000);

    expect(result).toHaveLength(DEDUPED_TOTAL);
    expect(result.some((id) => id.startsWith('versions.'))).toBe(false);
    expect(result.some((id) => id.startsWith('other-'))).toBe(false);
    // every paired doc must appear as its draft, never as the bare published id
    expect(result.some((id) => /^paired-\d+$/.test(id))).toBe(false);
    expect(
      Array.from({ length: 50 }, (_, i) => `drafts.paired-${i}`).every((id) =>
        result.includes(id),
      ),
    ).toBe(true);
  });

  it('pages with a non-divisor page size cover the full set with no gaps or duplicates', async () => {
    const dataset = buildDataset();
    const full = await runQuery(dataset, 0, 1000);

    const pageSize = 17;
    const starts: number[] = [];
    for (let start = 0; start < DEDUPED_TOTAL + pageSize; start += pageSize) {
      starts.push(start);
    }
    // Pages are independent (each `start` is precomputed), so fetch them
    // concurrently instead of sequentially awaiting inside the loop.
    // Promise.all preserves order, so this doesn't affect the assembled result.
    const pages = await Promise.all(
      starts.map((start) => runQuery(dataset, start, start + pageSize)),
    );
    const assembled = pages.flat();

    expect(assembled).toEqual(full);
    expect(new Set(assembled).size).toBe(assembled.length);
  });
});
