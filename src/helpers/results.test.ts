import {SanityDocument} from 'sanity'
import {describe, expect, it} from 'vitest'

import {isDraftId, publishedIdOf, reduceResults} from './results'

const doc = (_id: string, _updatedAt: string): SanityDocument =>
  ({_id, _type: 'thing', _updatedAt}) as SanityDocument

describe('publishedIdOf', () => {
  it('strips the drafts. prefix', () => {
    expect(publishedIdOf('drafts.abc')).toBe('abc')
  })

  it('leaves a plain id untouched', () => {
    expect(publishedIdOf('abc')).toBe('abc')
  })

  it('recognises a draft id', () => {
    expect(isDraftId('drafts.abc')).toBe(true)
    expect(isDraftId('abc')).toBe(false)
  })
})

describe('reduceResults', () => {
  it('folds a draft/published pair into one row and keeps the draft on top', () => {
    const rows = reduceResults(
      [doc('abc', '2024-01-01T00:00:00Z'), doc('drafts.abc', '2024-02-01T00:00:00Z')],
      ['abc'],
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]._id).toBe('drafts.abc')
    expect(rows[0]._status).toBe('published_with_pending_changes')
  })

  it('takes _lastPublishedAt from the published half, whatever the sort order', () => {
    const [row] = reduceResults(
      [doc('drafts.abc', '2024-02-01T00:00:00Z'), doc('abc', '2024-01-01T00:00:00Z')],
      ['abc'],
    )

    expect(row._lastPublishedAt).toBe('2024-01-01T00:00:00Z')
  })

  it('reports a draft with no published version as not published', () => {
    const [row] = reduceResults([doc('drafts.abc', '2024-02-01T00:00:00Z')], ['abc'])

    expect(row._status).toBe('draft')
    expect(row._lastPublishedAt).toBeNull()
  })

  it('restores the order of pageIds, which the id query already sorted', () => {
    const rows = reduceResults(
      [doc('b', '2024-01-01T00:00:00Z'), doc('a', '2024-01-01T00:00:00Z')],
      ['a', 'b'],
    )

    expect(rows.map((row) => row._normalizedId)).toEqual(['a', 'b'])
  })
})
