import {Text} from '@sanity/ui'
import {memo} from 'react'
import {Preview, SchemaType} from 'sanity'
import styled from 'styled-components'

import {useLabels} from '../context'
import {i18nValue, isI18nArray} from '../helpers/i18n'
import {TableField} from '../types'
import {CellPrimitive} from './primitives'

const TableDiv = styled(Text)`
  font-size: ${(props) => (props.muted ? '0.7rem' : '0.75rem')};
  /* Truncation only works on an element with a bounded width. Without this,
     @sanity/ui's textOverflow="ellipsis" has nothing to shorten and a long name
     spills into the next column (the table has fixed column widths). */
  display: block;
  min-width: 0;
  max-width: 100%;
`

const TableCellContentImage = styled.div`
  width: 2.0625rem;
  height: 2.0625rem;
  min-width: 2.0625rem;
  font-size: 0.75rem;

  > div > div {
    padding: 0;
  }
`

function formatDatetime(value: string, {includeTime}: {includeTime: boolean}): string {
  const locale = navigator.language || 'en-US' // Get the user's locale
  const timeOptions = includeTime
    ? {
        hour: 'numeric' as const,
        minute: 'numeric' as const,
        hour12: true,
      }
    : {}
  return new Date(value).toLocaleString(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    ...timeOptions,
  })
}

interface Props {
  field: TableField['field']
  fieldPath: string
  value: any
  language?: string
}

// Just the text in the language picked in the header. The per-language state
// of the whole document lives in its own "Languages" column — repeating three
// badges in every text cell said the same thing four times per row.
function I18nCell({value, language}: {value: unknown; language: string}) {
  const labels = useLabels()
  const text = i18nValue(value, language)
  return (
    <TableDiv textOverflow="ellipsis" muted={!text}>
      {text || labels.empty}
    </TableDiv>
  )
}

// Props are stable across a row's re-renders (field comes from the memoized
// `fields` array, value is read off the row's stable `item` reference), so
// this skips re-rendering every cell -- including the expensive `image`/
// default `<Preview>` cases -- when a row updates only for an unrelated
// reason (e.g. its `selected` state flipping).
function Cell({field, fieldPath, value, language}: Props) {
  const labels = useLabels()
  // Ahead of the switch: these are arrays as far as the schema is concerned, so
  // the `array` case would count them ("3 items") and the default case would
  // hand the raw array to <Preview>, which renders "Untitled".
  //
  // Gated on `language` only ('' when the table was created without
  // `languages`), never on the "Languages" column being visible — hiding the
  // badge column used to take the text with it and every title/slug cell read
  // "Untitled".
  if (language && isI18nArray(field.type.name)) {
    return (
      <CellPrimitive as="td" key={fieldPath}>
        <I18nCell value={value} language={language} />
      </CellPrimitive>
    )
  }

  switch (field.type.name) {
    case 'date':
    case 'datetime':
    case '_createdAt':
    case '_lastPublishedAt':
    case '_updatedAt': {
      const includeTime = field.type.name !== 'date'
      const defaultMessage =
        field.type.name === '_lastPublishedAt' ? labels.notPublished : labels.empty
      return (
        <CellPrimitive as="td" key={fieldPath}>
          <TableDiv textOverflow="ellipsis" muted={!value}>
            {value ? formatDatetime(value, {includeTime}) : defaultMessage}
          </TableDiv>
        </CellPrimitive>
      )
    }
    case 'slug': {
      return (
        <CellPrimitive as="td" key={fieldPath}>
          <TableDiv textOverflow="ellipsis">{value?.current || labels.empty}</TableDiv>
        </CellPrimitive>
      )
    }
    case 'text':
    case 'url':
    case 'string':
    case 'number': {
      return (
        <CellPrimitive as="td" key={fieldPath}>
          <TableDiv textOverflow="ellipsis">{value || labels.empty}</TableDiv>
        </CellPrimitive>
      )
    }
    case 'boolean': {
      let renderedValue: string = labels.empty
      if (value === true) renderedValue = labels.yes
      if (value === false) renderedValue = labels.no
      return (
        <CellPrimitive as="td" key={fieldPath}>
          <TableDiv textOverflow="ellipsis">{renderedValue}</TableDiv>
        </CellPrimitive>
      )
    }
    case 'array': {
      return (
        <CellPrimitive as="td" key={fieldPath}>
          <TableDiv textOverflow="ellipsis">{labels.itemCount(value?.length || 0)}</TableDiv>
        </CellPrimitive>
      )
    }
    case 'image': {
      return (
        <CellPrimitive as="td" key={fieldPath}>
          {value ? (
            <TableCellContentImage>
              <Preview
                layout="media"
                value={value}
                mediaDimensions={{
                  fit: 'fill',
                  aspect: 1,
                }}
                // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `field` is a schema field OR a built-in mock column (see TableField); Preview only ever receives real schema fields at runtime, but that isn't statically provable from the union.
                schemaType={field.type as SchemaType}
              />
            </TableCellContentImage>
          ) : (
            <TableDiv textOverflow="ellipsis">{labels.empty}</TableDiv>
          )}
        </CellPrimitive>
      )
    }
    default: {
      return (
        <CellPrimitive as="td" key={fieldPath}>
          <TableDiv textOverflow="ellipsis">
            {value ? (
              <Preview
                value={value}
                layout="default"
                // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `field` is a schema field OR a built-in mock column (see TableField); Preview only ever receives real schema fields at runtime, but that isn't statically provable from the union.
                schemaType={field.type as SchemaType}
              />
            ) : (
              labels.empty
            )}
          </TableDiv>
        </CellPrimitive>
      )
    }
  }
}

export default memo(Cell)
