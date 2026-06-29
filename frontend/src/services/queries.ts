/**
 * TanStack Query v5 — query/mutation hooks and the shared QueryClient.
 *
 * 409 Conflict recovery:
 *   Both submit mutations catch ConflictError in onError and invalidate the
 *   relevant context query so it refetches automatically. Closing the modal is
 *   only ever driven by the success path (onSuccess === closeModal), so a 409
 *   leaves it open by construction. The flow hooks (useApproveFlow /
 *   usePublishFlow) then block re-confirmation until that refetch settles, so
 *   the user always sees fresh context before confirming again.
 *
 * Query keys are exported constants so useSyncWebSocket and the flow hooks can
 * invalidate/remove the same keys without hard-coding strings.
 */

import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ConflictError,
  approve,
  getApprovalContext,
  getPublishContext,
  publish,
} from './api';
import type { ApprovalContext, ApproveResult, PublishContext, PublishResult } from './types';

export const queryClient = new QueryClient();

export const queryKeys = {
  approvalContext: ['approval-context'] as const,
  publishContext: ['publish-context'] as const,
} as const;

/** Fetch approval context only while the approve flow is active. */
export function useApprovalContextQuery(enabled: boolean) {
  return useQuery<ApprovalContext>({
    queryKey: queryKeys.approvalContext,
    queryFn: getApprovalContext,
    enabled,
  });
}

/** Fetch publish context only while the publish flow is active. */
export function usePublishContextQuery(enabled: boolean) {
  return useQuery<PublishContext>({
    queryKey: queryKeys.publishContext,
    queryFn: getPublishContext,
    enabled,
  });
}

/**
 * Submit an approval. On 409, invalidate context (modal stays open with fresh
 * data). `onSuccess` is typically `closeModal` from the Zustand store.
 */
export function useApproveMutation(onSuccess: () => void) {
  const qc = useQueryClient();
  return useMutation<ApproveResult, unknown, number>({
    mutationFn: approve,
    onSuccess,
    onError: (error) => {
      if (error instanceof ConflictError) {
        void qc.invalidateQueries({ queryKey: queryKeys.approvalContext });
      }
    },
  });
}

/**
 * Submit a publish. On 409, invalidate context (modal stays open with fresh
 * data). `onSuccess` is typically `closeModal` from the Zustand store.
 */
export function usePublishMutation(onSuccess: () => void) {
  const qc = useQueryClient();
  return useMutation<PublishResult, unknown, number>({
    mutationFn: publish,
    onSuccess,
    onError: (error) => {
      if (error instanceof ConflictError) {
        void qc.invalidateQueries({ queryKey: queryKeys.publishContext });
      }
    },
  });
}
