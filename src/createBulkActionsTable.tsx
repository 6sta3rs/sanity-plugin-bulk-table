import {CogIcon} from '@sanity/icons/Cog'
import {FolderIcon} from '@sanity/icons/Folder'
import {SyncIcon} from '@sanity/icons/Sync'
import {ToastProvider} from '@sanity/ui'
import {ListItem} from 'sanity/structure'

import ActionRow from './ActionRow'
import {Options} from './constants'
import {BulkActionsTableProvider, SearchProvider, useBulkActionsTableContext} from './context'
import createEmitter from './createEmitter'
import Footer from './Footer'
import {LABELS} from './labels'
import {ErrorState, LoadingState, NoResultsState} from './states'
import {Container} from './styles'
import Table from './table/Table'
import TableSettingsDialog from './TableSettingsDialog'
import {CreateBulkActionsTableConfig} from './types'

/** The view settings dialog — mounted only while it is open. */
const TableSettings = () => {
  const {settingsOpen, setSettingsOpen} = useBulkActionsTableContext()
  if (!settingsOpen) return null
  return <TableSettingsDialog onClose={() => setSettingsOpen(false)} />
}

const BulkActionsTableParent = ({options}: {options: Options}) => (
  <ToastProvider>
    <BulkActionsTableProvider options={options}>
      <SearchProvider>
        <Container>
          <TableSettings />
          <ActionRow />
          <LoadingState />
          <Table />
          <ErrorState />
          <NoResultsState />
          <Footer />
        </Container>
      </SearchProvider>
    </BulkActionsTableProvider>
  </ToastProvider>
)

/**
 * A table of documents with selection, column picking and bulk actions.
 * @public
 */
function createBulkActionsTable(config: CreateBulkActionsTableConfig): ListItem {
  // Only what TypeScript cannot see at the call site is checked here: `type`
  // has to exist in the schema, and `S`/`context` come from the structure
  // resolver and are easy to forget.
  //
  // This used to be a hundred and twenty lines of `if`s asserting that `title`
  // is a string and `layout` one of two allowed words — precisely what
  // `CreateBulkActionsTableConfig` declares and `tsc` already catches.
  if (!config?.type || !config.S || !config.context) {
    throw new Error(
      "createBulkActionsTable: 'type', 'S' and 'context' are required.\n" +
        "Example: structure: (S, context) => createBulkActionsTable({type: 'product', S, context})",
    )
  }

  const {
    type,
    context,
    S,
    title,
    icon,
    languages,
    labels: labelOverrides,
    layout = 'table',
    apiVersion = '2025-02-19',
  } = config
  const {schema, getClient} = context
  const client = getClient({apiVersion})
  // The pane menu is built outside React, so it cannot use `useLabels()`.
  const labels = {...LABELS, ...labelOverrides}

  const refresh = createEmitter()
  const openSettings = createEmitter()

  // Structure item ids have to be unique, so a table and a list of the same
  // type cannot both be called `type`.
  const id = layout === 'list' ? `${type}-list` : type

  return S.listItem()
    .id(id)
    .title(title || type)
    .icon(icon || FolderIcon)
    .child(
      Object.assign(S.documentTypeList(type).serialize(), {
        // Don't re-render the component when switching documents…
        __preserveInstance: true,
        // …but do re-render it when switching structure items.
        key: id,
        type: 'component',
        options: {
          type,
          client,
          schema,
          refresh,
          openSettings,
          title,
          layout,
          languages,
          labels: labelOverrides,
        },
        component: BulkActionsTableParent,
        menuItems: [
          S.menuItem().title(labels.refresh).icon(SyncIcon).action(refresh.notify).serialize(),
          // A dialog rather than toggles in the menu: the pane menu is built
          // once, outside React, so it cannot show which state the table is in
          // — and the width slider needs a live preview anyway.
          S.menuItem()
            .title(labels.tableSettings)
            .icon(CogIcon)
            .action(openSettings.notify)
            .serialize(),
        ],
      }),
    )
    .serialize()
}

export default createBulkActionsTable
