/**
 * Bridges the framework-agnostic WebSocket singleton into redux-saga.
 *
 * `eventChannel` is the official way to feed an external event source into
 * sagas: it emits one StateUpdatedPayload per server push, and closing the
 * channel unsubscribes from the socket.
 */

import { eventChannel, type EventChannel } from 'redux-saga';
import type { StateUpdatedPayload } from '../../../services/types';
import { wsClient } from '../../../services/ws';

export function createWsChannel(): EventChannel<StateUpdatedPayload> {
  return eventChannel<StateUpdatedPayload>((emit) => {
    const unsubscribe = wsClient.subscribe((payload) => {
      emit(payload);
    });
    // eventChannel invokes this when the channel is closed.
    return unsubscribe;
  });
}
