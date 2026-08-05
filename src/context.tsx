import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ObjectField, SchemaType } from 'sanity';

import { Options, orderColumnDefault, rowsPerPage } from './constants';
import { ColumnOrder, useStickyStateOrder } from './hooks/useStickyStateOrder';
import { useStickyStateSet } from './hooks/useStickyStateSet';
import usePaginatedClient, { PaginatedClient } from './usePaginatedClient';
import { sanitizeGroqInput } from './utils/sanitization';

interface BulkActionsTableContextValue {
  options: Options;
  schemaType: SchemaType;
  pageSize: number;
  setPageSize: (num: number) => void;
  selectedColumns: Set<string>;
  setSelectedColumns: (set: Set<string>) => void;
  orderColumn: ColumnOrder;
  setOrderColumn: (obj: ColumnOrder) => void;
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  isSelectState: boolean;
  setIsSelectState: (bool: boolean) => void;
  paginatedClient: PaginatedClient;
}

// No fake default object: every real field (Options/SchemaType/PaginatedClient)
// is either sourced from Sanity's dynamic schema API or a hook return type that
// can't be honestly stubbed out without a full mock implementation. `null` is
// the honest default; the hook below throws if it's ever read outside the
// Provider (which never happens in this plugin's component tree).
const BulkActionsTableContext =
  createContext<BulkActionsTableContextValue | null>(null);

export const useBulkActionsTableContext = () => {
  const value = useContext(BulkActionsTableContext);
  if (!value) {
    throw new Error(
      'useBulkActionsTableContext must be used within a BulkActionsTableProvider',
    );
  }
  return value;
};

// Kept out of BulkActionsTableContext on purpose: searchValue changes on
// every keystroke, and that context's `contextValue` is read by the whole
// table (including every row's <Preview>). A dedicated context means only
// the components that actually read searchValue (SearchField, NoResultsState)
// re-render while typing.
interface SearchContextValue {
  searchValue: string;
  setSearchValue: (searchValue: string) => void;
}

// Explicit generic (rather than casting the no-op default's setter) so the
// context's real type always requires the 1-arg setter SearchProvider
// actually supplies -- the no-op below only needs to satisfy that shape, not
// literally declare a matching parameter.
const SearchContext = createContext<SearchContextValue>({
  searchValue: '',
  setSearchValue: () => {},
});

export const useSearchContext = () => useContext(SearchContext);

export const SearchProvider = ({ children }: { children: ReactNode }) => {
  const [searchValue, setSearchValue] = useState('');
  const value = useMemo(
    () => ({ searchValue, setSearchValue }),
    [searchValue],
  );
  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
};

export const BulkActionsTableProvider = ({
  options,
  children,
}: {
  options: Options;
  children: ReactNode;
}) => {
  const { type, schema, client } = options;
  const schemaType = useMemo(() => {
    const resolved = schema.get(type);
    if (!resolved) {
      throw new Error(`Unknown schema type: "${type}"`);
    }
    return resolved;
  }, [type, schema]);

  const [pageSize, setPageSize] = useState(rowsPerPage[0]);
  const [selectedColumns, setSelectedColumns] = useStickyStateSet(
    new Set<string>(),
    `bulk-actions-table-${type}-selected-columns`,
  );
  const [orderColumn, setOrderColumn] = useStickyStateOrder(
    orderColumnDefault,
    `bulk-actions-table-${type}-order-column`,
  );
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [isSelectState, setIsSelectState] = useState<boolean>(false);

  const searchableFields = useMemo(
    () =>
      ('fields' in schemaType ? schemaType.fields : []).reduce(
        (agg, field: ObjectField) => {
          const name = field.name;

          // Validate field name for security
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
            return agg; // Skip invalid field names
          }

          if (field?.type?.jsonType === 'string') {
            agg.push((query: string) => {
              const sanitizedQuery = sanitizeGroqInput(query);
              return sanitizedQuery
                ? `${name} match "${sanitizedQuery}*"`
                : 'true';
            });
          }
          if (field?.type?.name === 'slug') {
            agg.push((query: string) => {
              const sanitizedQuery = sanitizeGroqInput(query);
              return sanitizedQuery
                ? `${name}.current match "${sanitizedQuery}*"`
                : 'true';
            });
          }
          if (field?.type?.name === 'number') {
            agg.push((query: string) => {
              const sanitizedQuery = sanitizeGroqInput(query);
              return sanitizedQuery
                ? `string(${name}) match "${sanitizedQuery}*"`
                : 'true';
            });
          }
          return agg;
        },
        [] as ((q: string) => string)[],
      ),
    [schemaType],
  );

  const paginatedClient = usePaginatedClient({
    type,
    pageSize,
    selectedColumns,
    searchableFields,
    orderColumn,
    client,
  });

  // Wire up the Studio menu's "Refresh" action (options.refresh) to the
  // paginated client's own refresh — nothing else subscribes to that emitter.
  const { refresh: refreshClient } = paginatedClient;
  useEffect(
    () => options.refresh.subscribe(refreshClient),
    [options.refresh, refreshClient],
  );

  const contextValue = useMemo(
    () => ({
      options,
      schemaType,
      pageSize,
      setPageSize,
      selectedColumns,
      setSelectedColumns,
      orderColumn,
      setOrderColumn,
      selectedIds,
      setSelectedIds,
      isSelectState,
      setIsSelectState,
      paginatedClient,
    }),
    [
      options,
      schemaType,
      pageSize,
      selectedColumns,
      setSelectedColumns,
      orderColumn,
      setOrderColumn,
      selectedIds,
      isSelectState,
      paginatedClient,
    ],
  );

  return (
    <BulkActionsTableContext.Provider value={contextValue}>
      {children}
    </BulkActionsTableContext.Provider>
  );
};
