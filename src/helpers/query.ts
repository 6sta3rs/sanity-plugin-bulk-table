/**
 * The table's queries. All three — the count, the list of ids and the row
 * fetch — have to see exactly the same set of documents.
 */

/**
 * One logical document = one row.
 *
 * Drops `versions.**`, and for a document that has both a published version and
 * a draft it keeps the draft and discards the published copy. That way
 * `offset`/`limit` work straight on the result and nothing has to be deduped in
 * the browser.
 *
 * This expression is shared by the count and by the list, and that is not
 * cosmetic. The count used to add up "published" and "drafts without a
 * published version" separately, which meant that under search it matched the
 * pattern against the **published** text while the list matched it against the
 * **draft**. A document titled "Alpha" with a draft titled "Beta" then reported
 * "1 item" and an empty table when you searched for "Alpha", and one row over
 * "0 / 0" pages when you searched for "Beta".
 */
const DEDUPED_FILTER =
  `_type == $type && !(_id in path("versions.**")) && ` +
  `(_id in path("drafts.**") || !defined(*[_id == "drafts." + ^._id][0]._id))`

/** How many rows there are — exactly the ones `buildPageIdsQuery` returns. */
export function buildTotalQuery(searchQuery: string): string {
  return `count(*[${DEDUPED_FILTER}${searchQuery}])`
}

/**
 * The ids on one page.
 *
 * `start`/`end` go into the query as literal numbers rather than as params:
 * they are always the result of an internal calculation, never text from the
 * user. `trunc` keeps it that way.
 */
export function buildPageIdsQuery(
  searchQuery: string,
  orderQuery: string,
  start: number,
  end: number,
): string {
  return (
    `*[${DEDUPED_FILTER}${searchQuery}]${orderQuery}` +
    `[${Math.trunc(start)}...${Math.trunc(end)}]._id`
  )
}

/**
 * The contents of one page of rows.
 *
 * The parts of the projection go through `filter` instead of being glued
 * together with conditional commas. With NO column selected — an ordinary
 * state, just untick everything in the column picker — the empty `join` left an
 * empty member in the middle (`{ _id, _type, , … }`), GROQ failed to parse the
 * whole list and the table showed an error instead of documents. Same for a
 * type with no translatable fields, where the empty member ended up last.
 */
export function buildRowsQuery(columnKeys: string[], coverage: string): string {
  const projection = ['_id', '_type', ...columnKeys, coverage].filter(Boolean).join(', ')
  return `*[_id in $ids]{ ${projection} }`
}
