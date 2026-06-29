/**
 * Strongly typed REST client (native fetch) for the document-approval backend.
 *
 * Every endpoint in docs/3_API_CONTRACTS.md is represented exactly once here.
 * Non-2xx responses throw: a generic `ApiError`, or a `ConflictError` carrying
 * the server's current version so the approve/publish flows can refetch context
 * and re-present the modal before the user confirms again.
 */

import type {
  ApprovalContext,
  ApproveResult,
  MutateAction,
  MutateResult,
  PublishContext,
  PublishResult,
} from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

/** Error thrown for any non-2xx response. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Thrown on 409 Conflict. `currentVersion` is the version the server now holds,
 * so the caller can refetch context and retry against fresh data.
 */
export class ConflictError extends ApiError {
  readonly currentVersion: number;

  constructor(message: string, currentVersion: number) {
    super(409, message);
    this.name = 'ConflictError';
    this.currentVersion = currentVersion;
  }
}

/** Shape of the `detail` object FastAPI returns on a 409 (see backend routers). */
interface ConflictDetail {
  message: string;
  currentVersion: number;
}

/** Safely narrow an unknown error body to a ConflictDetail, or null if it isn't one. */
function readConflictDetail(body: unknown): ConflictDetail | null {
  if (typeof body !== 'object' || body === null) return null;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail !== 'object' || detail === null) return null;
  const { message, currentVersion } = detail as Record<string, unknown>;
  if (typeof message === 'string' && typeof currentVersion === 'number') {
    return { message, currentVersion };
  }
  return null;
}

/** Issue a JSON request and parse the response, raising typed errors on failure. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Only declare a JSON content type when there is a body. Sending it on GETs
  // would make them non-simple requests and force a needless CORS preflight.
  const headers: HeadersInit = init.body
    ? { 'Content-Type': 'application/json', ...init.headers }
    : { ...init.headers };
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 409) {
      const detail = readConflictDetail(body);
      if (detail) throw new ConflictError(detail.message, detail.currentVersion);
    }
    throw new ApiError(response.status, `${path} failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getApprovalContext(): Promise<ApprovalContext> {
  return request<ApprovalContext>('/api/approval-context');
}

export function approve(version: number): Promise<ApproveResult> {
  return request<ApproveResult>('/api/approve', {
    method: 'POST',
    body: JSON.stringify({ version }),
  });
}

export function getPublishContext(): Promise<PublishContext> {
  return request<PublishContext>('/api/publish-context');
}

export function publish(version: number): Promise<PublishResult> {
  return request<PublishResult>('/api/publish', {
    method: 'POST',
    body: JSON.stringify({ version }),
  });
}

export function mutate(action: MutateAction): Promise<MutateResult> {
  return request<MutateResult>('/api/dev/mutate', {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}
