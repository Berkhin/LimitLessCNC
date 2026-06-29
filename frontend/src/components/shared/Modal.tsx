import type { CSSProperties, ReactNode } from 'react';

/**
 * Presentational modal shell shared by the approve/publish flows.
 *
 * Pure and state-manager agnostic: it renders nothing when closed and emits
 * intent through `onConfirm` / `onCancel`. Callers own all behaviour.
 */
export interface ModalProps {
  isOpen: boolean;
  title: string;
  confirmLabel: string;
  /** Optional status line (e.g. a version-conflict or error message). */
  notice?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.5)',
};

const dialogStyle: CSSProperties = {
  minWidth: 320,
  maxWidth: 480,
  padding: '1.5rem',
  background: '#fff',
  color: '#000',
  borderRadius: 6,
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.5rem',
  marginTop: '1.5rem',
};

const noticeStyle: CSSProperties = {
  padding: '0.5rem 0.75rem',
  marginBottom: '0.75rem',
  border: '1px solid #c0392b',
  color: '#c0392b',
  borderRadius: 4,
};

export function Modal({
  isOpen,
  title,
  confirmLabel,
  notice,
  onConfirm,
  onCancel,
  children,
}: ModalProps) {
  if (!isOpen) return null;
  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label={title}>
      <div style={dialogStyle}>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {notice && (
          <p style={noticeStyle} role="alert">
            {notice}
          </p>
        )}
        {children}
        <div style={footerStyle}>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
