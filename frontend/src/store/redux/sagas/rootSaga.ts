/**
 * Root saga: pumps WebSocket events into the store and watches the flow triggers.
 *
 * `takeLeading` is the idiomatic re-entrancy guard — it runs the first trigger
 * and ignores further ones until that flow completes, so rapid Approve/Publish
 * clicks can never start a flow twice (no UI-level debouncing needed).
 */

import { all, fork, put, take, takeLeading } from 'redux-saga/effects';
import type { StateUpdatedPayload } from '../../../services/types';
import { approveRequested, publishRequested, stateUpdated } from '../flowSlice';
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

export function* rootSaga() {
  yield all([
    fork(pumpWsChannel),
    takeLeading(approveRequested.type, runApproveFlow),
    takeLeading(publishRequested.type, runPublishFlow),
  ]);
}
