/**
 * Implementation 1 root: TanStack Query + Zustand.
 *
 * Stitches the shared dumb components to the query/mutation hooks and the
 * Zustand flow store, and mounts the WebSocket sync hook. The QueryClientProvider
 * wraps an inner component so the hooks run inside Query context.
 */

import type { CSSProperties } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ConflictError } from '../../services/api';
import {
  queryClient,
  useApprovalContextQuery,
  useApproveMutation,
  usePublishContextQuery,
  usePublishMutation,
} from '../../services/queries';
import { useSyncWebSocket } from '../../services/useSyncWebSocket';
import { useFlowStore } from '../../store/useFlowStore';
import { ApproveModal } from '../shared/ApproveModal';
import { DocumentCard } from '../shared/DocumentCard';
import { PublishModal } from '../shared/PublishModal';

const alertStyle: CSSProperties = {
  marginBottom: '1rem',
  padding: '0.75rem',
  border: '1px solid #c0392b',
  color: '#c0392b',
  borderRadius: 4,
};

/** Map a mutation error to a short user-facing notice (undefined when none). */
function errorNotice(error: unknown): string | undefined {
  if (error instanceof ConflictError) {
    return 'The document changed since you opened this. Review the updated details and confirm again.';
  }
  if (error) return 'Something went wrong submitting your request. Please try again.';
  return undefined;
}

function AppQueryContent() {
  useSyncWebSocket();

  const documentState = useFlowStore((s) => s.document);
  const activeFlow = useFlowStore((s) => s.activeFlow);
  const isModalOpen = useFlowStore((s) => s.isModalOpen);
  const abortMessage = useFlowStore((s) => s.abortMessage);
  const startFlow = useFlowStore((s) => s.startFlow);
  const closeModal = useFlowStore((s) => s.closeModal);
  const clearAbortMessage = useFlowStore((s) => s.clearAbortMessage);

  const approvalQuery = useApprovalContextQuery(activeFlow === 'approve');
  const publishQuery = usePublishContextQuery(activeFlow === 'publish');
  const approveMutation = useApproveMutation(closeModal);
  const publishMutation = usePublishMutation(closeModal);

  // Reset prior mutation state on (re)open so a stale error notice can't leak.
  const openApprove = () => {
    approveMutation.reset();
    startFlow('approve');
  };
  const openPublish = () => {
    publishMutation.reset();
    startFlow('publish');
  };

  // Re-entrancy: a submit already in flight silently ignores further clicks.
  // (Flow *triggers* are deduped by React Query's per-key request sharing.)
  const confirmApprove = () => {
    const version = approvalQuery.data?.documentVersion;
    if (approveMutation.isPending || version === undefined) return;
    approveMutation.mutate(version);
  };
  const confirmPublish = () => {
    const version = publishQuery.data?.documentState.version;
    if (publishMutation.isPending || version === undefined) return;
    publishMutation.mutate(version);
  };

  if (!documentState) return <p style={{ padding: '2rem' }}>Connecting to the document…</p>;

  return (
    <main style={{ padding: '2rem' }}>
      {abortMessage && (
        <div role="alert" style={alertStyle}>
          {abortMessage}{' '}
          <button type="button" onClick={clearAbortMessage}>
            Dismiss
          </button>
        </div>
      )}

      <DocumentCard
        document={documentState}
        onApprove={openApprove}
        onPublish={openPublish}
      />

      {activeFlow === 'approve' && (
        <ApproveModal
          isOpen={isModalOpen}
          context={approvalQuery.data ?? null}
          notice={errorNotice(approveMutation.error)}
          onConfirm={confirmApprove}
          onCancel={closeModal}
        />
      )}

      {activeFlow === 'publish' && (
        <PublishModal
          isOpen={isModalOpen}
          context={publishQuery.data ?? null}
          notice={errorNotice(publishMutation.error)}
          onConfirm={confirmPublish}
          onCancel={closeModal}
        />
      )}
    </main>
  );
}

export function AppQuery() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppQueryContent />
    </QueryClientProvider>
  );
}
