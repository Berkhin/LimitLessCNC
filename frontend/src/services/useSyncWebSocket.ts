/**
 * React hook — bridges the framework-agnostic WebSocket singleton into the
 * TanStack Query + Zustand layer.
 *
 * Mount this once at the root of the impl1 component tree.
 *
 * On every STATE_UPDATED event:
 *   1. Persist the latest document snapshot in the Zustand store.
 *   2. Invalidate whichever context queries the server flagged as stale so they
 *      refetch automatically. An open modal will show updated data without the
 *      user needing to reopen it.
 *   3. When BOTH contexts are flagged simultaneously the server incremented the
 *      document version. Any in-flight flow is now operating on a stale version
 *      and must be aborted — the user is informed and can restart.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsClient } from './ws';
import { queryKeys } from './queries';
import { useFlowStore } from '../store/useFlowStore';

export function useSyncWebSocket(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = wsClient.subscribe((payload) => {
      // Read Zustand state imperatively so this callback does not become a
      // useEffect dependency — we don't want to re-subscribe on every flow change.
      const { setDocument, activeFlow, abortFlow } = useFlowStore.getState();

      setDocument(payload.document);

      if (payload.approvalContextChanged) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.approvalContext });
      }
      if (payload.publishContextChanged) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.publishContext });
      }

      // Both flags true simultaneously = the document version was incremented.
      // Any active flow is now stale; abort it and tell the user why.
      const versionBumped =
        payload.approvalContextChanged && payload.publishContextChanged;
      if (versionBumped && activeFlow !== null) {
        abortFlow('The document version changed while you were reviewing. Please try again.');
      }
    });

    return unsubscribe;
  }, [queryClient]);
}
