/**
 * User-facing copy for the Implementation 1 flows, plus the error→notice mapping.
 *
 * Kept out of the components so the view stays presentational: mapping a raw
 * error to a message is orchestration, and it lives in the data layer (the flow
 * hooks) alongside the rest of the flow's behaviour.
 */

import { ConflictError } from './api';

export const CONFLICT_NOTICE =
  'The document changed since you opened this. Review the updated details and confirm again.';

export const SUBMIT_ERROR_NOTICE =
  'Something went wrong submitting your request. Please try again.';

export const VERSION_ABORT_NOTICE =
  'The document version changed while you were reviewing. Please try again.';

/** Map a mutation error to a short user-facing notice (undefined when none). */
export function errorNotice(error: unknown): string | undefined {
  if (error instanceof ConflictError) return CONFLICT_NOTICE;
  if (error) return SUBMIT_ERROR_NOTICE;
  return undefined;
}
