import {Box, Card, Dialog, Flex, Stack, Switch, Text} from '@sanity/ui'
import {useId} from 'react'

import {MAX_COLUMN_WIDTH_MAX, MAX_COLUMN_WIDTH_MIN, MAX_COLUMN_WIDTH_STEP} from './constants'
import {useBulkActionsTableContext} from './context'

/**
 * The table's view settings — everything that changes its shape rather than its
 * contents.
 *
 * A dialog of its own rather than more items in the column menu: that one picks
 * **what** you see, this one **how** it looks. The width slider also needs a
 * live preview, and a menu closes on every click.
 */
export default function TableSettingsDialog({onClose}: {onClose: () => void}) {
  const {fullWidth, setFullWidth, maxColumnWidth, setMaxColumnWidth, dense, setDense} =
    useBulkActionsTableContext()
  const dialogId = useId()

  return (
    <Dialog id={dialogId} header="Table settings" onClose={onClose} width={1} zOffset={1000}>
      <Box padding={4}>
        <Stack gap={4}>
          <Setting
            title="Full width columns"
            description="Every column as wide as its content needs, with the table scrolling sideways. Off: columns share the space evenly and text is truncated."
          >
            <Switch checked={fullWidth} onChange={() => setFullWidth(!fullWidth)} />
          </Setting>

          <Setting
            title="Dense rows"
            description="Tighter spacing - more rows on screen, less room for thumbnails."
          >
            <Switch checked={dense} onChange={() => setDense(!dense)} />
          </Setting>

          <Card borderTop paddingTop={4}>
            <Stack gap={3}>
              <Flex align="center" justify="space-between" gap={3}>
                <Text size={1} weight="medium">
                  Maximum column width
                </Text>
                <Text size={1} muted>
                  {maxColumnWidth} px
                </Text>
              </Flex>
              <Text size={0} muted>
                Applies to full width columns. With no limit, a description column stretches to the
                longest sentence in the table and every other column runs off the screen.
              </Text>
              {/* A native slider rather than a @sanity/ui component: there
                  isn't one, and `input[type=range]` inherits the theme through
                  `accent-color`. */}
              <input
                type="range"
                min={MAX_COLUMN_WIDTH_MIN}
                max={MAX_COLUMN_WIDTH_MAX}
                step={MAX_COLUMN_WIDTH_STEP}
                value={maxColumnWidth}
                onChange={(event) => setMaxColumnWidth(Number(event.currentTarget.value))}
                style={{width: '100%', accentColor: 'currentColor'}}
              />
              <Flex justify="space-between">
                <Text size={0} muted>
                  {MAX_COLUMN_WIDTH_MIN} px
                </Text>
                <Text size={0} muted>
                  {MAX_COLUMN_WIDTH_MAX} px
                </Text>
              </Flex>
            </Stack>
          </Card>
        </Stack>
      </Box>
    </Dialog>
  )
}

function Setting({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Flex align="flex-start" justify="space-between" gap={3}>
      <Stack gap={2} flex={1}>
        <Text size={1} weight="medium">
          {title}
        </Text>
        <Text size={0} muted>
          {description}
        </Text>
      </Stack>
      <Box style={{flexShrink: 0}}>{children}</Box>
    </Flex>
  )
}
