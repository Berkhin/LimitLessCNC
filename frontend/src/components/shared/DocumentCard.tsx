import type { CSSProperties } from 'react';
import type { DocumentState } from '../../services/types';

/**
 * Presentational card for a document. State-manager agnostic: it renders the
 * given document and forwards button clicks to the caller, which owns the flows.
 */
export interface DocumentCardProps {
  document: DocumentState;
  onApprove: () => void;
  onPublish: () => void;
}

const cardStyle: CSSProperties = {
  maxWidth: 640,
  padding: '1.5rem',
  border: '1px solid #ccc',
  borderRadius: 6,
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  marginTop: '1rem',
};

export function DocumentCard({
  document,
  onApprove,
  onPublish,
}: DocumentCardProps) {
  return (
    <section style={cardStyle}>
      <h1 style={{ marginTop: 0 }}>{document.title}</h1>
      <p>
        Version {document.version} · {document.status}
      </p>
      <p>{document.body}</p>
      <div style={actionsStyle}>
        <button type="button" onClick={onApprove}>
          Approve
        </button>
        <button type="button" onClick={onPublish}>
          Publish
        </button>
      </div>
    </section>
  );
}
