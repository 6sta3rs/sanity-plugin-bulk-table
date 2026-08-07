import {Badge, Box, Flex, Text, Tooltip} from '@sanity/ui'
import {memo} from 'react'

import {useLabels} from '../context'
import {coverageOf} from '../helpers/i18n'

/**
 * The translation state of the whole document, one badge per language.
 *
 * Filled = every text of this document has a version in that language,
 * outlined = some or none. The percentage under the cursor says exactly how
 * much - "English 80%" answers "how much is left", which a coloured dot on its
 * own does not.
 *
 * It counts **filled** fields only: an optional description nobody wrote in the
 * source language is not a missing translation and does not drag the number
 * down.
 */
function LanguageCell({
  row,
  fields,
  languages,
  label,
}: {
  row: Record<string, unknown>
  fields: string[]
  languages: string[]
  label: (code: string) => string
}) {
  const labels = useLabels()

  return (
    <Flex gap={1} align="center">
      {languages.map((code) => {
        const {ratio, filled, total} = coverageOf(row, fields, code)
        const percent = Math.round(ratio * 100)
        const complete = total > 0 && filled === total

        return (
          <Tooltip
            key={code}
            portal
            placement="bottom"
            delay={{open: 200}}
            content={
              <Box padding={2}>
                <Text size={0}>
                  {label(code)} — {percent}%
                  {total > 0 ? ` ${labels.fieldCount(filled, total)}` : ''}
                </Text>
              </Box>
            }
          >
            <Badge
              fontSize={0}
              padding={1}
              radius={2}
              mode={complete ? 'default' : 'outline'}
              tone={complete ? 'positive' : percent > 0 ? 'caution' : 'critical'}
            >
              {code.toUpperCase()}
            </Badge>
          </Tooltip>
        )
      })}
    </Flex>
  )
}

export default memo(LanguageCell)
