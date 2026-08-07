import {SanityClient} from '@sanity/client'
import {ChevronDownIcon} from '@sanity/icons/ChevronDown'
import {DocumentId, getDraftId, getPublishedId} from '@sanity/id-utils'
import {Button, Dialog, Menu, MenuButton, MenuDivider, MenuItem, useToast} from '@sanity/ui'
import {useId, useState} from 'react'
import styled from 'styled-components'

import {useBulkActionsTableContext, useLabels} from '../context'
import {logError} from '../utils/errorHandling'
import {BULK_DIALOGS, BulkMode} from './dialogs'

const Content = styled.div`
  padding: 0 1rem;
  font-size: 0.85rem;
`

const Footer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 0.75rem;
`

type BulkAction =
  | {
      actionType: 'sanity.action.document.publish'
      draftId: string
      publishedId: string
    }
  | {
      actionType: 'sanity.action.document.unpublish'
      draftId: string
      publishedId: string
    }
  | {
      actionType: 'sanity.action.document.version.discard'
      versionId: string
    }
  | {
      actionType: 'sanity.action.document.delete'
      publishedId: string
      includeDrafts: string[]
    }

/**
 * How many documents go into one request.
 *
 * A constant, not a setting. A request is atomic, so without chunking a
 * selection of a hundred items went out as a single transaction and one
 * document with an incoming reference took the whole thing down with no word on
 * how much had succeeded. If Sanity's own limit ever changes, this is the one
 * number to change.
 */
const CHUNK_SIZE = 30

/**
 * Which documents the operation will actually touch.
 *
 * This answers a question nobody used to ask: the toast said "published 41
 * documents" because it reported the size of the selection rather than the
 * number of documents that had a draft to publish.
 */
async function planActions(
  mode: BulkMode,
  client: SanityClient,
  selectedIds: string[],
): Promise<BulkAction[]> {
  switch (mode) {
    case 'publish': {
      const draftIds = await client.fetch<string[]>('*[_id in $ids]._id', {
        ids: selectedIds.map((id) => getDraftId(DocumentId(id))),
      })
      return draftIds.map((draftId) => ({
        actionType: 'sanity.action.document.publish',
        draftId,
        publishedId: getPublishedId(DocumentId(draftId)),
      }))
    }

    case 'unpublish': {
      // `sanity.action.document.unpublish` moves the published content into a
      // draft only when no draft exists yet — unlike the old createIfNotExists
      // + delete pair, which silently lost the published content whenever a
      // draft was already waiting.
      const publishedIds = await client.fetch<string[]>('*[_id in $ids]._id', {
        ids: selectedIds,
      })
      return publishedIds.map((publishedId) => ({
        actionType: 'sanity.action.document.unpublish',
        draftId: getDraftId(DocumentId(publishedId)),
        publishedId: getPublishedId(DocumentId(publishedId)),
      }))
    }

    case 'discard_changes': {
      const ids = await client.fetch<string[]>('*[_id in $ids]._id', {
        ids: selectedIds.flatMap((id) => [id, getDraftId(DocumentId(id))]),
      })
      const present = new Set(ids)
      return ids
        .filter((id) => id.startsWith('drafts.') && present.has(getPublishedId(DocumentId(id))))
        .map((versionId) => ({
          actionType: 'sanity.action.document.version.discard',
          versionId,
        }))
    }

    case 'delete':
      // No existence check: the delete action is a no-op for ids that don't
      // exist, and only errors when a draft outside `includeDrafts` exists.
      return selectedIds.map((id) => ({
        actionType: 'sanity.action.document.delete',
        publishedId: getPublishedId(DocumentId(id)),
        includeDrafts: [getDraftId(DocumentId(id))],
      }))
  }
}

interface Props {
  /** Called after an operation that may have changed the page's contents. */
  onChanged: () => void
}

function BulkActionsMenu({onChanged}: Props) {
  const {
    options: {client},
    selectedIds,
    setSelectedIds,
    setIsSelectState,
  } = useBulkActionsTableContext()
  const labels = useLabels()

  const buttonId = useId()
  const dialogId = useId()
  const toast = useToast()
  const [mode, setMode] = useState<BulkMode | null>(null)
  const [loading, setLoading] = useState(false)

  const run = async (activeMode: BulkMode) => {
    const copy = BULK_DIALOGS[activeMode]
    setLoading(true)
    let done = 0

    try {
      const actions = await planActions(activeMode, client, Array.from(selectedIds))

      for (let i = 0; i < actions.length; i += CHUNK_SIZE) {
        const chunk = actions.slice(i, i + CHUNK_SIZE)
        await client.action(chunk)
        done += chunk.length
      }

      const skipped = selectedIds.size - done
      toast.push({
        title: copy.successTitle,
        description:
          done === 0
            ? 'None of the selected documents needed this operation.'
            : `${done} of ${selectedIds.size}` +
              (skipped > 0 ? ` (skipped ${skipped} - nothing to change)` : ''),
        status: done === 0 ? 'warning' : 'success',
        closable: true,
        duration: 10 * 1000,
      })

      setSelectedIds(new Set())
      setIsSelectState(false)
      onChanged()
    } catch (e) {
      logError(e, `bulk action: ${activeMode}`)

      toast.push({
        title: copy.errorTitle,
        description: [
          done > 0
            ? `Got through ${done} of ${selectedIds.size}. The rest are unchanged.`
            : 'Nothing was changed.',
          copy.errorHint,
          e instanceof Error ? e.message : String(e),
        ]
          .filter(Boolean)
          .join(' '),
        status: 'error',
        closable: true,
        duration: 30 * 1000,
      })

      // The page may already have partly changed — after an interrupted
      // operation it matters all the more to show what actually happened.
      if (done > 0) onChanged()
    } finally {
      setMode(null)
      setLoading(false)
    }
  }

  const copy = mode ? BULK_DIALOGS[mode] : null

  return (
    <>
      <MenuButton
        id={buttonId}
        button={
          <Button
            gap={2}
            fontSize={1}
            padding={2}
            text={labels.bulkButton}
            tone="primary"
            iconRight={ChevronDownIcon}
          />
        }
        popover={{portal: true, placement: 'bottom'}}
        menu={
          <Menu style={{textAlign: 'left'}}>
            {(['publish', 'discard_changes', 'unpublish'] as const).map((key) => (
              <MenuItem
                key={key}
                className="prevent-nav"
                text={BULK_DIALOGS[key].menuLabel}
                icon={BULK_DIALOGS[key].icon}
                tone={BULK_DIALOGS[key].tone}
                onClick={() => setMode(key)}
              />
            ))}
            <MenuDivider />
            <MenuItem
              className="prevent-nav"
              text={BULK_DIALOGS.delete.menuLabel}
              icon={BULK_DIALOGS.delete.icon}
              tone={BULK_DIALOGS.delete.tone}
              onClick={() => setMode('delete')}
            />
          </Menu>
        }
      />

      {mode && copy && (
        <Dialog
          id={dialogId}
          header={copy.header}
          zOffset={100000}
          footer={
            <Footer>
              <Button
                text={labels.cancel}
                mode="ghost"
                disabled={loading}
                onClick={() => setMode(null)}
              />
              <Button
                text={copy.confirm}
                tone={copy.tone}
                disabled={loading}
                onClick={() => void run(mode)}
              />
            </Footer>
          }
          onClose={() => setMode(null)}
        >
          <Content>{copy.body(selectedIds.size)}</Content>
        </Dialog>
      )}
    </>
  )
}

export default BulkActionsMenu
