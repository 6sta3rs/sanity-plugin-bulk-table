import styled, { css } from 'styled-components';

type Tone = 'default' | 'primary';

interface SelectableStateColors {
  bg: string;
  fg: string;
}

// styled-components' `theme` prop is untyped (`DefaultTheme` is an empty,
// augmentable interface) unless globally augmented -- and @sanity/ui's own
// `Theme`/`ThemeColor` types for this (the `sanity.color` shape actually
// supplied by @sanity/ui's <ThemeProvider>) are themselves marked
// `@deprecated` in favor of a differently-shaped `v2.color`, so reusing them
// here would just trade one lint error for another. This is the minimal
// shape this file actually reads off `theme.sanity.color`.
interface SelectableThemeColor {
  sanity: {
    color: {
      selectable: Record<
        Tone,
        {
          enabled: SelectableStateColors;
          hovered: SelectableStateColors;
          selected: SelectableStateColors;
        }
      >;
    };
  };
}

// Table
export const TablePrimitive = styled.table`
  display: table;
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;

  &:not([hidden]) {
    display: table;
    border-collapse: collapse;
  }
`;

// Table head
export const TableHeadPrimitive = styled.thead`
  display: table-header-group;

  &:not([hidden]) {
    display: table-header-group;
  }
`;

// Row
export const RowPrimitive = styled.tr<{ $tone?: Tone; $selected?: boolean }>(
  ({ theme, $tone = 'default', $selected }) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see SelectableThemeColor above: styled-components' theme is untyped by default, and @sanity/ui's own typed alternative for this shape is deprecated.
    const { selectable } = (theme as SelectableThemeColor).sanity.color;
    const colors = $selected ? selectable[$tone].selected : selectable[$tone].enabled;

    return css`
      display: table-row;
      background-color: ${colors.bg};
      color: ${colors.fg};

      &:hover {
        background-color: ${selectable[$tone].hovered.bg};
        cursor: pointer;
      }

      &:not([hidden]) {
        display: table-row;
      }
    `;
  },
);

// Cell
export const CellPrimitive = styled.td`
  display: table-cell;

  &:not([hidden]) {
    display: table-cell;
  }
`;
