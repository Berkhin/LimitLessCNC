import type { PublishContext } from '../../services/types';
import { Modal } from './Modal';

/**
 * Presentational publish-confirmation modal showing the cascade impact.
 * `context` may be null while it is being (re)fetched or updated mid-flight via
 * a WebSocket state change, so the dialog can reflect new data in place.
 */
export interface PublishModalProps {
  isOpen: boolean;
  context: PublishContext | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PublishModal({
  isOpen,
  context,
  onConfirm,
  onCancel,
}: PublishModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      title="Publish document"
      confirmLabel="Confirm publish"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {context ? (
        <>
          <p>
            {context.documentState.title} (v{context.documentState.version},{' '}
            {context.documentState.status})
          </p>
          <p>Dependent documents that will update:</p>
          <ul>
            {context.dependentDocuments.map((dependent) => (
              <li key={dependent}>{dependent}</li>
            ))}
          </ul>
          <p>Subscribers to be notified:</p>
          <ul>
            {context.subscribers.map((subscriber) => (
              <li key={subscriber}>{subscriber}</li>
            ))}
          </ul>
        </>
      ) : (
        <p>Loading publish context…</p>
      )}
    </Modal>
  );
}
