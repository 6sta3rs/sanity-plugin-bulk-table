import {AddIcon} from '@sanity/icons/Add'
import {CheckmarkIcon} from '@sanity/icons/Checkmark'
import {ChevronDownIcon} from '@sanity/icons/ChevronDown'
import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
import {TranslateIcon} from '@sanity/icons/Translate'
import {Box, Button, Card, Flex, Menu, MenuButton, MenuItem, Text, Tooltip} from '@sanity/ui'
import {ReactElement, useId} from 'react'
import {usePaneRouter} from 'sanity/structure'

import BulkActionsMenu from './BulkActionsMenu'
import ColumnSelector from './ColumnSelector'
import {orderColumnDefault} from './constants'
import {useBulkActionsTableContext, useLabels} from './context'
import {languageName} from './helpers/languageName'
import SearchField from './SearchField'

const Hint = ({text, children}: {text: string; children: ReactElement}) => (
  <Tooltip
    content={
      <Box padding={1}>
        <Text size={0}>{text}</Text>
      </Box>
    }
    delay={{open: 400}}
    padding={1}
    placement="bottom"
    portal
  >
    {children}
  </Tooltip>
)

export default function ActionRow() {
  const {navigateIntent} = usePaneRouter()
  const languageMenuId = useId()
  const {
    options: {type, languages},
    selectedIds,
    setSelectedIds,
    paginatedClient,
    isSelectState,
    setIsSelectState,
    language,
    setLanguage,
    untranslatedOnly,
    setUntranslatedOnly,
    schemaType,
    selectedColumns,
    setSelectedColumns,
    setOrderColumn,
    languagesVisible,
    setLanguagesVisible,
  } = useBulkActionsTableContext()
  const labels = useLabels()

  if (isSelectState) {
    return (
      <Card padding={2}>
        <Flex align="center" justify="space-between">
          <Text size={1} weight="bold">
            {selectedIds.size === 0 ? labels.selectPrompt : labels.selected(selectedIds.size)}
          </Text>
          <Flex gap={2} align="center">
            {selectedIds.size > 0 && (
              <BulkActionsMenu
                onChanged={() => {
                  paginatedClient.setPage(0)
                  paginatedClient.refresh()
                }}
              />
            )}
            <Hint text={labels.cancelHint}>
              <Button
                fontSize={1}
                padding={2}
                text={labels.cancel}
                mode="ghost"
                onClick={() => {
                  setIsSelectState(false)
                  setSelectedIds(new Set())
                }}
              />
            </Hint>
          </Flex>
        </Flex>
      </Card>
    )
  }

  return (
    <Card padding={2}>
      <Flex align="center" gap={2}>
        <Text size={1} weight="bold" style={{whiteSpace: 'nowrap'}}>
          {labels.items(paginatedClient.total)}
        </Text>
        <Flex gap={2} align="center" flex={1}>
          {/* Search takes every bit of free space between the count and the
              actions — it is the only text field in the bar, so there is
              nothing to compete with, and long titles stay readable in full. */}
          <Box flex={1}>
            <SearchField />
          </Box>

          {!!languages?.length && (
            <>
              {/* The language picker governs two things at once: which version
                  the text columns render, and which one they sort by. One
                  control, because it is the same question asked twice. */}
              <MenuButton
                id={languageMenuId}
                button={
                  <Button
                    gap={2}
                    fontSize={1}
                    padding={2}
                    mode="ghost"
                    icon={EarthGlobeIcon}
                    iconRight={ChevronDownIcon}
                    text={languageName(language)}
                  />
                }
                menu={
                  <Menu>
                    {languages.map((code) => (
                      <MenuItem
                        key={code}
                        fontSize={1}
                        padding={3}
                        text={languageName(code)}
                        icon={code === language ? CheckmarkIcon : undefined}
                        pressed={code === language}
                        onClick={() => setLanguage(code)}
                      />
                    ))}
                  </Menu>
                }
                popover={{portal: true, placement: 'bottom-start'}}
              />

              {/* Narrows the list to the documents with no text in the chosen
                  language. The "N items" count on the left is then the answer
                  to "how many are left" — which is why the filter travels the
                  same path as search instead of dropping rows after the page
                  has been fetched. */}
              <Hint text={labels.untranslatedHint(languageName(language))}>
                <Button
                  gap={2}
                  fontSize={1}
                  padding={2}
                  text={labels.untranslated}
                  mode={untranslatedOnly ? 'default' : 'ghost'}
                  tone={untranslatedOnly ? 'primary' : 'default'}
                  selected={untranslatedOnly}
                  icon={TranslateIcon}
                  onClick={() => setUntranslatedOnly(!untranslatedOnly)}
                />
              </Hint>
            </>
          )}

          {/* Every secondary action is `ghost` and the one primary action
              ("Create") is `primary` — the way Studio's own document lists
              look. */}
          <Hint text={labels.selectHint}>
            <Button
              gap={2}
              fontSize={1}
              padding={2}
              text={labels.select}
              mode="ghost"
              icon={CheckmarkIcon}
              onClick={() => setIsSelectState(true)}
            />
          </Hint>

          <Button
            gap={2}
            fontSize={1}
            padding={2}
            text={labels.create}
            tone="primary"
            icon={AddIcon}
            onClick={() => navigateIntent('create', {type})}
          />

          {/* The column picker lives in the bar, not in the table. It used to
              be the last column: on a wide table it either scrolled off the
              screen or — pinned — covered the last column's content in every
              row with a strip. */}
          <ColumnSelector
            schemaType={schemaType}
            hasLanguages={!!languages?.length}
            languagesVisible={languagesVisible}
            onToggleLanguages={() => setLanguagesVisible(!languagesVisible)}
            selectedColumns={selectedColumns}
            onToggleColumnSelect={(key) => {
              const nextSet = new Set(selectedColumns)
              if (nextSet.has(key)) {
                setOrderColumn(orderColumnDefault)
                nextSet.delete(key)
              } else {
                nextSet.add(key)
              }
              setSelectedColumns(nextSet)
            }}
          />
        </Flex>
      </Flex>
    </Card>
  )
}
