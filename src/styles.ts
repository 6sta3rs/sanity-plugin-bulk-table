import {SpinnerIcon} from '@sanity/icons/Spinner'
import {Badge} from '@sanity/ui'
import styled, {css, keyframes} from 'styled-components'

import {MAX_COLUMN_WIDTH} from './constants'
import {CellPrimitive, TablePrimitive} from './table/primitives'

export const LIST_STATUS_WIDTH = '28px'

// List layout matches Sanity's own document list: a dot on the right edge
// instead of a badge, so the title keeps the full pane width.
export const StatusDot = styled.span<{
  $tone: 'positive' | 'caution' | 'primary'
}>((props: any) => {
  const {theme, $tone} = props

  return css`
    display: block;
    margin-left: auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${theme.sanity.color.muted[$tone].enabled.fg};
  `
})

export const Container = styled.div`
  height: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`

export const StatusBadge = styled(Badge)`
  text-transform: capitalize;
  padding: 0.35rem 0.5rem;
  border-radius: 0.6rem;
  max-width: 100%;
  vertical-align: middle !important;

  div[data-ui='Text'] {
    font-size: 0.7rem;

    span {
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
      overflow: clip;
    }
  }
`

export const TableWrapper = styled.div<{
  $hasResults: boolean
  $panning?: boolean
}>`
  overflow: auto;
  position: relative;
  /* The footer is an ordinary layout element, so there is no space to reserve
     underneath it — that used to be a padding-bottom: 41px tuned to its
     height. */
  ${({$hasResults}) =>
    $hasResults &&
    css`
      flex: 1 1 0;
    `}
  ${({$panning}) =>
    $panning &&
    css`
      cursor: grabbing;
      user-select: none;
    `}
`

export const LoadingOverlay = styled.div(({theme}: {theme: any}) => {
  const {color} = theme.sanity
  const background = color.muted.default.disabled.muted.bg

  return css`
    position: absolute;
    top: 0;
    height: 100%;
    left: 0;
    right: 0;
    pointer-events: none;
    transition: opacity 250ms;
    background-color: ${background};
    z-index: 5;
    opacity: 0;
    display: flex;

    &.active {
      opacity: 0.5;
    }
  `
})

export const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`

export const LoadingSpinner = styled(SpinnerIcon)`
  margin: auto;
  width: 32px;
  height: 32px;
  animation: ${spin} 1500ms linear infinite;

  /* The overlay stays mounted so it can fade out, but a hidden spinner must
     not keep animating — an idle pane would otherwise run a rotation forever. */
  ${LoadingOverlay}:not(.active) & {
    animation-play-state: paused;
  }
`

export const Table = styled(TablePrimitive)<{
  $list?: boolean
  $full?: boolean
  $maxColumnWidth?: number
  $dense?: boolean
}>((props: any) => {
  const {theme, $list, $full, $dense} = props
  const maxColumnWidth = `${props.$maxColumnWidth ?? MAX_COLUMN_WIDTH}px`
  const {color} = theme.sanity
  const borderColor = color.selectable.default.enabled.border

  return css`
    /* No hiding of columns by ordinal position here.
       There used to be four width breakpoints hiding nth-child(n + N), plus the
       same block written out a second time under @supports not. The ordinal
       shifted along with the selection column and the "Languages" column, so
       the same breakpoint hid something different every time — with no trace
       that anything had gone. A narrow pane scrolls sideways instead; which
       columns to show is the editor's call. */

    /* Rows only as tall as a thumbnail and two lines of preview need — the
       rest of the height was padding. */
    .preview-root {
      padding: 0;
      margin-right: -0.75rem;
    }

    .preview-status {
      display: none;
    }

    .preview-title {
      font-size: 0.75rem;
    }

    .preview-subtitle {
      font-size: 0.6875rem;
    }

    thead {
      position: sticky;
      top: 0;
      z-index: 1;
      /* The header has to be opaque: scrolled rows passed underneath it and
         their letters overlapped the column names. The row background is the
         fallback, because the shape of the Studio theme changed between
         @sanity/ui versions and an undefined colour means a transparent header
         all over again. */
      background-color: ${color.base?.bg ?? color.selectable.default.enabled.bg};
    }

    th {
      padding: 0.3rem 0.5rem;
      position: relative;
      /* One line under the header, drawn as an inset shadow.
         It used to be a pseudo-element stretched across the cell, and with a
         sticky header that produced two lines: its own and the one under the
         first row. A shadow takes up no space in the layout, so there is
         nothing to double. */
      box-shadow: inset 0 -1px 0 ${borderColor};
    }

    td,
    th {
      text-align: left;
      /* table-layout: fixed doesn't widen a column for longer text — without
         truncation the content leaves its cell and paints over the next one.
         That is the overlapping title and slug. */
      overflow: hidden;
    }

    /* An ellipsis only works when the element has something to truncate
       against: in the cell (block) and in the flex item (min-width, because the
       default auto refuses to shrink below the content width). */
    td > *,
    th > * {
      max-width: 100%;
      min-width: 0;
    }

    th.title-cell,
    td.title-cell {
      //padding-right: 0;
    }

    td {
      padding: 0.125rem 0.5rem;
      border-bottom: 1px solid ${borderColor};
    }

    /* "Full width columns" mode: every column as wide as its content needs,
       and the table wider than the pane — for reading it like a spreadsheet.
       The default is the opposite: columns share the space evenly and text is
       truncated, because that shows the most rows at once. */
    ${
      $full &&
      css`
        table-layout: auto;
        width: max-content;
        min-width: 100%;

        td,
        th {
          overflow: hidden;
          white-space: nowrap;
          max-width: ${maxColumnWidth};
        }

        /* A column grows to its content but no further than the limit — longer
         text gets an ellipsis instead of stretching the table across several
         screens. */
        td > *,
        th > * {
          max-width: ${maxColumnWidth};
        }

        .preview-title,
        .preview-subtitle {
          white-space: nowrap;
        }
      `
    }

    /* Denser rows: more items on screen at the cost of the thumbnails. */
    ${
      $dense &&
      css`
        td {
          padding: 0 0.5rem;
        }

        .preview-root {
          padding: 0;
        }

        .preview-media,
        .preview-media img {
          max-height: 1.5rem;
        }
      `
    }

    /* List layout: no dense-table typography, roomier rows. */
    ${
      $list &&
      css`
        .preview-root {
          padding: 0.25rem 0;
          margin-right: 0;
        }

        .preview-title {
          font-size: inherit;
        }

        .preview-subtitle {
          font-size: inherit;
        }

        td {
          padding: 0.25rem 0.5rem;
        }
      `
    }
  `
})

export const CheckboxCellTh = styled(CellPrimitive).attrs(() => ({
  as: 'th',
}))`
  width: 30px;
  overflow: hidden;
  position: relative;
  > * > * {
    margin: auto;
  }
`

export const CheckboxCellTd = styled(CellPrimitive).attrs(() => ({
  as: 'td',
}))`
  width: 30px;
  overflow: hidden;
  position: relative;
  > * > * {
    margin: auto;
  }
`

export const CheckboxFacade = styled.div`
  display: flex;
  pointer-events: none;
`

export const HiddenCheckbox = styled.input.attrs({type: 'checkbox'})`
  height: 100%;
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  left: 0;
  width: 100%;
  opacity: 0;
  cursor: pointer;
`

export const IndeterminateIndicator = styled.span`
  font-size: 11px;
  padding-left: 2px;
  padding-right: 2px;
`
