/**
 * Publish flow as one imperative saga script — mirror of the approve flow.
 *
 * fetch context -> confirmation gate -> confirm / cancel / mid-flight WS change,
 * with 409 recovery looping back to refetch. Re-entrancy via `takeLeading`.
 */

import { call, put, race, take } from 'redux-saga/effects';
import { ConflictError, getPublishContext, publish } from '../../../services/api';
import { isVersionChanged } from '../../../services/stateUpdate';
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
  PUBLISH_SUBMIT_ERROR,
  VERSION_ABORT,
} from './messages';

interface GateResult {
  cancel?: ReturnType<typeof cancelRequested>;
  changed?: ReturnType<typeof stateUpdated>;
  confirm?: ReturnType<typeof confirmRequested>;
}

export function* runPublishFlow() {
  yield put(flowStarted('publish'));
  let needFetch = true;
  let version = 0;

  while (true) {
    if (needFetch) {
      try {
        const context: PublishContext = yield call(getPublishContext);
        version = context.documentState.version;
        yield put(publishContextLoaded(context));
        needFetch = false;
      } catch (error) {
        console.error('Publish flow: failed to load publish context', error);
        yield put(flowAborted(PUBLISH_LOAD_ERROR));
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
      // The version we are about to confirm no longer matches the server, so
      // what the user reviewed no longer exists in that form: abort cleanly.
      if (isVersionChanged(payload, version)) {
        yield put(flowAborted(VERSION_ABORT));
        return;
      }
      // Same version, but the publish context itself changed -> refetch in place.
      if (payload.publishContextChanged) needFetch = true;
      continue;
    }

    if (confirm) {
      try {
        yield call(publish, version);
        yield put(flowEnded());
        return;
      } catch (error) {
        if (error instanceof ConflictError) {
          yield put(noticeSet(CONFLICT_NOTICE));
          needFetch = true;
          continue;
        }
        console.error('Publish flow: failed to submit publish', error);
        yield put(noticeSet(PUBLISH_SUBMIT_ERROR));
        continue;
      }
    }
  }
}
