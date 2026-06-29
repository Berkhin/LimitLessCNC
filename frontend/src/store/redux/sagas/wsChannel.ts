/**
 * Bridges the framework-agnostic WebSocket singleton into redux-saga.
 *
 * `eventChannel` is the official way to feed an external event source into
 * sagas: it emits one StateUpdatedPayload per server push, and closing the
 * channel unsubscribes from the socket.
 *
 * Buffering: an unbuffered eventChannel defaults to `buffers.none()`, which
 * DROPS any payload that arrives while the pump saga is not currently parked on
 * `take(channel)` (e.g. mid-dispatch of the previous event). A burst of server
 * pushes could then silently lose a STATE_UPDATED — and with it a refetch or
 * abort signal. An expanding buffer queues bursts so every event is delivered in
 * order; the pump always drains it, so it never grows unbounded in practice.
 */

import { buffers, eventChannel, type EventChannel } from 'redux-saga';
import type { StateUpdatedPayload } from '../../../services/types';
import { wsClient } from '../../../services/ws';

export function createWsChannel(): EventChannel<StateUpdatedPayload> {
  return eventChannel<StateUpdatedPayload>((emit) => {
    const unsubscribe = wsClient.subscribe((payload) => {
      emit(payload);
    });
    // eventChannel invokes this when the channel is closed.
    return unsubscribe;
  }, buffers.expanding<StateUpdatedPayload>(8));
}
