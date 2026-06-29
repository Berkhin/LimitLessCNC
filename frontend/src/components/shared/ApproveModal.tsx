import type { ApprovalContext } from '../../services/types';
import { Modal } from './Modal';

/**
 * Presentational approve-confirmation modal. `context` may be null while it is
 * being (re)fetched — e.g. after a version conflict — so the dialog can stay
 * open and swap in fresh data without the caller unmounting it.
 */
export interface ApproveModalProps {
  isOpen: boolean;
  context: ApprovalContext | null;
  notice?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ApproveModal({
  isOpen,
  context,
  notice,
  onConfirm,
  onCancel,
}: ApproveModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      title="Approve document"
      confirmLabel="Confirm approval"
      notice={notice}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {context ? (
        <>
          <p>Document version: {context.documentVersion}</p>
          <p>Your role: {context.currentUserRole}</p>
          <p>Required approvers:</p>
          <ul>
            {context.requiredApprovers.map((approver) => (
              <li key={approver}>{approver}</li>
            ))}
          </ul>
        </>
      ) : (
        <p>Loading approval context…</p>
      )}
    </Modal>
  );
}
