import {Checkbox} from '@sanity/ui'
import {KeyboardEvent, memo} from 'react'
import {Preview, SchemaType} from 'sanity'

import {useLabels} from '../context'
import {languageName} from '../helpers/languageName'
import {ResultDocument} from '../helpers/results'
import {statusLabel} from '../labels'
import {CheckboxCellTd, CheckboxFacade, HiddenCheckbox, StatusBadge, StatusDot} from '../styles'
import {TableField} from '../types'
import Cell from './Cell'
import LanguageCell from './LanguageCell'
import {CellPrimitive, RowPrimitive} from './primitives'

interface TableRowProps {
  item: ResultDocument
  schemaType: SchemaType
  fields: TableField[]
  isSelectState: boolean
  isList: boolean
  selected: boolean
  isOpened: boolean
  onToggleSelect: (id: string) => void
  onNavigate: (id: string, type: string) => void
  language: string
  i18nFields: string[]
  languages?: string[]
}

const TONE = {
  published: 'positive',
  draft: 'caution',
  published_with_pending_changes: 'primary',
} as const

/**
 * Memoized so that selecting or opening one row doesn't re-render the other
 * ninety-nine — each of which draws an expensive `<Preview>` off the preview
 * store.
 *
 * It only pays off because every prop below is stable: `selected` and
 * `isOpened` are booleans computed once in the parent (not a shared `Set`), and
 * the callbacks are `useCallback`s whose identity doesn't change.
 */
const TableRow = memo(function TableRow({
  item,
  schemaType,
  fields,
  isSelectState,
  isList,
  selected,
  isOpened,
  onToggleSelect,
  onNavigate,
  language,
  languages,
  i18nFields,
}: TableRowProps) {
  const labels = useLabels()

  const activate = () => {
    if (isSelectState) {
      onToggleSelect(item._normalizedId)
      return
    }
    onNavigate(item._normalizedId, item._type)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (event.target !== event.currentTarget) return
    event.preventDefault()
    activate()
  }

  return (
    <RowPrimitive
      // The row is clickable, so it has to be reachable from the keyboard too:
      // without `tabIndex` and an Enter handler there was no way to open a
      // document other than with the mouse.
      tabIndex={0}
      aria-selected={isSelectState ? selected : undefined}
      $selected={isOpened}
      $tone={selected ? 'primary' : 'default'}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        // A click inside a menu must not navigate.
        if (e.target instanceof Element && e.target.closest('.prevent-nav')) {
          return
        }
        activate()
      }}
    >
      {isSelectState && (
        <CheckboxCellTd className="prevent-nav">
          <HiddenCheckbox
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.preventDefault()
              onToggleSelect(item._normalizedId)
              e.stopPropagation()
            }}
          />
          <CheckboxFacade aria-hidden="true">
            <Checkbox tabIndex={-1} checked={selected} readOnly={true} />
          </CheckboxFacade>
        </CheckboxCellTd>
      )}
      <CellPrimitive as="td" className="title-cell">
        <Preview schemaType={schemaType} layout="default" value={item} />
      </CellPrimitive>
      <CellPrimitive as="td">
        {isList ? (
          <StatusDot $tone={TONE[item._status]} title={statusLabel(labels, item._status)} />
        ) : (
          <StatusBadge tone={TONE[item._status]}>{statusLabel(labels, item._status)}</StatusBadge>
        )}
      </CellPrimitive>
      {/* The translation state is a property of the row rather than a chosen
          column — which is why it sits next to the status. */}
      {!isList && !!languages?.length && (
        <CellPrimitive as="td">
          <LanguageCell row={item} fields={i18nFields} languages={languages} label={languageName} />
        </CellPrimitive>
      )}
      {fields.map((field: TableField) => (
        <Cell
          key={field.fieldPath}
          field={field.field}
          fieldPath={field.fieldPath}
          // The GROQ projection names nested fields literally (`"a.b": a.b`),
          // so the result has an "a.b" key rather than a nested `a: {b: …}`.
          value={(item as Record<string, unknown>)[field.fieldPath]}
          language={language}
        />
      ))}
    </RowPrimitive>
  )
})

export default TableRow
