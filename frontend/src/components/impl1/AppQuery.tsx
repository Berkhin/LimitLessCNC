/**
 * Implementation 1 root: TanStack Query + Zustand.
 *
 * Deliberately thin: it reads flow state and renders. All orchestration
 * (context fetch, submit, re-entrancy, refetch gating, error→notice mapping)
 * lives in the useApproveFlow / usePublishFlow data-layer hooks, so there is no
 * isPending guard, mutation.reset() or error mapping in the view. The
 * QueryClientProvider wraps an inner component so the hooks run inside Query
 * context.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../services/queries';
import { useApproveFlow } from '../../services/useApproveFlow';
import { usePublishFlow } from '../../services/usePublishFlow';
import { useSyncWebSocket } from '../../services/useSyncWebSocket';
import { useFlowStore } from '../../store/useFlowStore';
import { AbortAlert } from '../shared/AbortAlert';
import { ApproveModal } from '../shared/ApproveModal';
import { DocumentCard } from '../shared/DocumentCard';
import { PublishModal } from '../shared/PublishModal';

function AppQueryContent() {
  useSyncWebSocket();

  const documentState = useFlowStore((s) => s.document);
  const activeFlow = useFlowStore((s) => s.activeFlow);
  const isModalOpen = useFlowStore((s) => s.isModalOpen);
  const abortMessage = useFlowStore((s) => s.abortMessage);
  const clearAbortMessage = useFlowStore((s) => s.clearAbortMessage);

  const approveFlow = useApproveFlow();
  const publishFlow = usePublishFlow();

  if (!documentState) return <p style={{ padding: '2rem' }}>Connecting to the document…</p>;

  return (
    <main style={{ padding: '2rem' }}>
      {abortMessage && (
        <AbortAlert message={abortMessage} onDismiss={clearAbortMessage} />
      )}

      <DocumentCard
        document={documentState}
        onApprove={approveFlow.open}
        onPublish={publishFlow.open}
      />

      {activeFlow === 'approve' && (
        <ApproveModal
          isOpen={isModalOpen}
          context={approveFlow.context}
          notice={approveFlow.notice}
          onConfirm={approveFlow.confirm}
          onCancel={approveFlow.cancel}
        />
      )}

      {activeFlow === 'publish' && (
        <PublishModal
          isOpen={isModalOpen}
          context={publishFlow.context}
          notice={publishFlow.notice}
          onConfirm={publishFlow.confirm}
          onCancel={publishFlow.cancel}
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
