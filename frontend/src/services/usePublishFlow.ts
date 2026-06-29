/**
 * Publish flow orchestration for Implementation 1 — mirror of useApproveFlow.
 *
 * Concentrates the publish context query, submit mutation, re-entrancy latch,
 * refetch gating and error→notice mapping so the component stays presentational.
 */

import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { errorNotice } from './flowNotices';
import { queryKeys, usePublishContextQuery, usePublishMutation } from './queries';
import type { PublishContext } from './types';
import { useFlowStore } from '../store/useFlowStore';

export interface PublishFlow {
  context: PublishContext | null;
  notice?: string;
  open: () => void;
  confirm: () => void;
  cancel: () => void;
}

export function usePublishFlow(): PublishFlow {
  const queryClient = useQueryClient();
  const activeFlow = useFlowStore((s) => s.activeFlow);
  const startFlow = useFlowStore((s) => s.startFlow);
  const closeModal = useFlowStore((s) => s.closeModal);

  const query = usePublishContextQuery(activeFlow === 'publish');
  const mutation = usePublishMutation(closeModal);

  // See useApproveFlow: synchronous effect-layer latch, not a UI-level guard.
  const submitting = useRef(false);

  const open = () => {
    queryClient.removeQueries({ queryKey: queryKeys.publishContext });
    mutation.reset();
    startFlow('publish');
  };

  const confirm = () => {
    const version = query.data?.documentState.version;
    if (submitting.current || query.isFetching || version === undefined) return;
    submitting.current = true;
    mutation.mutate(version, {
      onSettled: () => {
        submitting.current = false;
      },
    });
  };

  const cancel = () => {
    void queryClient.cancelQueries({ queryKey: queryKeys.publishContext });
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
