/**
 * Root saga: pumps WebSocket events into the store and watches the flow trigger.
 *
 * Re-entrancy is governed by ONE `takeLeading` over a single unified trigger
 * (`flowRequested`). This is deliberate, and the subtle part of the design:
 *
 *   `takeLeading` only dedupes the *same* pattern. Two separate watchers —
 *   `takeLeading(approveRequested)` and `takeLeading(publishRequested)` — would
 *   each guard their own trigger but NOT each other. Approve could start, park
 *   at its confirm gate, and Publish could then start a second concurrent flow.
 *   Both sagas would be sitting on the shared `confirmRequested`, so a single
 *   Confirm would resolve BOTH and fire two submits from one click.
 *
 * Funnelling both intents through one `flowRequested` trigger makes "only one
 * flow in flight" a structural invariant: while a flow runs, `takeLeading`
 * ignores every further `flowRequested` regardless of which flow it names, so
 * exactly one flow saga is ever parked on `confirmRequested`.
 */

import { all, call, fork, put, take, takeLeading } from 'redux-saga/effects';
import type { StateUpdatedPayload } from '../../../services/types';
import { flowRequested, stateUpdated } from '../flowSlice';
import { runApproveFlow } from './approveSaga';
import { runPublishFlow } from './publishSaga';
import { createWsChannel } from './wsChannel';

/** Forward every WebSocket payload into the store as a stateUpdated action. */
function* pumpWsChannel() {
  const channel = createWsChannel();
  while (true) {
    const payload: StateUpdatedPayload = yield take(channel);
    yield put(stateUpdated(payload));
  }
}

/** Dispatch to the requested flow. Run via the single `takeLeading` above so the
 *  whole flow completes before any further trigger is honoured. */
function* runFlow(action: ReturnType<typeof flowRequested>) {
  if (action.payload === 'approve') {
    yield call(runApproveFlow);
  } else {
    yield call(runPublishFlow);
  }
}

export function* rootSaga() {
  yield all([
    fork(pumpWsChannel),
    takeLeading(flowRequested.match, runFlow),
  ]);
}
