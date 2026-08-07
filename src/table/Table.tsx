import {Checkbox} from '@sanity/ui'
import {useCallback, useMemo, useRef} from 'react'
import {usePaneRouter} from 'sanity/structure'

import {defaultDatetimeFields} from '../constants'
import {useBulkActionsTableContext, useLabels} from '../context'
import {SelectableField, getSelectableFields} from '../helpers/getSelectableFields'
import {
  CheckboxCellTh,
  CheckboxFacade,
  HiddenCheckbox,
  LIST_STATUS_WIDTH,
  Table as StyledTable,
  TableWrapper,
} from '../styles'
import {TableField} from '../types'
import {CellPrimitive, RowPrimitive, TableHeadPrimitive} from './primitives'
import {TableHeadCell} from './TableHeadCell'
import TableRow from './TableRow'
import {usePanScroll} from './usePanScroll'

// Columns that don't come from the schema (the dates). Outside the component
// because they depend on nothing that changes.
const nonSchemaFields: TableField[] = defaultDatetimeFields.map(({key, title, sortable}) => ({
  fieldPath: key,
  title,
  field: {type: {name: key}},
  level: 0,
  sortable,
  type: key,
}))

/** A header for a column that is not a schema field. */
const fixedColumn = (fieldPath: string, title: string): TableField => ({
  fieldPath,
  title,
  type: 'string',
  sortable: false,
  field: {type: {name: 'string'}},
  level: 0,
})

export default function Table() {
  const {navigateIntent, groupIndex, routerPanesState} = usePaneRouter()
  const openedDocumentId = routerPanesState[groupIndex + 1]?.[0]?.id || null

  const {
    selectedColumns,
    selectedIds,
    setSelectedIds,
    schemaType,
    isSelectState,
    paginatedClient,
    language,
    i18nFields,
    languagesVisible,
    fullWidth,
    maxColumnWidth,
    dense,
    options: {layout, languages},
  } = useBulkActionsTableContext()
  const labels = useLabels()

  const isList = layout === 'list'
  const showLanguages = !isList && !!languages?.length && languagesVisible

  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const {panning, handlers} = usePanScroll(wrapperRef)

  const visibleNonSchemaFields = useMemo(
    () => nonSchemaFields.filter((field) => selectedColumns.has(field.fieldPath)),
    [selectedColumns],
  )

  const selectableFields = useMemo(
    () =>
      getSelectableFields('fields' in schemaType ? schemaType.fields : []).filter(
        (field: SelectableField) => selectedColumns.has(field.fieldPath),
      ),
    [schemaType, selectedColumns],
  )

  const fields: TableField[] = useMemo(
    () => (isList ? [] : [...visibleNonSchemaFields, ...selectableFields]),
    [isList, visibleNonSchemaFields, selectableFields],
  )

  const results = paginatedClient.results

  const atLeastOneSelected = useMemo(
    () => results.some((i) => selectedIds.has(i._normalizedId)),
    [results, selectedIds],
  )
  // `[].every()` returns `true`, so on an empty or still-loading page the
  // hidden `<input>` was checked while the visible stand-in next to it showed
  // an empty box — the screen reader said one thing and the screen another.
  const allSelected = useMemo(
    () => results.length > 0 && results.every((i) => selectedIds.has(i._normalizedId)),
    [results, selectedIds],
  )

  // The updater form, so this doesn't depend on the current `selectedIds` —
  // `setSelectedIds` is stable, so this function's identity is too.
  const onToggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prevSet: Set<string>) => {
        const nextSet = new Set(prevSet)
        if (nextSet.has(id)) nextSet.delete(id)
        else nextSet.add(id)
        return nextSet
      })
    },
    [setSelectedIds],
  )

  const onToggleAll = useCallback(() => {
    setSelectedIds((prevSet: Set<string>) => {
      const nextSet = new Set(prevSet)
      for (const result of results) {
        if (allSelected) nextSet.delete(result._normalizedId)
        else nextSet.add(result._normalizedId)
      }
      return nextSet
    })
  }, [allSelected, results, setSelectedIds])

  const onNavigate = useCallback(
    (id: string, type: string) => {
      // The router works on published ids — a `drafts.` prefix opens the wrong
      // pane and breaks the row highlight.
      navigateIntent('edit', {id, type})
    },
    [navigateIntent],
  )

  return (
    <TableWrapper ref={wrapperRef} $hasResults={!!results.length} $panning={panning} {...handlers}>
      <StyledTable $list={isList} $full={fullWidth} $maxColumnWidth={maxColumnWidth} $dense={dense}>
        <colgroup>
          {isSelectState && <col />}
          <col />
          <col style={isList ? {width: LIST_STATUS_WIDTH} : undefined} />
          {/* The badges have a fixed width, so this column doesn't have to
              compete for space with the text. */}
          {showLanguages && <col style={{width: '7.5rem'}} />}
          {fields.map((field: TableField) => (
            <col key={field.fieldPath} />
          ))}
        </colgroup>
        {/* In the list layout the header exists only to hold "select all" —
            there are no columns to label. */}
        {(!isList || isSelectState) && (
          <TableHeadPrimitive>
            <RowPrimitive>
              {isSelectState && (
                <CheckboxCellTh className="prevent-nav">
                  <HiddenCheckbox type="checkbox" checked={allSelected} onChange={onToggleAll} />
                  <CheckboxFacade aria-hidden="true">
                    <Checkbox
                      tabIndex={-1}
                      checked={allSelected}
                      indeterminate={atLeastOneSelected && !allSelected}
                      readOnly={true}
                    />
                  </CheckboxFacade>
                </CheckboxCellTh>
              )}
              {isList ? (
                <CellPrimitive as="th" colSpan={2} />
              ) : (
                <>
                  <TableHeadCell field={fixedColumn('_document', labels.document)} />
                  <TableHeadCell field={fixedColumn('_status', labels.status)} />
                  {showLanguages && (
                    <TableHeadCell field={fixedColumn('_languages', labels.languages)} />
                  )}
                  {fields.map((field: TableField) => (
                    <TableHeadCell key={field.fieldPath} field={field} />
                  ))}
                </>
              )}
            </RowPrimitive>
          </TableHeadPrimitive>
        )}
        <tbody>
          {results.map((item) => (
            <TableRow
              key={item._normalizedId}
              item={item}
              schemaType={schemaType}
              fields={fields}
              isSelectState={isSelectState}
              isList={isList}
              selected={selectedIds.has(item._normalizedId)}
              isOpened={item._normalizedId === openedDocumentId}
              onToggleSelect={onToggleSelect}
              onNavigate={onNavigate}
              language={language}
              languages={showLanguages ? languages : undefined}
              i18nFields={i18nFields}
            />
          ))}
        </tbody>
      </StyledTable>
    </TableWrapper>
  )
}
