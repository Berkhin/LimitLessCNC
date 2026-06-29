import type { CSSProperties } from 'react';

/**
 * Dismissible alert shown when a flow is aborted mid-review (shared by both
 * implementations). Presentational only — the caller owns the dismiss action.
 */
export interface AbortAlertProps {
  message: string;
  onDismiss: () => void;
}

const alertStyle: CSSProperties = {
  marginBottom: '1rem',
  padding: '0.75rem',
  border: '1px solid #c0392b',
  color: '#c0392b',
  borderRadius: 4,
};

export function AbortAlert({ message, onDismiss }: AbortAlertProps) {
  return (
    <div role="alert" style={alertStyle}>
      {message}{' '}
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
