import { DocumentId, getPublishedId } from '@sanity/id-utils';
import { SanityClient } from '@sanity/client';
import { useCallback, useEffect, useState } from 'react';
import { debounceTime, tap } from 'rxjs/operators';
import { SanityDocument } from 'sanity';

import { defaultDatetimesObj } from './constants';
import { ColumnOrder } from './hooks/useStickyStateOrder';
import { PluginError, handleDataFetchError } from './utils/errorHandling';

// Strips both the `drafts.` and `versions.<name>.` prefixes, giving the
// stable id that identifies a document regardless of its draft/version state.
export const normalizeId = (id: string): string =>
  getPublishedId(DocumentId(id));

// Builds the single query used to fetch one page of ids directly from the
// server: it excludes `versions.**` documents, and for any published
// document that has its own draft, filters out the published copy so each
// logical document appears exactly once (preferring the draft id). This
// means paging never needs client-side dedup or sequential batch fetches —
// offset/limit apply natively via the trailing slice.
// `start`/`end` are embedded as numeric literals (not bound params) because
// they're always internally-computed numbers, never user input.
export function buildPageIdsQuery(
  searchQuery: string,
  orderQuery: string,
  start: number,
  end: number,
): string {
  return (
    `*[_type == $type && !(_id in path("versions.**")) && ` +
    `(_id in path("drafts.**") || !defined(*[_id == "drafts." + ^._id][0]._id))` +
    `${searchQuery}]${orderQuery}[${Math.trunc(start)}...${Math.trunc(end)}]._id`
  );
}

type ResultDocument = SanityDocument & {
  _normalizedId: string;
  _status: 'published' | 'published_with_pending_changes' | 'draft';
};

// Same as ResultDocument, plus the `_lastPublishedAt` field the results
// reducer below computes (used by the `_lastPublishedAt` column only).
type IndexedResultDocument = ResultDocument & {
  _lastPublishedAt: string | null;
};

export interface PaginatedClient {
  results: ResultDocument[];
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
  loading: boolean;
  pageIds: string[];
  total: number;
  refresh: () => void;
  setUserQuery: (query: string) => void;
  error: PluginError | null;
}

interface Params {
  type: string;
  pageSize: number;
  selectedColumns: Set<string>;
  searchableFields: ((q: string) => string)[];
  orderColumn: ColumnOrder;
  client: SanityClient;
}

function usePaginatedClient({
  type,
  pageSize,
  selectedColumns,
  searchableFields,
  orderColumn,
  client,
}: Params) {
  // the loading statuses are a set of strings
  // when it's empty, nothing is loading
  const [loadingStatuses, setLoadingStatuses] = useState(new Set<string>());
  const loading = loadingStatuses.size > 0;

  const [error, setError] = useState<PluginError | null>(null);

  // stores the state for the total amount of de-duped documents
  const [total, setTotal] = useState(0);

  // uses the pageSize to calculate the total pages
  const totalPages = Math.ceil(total / pageSize);

  // stores the current set of active IDs on the page.
  // these are fed into the `useEffect` that creates the `results` state
  const [pageIds, setPageIds] = useState<string[]>([]);

  // the current page. changing this will trigger a re-fetch of the `pageIds`
  const [page, setPage] = useState(0);

  // the current result set
  const [results, setResults] = useState<ResultDocument[]>([]);

  // Refresh mechanism: bumping this counter re-runs the effects below
  const [refreshId, setRefreshId] = useState(0);
  const refresh = useCallback(() => setRefreshId((n) => n + 1), []);

  const [userQuery, setUserQuery] = useState('');
  // Builds the string to use when a custom filter has been entered
  const searchQuery =
    userQuery.length && searchableFields.length
      ? ` && (${searchableFields.map((fn) => fn(userQuery)).join(' || ')})`
      : '';

  // Implements ordering from the <th> buttons
  const orderQuery = orderColumn
    ? `| order(${orderColumn.key}${orderColumn.type === 'slug' ? '.current' : ''} ${orderColumn.direction})`
    : ``;

  // get total count
  useEffect(() => {
    let canceled = false;

    async function getTotalCount() {
      setLoadingStatuses((prev) => {
        const next = new Set(prev);
        next.add('total_count');
        return next;
      });

      try {
        // Single round trip: published (non-draft, non-version) count, plus
        // drafts that have no published counterpart (a join expressed via
        // `^._id` inside the nested subquery), so nothing over-counts
        // `versions.**` documents and no id list needs to travel over the wire.
        const { notDraftCount, draftOnlyCount } = await client.fetch<{
          notDraftCount: number;
          draftOnlyCount: number;
        }>(
          `{
            "notDraftCount": count(*[_type == $type && !(_id in path("drafts.**")) && !(_id in path("versions.**")) ${searchQuery}]),
            "draftOnlyCount": count(*[_type == $type && _id in path("drafts.**") ${searchQuery} && !defined(*[_id == string::split(^._id, "drafts.")[1]][0])])
          }`,
          { type },
        );

        if (canceled) return;

        setTotal(notDraftCount + draftOnlyCount);
        setError(null);
      } catch (e) {
        const pluginError = handleDataFetchError(e, 'getting total count');
        if (!canceled) setError(pluginError);
      } finally {
        if (!canceled) {
          setLoadingStatuses((prev) => {
            const next = new Set(prev);
            next.delete('total_count');
            return next;
          });
        }
      }
    }

    void getTotalCount();

    return () => {
      canceled = true;
    };
  }, [client, type, refreshId, searchQuery]);

  // get page IDs
  useEffect(() => {
    let canceled = false;

    const getPageIds = async (targetPage: number) => {
      setLoadingStatuses((prev) => {
        const next = new Set(prev);
        next.add('page_ids');
        return next;
      });

      try {
        // Single round trip: the query already dedupes drafts/published
        // pairs and excludes `versions.**` server-side, so offset/limit
        // apply directly — no client-side dedup or batching needed.
        const start = targetPage * pageSize;
        const rawIds = await client.fetch<string[]>(
          buildPageIdsQuery(searchQuery, orderQuery, start, start + pageSize),
          { type },
        );

        return rawIds.map(normalizeId);
      } finally {
        if (!canceled) {
          setLoadingStatuses((prev) => {
            const next = new Set(prev);
            next.delete('page_ids');
            return next;
          });
        }
      }
    };

    getPageIds(page)
      .then((ids) => {
        if (!canceled) {
          // Keep the previous array reference when the id list is
          // unchanged (e.g. a manual refresh() that didn't add, remove, or
          // reorder any documents on this page), so the results effect
          // below - and its client.listen subscription - doesn't tear down
          // and re-run just because a new (but equal) array was set.
          setPageIds((prev) =>
            prev.length === ids.length && prev.every((id, i) => id === ids[i])
              ? prev
              : ids,
          );
          setError(null);
        }
        return;
      })
      .catch((e) => {
        const pluginError = handleDataFetchError(e, 'fetching page IDs');
        if (!canceled) setError(pluginError);
      });

    return () => {
      canceled = true;
    };
  }, [client, page, pageSize, type, refreshId, searchQuery, orderQuery]);

  // get results
  useEffect(() => {
    let canceled = false;

    // take all the input IDs and duplicate them with the prefix `drafts.`
    const ids = pageIds.flatMap((id) => [id, `drafts.${id}`]);
    // Inner-object selected keys need to be shaped in the query
    const columnKeys = Array.from(selectedColumns).map((key: string) =>
      key.includes('.') ? `"${key}": ${key}` : key,
    );

    if (
      !columnKeys.includes(defaultDatetimesObj._updatedAt.key) &&
      columnKeys.includes(defaultDatetimesObj._lastPublishedAt.key)
    ) {
      columnKeys.push(defaultDatetimesObj._updatedAt.key);
    }

    const columnKeysString = columnKeys.join(', ');

    // these IDs will go into a specific query. if the draft or published
    // version happens to not exist, that's okay.
    // `searchQuery`/`orderQuery` are deliberately NOT applied here:
    // `pageIds` (and therefore `ids`, derived from it) already went through
    // both server-side via the page-ids query, and the results below are
    // re-sorted in JS by `indexes` regardless of query order. Re-applying
    // them here was pure duplicate work, and - because they're also this
    // effect's dependencies - made every sort/search change fire this fetch
    // twice: once with the stale `pageIds` and again once the new ones
    // arrived from the page-ids effect.
    const query = `*[_id in $ids]{ _id, _type, ${columnKeysString} }`;

    async function getResults() {
      setLoadingStatuses((prev) => {
        const next = new Set(prev);
        next.add('results');
        return next;
      });

      try {
        // create a dictionary of indexes where the keys are the IDs and the
        // values are the current index. this dictionary will be used to sort the
        // documents in their original order
        const indexes = pageIds.reduce<{ [id: string]: number }>(
          (acc, id, index) => {
            acc[id] = index;
            return acc;
          },
          {},
        );

        const newResults = await client.fetch<SanityDocument[]>(query, {
          ids,
        });

        // reduce the results into an accumulator by their normalized ID.
        // if there is a draft version, prefer the draft over the published
        const reducedResults = Object.values(
          newResults.reduce<{ [id: string]: IndexedResultDocument }>(
            (acc, next) => {
              const id = normalizeId(next._id);
              const preceding = acc[id];

              const precedingIsDraft = preceding?._id.startsWith('drafts.');
              const nextIsDraft = next?._id.startsWith('drafts.');

              const status = preceding
                ? 'published_with_pending_changes'
                : nextIsDraft
                  ? 'draft'
                  : 'published';

              const base = precedingIsDraft ? preceding : next;

              const lastPublishedAt =
                orderColumn.key === '_updatedAt' &&
                orderColumn.direction === 'desc'
                  ? nextIsDraft
                    ? null
                    : next._updatedAt
                  : preceding
                    ? preceding._updatedAt
                    : nextIsDraft
                      ? null
                      : next._updatedAt;

              acc[id] = {
                ...base,
                _status: status,
                _normalizedId: id,
                _lastPublishedAt: lastPublishedAt,
              };

              return acc;
            },
            {},
          ),
        );

        if (canceled) return;

        setResults(
          reducedResults
            .slice()
            // sort the accumulated version by their original index
            .sort(
              (a: SanityDocument, b: SanityDocument) =>
                indexes[normalizeId(a._id)] - indexes[normalizeId(b._id)],
            ),
        );
        setError(null);
      } catch (e) {
        const pluginError = handleDataFetchError(e, 'fetching results');
        if (!canceled) setError(pluginError);
      } finally {
        if (!canceled) {
          setLoadingStatuses((prev) => {
            const next = new Set(prev);
            next.delete('results');
            return next;
          });
        }
      }
    }

    void getResults();

    // Listen only to the documents currently shown on this page (draft +
    // published variants), instead of the whole type — a page's worth of ids
    // is small and doesn't need a full-type subscription. A change to one of
    // these documents triggers a refetch of the same page; it no longer
    // appends new ids past `pageSize` (a new document should be picked up by
    // re-paging/refreshing, not by growing this page unbounded).
    const idsToWatch = pageIds.flatMap((id) => [id, `drafts.${id}`]);
    if (idsToWatch.length === 0) {
      return () => {
        canceled = true;
      };
    }

    const subscription = client
      .listen(`*[_id in $ids]`, { ids: idsToWatch })
      .pipe(
        tap(() => {
          setLoadingStatuses((prev) => {
            const next = new Set(prev);
            next.add('results');
            return next;
          });
        }),
        debounceTime(1000),
      )
      .subscribe(() => {
        void getResults();
      });

    return () => {
      canceled = true;
      subscription.unsubscribe();
    };
  }, [client, pageIds, selectedColumns, refreshId, orderColumn]);

  // Reset the page when totalPages shrinks past it (e.g. pageSize changed,
  // or the result count dropped). Adjusted during render rather than in an
  // effect, per https://react.dev/learn/you-might-not-need-an-effect
  // ("Adjusting state when a prop changes") -- this avoids the extra
  // render+effect+re-render cascade of doing it after the fact.
  const [prevTotalPages, setPrevTotalPages] = useState(totalPages);
  if (totalPages !== prevTotalPages) {
    setPrevTotalPages(totalPages);
    if (page >= totalPages) {
      setPage(0);
    }
  }

  return {
    results,
    page,
    totalPages,
    setPage,
    loading,
    pageIds,
    total,
    refresh,
    setUserQuery,
    error,
  };
}

export default usePaginatedClient;
