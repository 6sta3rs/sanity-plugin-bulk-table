import {AddIcon} from '@sanity/icons/Add'
import {SyncIcon} from '@sanity/icons/Sync'
import {WarningOutlineIcon} from '@sanity/icons/WarningOutline'
import {Button, Card, Flex, Text} from '@sanity/ui'
import {usePaneRouter} from 'sanity/structure'

import {useBulkActionsTableContext, useLabels, useSearchContext} from './context'
import {LoadingOverlay, LoadingSpinner} from './styles'

export const LoadingState = () => {
  const {paginatedClient} = useBulkActionsTableContext()
  return (
    <LoadingOverlay className={paginatedClient.loading ? 'active' : undefined}>
      <LoadingSpinner />
    </LoadingOverlay>
  )
}

/**
 * A failed query — and this is the state that did not exist before.
 *
 * `paginatedClient.error` was set and returned, but nobody read it: a broken
 * GROQ query, an expired token or missing permissions all produced an empty
 * result list, i.e. the message "there are no documents here yet" — over a
 * dataset that was full of them. The worst possible message in a pane built for
 * deleting documents in bulk.
 */
export const ErrorState = () => {
  const {paginatedClient} = useBulkActionsTableContext()
  const labels = useLabels()
  const {error} = paginatedClient

  if (!error) return null

  return (
    <Flex direction="column" align="center" padding={4}>
      <Card padding={4} radius={2} shadow={1} tone="critical">
        <Flex direction="column" align="center" gap={4}>
          <Flex align="center" gap={2}>
            <Text size={2}>
              <WarningOutlineIcon />
            </Text>
            <Text size={2} weight="medium">
              {labels.loadFailed}
            </Text>
          </Flex>
          <Text size={1} muted align="center">
            {error.message}
          </Text>
          <Button
            padding={2}
            fontSize={1}
            icon={SyncIcon}
            text={labels.retry}
            onClick={paginatedClient.refresh}
          />
        </Flex>
      </Card>
    </Flex>
  )
}

export const NoResultsState = () => {
  const {navigateIntent} = usePaneRouter()
  const {
    options: {type},
    paginatedClient,
  } = useBulkActionsTableContext()
  const {searchValue} = useSearchContext()
  const labels = useLabels()

  // An error has its own message — an empty list after a failed query does not
  // mean "there is nothing here".
  if (paginatedClient.error) return null
  if (paginatedClient.loading || paginatedClient.results.length) return null

  return (
    <Flex direction="column" align="center" padding={4}>
      <Card padding={4} radius={2} shadow={1}>
        <Flex direction="column" align="center" justify="center" gap={4}>
          <Text size={2} align="center">
            {searchValue.length ? labels.noResults(searchValue) : labels.noDocuments}
          </Text>
          {!searchValue.length && (
            <Button
              padding={2}
              fontSize={1}
              tone="default"
              icon={AddIcon}
              text={labels.create}
              onClick={() => navigateIntent('create', {type})}
            />
          )}
        </Flex>
      </Card>
    </Flex>
  )
}
