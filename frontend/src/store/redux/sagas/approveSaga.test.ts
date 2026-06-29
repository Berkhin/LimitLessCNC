/**
 * Pure generator unit tests for the approve flow. The saga is a plain generator,
 * so we drive it with .next()/.throw() and assert the yielded effects — no
 * middleware, no mocks. This is the testability the journal claims for sagas,
 * and it pins down all four required behaviours (gate, mid-flight change,
 * re-entrancy/409 recovery, abort).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { call, put, race, take } from 'redux-saga/effects';
import { ConflictError, approve, getApprovalContext } from '../../../services/api';
import type { ApprovalContext, StateUpdatedPayload } from '../../../services/types';
import {
  approvalContextLoaded,
  cancelRequested,
  confirmRequested,
  flowAborted,
  flowEnded,
  flowStarted,
  noticeSet,
  stateUpdated,
} from '../flowSlice';
import {
  APPROVE_LOAD_ERROR,
  APPROVE_SUBMIT_ERROR,
  CONFLICT_NOTICE,
  VERSION_ABORT,
} from './messages';
import { runApproveFlow } from './approveSaga';

const HELD_VERSION = 5;
const context: ApprovalContext = {
  documentVersion: HELD_VERSION,
  requiredApprovers: ['Alice'],
  currentUserRole: 'Editor',
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

/** Step a fresh saga to the point where it is parked on the confirmation gate. */
function atGate() {
  const gen = runApproveFlow();
  gen.next(); // put(flowStarted)
  gen.next(); // call(getApprovalContext)
  gen.next(context); // put(approvalContextLoaded)
  expect(gen.next().value).toEqual(gate); // parked on the race
  return gen;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('runApproveFlow', () => {
  it('fetches context, opens the gate, then submits on confirm', () => {
    const gen = runApproveFlow();
    expect(gen.next().value).toEqual(put(flowStarted('approve')));
    expect(gen.next().value).toEqual(call(getApprovalContext));
    expect(gen.next(context).value).toEqual(put(approvalContextLoaded(context)));
    expect(gen.next().value).toEqual(gate);
    expect(gen.next({ confirm: confirmRequested() }).value).toEqual(
      call(approve, HELD_VERSION),
    );
    expect(gen.next().value).toEqual(put(flowEnded()));
    expect(gen.next().done).toBe(true);
  });

  it('ends the flow cleanly on cancel without submitting', () => {
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

  it('refetches in place when the approval context changes at the same version', () => {
    const gen = atGate();
    const changed = makePayload(HELD_VERSION, true, false);
    // Not a version change -> loop back to refetch fresh context.
    expect(gen.next({ changed: stateUpdated(changed) }).value).toEqual(
      call(getApprovalContext),
    );
  });

  it('ignores a change that only affects the publish context', () => {
    const gen = atGate();
    const irrelevant = makePayload(HELD_VERSION, false, true);
    // Same version, approval context untouched -> just re-arm the gate.
    expect(gen.next({ changed: stateUpdated(irrelevant) }).value).toEqual(gate);
  });

  it('on 409 keeps the modal open, notices, and refetches before re-gating', () => {
    const gen = atGate();
    expect(gen.next({ confirm: confirmRequested() }).value).toEqual(
      call(approve, HELD_VERSION),
    );
    // Submit throws a version conflict.
    expect(gen.throw(new ConflictError('conflict', HELD_VERSION + 1)).value).toEqual(
      put(noticeSet(CONFLICT_NOTICE)),
    );
    // Loops back to refetch fresh context (does NOT end the flow).
    expect(gen.next().value).toEqual(call(getApprovalContext));
  });

  it('on a non-conflict submit error notices and re-gates without refetching', () => {
    const gen = atGate();
    gen.next({ confirm: confirmRequested() }); // call(approve)
    expect(gen.throw(new Error('500')).value).toEqual(
      put(noticeSet(APPROVE_SUBMIT_ERROR)),
    );
    expect(console.error).toHaveBeenCalled(); // never fails silently
    expect(gen.next().value).toEqual(gate); // modal stays open, gate re-armed
  });

  it('aborts (does not fail silently) when the context fetch fails', () => {
    const gen = runApproveFlow();
    gen.next(); // put(flowStarted)
    gen.next(); // call(getApprovalContext)
    expect(gen.throw(new Error('network')).value).toEqual(
      put(flowAborted(APPROVE_LOAD_ERROR)),
    );
    expect(console.error).toHaveBeenCalled();
    expect(gen.next().done).toBe(true);
  });
});
