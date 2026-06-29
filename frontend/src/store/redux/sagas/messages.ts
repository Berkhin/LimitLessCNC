/** Shared user-facing copy for the approve/publish sagas (kept DRY). */

export const CONFLICT_NOTICE =
  'The document changed since you opened this. Review the updated details and confirm again.';

export const VERSION_ABORT =
  'The document version changed while you were reviewing. Please try again.';

export const APPROVE_SUBMIT_ERROR =
  'Something went wrong submitting your approval. Please try again.';
export const APPROVE_LOAD_ERROR =
  'Could not load the approval context. Please close and retry.';

export const PUBLISH_SUBMIT_ERROR =
  'Something went wrong submitting your publish. Please try again.';
export const PUBLISH_LOAD_ERROR =
  'Could not load the publish context. Please close and retry.';
