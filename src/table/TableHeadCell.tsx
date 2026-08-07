import {ChevronDownIcon} from '@sanity/icons/ChevronDown'
import {ChevronUpIcon} from '@sanity/icons/ChevronUp'
import {Box, Button, Text, Tooltip} from '@sanity/ui'
import {ComponentProps, useCallback} from 'react'
import styled, {css} from 'styled-components'

import {orderColumnDefault} from '../constants'
import {useBulkActionsTableContext, useLabels} from '../context'
import {TableField} from '../types'
import {CellPrimitive} from './primitives'

interface ExtraProps {
  mode: 'default' | 'ghost' | 'bleed'
  tone?: 'default' | 'primary' | 'positive' | 'caution' | 'critical'
  iconRight?: ComponentProps<typeof Button>['iconRight']
}

export const TableHeaderButton = styled(Button)(({
  theme,
  disabled,
}: {
  theme: any
  disabled?: boolean
}) => {
  const {color} = theme.sanity
  const buttonColor = color.button.bleed.default.enabled.fg

  return css`
    /* The sort button spans the whole column rather than the width of its
       label: the entire header cell is then clickable instead of just the word,
       and headers line up with the column content instead of floating as
       chips. */
    width: 100%;
    max-width: 100%;
    justify-content: flex-start;
    text-align: left;

    & > span {
      width: 100%;
      justify-content: flex-start;
    }

    div[data-ui='Text'] {
      font-size: 0.75rem;
      font-weight: 600;
      ${disabled ? `color: ${buttonColor};` : ''}

      /* Long headings used to push the button out of its cell: the table has
         fixed column widths, so there is nowhere to grow. */
      span {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  `
})

export function TableHeadCell({field}: {field: TableField}) {
  const {orderColumn, setOrderColumn} = useBulkActionsTableContext()
  const labels = useLabels()

  const handleOrder = useCallback(() => {
    const {fieldPath: key, type: fieldType, sortable} = field
    if (!sortable) return
    // Reset
    if (orderColumn.key === key && orderColumn.direction === 'desc') {
      setOrderColumn(orderColumnDefault)
      return
    }
    // Set updated key and/or direction
    setOrderColumn({
      key,
      direction: orderColumn?.direction === 'asc' && orderColumn.key === key ? 'desc' : 'asc',
      type: fieldType,
    })
  }, [field, orderColumn, setOrderColumn])

  const isSelected = orderColumn.key === field.fieldPath
  const extraProps: ExtraProps = {
    mode: isSelected ? 'ghost' : 'bleed',
    // tone: isSelected ? 'default' : 'primary'
  }

  if (orderColumn.key === field.fieldPath) {
    extraProps.iconRight = orderColumn.direction === 'asc' ? ChevronUpIcon : ChevronDownIcon
  }

  return (
    <CellPrimitive as="th" style={{paddingLeft: 0}}>
      <Tooltip
        content={
          <Box padding={0}>
            <Text size={0}>
              {field.sortable ? labels.sortBy(field.title || '') : labels.notSortable}
            </Text>
          </Box>
        }
        placement="bottom"
        portal
        delay={{open: 400}}
      >
        <Box display="block" style={{width: '100%', maxWidth: '100%'}}>
          <TableHeaderButton
            space={2}
            disabled={!field.sortable}
            paddingX={2}
            paddingY={2}
            text={field.title || ''}
            onClick={handleOrder}
            {...extraProps}
          />
        </Box>
      </Tooltip>
    </CellPrimitive>
  )
}
