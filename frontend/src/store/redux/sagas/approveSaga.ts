/**
 * Approve flow as one imperative saga script.
 *
 * fetch context -> open the confirmation gate -> react to confirm / cancel /
 * mid-flight WS change. A 409 at submit loops back to refetch fresh context with
 * the modal still open. Re-entrancy is handled by `takeLeading` in rootSaga.
 */

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

interface GateResult {
  cancel?: ReturnType<typeof cancelRequested>;
  changed?: ReturnType<typeof stateUpdated>;
  confirm?: ReturnType<typeof confirmRequested>;
}

export function* runApproveFlow() {
  yield put(flowStarted('approve'));
  let needFetch = true;
  let version = 0;

  while (true) {
    if (needFetch) {
      try {
        const context: ApprovalContext = yield call(getApprovalContext);
        version = context.documentVersion;
        yield put(approvalContextLoaded(context));
        needFetch = false;
      } catch {
        yield put(flowAborted(APPROVE_LOAD_ERROR));
        return;
      }
    }

    const { cancel, changed, confirm }: GateResult = yield race({
      cancel: take(cancelRequested.type),
      changed: take(stateUpdated.type),
      confirm: take(confirmRequested.type),
    });

    if (cancel) {
      yield put(flowEnded());
      return;
    }

    if (changed) {
      const payload: StateUpdatedPayload = changed.payload;
      // Both flags = the version was bumped: what the user is confirming no
      // longer exists in the form they saw, so abort cleanly.
      if (payload.approvalContextChanged && payload.publishContextChanged) {
        yield put(flowAborted(VERSION_ABORT));
        return;
      }
      // Refetch only when the approval context itself changed; ignore the rest.
      if (payload.approvalContextChanged) needFetch = true;
      continue;
    }

    if (confirm) {
      try {
        yield call(approve, version);
        yield put(flowEnded());
        return;
      } catch (error) {
        if (error instanceof ConflictError) {
          yield put(noticeSet(CONFLICT_NOTICE));
          needFetch = true;
          continue;
        }
        yield put(noticeSet(APPROVE_SUBMIT_ERROR));
        continue;
      }
    }
  }
}
