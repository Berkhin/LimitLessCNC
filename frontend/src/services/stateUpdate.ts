/**
 * The single boundary where the WebSocket wire protocol is translated into
 * domain meaning. Both implementations import from here, so neither re-derives
 * protocol semantics inline.
 *
 * "Did the document version change?" is answered by comparing the version a flow
 * is operating on against the version carried in the pushed snapshot — NOT by
 * inferring it from the `approvalContextChanged` / `publishContextChanged` flags.
 * Those flags only say *which context to refetch*; they are not a version signal.
 * Coupling "version bumped" to "both flags set" would break silently the moment
 * the server set both flags for any non-version reason. The snapshot already
 * carries `document.version`, so we compare it directly.
 */

import type { StateUpdatedPayload } from './types';

/**
 * True when the server's document version differs from the version the active
 * flow was shown — i.e. what the user is about to confirm no longer exists in
 * the form they reviewed, so the flow is stale.
 */
export function isVersionChanged(
  payload: StateUpdatedPayload,
  knownVersion: number,
): boolean {
  return payload.document.version !== knownVersion;
}
