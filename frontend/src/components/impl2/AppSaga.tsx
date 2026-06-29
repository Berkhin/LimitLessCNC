/**
 * Implementation 2 root: Redux Toolkit + redux-saga.
 *
 * The container is deliberately thin: it reads slice state and dispatches intent
 * actions. All orchestration (sequencing, re-entrancy via takeLeading, 409
 * recovery, mid-flight abort) lives in the sagas, so there is no isPending guard
 * or notice bookkeeping here.
 */

import { Provider } from 'react-redux';
import {
  abortMessageCleared,
  approveRequested,
  cancelRequested,
  confirmRequested,
  publishRequested,
} from '../../store/redux/flowSlice';
import { useAppDispatch, useAppSelector } from '../../store/redux/hooks';
import { store } from '../../store/redux/store';
import { AbortAlert } from '../shared/AbortAlert';
import { ApproveModal } from '../shared/ApproveModal';
import { DocumentCard } from '../shared/DocumentCard';
import { PublishModal } from '../shared/PublishModal';

function AppSagaContent() {
  const dispatch = useAppDispatch();
  const documentState = useAppSelector((s) => s.flow.document);
  const activeFlow = useAppSelector((s) => s.flow.activeFlow);
  const isModalOpen = useAppSelector((s) => s.flow.isModalOpen);
  const notice = useAppSelector((s) => s.flow.notice);
  const abortMessage = useAppSelector((s) => s.flow.abortMessage);
  const approvalContext = useAppSelector((s) => s.flow.approvalContext);
  const publishContext = useAppSelector((s) => s.flow.publishContext);

  if (!documentState) {
    return <p style={{ padding: '2rem' }}>Connecting to the document…</p>;
  }

  return (
    <main style={{ padding: '2rem' }}>
      {abortMessage && (
        <AbortAlert
          message={abortMessage}
          onDismiss={() => dispatch(abortMessageCleared())}
        />
      )}

      <DocumentCard
        document={documentState}
        onApprove={() => dispatch(approveRequested())}
        onPublish={() => dispatch(publishRequested())}
      />

      {activeFlow === 'approve' && (
        <ApproveModal
          isOpen={isModalOpen}
          context={approvalContext}
          notice={notice ?? undefined}
          onConfirm={() => dispatch(confirmRequested())}
          onCancel={() => dispatch(cancelRequested())}
        />
      )}

      {activeFlow === 'publish' && (
        <PublishModal
          isOpen={isModalOpen}
          context={publishContext}
          notice={notice ?? undefined}
          onConfirm={() => dispatch(confirmRequested())}
          onCancel={() => dispatch(cancelRequested())}
        />
      )}
    </main>
  );
}

export function AppSaga() {
  return (
    <Provider store={store}>
      <AppSagaContent />
    </Provider>
  );
}
