import {RowStatus} from './helpers/results'

/**
 * Every string the table renders, in one place.
 *
 * Collected here for consistency first and translation second: the strings used
 * to sit in eight different files, so half the table said "Rows Per Page" and
 * the other half "Update items", and nobody ever saw them side by side.
 *
 * Pass `labels` to `createBulkActionsTable` to override any of them — the
 * object below is the default, merged shallowly with yours.
 * @public
 */
export const LABELS = {
  // Toolbar
  items: (count: number) => (count === 1 ? '1 item' : `${count} items`),
  search: 'Search',
  select: 'Select',
  selectHint: 'Select several items at once',
  selectPrompt: 'Select items',
  selected: (count: number) => `${count} selected`,
  cancel: 'Cancel',
  cancelHint: 'Leave selection mode',
  create: 'Create',
  columns: 'Choose columns',
  untranslated: 'Needs translation',
  untranslatedHint: (language: string) =>
    `Show only the documents with nothing written in the chosen language (${language})`,

  // Column headings
  document: 'Document',
  status: 'Status',
  languages: 'Languages',
  fieldCount: (filled: number, total: number) => `(${filled} of ${total} fields)`,
  sortBy: (title: string) => `Sort by: ${title}`,
  notSortable: 'This column cannot be sorted on',

  // Cell values
  status_published: 'Published',
  status_draft: 'Draft',
  status_published_with_pending_changes: 'Unpublished changes',
  notPublished: 'Not published',
  empty: '—',
  itemCount: (count: number) => (count === 1 ? '1 entry' : `${count} entries`),
  yes: 'Yes',
  no: 'No',

  // Footer
  rowsPerPage: 'Rows per page',
  previousPage: 'Previous page',
  nextPage: 'Next page',

  // States
  noResults: (query: string) => `No results for “${query}”.`,
  noDocuments: 'There are no documents here yet.',
  loadFailed: 'Could not load the list.',
  retry: 'Try again',

  // Pane menu
  refresh: 'Refresh',
  tableSettings: 'Table settings',

  // Bulk actions
  bulkButton: 'Apply',
} as const

/** @public */
export type Labels = typeof LABELS

export const statusLabel = (labels: Labels, status: RowStatus): string => labels[`status_${status}`]
