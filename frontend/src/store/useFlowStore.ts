/**
 * Zustand store for the document-approval UI flow state.
 *
 * Tracks which flow (approve / publish) is currently active and whether the
 * corresponding modal is open. Also caches the live document snapshot delivered
 * by the WebSocket so both flows share one source of truth for document data.
 *
 * Re-entrancy protection lives in the flow hooks (a synchronous ref latch at the
 * effect layer), not here. This store only tells the rest of the app what is
 * happening.
 */

import { create } from 'zustand';
import type { DocumentState } from '../services/types';

export type FlowKind = 'approve' | 'publish';

interface FlowState {
  activeFlow: FlowKind | null;
  isModalOpen: boolean;
  /** Live document state kept in sync by useSyncWebSocket. */
  document: DocumentState | null;
  /**
   * Set when useSyncWebSocket detects that the active flow has been
   * invalidated by a server-side version change. Cleared explicitly by
   * the component after showing the message.
   */
  abortMessage: string | null;

  startFlow: (flow: FlowKind) => void;
  closeModal: () => void;
  abortFlow: (message: string) => void;
  setDocument: (doc: DocumentState) => void;
  clearAbortMessage: () => void;
}

export const useFlowStore = create<FlowState>()((set) => ({
  activeFlow: null,
  isModalOpen: false,
  document: null,
  abortMessage: null,

  startFlow: (flow) => set({ activeFlow: flow, isModalOpen: true }),

  closeModal: () => set({ activeFlow: null, isModalOpen: false }),

  abortFlow: (message) =>
    set({ activeFlow: null, isModalOpen: false, abortMessage: message }),

  setDocument: (doc) => set({ document: doc }),

  clearAbortMessage: () => set({ abortMessage: null }),
}));
