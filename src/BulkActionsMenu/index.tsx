import { DocumentId, getDraftId, getPublishedId } from '@sanity/id-utils';
import ChevronDownIcon from '@sanity/icons/ChevronDown';
import PublishIcon from '@sanity/icons/Publish';
import ResetIcon from '@sanity/icons/Reset';
import TrashIcon from '@sanity/icons/Trash';
import UnpublishIcon from '@sanity/icons/Unpublish';
import {
  Button,
  Dialog,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  useToast,
} from '@sanity/ui';
import { Component, ReactNode, useId, useState } from 'react';
import { Preview } from 'sanity';
import styled from 'styled-components';

import { useBulkActionsTableContext } from '../context';
import { handleBulkOperationError } from '../utils/errorHandling';

const Content = styled.div`
  padding: 0 1rem;
  font-size: 0.85rem;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 0.75rem;
`;

interface Props {
  onDelete: () => void;
}

// Renders nothing if a child throws — this only guards the document previews
// inside an error toast, where a second crash must not take down the pane.
// @sanity/ui's ErrorBoundary is @beta ("DO NOT USE IN PRODUCTION") and renders
// the error message instead of nothing, so it is not usable here.
class SilentErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const ErroredDocuments = ({ e, schemaType }: { e: any; schemaType: any }) => {
  // ponytail: Actions API error shape isn't confirmed to carry per-document ids
  // the way the old Mutations API's `details.items[].error.id` did (the typed
  // ActionErrorItem only guarantees `index` + `error.type`/`description`).
  // Read defensively and fall back to an empty list rather than throwing.
  const idsWithErrors: string[] =
    e?.details?.items
      ?.map((item: any) => item?.error?.id)
      .filter((id: unknown): id is string => typeof id === 'string') ?? [];

  if (!idsWithErrors.length) {
    return null;
  }

  const plural = idsWithErrors.length !== 1;

  return (
    <SilentErrorBoundary>
      <p>
        Please unselect {plural ? 'these' : 'this'} document{plural ? 's' : ''}{' '}
        and try again:
      </p>
      <p>
        {idsWithErrors.map((id) => (
          <Preview
            key={id}
            schemaType={schemaType}
            layout="default"
            value={{ _id: id, _type: schemaType.type }}
          />
        ))}
      </p>
    </SilentErrorBoundary>
  );
};

function BulkActionsMenu({ onDelete }: Props) {
  const {
    options: { client },
    selectedIds,
    setSelectedIds,
    schemaType,
  } = useBulkActionsTableContext();

  const buttonId = useId();
  const toast = useToast();
  const dialogId = useId();
  const [dialogMode, setDialogMode] = useState<
    'discard_changes' | 'unpublish' | 'publish' | 'delete' | null
  >(null);
  const [loading, setLoading] = useState(false);

  const handleDiscardChanges = async () => {
    setLoading(true);

    try {
      const ids = await client.fetch<string[]>('*[_id in $ids]._id', {
        ids: Array.from(selectedIds).flatMap((id) => [
          id,
          getDraftId(DocumentId(id)),
        ]),
      });

      const idSet = ids.reduce((set, id) => {
        set.add(id);
        return set;
      }, new Set<string>());

      const draftIdsThatAlsoHavePublishedIds = ids.filter(
        (id) =>
          id.startsWith('drafts.') && idSet.has(id.substring('drafts.'.length)),
      );

      if (draftIdsThatAlsoHavePublishedIds.length) {
        await client.action(
          draftIdsThatAlsoHavePublishedIds.map((versionId) => ({
            actionType: 'sanity.action.document.version.discard' as const,
            versionId,
          })),
        );
      }

      toast.push({
        title: 'Changes Discarded',
        description: `${selectedIds.size} documents reverted`,
        status: 'success',
        closable: true,
        duration: 10 * 1000,
      });
      setSelectedIds(new Set());
    } catch (e) {
      handleBulkOperationError(e, 'discard changes', Array.from(selectedIds));

      toast.push({
        title: 'Error Bulk Discarding Changes',
        description: (
          <>
            <p>The bulk discard changes failed.</p>
            <ErroredDocuments e={e} schemaType={schemaType} />
          </>
        ),
        status: 'error',
        closable: true,
        duration: 30 * 1000,
      });
    } finally {
      setDialogMode(null);
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    setLoading(true);

    try {
      const publishedIds = await client.fetch<string[]>('*[_id in $ids]._id', {
        ids: Array.from(selectedIds),
      });

      if (publishedIds.length) {
        // sanity.action.document.unpublish moves the published document's
        // content into the draft only if a draft doesn't already exist,
        // instead of the old createIfNotExists-then-delete pair, which
        // silently dropped published content whenever a draft was already
        // staged.
        await client.action(
          publishedIds.map((publishedId) => ({
            actionType: 'sanity.action.document.unpublish' as const,
            draftId: getDraftId(DocumentId(publishedId)),
            publishedId: getPublishedId(DocumentId(publishedId)),
          })),
        );
      }

      toast.push({
        title: 'Unpublish Successful',
        description: `${selectedIds.size} documents unpublished`,
        status: 'success',
        closable: true,
        duration: 10 * 1000,
      });
      setSelectedIds(new Set());
    } catch (e) {
      handleBulkOperationError(e, 'unpublish', Array.from(selectedIds));

      toast.push({
        title: 'Error Bulk Unpublishing',
        description: (
          <>
            <p>
              The bulk unpublished failed. This usually occurs because there are
              other documents referencing the documents you’re trying to
              unpublish.
            </p>
            <ErroredDocuments e={e} schemaType={schemaType} />
          </>
        ),
        status: 'error',
        closable: true,
        duration: 30 * 1000,
      });
    } finally {
      setDialogMode(null);
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    setLoading(true);

    try {
      const draftIds = await client.fetch<string[]>('*[_id in $ids]._id', {
        ids: Array.from(selectedIds).map((id) => getDraftId(DocumentId(id))),
      });

      if (draftIds.length) {
        await client.action(
          draftIds.map((draftId) => ({
            actionType: 'sanity.action.document.publish' as const,
            draftId,
            publishedId: getPublishedId(DocumentId(draftId)),
          })),
        );
      }

      toast.push({
        title: 'Publish Successful',
        description: `${selectedIds.size} documents published`,
        status: 'success',
        closable: true,
        duration: 10 * 1000,
      });
      setSelectedIds(new Set());
    } catch (e) {
      handleBulkOperationError(e, 'publish', Array.from(selectedIds));

      toast.push({
        title: 'Error Bulk Publishing',
        description: (
          <>
            <p>The bulk publish failed.</p>
            <ErroredDocuments e={e} schemaType={schemaType} />
          </>
        ),
        status: 'error',
        closable: true,
        duration: 30 * 1000,
      });
    } finally {
      setDialogMode(null);
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);

    try {
      // sanity.action.document.delete errors if a draft exists that isn't
      // listed in includeDrafts, but is otherwise a no-op for ids that don't
      // exist, so no existence pre-check is needed here.
      await client.action(
        Array.from(selectedIds).map((id) => ({
          actionType: 'sanity.action.document.delete' as const,
          publishedId: getPublishedId(DocumentId(id)),
          includeDrafts: [getDraftId(DocumentId(id))],
        })),
      );

      toast.push({
        title: 'Delete Successful',
        description: `${selectedIds.size} documents deleted`,
        status: 'success',
        closable: true,
        duration: 10 * 1000,
      });

      onDelete();
    } catch (e) {
      handleBulkOperationError(e, 'delete', Array.from(selectedIds));

      toast.push({
        title: 'Error Bulk Deleting',
        description: (
          <>
            <p>
              The bulk delete failed. This usually occurs because there are
              other documents referencing the documents you’re trying to delete.
            </p>

            <ErroredDocuments e={e} schemaType={schemaType} />
          </>
        ),
        status: 'error',
        closable: true,
        duration: 30 * 1000,
      });
    } finally {
      setDialogMode(null);
      setLoading(false);
    }
  };

  return (
    <>
      <MenuButton
        id={buttonId}
        button={
          <Button
            gap={2}
            fontSize={1}
            padding={2}
            text="Update items"
            tone="primary"
            iconRight={ChevronDownIcon}
          />
        }
        popover={{ portal: true, placement: 'bottom' }}
        menu={
          <Menu style={{ textAlign: 'left' }}>
            <MenuItem
              className="prevent-nav"
              text="Publish"
              icon={PublishIcon}
              tone="positive"
              onClick={() => setDialogMode('publish')}
            />
            <MenuItem
              className="prevent-nav"
              text="Discard staged changes"
              icon={ResetIcon}
              onClick={() => setDialogMode('discard_changes')}
            />
            <MenuItem
              text="Unpublish"
              icon={UnpublishIcon}
              tone="caution"
              className="prevent-nav"
              onClick={() => setDialogMode('unpublish')}
            />
            <MenuDivider />
            <MenuItem
              tone="critical"
              icon={TrashIcon}
              text="Delete"
              className="prevent-nav"
              onClick={() => setDialogMode('delete')}
            />
          </Menu>
        }
      />

      {dialogMode === 'discard_changes' && (
        <Dialog
          id={dialogId}
          header="Discard Changes"
          zOffset={100000}
          footer={
            <Footer>
              <Button
                text="Cancel"
                mode="ghost"
                disabled={loading}
                onClick={() => setDialogMode(null)}
              />
              <Button
                text="Discard Changes"
                tone="critical"
                mode="ghost"
                disabled={loading}
                onClick={handleDiscardChanges}
              />
            </Footer>
          }
          onClose={() => setDialogMode(null)}
        >
          <Content>
            <p>
              Are you sure you want to discard changes to{' '}
              <strong>{selectedIds.size}</strong> document
              {selectedIds.size === 1 ? '' : 's'}?
            </p>
            <p>
              Discarding changes reverts changes made to any drafts of the
              selected documents and restores the currently published versions.
            </p>
            <p>
              You can use the{' '}
              <a
                href="https://www.sanity.io/docs/history-experience"
                target="_blank"
                rel="noreferrer noopener"
              >
                document history
              </a>{' '}
              of each individual document to track these changes.
            </p>
          </Content>
        </Dialog>
      )}

      {dialogMode === 'unpublish' && (
        <Dialog
          id={dialogId}
          header="Unpublish Documents"
          zOffset={100000}
          footer={
            <Footer>
              <Button
                text="Cancel"
                mode="ghost"
                disabled={loading}
                onClick={() => setDialogMode(null)}
              />
              <Button
                text="Unpublish Documents"
                tone="caution"
                disabled={loading}
                onClick={handleUnpublish}
              />
            </Footer>
          }
          onClose={() => setDialogMode(null)}
        >
          <Content>
            <p>
              Are you sure you want to unpublish{' '}
              <strong>{selectedIds.size}</strong> document
              {selectedIds.size === 1 ? '' : 's'}?
            </p>
            <p>
              If you unpublish a document, it will no longer be available to the
              public. Its contents will be moved into a draft if a draft does
              not already exist. From there you can continue to author the
              document and re-publish it later.
            </p>
            <p>
              You can use the{' '}
              <a
                href="https://www.sanity.io/docs/history-experience"
                target="_blank"
                rel="noreferrer noopener"
              >
                document history
              </a>{' '}
              of each individual document to track these changes.
            </p>
          </Content>
        </Dialog>
      )}

      {dialogMode === 'publish' && (
        <Dialog
          id={dialogId}
          header="Publish Documents"
          zOffset={100000}
          footer={
            <Footer>
              <Button
                text="Cancel"
                mode="ghost"
                disabled={loading}
                onClick={() => setDialogMode(null)}
              />
              <Button
                text="Publish Documents"
                tone="positive"
                disabled={loading}
                onClick={handlePublish}
              />
            </Footer>
          }
          onClose={() => setDialogMode(null)}
        >
          <Content>
            <p>
              Are you sure you want to publish{' '}
              <strong>{selectedIds.size}</strong> document
              {selectedIds.size === 1 ? '' : 's'}?
            </p>
            <p>
              Publishing a document makes the current contents of each document
              publicly available.
            </p>
            <p>
              You can use the{' '}
              <a
                href="https://www.sanity.io/docs/history-experience"
                target="_blank"
                rel="noreferrer noopener"
              >
                document history
              </a>{' '}
              of each individual document to track these changes.
            </p>
          </Content>
        </Dialog>
      )}

      {dialogMode === 'delete' && (
        <Dialog
          id={dialogId}
          header="Delete Documents"
          zOffset={100000}
          footer={
            <Footer>
              <Button
                text="Cancel"
                mode="ghost"
                disabled={loading}
                onClick={() => setDialogMode(null)}
              />
              <Button
                text="Delete Documents"
                tone="critical"
                disabled={loading}
                onClick={handleDelete}
              />
            </Footer>
          }
          onClose={() => setDialogMode(null)}
        >
          <Content>
            <p>
              Are you sure you want to delete{' '}
              <strong>{selectedIds.size}</strong> document
              {selectedIds.size === 1 ? '' : 's'}?
            </p>
            <p>
              Deleting a document makes it no longer available to the public as
              well as removing any draft versions of it.
            </p>
            <p>
              <strong>Note:</strong> in order to delete a document, it must not
              be referenced by any other document. You may have to remove those
              references first.
            </p>
          </Content>
        </Dialog>
      )}
    </>
  );
}

export default BulkActionsMenu;
