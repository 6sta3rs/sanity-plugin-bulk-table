// `import type`, not a plain import: the pure functions here are exercised by
// tests that load the file directly, where there is nothing to resolve from the
// `sanity` package.
import type {SanityDocument} from 'sanity'

/**
 * Folding a published/draft pair into a single table row.
 *
 * A pure function, outside React and outside the network — because this is
 * where two bugs lived at once, and only out here can an assertion pin them
 * down.
 */

export type RowStatus = 'published' | 'published_with_pending_changes' | 'draft'

export interface ResultDocument extends SanityDocument {
  _normalizedId: string
  _status: RowStatus
  /**
   * `_updatedAt` of the published version, or `null` when there is none.
   * Sanity keeps no last-published date, so this is the closest approximation.
   */
  _lastPublishedAt: string | null
}

const DRAFTS = 'drafts.'

export const isDraftId = (id: string): boolean => id.startsWith(DRAFTS)

/**
 * The id without its `drafts.` prefix.
 *
 * A prefix check is enough, no `@sanity/id-utils`: the only ids reaching this
 * function come from `$ids`, i.e. one page of results and their drafts.
 * `versions.**` documents are already filtered out by the query.
 */
export const publishedIdOf = (id: string): string => (isDraftId(id) ? id.slice(DRAFTS.length) : id)

/**
 * Documents from one query → rows, in `pageIds` order.
 *
 * The order is restored in JavaScript because `*[_id in $ids]` does not
 * preserve the order of the list, and the dataset had already sorted it in the
 * query that fetched the ids.
 */
export function reduceResults(documents: SanityDocument[], pageIds: string[]): ResultDocument[] {
  const pairs = new Map<string, {draft?: SanityDocument; published?: SanityDocument}>()

  for (const document of documents) {
    const id = publishedIdOf(document._id)
    const pair = pairs.get(id) ?? {}
    if (isDraftId(document._id)) pair.draft = document
    else pair.published = document
    pairs.set(id, pair)
  }

  const position = new Map(pageIds.map((id, index) => [id, index]))

  return Array.from(pairs, ([id, {draft, published}]): ResultDocument => {
    // The draft wins: it is what the editor sees on opening the document.
    const base = draft ?? published

    return {
      ...(base as SanityDocument),
      _normalizedId: id,
      _status:
        draft && published ? 'published_with_pending_changes' : draft ? 'draft' : 'published',
      // The date of the published version — the only one that has anything to
      // do with publishing. The pick used to depend on whichever column the
      // table happened to be sorted by, so a published document with a draft
      // read "Not published" whenever the table stood on "Updated" descending.
      _lastPublishedAt: published?._updatedAt ?? null,
    }
  }).sort((a, b) => (position.get(a._normalizedId) ?? 0) - (position.get(b._normalizedId) ?? 0))
}
