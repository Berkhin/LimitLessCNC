/**
 * API contract types.
 *
 * These mirror the backend Pydantic models (backend/models.py) and the contract
 * in docs/3_API_CONTRACTS.md. Field names are camelCase because the backend
 * serializes them that way on the wire.
 */

export type DocStatus = 'draft' | 'approved' | 'published';

/** GET responses embed this; the wire shape of the document itself. */
export interface DocumentState {
  id: string;
  title: string;
  body: string;
  version: number;
  status: DocStatus;
}

/** GET /api/approval-context */
export interface ApprovalContext {
  documentVersion: number;
  requiredApprovers: string[];
  currentUserRole: string;
}

/** GET /api/publish-context */
export interface PublishContext {
  dependentDocuments: string[];
  subscribers: string[];
  documentState: DocumentState;
}

/** POST /api/approve -> 200 */
export interface ApproveResult {
  status: Extract<DocStatus, 'approved'>;
  version: number;
}

/** POST /api/publish -> 200 */
export interface PublishResult {
  status: Extract<DocStatus, 'published'>;
  version: number;
}

/** Accepted actions for POST /api/dev/mutate. */
export type MutateAction =
  | 'increment_version'
  | 'change_approvers'
  | 'change_dependents';

/** POST /api/dev/mutate -> 200 */
export interface MutateResult {
  applied: MutateAction;
  document: DocumentState;
}

/** Body of a STATE_UPDATED WebSocket event (the meaningful content). */
export interface StateUpdatedPayload {
  document: DocumentState;
  approvalContextChanged: boolean;
  publishContextChanged: boolean;
}

/** The only message the server pushes over the WebSocket (see ws://.../ws). */
export interface StateUpdatedEvent {
  type: 'STATE_UPDATED';
  payload: StateUpdatedPayload;
}
