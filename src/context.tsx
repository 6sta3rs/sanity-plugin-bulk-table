import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {ObjectField, SchemaType} from 'sanity'

import {MAX_COLUMN_WIDTH, Options, orderColumnDefault, rowsPerPage} from './constants'
import {isI18nArray, missingLanguageFilter} from './helpers/i18n'
import {
  ColumnOrder,
  useStickyState,
  useStickyStateOrder,
  useStickyStateSet,
} from './hooks/useStickyState'
import {LABELS, Labels} from './labels'
import usePaginatedClient, {PaginatedClient} from './usePaginatedClient'

interface BulkActionsTableContextValue {
  options: Options
  /** `LABELS` with the table's own overrides merged in. */
  labels: Labels
  schemaType: SchemaType
  pageSize: number
  setPageSize: (num: number) => void
  selectedColumns: Set<string>
  setSelectedColumns: (set: Set<string>) => void
  orderColumn: ColumnOrder
  setOrderColumn: (obj: ColumnOrder) => void
  selectedIds: Set<string>
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>
  isSelectState: boolean
  setIsSelectState: (bool: boolean) => void
  paginatedClient: PaginatedClient
  /** '' when the table was created without `languages`. */
  language: string
  setLanguage: (language: string) => void
  /** The schema's translatable fields — the denominator of "how much of this document is translated". */
  i18nFields: string[]
  /** Narrows the list down to documents with no text in the chosen language. */
  untranslatedOnly: boolean
  setUntranslatedOnly: (only: boolean) => void
  /** The "Languages" column — hidden like any other, it just isn't a schema field. */
  languagesVisible: boolean
  setLanguagesVisible: (visible: boolean) => void
  /** Columns as wide as their content instead of sharing the space evenly. */
  fullWidth: boolean
  setFullWidth: (full: boolean) => void
  /** Upper bound on a column's width in full-width mode (px). */
  maxColumnWidth: number
  setMaxColumnWidth: (width: number) => void
  /** Tighter rows. */
  dense: boolean
  setDense: (dense: boolean) => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}

// No dummy default value: every real field comes either from Sanity's dynamic
// schema API or from a hook, and none of them can be faked honestly. `null` is
// truthful, and the hook below throws if anyone reaches for the context outside
// the provider.
const BulkActionsTableContext = createContext<BulkActionsTableContextValue | null>(null)

/** Every string the table renders, overrides from `labels` already applied. */
export const useLabels = (): Labels => useBulkActionsTableContext().labels

export const useBulkActionsTableContext = () => {
  const value = useContext(BulkActionsTableContext)
  if (!value) {
    throw new Error('useBulkActionsTableContext must be used within a BulkActionsTableProvider')
  }
  return value
}

// Deliberately outside BulkActionsTableContext: `searchValue` changes on every
// keystroke, and that context is read by the whole table including every row's
// preview. A separate context means typing only re-renders the components that
// actually read the search term.
interface SearchContextValue {
  searchValue: string
  setSearchValue: (searchValue: string) => void
}

const SearchContext = createContext<SearchContextValue>({
  searchValue: '',
  setSearchValue: () => {},
})

export const useSearchContext = () => useContext(SearchContext)

export const SearchProvider = ({children}: {children: ReactNode}) => {
  const [searchValue, setSearchValue] = useState('')
  const value = useMemo(() => ({searchValue, setSearchValue}), [searchValue])
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

/**
 * The GROQ expressions the search field matches on — all of them refer to the
 * `$q` parameter, so the search term never becomes part of the query text.
 *
 * The field name is pattern-checked because it *is* interpolated: it comes from
 * the schema rather than from the user, but this is the only place left where
 * anything is spliced into a query at all.
 */
function searchExpressions(fields: ObjectField[]): string[] {
  const expressions: string[] = []

  for (const field of fields) {
    const name = field.name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) continue

    if (field?.type?.jsonType === 'string') {
      expressions.push(`${name} match $q`)
    }
    if (field?.type?.name === 'slug') {
      expressions.push(`${name}.current match $q`)
    }
    // Without this, search sees no translatable field at all — its `jsonType`
    // is `array`, so it matches none of the conditions above, and a catalogue
    // whose titles live in `internationalizedArray*` can only be searched by
    // SKU. It matches in every language, not just the chosen one: you type what
    // you remember, wherever it happens to be stored.
    if (isI18nArray(field?.type?.name ?? '')) {
      expressions.push(`count(${name}[value match $q]) > 0`)
    }
    if (field?.type?.name === 'number') {
      expressions.push(`string(${name}) match $q`)
    }
  }

  return expressions
}

export const BulkActionsTableProvider = ({
  options,
  children,
}: {
  options: Options
  children: ReactNode
}) => {
  const {type, schema, client} = options
  const schemaType = useMemo(() => {
    const resolved = schema.get(type)
    if (!resolved) {
      throw new Error(`Unknown schema type: "${type}"`)
    }
    return resolved
  }, [type, schema])

  const [pageSize, setPageSize] = useState(rowsPerPage[0])
  const [selectedColumns, setSelectedColumns] = useStickyStateSet(
    new Set<string>(),
    `bulk-actions-table-${type}-selected-columns`,
  )
  const [orderColumn, setOrderColumn] = useStickyStateOrder(
    orderColumnDefault,
    `bulk-actions-table-${type}-order-column`,
  )
  const [selectedIds, setSelectedIds] = useState(new Set<string>())
  const [isSelectState, setIsSelectState] = useState<boolean>(false)

  const [language, setLanguage] = useState(options.languages?.[0] ?? '')
  const [untranslatedOnly, setUntranslatedOnly] = useState(false)

  // Remembered like the column choice: the table layout belongs to the person
  // working with it, not to a single visit to the pane.
  const [languagesVisible, setLanguagesVisible] = useStickyState<boolean>(
    true,
    `bulk-actions-table-${type}-languages-visible`,
  )
  const [fullWidth, setFullWidth] = useStickyState<boolean>(
    false,
    `bulk-actions-table-${type}-full-width`,
  )
  const [maxColumnWidth, setMaxColumnWidth] = useStickyState<number>(
    MAX_COLUMN_WIDTH,
    `bulk-actions-table-${type}-max-column-width`,
  )
  const [dense, setDense] = useStickyState<boolean>(false, `bulk-actions-table-${type}-dense`)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const labels = useMemo(() => ({...LABELS, ...options.labels}), [options.labels])

  const fields = useMemo(() => ('fields' in schemaType ? schemaType.fields : []), [schemaType])

  // Every translatable field of the schema. A row's coverage is "how many of
  // them have a version in this language", so this list is the denominator —
  // and a schema with one such field behaves like a schema with four.
  const i18nFields = useMemo(
    () => fields.filter((field) => isI18nArray(field.type.name)).map((field) => field.name),
    [fields],
  )

  const searchableFields = useMemo(() => searchExpressions(fields), [fields])

  // "Needs translation" works on the first translatable field (the title): a
  // document with no name in a language has no version of itself in it either.
  const extraFilter = useMemo(
    () =>
      untranslatedOnly && i18nFields[0] && language
        ? missingLanguageFilter(i18nFields[0], language)
        : '',
    [untranslatedOnly, i18nFields, language],
  )

  const paginatedClient = usePaginatedClient({
    type,
    pageSize,
    selectedColumns,
    searchableFields,
    orderColumn,
    client,
    language,
    extraFilter,
    i18nFields,
  })

  // The pane menu's "Refresh" item — nothing else listens to this emitter.
  const {refresh: refreshClient} = paginatedClient
  useEffect(() => options.refresh.subscribe(refreshClient), [options.refresh, refreshClient])

  // Same for "Table settings": the menu is built outside React, so the click
  // arrives here through an emitter and the state lives in one place.
  useEffect(
    () => options.openSettings.subscribe(() => setSettingsOpen(true)),
    [options.openSettings],
  )

  const contextValue = useMemo(
    () => ({
      options,
      labels,
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
      language,
      setLanguage,
      i18nFields,
      untranslatedOnly,
      setUntranslatedOnly,
      languagesVisible,
      setLanguagesVisible,
      fullWidth,
      setFullWidth,
      maxColumnWidth,
      setMaxColumnWidth,
      dense,
      setDense,
      settingsOpen,
      setSettingsOpen,
    }),
    [
      options,
      labels,
      schemaType,
      pageSize,
      selectedColumns,
      setSelectedColumns,
      orderColumn,
      setOrderColumn,
      selectedIds,
      isSelectState,
      paginatedClient,
      language,
      i18nFields,
      untranslatedOnly,
      languagesVisible,
      setLanguagesVisible,
      fullWidth,
      setFullWidth,
      maxColumnWidth,
      setMaxColumnWidth,
      dense,
      setDense,
      settingsOpen,
    ],
  )

  return (
    <BulkActionsTableContext.Provider value={contextValue}>
      {children}
    </BulkActionsTableContext.Provider>
  )
}
