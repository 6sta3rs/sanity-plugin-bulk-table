import { AddIcon } from '@sanity/icons/Add';
import { CheckmarkIcon } from '@sanity/icons/Checkmark';
import { ChevronLeftIcon } from '@sanity/icons/ChevronLeft';
import { ChevronRightIcon } from '@sanity/icons/ChevronRight';
import { FolderIcon } from '@sanity/icons/Folder';
import { SyncIcon } from '@sanity/icons/Sync';
import {
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Label,
  Select,
  Text,
  ToastProvider,
  Tooltip,
} from '@sanity/ui';
import { memo, useCallback, useMemo, useRef } from 'react';
import { Preview, SchemaType } from 'sanity';
import { ListItem, usePaneRouter } from 'sanity/structure';

import BulkActionsMenu from './BulkActionsMenu';
import ColumnSelector from './ColumnSelector';
import SearchField from './SearchField';
import {
  Options,
  defaultDatetimeFields,
  orderColumnDefault,
  rowsPerPage,
} from './constants';
import {
  BulkActionsTableProvider,
  SearchProvider,
  useBulkActionsTableContext,
  useSearchContext,
} from './context';
import createEmitter from './createEmitter';
import {
  SelectableField,
  getSelectableFields,
} from './helpers/getSelectableFields';
import {
  COLUMN_SELECTOR_WIDTH,
  LIST_STATUS_WIDTH,
  CheckboxCellTd,
  CheckboxCellTh,
  CheckboxFacade,
  ColumnSelectBodyCell,
  ColumnSelectHeadCell,
  Container,
  HiddenCheckbox,
  LoadingOverlay,
  LoadingSpinner,
  StatusBadge,
  StatusDot,
  Table as StyledTable,
  TableWrapper,
} from './styles';
import Cell from './table/Cell';
import { TableHeadCell } from './table/TableHeadCell';
import {
  CellPrimitive,
  RowPrimitive,
  TableHeadPrimitive,
} from './table/primitives';
import { CreateBulkActionsTableConfig, TableField } from './types';
import { PaginatedClient } from './usePaginatedClient';

function parentHasClass(
  el: EventTarget | Element | null,
  className: string,
): boolean {
  if (!(el instanceof Element)) return false;
  if (el.classList.contains(className)) return true;
  return parentHasClass(el.parentElement, className);
}

interface BulkActionsTableProps {
  options: Options;
}

const nonSchemaFields = defaultDatetimeFields.map(
  ({ key, title, sortable }) => ({
    fieldPath: key,
    title,
    field: { type: { name: key } },
    level: 0,
    sortable,
    type: key, // Add the missing type property
  }),
);

const ActionRow = () => {
  const { navigateIntent } = usePaneRouter();
  const {
    options: { type },
    selectedIds,
    setSelectedIds,
    paginatedClient,
    isSelectState,
    setIsSelectState,
  } = useBulkActionsTableContext();

  return (
    <Card padding={2}>
      {isSelectState ? (
        <Flex align="center" justify="space-between">
          <Text size={1} weight="bold">
            {selectedIds.size === 0
              ? 'Select items'
              : `${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'} selected`}
          </Text>
          <Flex gap={2} align="center">
            {selectedIds.size > 0 && (
              <BulkActionsMenu
                onDelete={() => {
                  setSelectedIds(new Set());
                  paginatedClient.setPage(0);
                  paginatedClient.refresh();
                }}
              />
            )}
            <Tooltip
              content={
                <Box padding={1}>
                  <Text size={0}>Cancel bulk selection</Text>
                </Box>
              }
              delay={{ open: 400 }}
              padding={1}
              placement="bottom"
              portal
            >
              <Button
                fontSize={1}
                padding={2}
                text="Cancel"
                mode="default"
                onClick={() => {
                  setIsSelectState(false);
                  setSelectedIds(new Set());
                }}
              />
            </Tooltip>
          </Flex>
        </Flex>
      ) : (
        <Flex align="center" justify="space-between">
          <Text size={1} weight="bold">
            {paginatedClient.total} Items
          </Text>
          <Flex gap={2} align="center">
            <SearchField />
            <Tooltip
              content={
                <Box padding={1}>
                  <Text size={0}>Bulk select</Text>
                </Box>
              }
              delay={{ open: 400 }}
              padding={1}
              placement="bottom"
              portal
            >
              <Button
                gap={2}
                fontSize={1}
                padding={2}
                text="Select"
                mode="default"
                icon={CheckmarkIcon}
                onClick={() => setIsSelectState(true)}
              />
            </Tooltip>
            <Button
              gap={2}
              fontSize={1}
              padding={2}
              text="Create"
              tone="primary"
              icon={AddIcon}
              onClick={() => navigateIntent('create', { type })}
            />
          </Flex>
        </Flex>
      )}
    </Card>
  );
};

type ResultDocument = PaginatedClient['results'][number];

interface TableRowProps {
  item: ResultDocument;
  schemaType: SchemaType;
  fields: TableField[];
  isSelectState: boolean;
  isList: boolean;
  selected: boolean;
  isOpened: boolean;
  onToggleSelect: (id: string) => void;
  onNavigate: (id: string, type: string) => void;
}

// Memoized so that selecting/opening one row doesn't re-render the other 99
// — each of which renders an expensive `<Preview>` from the document preview
// store. This only pays off because every prop below is stable: `selected`
// and `isOpened` are booleans computed once in the parent (not a shared
// `Set`), and the callbacks are `useCallback`s that never change identity.
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
}: TableRowProps) {
  const statusTone =
    item._status === 'published'
      ? 'positive'
      : item._status === 'draft'
        ? 'caution'
        : 'primary';
  const statusLabel =
    item._status === 'published_with_pending_changes'
      ? 'Staged changes'
      : item._status;

  return (
    <RowPrimitive
      data-as="a"
      $selected={isOpened}
      $tone={selected ? 'primary' : 'default'}
      onClick={(e) => {
        // prevent the menu button from causing a navigation
        if (parentHasClass(e.target, 'prevent-nav')) {
          return;
        }
        if (isSelectState) {
          onToggleSelect(item._normalizedId);
          return;
        }
        onNavigate(item._normalizedId, item._type);
      }}
    >
      {isSelectState && (
        <CheckboxCellTd className="prevent-nav">
          <HiddenCheckbox
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.preventDefault();
              onToggleSelect(item._normalizedId);
              e.stopPropagation();
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
          <StatusDot $tone={statusTone} title={statusLabel} />
        ) : (
          <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
        )}
      </CellPrimitive>
      {fields.map((field: TableField) => (
        <Cell
          key={field.fieldPath}
          field={field.field}
          fieldPath={field.fieldPath}
          // GROQ projections alias nested fields literally as
          // `"a.b": a.b`, so the result object has a key named
          // "a.b" verbatim -- not a nested `a: {b: ...}` shape.
          value={(item as Record<string, unknown>)[field.fieldPath]}
        />
      ))}
      {!isList && <ColumnSelectBodyCell />}
    </RowPrimitive>
  );
});

const Table = () => {
  const { navigateIntent, groupIndex, routerPanesState } = usePaneRouter();
  const openedDocumentId = routerPanesState[groupIndex + 1]?.[0]?.id || null;

  const {
    selectedColumns,
    setSelectedColumns,
    setOrderColumn,
    selectedIds,
    setSelectedIds,
    schemaType,
    isSelectState,
    paginatedClient,
    options: { layout },
  } = useBulkActionsTableContext();

  const isList = layout === 'list';

  const documentsListRef = useRef<HTMLTableElement | null>(null);

  const visibleNonSchemaFields = useMemo(
    () =>
      nonSchemaFields.filter((field) => selectedColumns.has(field.fieldPath)),
    [selectedColumns],
  );

  const selectableFields = useMemo(
    () =>
      getSelectableFields(
        'fields' in schemaType ? schemaType.fields : [],
      ).filter((field: SelectableField) =>
        selectedColumns.has(field.fieldPath),
      ),
    [schemaType, selectedColumns],
  );

  const fields: TableField[] = useMemo(
    () => (isList ? [] : [...visibleNonSchemaFields, ...selectableFields]),
    [isList, visibleNonSchemaFields, selectableFields],
  );

  const atLeastOneSelected = useMemo(
    () =>
      paginatedClient.results.some((i) => selectedIds.has(i._normalizedId)),
    [paginatedClient.results, selectedIds],
  );
  const allSelected = useMemo(
    () =>
      paginatedClient.results.every((i) => selectedIds.has(i._normalizedId)),
    [paginatedClient.results, selectedIds],
  );

  // Functional updater form so this never depends on (and never changes with)
  // the current `selectedIds` value -- setSelectedIds itself is already
  // stable, so this callback identity never changes either.
  const onToggleSelect = useCallback((id: string) => {
    setSelectedIds((prevSet: Set<string>) => {
      const nextSet = new Set(prevSet);
      if (nextSet.has(id)) {
        nextSet.delete(id);
      } else {
        nextSet.add(id);
      }
      return nextSet;
    });
  }, [setSelectedIds]);

  const onNavigate = useCallback(
    (id: string, type: string) => {
      // The router works in published ids — passing a `drafts.` prefixed id
      // here opens the wrong pane and breaks the selected-row highlight for
      // documents that have a draft.
      navigateIntent('edit', { id, type });
    },
    [navigateIntent],
  );

  return (
    <TableWrapper $hasResults={!!paginatedClient.results.length}>
      <StyledTable ref={documentsListRef} $list={isList}>
        <colgroup>
          {isSelectState && <col />}
          <col />
          <col style={isList ? { width: LIST_STATUS_WIDTH } : undefined} />
          {fields.map((field: TableField) => (
            <col key={field.fieldPath} />
          ))}
          {!isList && <col style={{ width: COLUMN_SELECTOR_WIDTH }} />}
        </colgroup>
        {/* In list layout the head only exists to hold "select all" — there
            are no columns to label. */}
        {(!isList || isSelectState) && (
          <TableHeadPrimitive>
            <RowPrimitive>
              {isSelectState && (
                <CheckboxCellTh className="prevent-nav">
                  <HiddenCheckbox
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => {
                      setSelectedIds((prevSet: Set<string>) => {
                        const nextSet = new Set(prevSet);
                        if (allSelected) {
                          for (const result of paginatedClient.results || []) {
                            nextSet.delete(result._normalizedId);
                          }
                        } else {
                          for (const result of paginatedClient.results || []) {
                            nextSet.add(result._normalizedId);
                          }
                        }

                        return nextSet;
                      });
                    }}
                  />
                  <CheckboxFacade aria-hidden="true">
                    <Checkbox
                      tabIndex={-1}
                      checked={atLeastOneSelected}
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
                  <TableHeadCell
                    field={{
                      title: 'Document',
                      fieldPath: '_document',
                      type: 'string',
                      sortable: false,
                      field: { type: { name: 'string' } },
                      level: 0,
                    }}
                  />
                  <TableHeadCell
                    field={{
                      title: 'Status',
                      fieldPath: '_status',
                      type: 'string',
                      sortable: false,
                      field: { type: { name: 'string' } },
                      level: 0,
                    }}
                  />
                  {fields.map((field: TableField) => (
                    <TableHeadCell key={field.fieldPath} field={field} />
                  ))}
                  <ColumnSelectHeadCell>
                    <ColumnSelector
                      schemaType={schemaType}
                      selectedColumns={selectedColumns}
                      onToggleColumnSelect={(key) => {
                        const nextSet = new Set(selectedColumns);
                        if (nextSet.has(key)) {
                          setOrderColumn(orderColumnDefault);
                        }
                        if (nextSet.has(key)) {
                          nextSet.delete(key);
                        } else {
                          nextSet.add(key);
                        }
                        setSelectedColumns(nextSet);
                      }}
                    />
                  </ColumnSelectHeadCell>
                </>
              )}
            </RowPrimitive>
          </TableHeadPrimitive>
        )}
        <tbody>
          {paginatedClient.results.map((item) => (
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
            />
          ))}
        </tbody>
      </StyledTable>
    </TableWrapper>
  );
};

const LoadingState = () => {
  const { paginatedClient } = useBulkActionsTableContext();
  return (
    <LoadingOverlay className={paginatedClient.loading ? 'active' : undefined}>
      <LoadingSpinner />
    </LoadingOverlay>
  );
};

const NoResultsState = () => {
  const { navigateIntent } = usePaneRouter();
  const {
    options: { type, title },
    paginatedClient,
  } = useBulkActionsTableContext();
  const { searchValue } = useSearchContext();

  if (paginatedClient.loading || paginatedClient.results.length) {
    return null;
  }

  // ponytail: no inflection — the label is used verbatim so it reads correctly
  // whether the title is singular or plural ("Post", "Blog Posts", "Category").
  const itemLabel = title || 'documents';

  return (
    <Flex direction="column" align="center">
      <Card padding={4} radius={2} shadow={1}>
        <Flex direction="column" align="center" justify="center" gap={4}>
          <Text size={2} align="center">
            {searchValue.length
              ? `No results for "${searchValue}".`
              : `No ${itemLabel} in your collection.`}
          </Text>
          {!searchValue.length && (
            <Button
              padding={2}
              fontSize={1}
              tone="default"
              icon={AddIcon}
              text="Create new"
              onClick={() => navigateIntent('create', { type })}
            />
          )}
        </Flex>
      </Card>
    </Flex>
  );
};

const Footer = () => {
  const { pageSize, setPageSize, paginatedClient } =
    useBulkActionsTableContext();
  return (
    <Card
      borderTop
      padding={[3, 3, 2]}
      style={{ position: 'absolute', bottom: 0, width: '100%' }}
    >
      <Flex align="center" gap={2}>
        <Flex align="center" gap={2}>
          <Label style={{ whiteSpace: 'nowrap' }}>Rows Per Page</Label>
          <Select
            fontSize={1}
            padding={2}
            value={pageSize}
            onChange={(e) => setPageSize(parseInt(e.currentTarget.value, 10))}
          >
            {rowsPerPage.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </Select>
        </Flex>

        <Box flex={1}>
          <Flex align="center" justify="flex-end" gap={2}>
            <Button
              fontSize={1}
              padding={2}
              disabled={paginatedClient.page === 0}
              onClick={() => paginatedClient.setPage(paginatedClient.page - 1)}
              icon={ChevronLeftIcon}
              title="Previous page"
              mode="bleed"
            />
            <Label>
              {paginatedClient.totalPages === 0 ? 0 : paginatedClient.page + 1}
              &nbsp;/&nbsp;
              {paginatedClient.totalPages}
            </Label>
            <Button
              fontSize={1}
              padding={2}
              disabled={paginatedClient.page === paginatedClient.totalPages - 1}
              onClick={() => paginatedClient.setPage(paginatedClient.page + 1)}
              icon={ChevronRightIcon}
              title="Next page"
              mode="bleed"
            />
          </Flex>
        </Box>
      </Flex>
    </Card>
  );
};

const BulkActionsTableParent = (props: BulkActionsTableProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  return (
    <ToastProvider>
      <BulkActionsTableProvider options={props.options}>
        <SearchProvider>
          <Container ref={containerRef}>
            <ActionRow />
            <LoadingState />
            <Table />
            <NoResultsState />
            <Footer />
          </Container>
        </SearchProvider>
      </BulkActionsTableProvider>
    </ToastProvider>
  );
};

/**
 * Creates a bulk actions table for managing documents in Sanity Studio
 * @public
 */
function createBulkActionsTable(
  config: CreateBulkActionsTableConfig,
): ListItem {
  // Validate required parameters
  if (!config) {
    throw new Error(`
      Configuration object is required.
      Example: createBulkActionsTable({type: 'category', S, context})
    `);
  }

  if (!config.type || typeof config.type !== 'string') {
    throw new Error(`
      'type' parameter is required and must be a string.
      The type should match a document schema type in your Sanity project.
      Example: createBulkActionsTable({type: 'post', S, context})
    `);
  }

  if (!config.context) {
    throw new Error(`
      'context' parameter is required.
      This should be the ConfigContext provided by the structure resolver.
      Example: structure: (S, context) => createBulkActionsTable({type: 'post', S, context})
    `);
  }

  if (!config.S) {
    throw new Error(`
      'S' (StructureBuilder) parameter is required.
      This should be the StructureBuilder provided by the structure resolver.
      Example: structure: (S, context) => createBulkActionsTable({type: 'post', S, context})
    `);
  }

  // Validate optional parameters
  if (config.title !== undefined && typeof config.title !== 'string') {
    throw new Error(`
      'title' parameter must be a string when provided.
      Example: createBulkActionsTable({type: 'post', S, context, title: 'Blog Posts'})
    `);
  }

  if (
    config.layout !== undefined &&
    config.layout !== 'table' &&
    config.layout !== 'list'
  ) {
    throw new Error(`
      'layout' parameter must be either 'table' or 'list' when provided.
      Example: createBulkActionsTable({type: 'post', S, context, layout: 'list'})
    `);
  }

  if (
    config.apiVersion !== undefined &&
    typeof config.apiVersion !== 'string'
  ) {
    throw new Error(`
      'apiVersion' parameter must be a string when provided.
      Example: createBulkActionsTable({type: 'post', S, context, apiVersion: '2025-02-19'})
    `);
  }

  const {
    type,
    context,
    S,
    title,
    icon,
    layout = 'table',
    apiVersion = '2025-02-19',
  } = config;
  const { schema, getClient } = context;
  const client = getClient({ apiVersion });

  const refresh = createEmitter();

  // Structure ids must be unique, so a table and a list view of the same type
  // can't both be `type`.
  const id = layout === 'list' ? `${type}-list` : type;

  return S.listItem()
    .id(id)
    .title(title || type)
    .icon(icon || FolderIcon)
    .child(
      Object.assign(S.documentTypeList(type).serialize(), {
        // Prevents the component from re-rendering when switching documents
        __preserveInstance: true,
        // Prevents the component from NOT re-rendering when switching listItems
        key: id,
        type: 'component',
        options: { type, client, schema, refresh, title, layout },
        component: BulkActionsTableParent,
        menuItems: [
          S.menuItem()
            .title('Refresh')
            .icon(SyncIcon)
            .action(refresh.notify)
            .serialize(),
        ],
      }),
    )
    .serialize();
}

export default createBulkActionsTable;
