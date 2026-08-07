import {ChevronLeftIcon} from '@sanity/icons/ChevronLeft'
import {ChevronRightIcon} from '@sanity/icons/ChevronRight'
import {Box, Button, Card, Flex, Label, Select} from '@sanity/ui'

import {rowsPerPage} from './constants'
import {useBulkActionsTableContext, useLabels} from './context'

export default function Footer() {
  const {pageSize, setPageSize, paginatedClient} = useBulkActionsTableContext()
  const labels = useLabels()

  return (
    // An ordinary layout element, not `position: absolute`. The footer used to
    // float over the table, with room for it made by a `padding-bottom: 41px`
    // in the stylesheet — two numbers in two files that had to agree or the
    // last row hid underneath the bar.
    <Card borderTop padding={[3, 3, 2]} style={{flexShrink: 0}}>
      <Flex align="center" gap={2}>
        <Flex align="center" gap={2}>
          <Label style={{whiteSpace: 'nowrap'}}>{labels.rowsPerPage}</Label>
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
              title={labels.previousPage}
              aria-label={labels.previousPage}
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
              disabled={
                paginatedClient.totalPages === 0 ||
                paginatedClient.page === paginatedClient.totalPages - 1
              }
              onClick={() => paginatedClient.setPage(paginatedClient.page + 1)}
              icon={ChevronRightIcon}
              title={labels.nextPage}
              aria-label={labels.nextPage}
              mode="bleed"
            />
          </Flex>
        </Box>
      </Flex>
    </Card>
  )
}
