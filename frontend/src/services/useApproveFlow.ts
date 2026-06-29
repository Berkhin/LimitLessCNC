/**
 * Approve flow orchestration for Implementation 1 — owned by the data layer.
 *
 * This hook is the Query-stack answer to "where does the flow live?": context
 * query + submit mutation + re-entrancy + refetch gating + error→notice mapping
 * are concentrated here, so the component stays a thin render-and-dispatch shell
 * (no isPending guard, no reset(), no error mapping in the view).
 */

import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { errorNotice } from './flowNotices';
import { queryKeys, useApprovalContextQuery, useApproveMutation } from './queries';
import type { ApprovalContext } from './types';
import { useFlowStore } from '../store/useFlowStore';

export interface ApproveFlow {
  context: ApprovalContext | null;
  notice?: string;
  open: () => void;
  confirm: () => void;
  cancel: () => void;
}

export function useApproveFlow(): ApproveFlow {
  const queryClient = useQueryClient();
  const activeFlow = useFlowStore((s) => s.activeFlow);
  const startFlow = useFlowStore((s) => s.startFlow);
  const closeModal = useFlowStore((s) => s.closeModal);

  const query = useApprovalContextQuery(activeFlow === 'approve');
  const mutation = useApproveMutation(closeModal);

  // Synchronous re-entrancy latch. A ref flips in the same tick as the click, so
  // two clicks within one render frame cannot both pass the guard — unlike
  // `isPending`, which is render state and updates a tick late (the TOCTOU gap).
  // This is an effect-layer guard, not a disabled button or debounce.
  const submitting = useRef(false);

  const open = () => {
    // Drop any cached context so a reopened modal never flashes the previous
    // session's data; it shows the loading state until fresh context arrives.
    queryClient.removeQueries({ queryKey: queryKeys.approvalContext });
    mutation.reset();
    startFlow('approve');
  };

  const confirm = () => {
    const version = query.data?.documentVersion;
    // Refuse to confirm while context is (re)fetching: after a conflict the user
    // must be looking at fresh data before resubmitting, mirroring the saga gate.
    if (submitting.current || query.isFetching || version === undefined) return;
    submitting.current = true;
    mutation.mutate(version, {
      onSettled: () => {
        submitting.current = false;
      },
    });
  };

  const cancel = () => {
    void queryClient.cancelQueries({ queryKey: queryKeys.approvalContext });
    closeModal();
  };

  return {
    context: query.data ?? null,
    notice: errorNotice(mutation.error),
    open,
    confirm,
    cancel,
  };
}
