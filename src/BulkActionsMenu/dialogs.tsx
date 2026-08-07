import {PublishIcon} from '@sanity/icons/Publish'
import {ResetIcon} from '@sanity/icons/Reset'
import {TrashIcon} from '@sanity/icons/Trash'
import {UnpublishIcon} from '@sanity/icons/Unpublish'
import {ComponentType, ReactNode} from 'react'

export type BulkMode = 'publish' | 'discard_changes' | 'unpublish' | 'delete'

export interface BulkDialogCopy {
  menuLabel: string
  icon: ComponentType
  tone: 'default' | 'positive' | 'caution' | 'critical'
  header: string
  confirm: string
  body: (count: number) => ReactNode
  successTitle: string
  errorTitle: string
  /** One sentence on why the operation might not have gone through. */
  errorHint: string
}

const documents = (count: number) => (count === 1 ? '1 document' : `${count} documents`)

const HistoryLink = () => (
  <a href="https://www.sanity.io/docs/history-experience" target="_blank" rel="noreferrer noopener">
    document history
  </a>
)

/**
 * All of the confirmation dialogs' copy in one table.
 *
 * This used to be four `<Dialog>` blocks differing only in their wording, next
 * to four functions of identical shape. A fix in one place (the count in a
 * message, say) took four identical fixes, and three of them were missed.
 */
export const BULK_DIALOGS: Record<BulkMode, BulkDialogCopy> = {
  publish: {
    menuLabel: 'Publish',
    icon: PublishIcon,
    tone: 'positive',
    header: 'Publish documents',
    confirm: 'Publish',
    body: (count) => (
      <>
        <p>
          Publish <strong>{documents(count)}</strong>?
        </p>
        <p>
          Publishing makes the current content of each of them public. Documents with no draft are
          skipped — there is nothing in them to publish.
        </p>
        <p>
          You can follow the changes in each item's <HistoryLink />.
        </p>
      </>
    ),
    successTitle: 'Published',
    errorTitle: 'Publishing failed',
    errorHint: 'Some documents may have failed schema validation.',
  },

  discard_changes: {
    menuLabel: 'Discard draft changes',
    icon: ResetIcon,
    tone: 'default',
    header: 'Discard changes',
    confirm: 'Discard changes',
    body: (count) => (
      <>
        <p>
          Discard the changes in <strong>{documents(count)}</strong>?
        </p>
        <p>
          The drafts of the selected documents are deleted and the currently published versions are
          left in place. Documents with no published version are skipped — there is nothing to fall
          back to.
        </p>
        <p>
          You can follow the changes in each item's <HistoryLink />.
        </p>
      </>
    ),
    successTitle: 'Changes discarded',
    errorTitle: 'Could not discard the changes',
    errorHint: '',
  },

  unpublish: {
    menuLabel: 'Unpublish',
    icon: UnpublishIcon,
    tone: 'caution',
    header: 'Unpublish documents',
    confirm: 'Unpublish',
    body: (count) => (
      <>
        <p>
          Unpublish <strong>{documents(count)}</strong>?
        </p>
        <p>
          The document stops being publicly available and its content moves into a draft — unless a
          draft already exists. You can keep editing it and publish it again later.
        </p>
        <p>
          You can follow the changes in each item's <HistoryLink />.
        </p>
      </>
    ),
    successTitle: 'Unpublished',
    errorTitle: 'Could not unpublish',
    errorHint: 'Usually because other documents still refer to the ones you are unpublishing.',
  },

  delete: {
    menuLabel: 'Delete',
    icon: TrashIcon,
    tone: 'critical',
    header: 'Delete documents',
    confirm: 'Delete',
    body: (count) => (
      <>
        <p>
          Delete <strong>{documents(count)}</strong>?
        </p>
        <p>The document disappears from the public site along with its drafts.</p>
        <p>
          <strong>Note:</strong> a document can only be deleted while no other document refers to
          it. Those references have to go first.
        </p>
      </>
    ),
    successTitle: 'Deleted',
    errorTitle: 'Deleting failed',
    errorHint: 'Usually because other documents still refer to the ones you are deleting.',
  },
}
