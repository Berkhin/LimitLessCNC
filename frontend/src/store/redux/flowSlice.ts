/**
 * Single Redux slice for both flows (Implementation 2).
 *
 * Holds the same shape as the Zustand store in Implementation 1 so the shared
 * dumb components can be driven identically. State-mutating actions live in the
 * slice; "intent" actions (below) carry no state change and exist purely for the
 * sagas to listen to.
 */

import { createAction, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  ApprovalContext,
  DocumentState,
  PublishContext,
  StateUpdatedPayload,
} from '../../services/types';

export type FlowKind = 'approve' | 'publish';

export interface FlowState {
  activeFlow: FlowKind | null;
  isModalOpen: boolean;
  document: DocumentState | null;
  approvalContext: ApprovalContext | null;
  publishContext: PublishContext | null;
  /** Conflict/error message shown inside the open modal. */
  notice: string | null;
  /** Alert shown after a flow is aborted by a mid-flight change. */
  abortMessage: string | null;
}

const initialState: FlowState = {
  activeFlow: null,
  isModalOpen: false,
  document: null,
  approvalContext: null,
  publishContext: null,
  notice: null,
  abortMessage: null,
};

// Intent actions: dispatched by the UI, consumed by sagas. No reducer changes.
export const approveRequested = createAction('flow/approveRequested');
export const publishRequested = createAction('flow/publishRequested');
export const confirmRequested = createAction('flow/confirmRequested');
export const cancelRequested = createAction('flow/cancelRequested');

// Dispatched by the WS channel pump: sagas race on it; the reducer stores the doc.
export const stateUpdated = createAction<StateUpdatedPayload>('flow/stateUpdated');

const flowSlice = createSlice({
  name: 'flow',
  initialState,
  reducers: {
    flowStarted(state, action: PayloadAction<FlowKind>) {
      state.activeFlow = action.payload;
      state.isModalOpen = true;
      state.notice = null;
      state.abortMessage = null;
      state.approvalContext = null;
      state.publishContext = null;
    },
    approvalContextLoaded(state, action: PayloadAction<ApprovalContext>) {
      state.approvalContext = action.payload;
    },
    publishContextLoaded(state, action: PayloadAction<PublishContext>) {
      state.publishContext = action.payload;
    },
    noticeSet(state, action: PayloadAction<string>) {
      state.notice = action.payload;
    },
    flowEnded(state) {
      state.activeFlow = null;
      state.isModalOpen = false;
      state.notice = null;
      state.approvalContext = null;
      state.publishContext = null;
    },
    flowAborted(state, action: PayloadAction<string>) {
      state.activeFlow = null;
      state.isModalOpen = false;
      state.notice = null;
      state.approvalContext = null;
      state.publishContext = null;
      state.abortMessage = action.payload;
    },
    abortMessageCleared(state) {
      state.abortMessage = null;
    },
  },
  extraReducers: (builder) => {
    // Every server push refreshes the live document the card renders.
    builder.addCase(stateUpdated, (state, action) => {
      state.document = action.payload.document;
    });
  },
});

export const {
  flowStarted,
  approvalContextLoaded,
  publishContextLoaded,
  noticeSet,
  flowEnded,
  flowAborted,
  abortMessageCleared,
} = flowSlice.actions;

export const flowReducer = flowSlice.reducer;
