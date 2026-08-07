import {SanityClient} from '@sanity/client'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {debounceTime} from 'rxjs/operators'
import {SanityDocument} from 'sanity'

import {defaultDatetimesObj} from './constants'
import {coverageProjection, i18nOrderKey, isI18nArray} from './helpers/i18n'
import {buildPageIdsQuery, buildRowsQuery, buildTotalQuery} from './helpers/query'
import {ResultDocument, publishedIdOf, reduceResults} from './helpers/results'
import {ColumnOrder} from './hooks/useStickyState'
import {PluginError, handleDataFetchError} from './utils/errorHandling'

export type {ResultDocument}

export interface PaginatedClient {
  results: ResultDocument[]
  page: number
  totalPages: number
  setPage: (page: number) => void
  loading: boolean
  total: number
  refresh: () => void
  setUserQuery: (query: string) => void
  error: PluginError | null
}

interface Params {
  type: string
  pageSize: number
  selectedColumns: Set<string>
  /** GROQ expressions referring to `$q`, e.g. `title match $q`. */
  searchableFields: string[]
  orderColumn: ColumnOrder
  client: SanityClient
  /** The language the `internationalizedArray*` columns sort by. */
  language?: string
  /** Appended to every filter, `&&` already included (or ''). */
  extraFilter?: string
  /** Translatable fields — used to project language coverage onto a row. */
  i18nFields?: string[]
}

function usePaginatedClient({
  type,
  pageSize,
  selectedColumns,
  searchableFields,
  orderColumn,
  client,
  language = '',
  extraFilter = '',
  i18nFields = [],
}: Params) {
  // A count of in-flight queries, not a set of their names: nobody ever asked
  // *which* one is loading, and the set version stopped the spinner too early —
  // two parallel runs of the same effect deleted a single name.
  const [pending, setPending] = useState(0)
  const loading = pending > 0

  const [error, setError] = useState<PluginError | null>(null)
  const [total, setTotal] = useState(0)
  const totalPages = Math.ceil(total / pageSize)

  const [pageIds, setPageIds] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [results, setResults] = useState<ResultDocument[]>([])

  // Bumping the counter runs the effects below once more.
  const [refreshId, setRefreshId] = useState(0)
  const refresh = useCallback(() => setRefreshId((n) => n + 1), [])

  const [userQuery, setUserQuery] = useState('')

  // The search term goes in as the `$q` parameter instead of being spliced
  // into the query text. That leaves nothing to "sanitize": a quote, a brace or
  // a backslash are ordinary characters to GROQ, not syntax. It is what removed
  // `utils/sanitization.ts` and its blocklist of characters entirely — a
  // blocklist that also silently ate legitimate search terms.
  const searchQuery =
    (userQuery.length && searchableFields.length ? ` && (${searchableFields.join(' || ')})` : '') +
    extraFilter

  const params = useMemo(
    () => (userQuery.length ? {type, q: `${userQuery}*`} : {type}),
    [type, userQuery],
  )

  // An `internationalizedArray*` column holds every language at once, so it
  // sorts by the value in the language picked in the header — `order(title
  // asc)` on the array itself sorts nothing.
  const orderKey =
    orderColumn.key && isI18nArray(orderColumn.type ?? '')
      ? i18nOrderKey(orderColumn.key, language)
      : `${orderColumn.key}${orderColumn.type === 'slug' ? '.current' : ''}`

  const orderQuery = orderColumn.key ? `| order(${orderKey} ${orderColumn.direction})` : ``

  // The item count
  useEffect(() => {
    let canceled = false

    async function getTotal() {
      setPending((n) => n + 1)
      try {
        const count = await client.fetch<number>(buildTotalQuery(searchQuery), params)
        if (canceled) return
        setTotal(count)
        setError(null)
      } catch (e) {
        if (!canceled) setError(handleDataFetchError(e, 'item count'))
      } finally {
        setPending((n) => n - 1)
      }
    }

    void getTotal()

    return () => {
      canceled = true
    }
  }, [client, params, refreshId, searchQuery])

  // The ids on the current page
  useEffect(() => {
    let canceled = false
    const start = page * pageSize

    async function getPageIds() {
      setPending((n) => n + 1)
      try {
        const rawIds = await client.fetch<string[]>(
          buildPageIdsQuery(searchQuery, orderQuery, start, start + pageSize),
          params,
        )
        if (canceled) return
        const ids = rawIds.map(publishedIdOf)
        // The same array as last time stays the same array: a refresh that
        // added nothing and reordered nothing has no reason to tear down the
        // `listen` subscription and re-fetch the rows.
        setPageIds((prev) =>
          prev.length === ids.length && prev.every((id, i) => id === ids[i]) ? prev : ids,
        )
        setError(null)
      } catch (e) {
        if (!canceled) setError(handleDataFetchError(e, 'item list'))
      } finally {
        setPending((n) => n - 1)
      }
    }

    void getPageIds()

    return () => {
      canceled = true
    }
  }, [client, page, pageSize, params, refreshId, searchQuery, orderQuery])

  // The row contents. `searchQuery`/`orderQuery` are deliberately NOT here:
  // `pageIds` has already been through both on the server, and the order is
  // restored by `reduceResults` anyway.
  const fetchResults = useCallback(async () => {
    if (!pageIds.length) {
      setResults([])
      return
    }

    // Nested fields have to be named in the projection: `"a.b": a.b`.
    const columnKeys = Array.from(selectedColumns).map((key) =>
      key.includes('.') ? `"${key}": ${key}` : key,
    )

    if (
      !columnKeys.includes(defaultDatetimesObj._updatedAt.key) &&
      columnKeys.includes(defaultDatetimesObj._lastPublishedAt.key)
    ) {
      columnKeys.push(defaultDatetimesObj._updatedAt.key)
    }

    // Language coverage travels with every row regardless of the chosen
    // columns: "Languages" is not a column you pick, it is the row's state.
    const coverage = coverageProjection(i18nFields)
    const query = buildRowsQuery(columnKeys, coverage)

    const ids = pageIds.flatMap((id) => [id, `drafts.${id}`])

    setPending((n) => n + 1)
    try {
      const documents = await client.fetch<SanityDocument[]>(query, {ids})
      setResults(reduceResults(documents, pageIds))
      setError(null)
    } catch (e) {
      setError(handleDataFetchError(e, 'row contents'))
    } finally {
      setPending((n) => n - 1)
    }
  }, [client, pageIds, selectedColumns, i18nFields])

  useEffect(() => {
    // Wrapped rather than called straight: `fetchResults` sets state on its
    // first statement, and a synchronous setState in an effect body is a
    // cascading render.
    async function run() {
      await fetchResults()
    }

    void run()
  }, [fetchResults, refreshId])

  // The live listener — its own effect, depending only on the ids being
  // watched. It used to sit together with the row fetch, so unticking a column
  // in the menu tore down and reopened the connection to the dataset even
  // though the set of documents had not changed. The fetching function is
  // reached through a ref precisely so that changing it doesn't drop the
  // subscription.
  const fetchRef = useRef(fetchResults)
  useEffect(() => {
    fetchRef.current = fetchResults
  }, [fetchResults])

  useEffect(() => {
    // `undefined`, not a bare `return`: the other branch returns a cleanup
    // function, and the two have to agree.
    if (!pageIds.length) return undefined

    const ids = pageIds.flatMap((id) => [id, `drafts.${id}`])

    const subscription = client
      .listen(`*[_id in $ids]`, {ids})
      .pipe(debounceTime(1000))
      .subscribe(() => {
        void fetchRef.current()
      })

    return () => subscription.unsubscribe()
  }, [client, pageIds])

  // Step off a page that no longer exists (page size change, a filter, a
  // deletion). Adjusted during the render rather than in an effect — see
  // "Adjusting state when a prop changes" in the React docs; an effect would
  // cost an extra pass.
  const [prevTotalPages, setPrevTotalPages] = useState(totalPages)
  if (totalPages !== prevTotalPages) {
    setPrevTotalPages(totalPages)
    if (page >= totalPages) setPage(0)
  }

  // Memoized because `contextValue` in `context.tsx` lists it as a dependency:
  // a fresh literal on every render invalidated that `useMemo` every time.
  return useMemo(
    () => ({
      results,
      page,
      totalPages,
      setPage,
      loading,
      total,
      refresh,
      setUserQuery,
      error,
    }),
    [results, page, totalPages, loading, total, refresh, error],
  )
}

export default usePaginatedClient
