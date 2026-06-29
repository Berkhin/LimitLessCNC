/**
 * Integration test for the re-entrancy invariant: with one `takeLeading` over a
 * single unified trigger, only one flow can be in flight at a time.
 *
 * This is the test that would have caught the cross-flow double-submit: before
 * the fix (two per-trigger watchers), Approve→Publish→Confirm fired BOTH submits
 * from a single Confirm. Here we assert exactly one submit fires.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';

// The WS pump must not open a real socket; give it a channel that never emits.
vi.mock('./wsChannel', async () => {
  const { eventChannel } = await import('redux-saga');
  return { createWsChannel: () => eventChannel(() => () => {}) };
});

// Mock only the network functions; keep the real error classes.
vi.mock('../../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/api')>();
  return {
    ...actual,
    getApprovalContext: vi.fn(),
    getPublishContext: vi.fn(),
    approve: vi.fn(),
    publish: vi.fn(),
  };
});

import {
  approve,
  getApprovalContext,
  getPublishContext,
  publish,
} from '../../../services/api';
import { confirmRequested, flowReducer, flowRequested } from '../flowSlice';
import { rootSaga } from './rootSaga';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function makeStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { flow: flowReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  sagaMiddleware.run(rootSaga);
  return store;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getApprovalContext).mockResolvedValue({
    documentVersion: 1,
    requiredApprovers: [],
    currentUserRole: 'Editor',
  });
  vi.mocked(getPublishContext).mockResolvedValue({
    dependentDocuments: [],
    subscribers: [],
    documentState: { id: 'doc-1', title: 'T', body: 'B', version: 1, status: 'draft' },
  });
  vi.mocked(approve).mockResolvedValue({ status: 'approved', version: 1 });
  vi.mocked(publish).mockResolvedValue({ status: 'published', version: 1 });
});

describe('rootSaga — only one flow in flight', () => {
  it('ignores a second flow trigger mid-gate; one Confirm fires exactly one submit', async () => {
    const store = makeStore();

    store.dispatch(flowRequested('approve'));
    await tick(); // approval context resolves; approve flow parks at its gate
    expect(store.getState().flow.activeFlow).toBe('approve');

    // Click Publish while Approve is parked. The unified takeLeading ignores it,
    // so the publish flow never starts (activeFlow stays 'approve').
    store.dispatch(flowRequested('publish'));
    await tick();
    expect(store.getState().flow.activeFlow).toBe('approve');

    // A single Confirm: only the one live flow resolves -> one POST.
    store.dispatch(confirmRequested());
    await tick();

    expect(approve).toHaveBeenCalledTimes(1);
    expect(approve).toHaveBeenCalledWith(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it('re-arms after a flow completes so the next flow can run', async () => {
    const store = makeStore();

    store.dispatch(flowRequested('approve'));
    await tick();
    store.dispatch(confirmRequested());
    await tick();
    expect(approve).toHaveBeenCalledTimes(1);
    expect(store.getState().flow.activeFlow).toBeNull();

    // takeLeading has re-armed: a fresh trigger starts the publish flow.
    store.dispatch(flowRequested('publish'));
    await tick();
    expect(store.getState().flow.activeFlow).toBe('publish');
    store.dispatch(confirmRequested());
    await tick();
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
