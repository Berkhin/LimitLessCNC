/**
 * Pure generator unit tests for the publish flow — mirror of approveSaga.test,
 * covering the gate, mid-flight abort/refetch, and 409 recovery.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { call, put, race, take } from 'redux-saga/effects';
import { ConflictError, getPublishContext, publish } from '../../../services/api';
import type { PublishContext, StateUpdatedPayload } from '../../../services/types';
import {
  cancelRequested,
  confirmRequested,
  flowAborted,
  flowEnded,
  flowStarted,
  noticeSet,
  publishContextLoaded,
  stateUpdated,
} from '../flowSlice';
import {
  CONFLICT_NOTICE,
  PUBLISH_LOAD_ERROR,
  VERSION_ABORT,
} from './messages';
import { runPublishFlow } from './publishSaga';

const HELD_VERSION = 5;
const context: PublishContext = {
  dependentDocuments: ['doc-2'],
  subscribers: ['team@x.dev'],
  documentState: {
    id: 'doc-1',
    title: 'T',
    body: 'B',
    version: HELD_VERSION,
    status: 'draft',
  },
};

const gate = race({
  cancel: take(cancelRequested.type),
  changed: take(stateUpdated.type),
  confirm: take(confirmRequested.type),
});

function makePayload(
  version: number,
  approvalContextChanged = false,
  publishContextChanged = false,
): StateUpdatedPayload {
  return {
    document: { id: 'doc-1', title: 'T', body: 'B', version, status: 'draft' },
    approvalContextChanged,
    publishContextChanged,
  };
}

function atGate() {
  const gen = runPublishFlow();
  gen.next(); // put(flowStarted)
  gen.next(); // call(getPublishContext)
  gen.next(context); // put(publishContextLoaded)
  expect(gen.next().value).toEqual(gate);
  return gen;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('runPublishFlow', () => {
  it('fetches context, opens the gate, then submits on confirm', () => {
    const gen = runPublishFlow();
    expect(gen.next().value).toEqual(put(flowStarted('publish')));
    expect(gen.next().value).toEqual(call(getPublishContext));
    expect(gen.next(context).value).toEqual(put(publishContextLoaded(context)));
    expect(gen.next().value).toEqual(gate);
    expect(gen.next({ confirm: confirmRequested() }).value).toEqual(
      call(publish, HELD_VERSION),
    );
    expect(gen.next().value).toEqual(put(flowEnded()));
    expect(gen.next().done).toBe(true);
  });

  it('ends cleanly on cancel without submitting', () => {
    const gen = atGate();
    expect(gen.next({ cancel: cancelRequested() }).value).toEqual(put(flowEnded()));
    expect(gen.next().done).toBe(true);
  });

  it('aborts when a mid-flight change bumps the version', () => {
    const gen = atGate();
    const bumped = makePayload(HELD_VERSION + 1, true, true);
    expect(gen.next({ changed: stateUpdated(bumped) }).value).toEqual(
      put(flowAborted(VERSION_ABORT)),
    );
    expect(gen.next().done).toBe(true);
  });

  it('refetches in place when the publish context changes at the same version', () => {
    const gen = atGate();
    const changed = makePayload(HELD_VERSION, false, true);
    expect(gen.next({ changed: stateUpdated(changed) }).value).toEqual(
      call(getPublishContext),
    );
  });

  it('on 409 keeps the modal open, notices, and refetches before re-gating', () => {
    const gen = atGate();
    expect(gen.next({ confirm: confirmRequested() }).value).toEqual(
      call(publish, HELD_VERSION),
    );
    expect(gen.throw(new ConflictError('conflict', HELD_VERSION + 1)).value).toEqual(
      put(noticeSet(CONFLICT_NOTICE)),
    );
    expect(gen.next().value).toEqual(call(getPublishContext));
  });

  it('aborts (does not fail silently) when the context fetch fails', () => {
    const gen = runPublishFlow();
    gen.next();
    gen.next();
    expect(gen.throw(new Error('network')).value).toEqual(
      put(flowAborted(PUBLISH_LOAD_ERROR)),
    );
    expect(console.error).toHaveBeenCalled();
    expect(gen.next().done).toBe(true);
  });
});
