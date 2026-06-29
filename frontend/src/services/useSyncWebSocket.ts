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
 *   3. If the active flow's version no longer matches the server, abort it — the
 *      user is reviewing something that no longer exists in that form. "Version
 *      changed" is decided by comparing versions (shared isVersionChanged), not
 *      by reverse-engineering it from the context-changed flags.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsClient } from './ws';
import { queryKeys } from './queries';
import { isVersionChanged } from './stateUpdate';
import { VERSION_ABORT_NOTICE } from './flowNotices';
import type { ApprovalContext, PublishContext } from './types';
import { useFlowStore } from '../store/useFlowStore';

export function useSyncWebSocket(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = wsClient.subscribe((payload) => {
      // Read Zustand state imperatively so this callback does not become a
      // useEffect dependency — we don't want to re-subscribe on every flow change.
      const { setDocument, activeFlow, abortFlow } = useFlowStore.getState();

      setDocument(payload.document);

      // Capture the version the active flow is operating on BEFORE the
      // invalidations below trigger a refetch that would overwrite the cache.
      const heldVersion =
        activeFlow === 'approve'
          ? queryClient.getQueryData<ApprovalContext>(queryKeys.approvalContext)
              ?.documentVersion
          : activeFlow === 'publish'
            ? queryClient.getQueryData<PublishContext>(queryKeys.publishContext)
                ?.documentState.version
            : undefined;

      if (payload.approvalContextChanged) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.approvalContext });
      }
      if (payload.publishContextChanged) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.publishContext });
      }

      // A version bump invalidates the in-flight flow: abort it and tell the user.
      if (heldVersion !== undefined && isVersionChanged(payload, heldVersion)) {
        abortFlow(VERSION_ABORT_NOTICE);
      }
    });

    return unsubscribe;
  }, [queryClient]);
}
