# Document Approval — Backend

A small in-memory [FastAPI](https://fastapi.tiangolo.com/) service backing the
document-approval app. It exposes REST endpoints for the **Approve** and
**Publish** flows, broadcasts state changes over a WebSocket, and provides a
dev-only endpoint to simulate mid-flight state changes.

State is held in a single in-memory dict — no database. Restarting the server
resets everything to the initial document.

## Requirements

- Python 3.10+ (developed on 3.14)

## Run

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The server listens on `http://localhost:8000`. Confirm it is up:

```bash
curl http://localhost:8000/api/health      # -> {"status":"ok"}
```

Interactive API docs are available at `http://localhost:8000/docs`.

> `requirements.txt` pins `uvicorn[standard]` (not plain `uvicorn`) because the
> `[standard]` extra bundles the `websockets` library the `/ws` endpoint needs.

## Project layout

The code is decomposed by concern (official FastAPI "Bigger Applications"
layout); every module stays small and single-purpose.

```
backend/
  main.py            # app creation, CORS, router wiring, /api/health
  models.py          # Pydantic request/response schemas
  state.py           # in-memory STATE, state_lock, STATE_UPDATED builder
  ws_manager.py      # WebSocket ConnectionManager (+ send_lock)
  routers/
    approval.py      # GET /api/approval-context, POST /api/approve
    publish.py       # GET /api/publish-context, POST /api/publish
    dev.py           # POST /api/dev/mutate
    websocket.py     # WS /ws
```

## Document state shape

```jsonc
{
  "id": "doc-1",
  "title": "Engineering Proposal",
  "body": "This document outlines the architecture...",
  "version": 1,
  "status": "draft"            // "draft" | "approved" | "published"
}
```

## HTTP endpoints

| Method | Path                    | Body                | Success         | Notes |
|--------|-------------------------|---------------------|-----------------|-------|
| GET    | `/api/health`           | —                   | `200`           | Liveness probe. |
| GET    | `/api/approval-context` | —                   | `200`           | Context for the Approve modal. |
| POST   | `/api/approve`          | `{ "version": n }`  | `200` / **`409`** | `409` if `version` ≠ current. |
| GET    | `/api/publish-context`  | —                   | `200`           | Context for the Publish modal. |
| POST   | `/api/publish`          | `{ "version": n }`  | `200` / **`409`** | `409` if `version` ≠ current. |
| POST   | `/api/dev/mutate`       | `{ "action": ... }` | `200` / `422`   | Dev-only; see below. |

**`GET /api/approval-context`** →

```json
{ "documentVersion": 1, "requiredApprovers": ["Alice (Engineering Lead)", "Bob (Compliance)"], "currentUserRole": "Editor" }
```

**`GET /api/publish-context`** →

```json
{
  "dependentDocuments": ["doc-2: API Spec", "doc-3: Deployment Runbook"],
  "subscribers": ["frontend-team@limitlesscnc.dev", "backend-team@limitlesscnc.dev"],
  "documentState": { "id": "doc-1", "title": "...", "body": "...", "version": 1, "status": "draft" }
}
```

### Version-conflict (409) handling

`POST /api/approve` and `POST /api/publish` carry the `version` the client was
shown. If it no longer matches the server's current version (e.g. someone
incremented it in between), the server responds `409 Conflict` with the current
version so the client can refetch the context and retry:

```json
{ "detail": { "message": "Version conflict: the document changed since the approval context was fetched.", "currentVersion": 2 } }
```

## WebSocket protocol

Connect to `ws://localhost:8000/ws`. On connect the server sends one snapshot of
the current state; thereafter it pushes a message on **every** state change.

Message shape:

```json
{
  "type": "STATE_UPDATED",
  "payload": {
    "document": { "id": "doc-1", "title": "...", "body": "...", "version": 2, "status": "draft" },
    "approvalContextChanged": true,
    "publishContextChanged": true
  }
}
```

`approvalContextChanged` / `publishContextChanged` tell the client whether the
data behind an *open* Approve / Publish modal is now stale and should be
refetched (or the flow aborted). Every message carries a full versioned document
snapshot, so a client can reconcile by `version` regardless of delivery timing.

## Triggering mid-flight state changes (for testing)

`POST /api/dev/mutate` forces a server-side state change and broadcasts the
resulting `STATE_UPDATED` event. Use it to exercise the modals' mid-flight
behavior. `action` must be one of:

| `action`            | Effect                                        | Change flags |
|---------------------|-----------------------------------------------|--------------|
| `increment_version` | bumps `document.version` (drives the **409** path) | both `true`  |
| `change_approvers`  | toggles "Carol (Security)" in `requiredApprovers`  | approval only |
| `change_dependents` | toggles "doc-4: Security Review" in `dependentDocuments` | publish only |

The list-toggling actions are repeatable: fire the same action twice to add then
remove the entry, so you can watch an open modal update live.

```bash
# Bump the version — an open Approve/Publish modal should detect the conflict.
curl -X POST http://localhost:8000/api/dev/mutate \
  -H "Content-Type: application/json" -d '{"action":"increment_version"}'

# Change the approver list — an open Approve modal should refresh.
curl -X POST http://localhost:8000/api/dev/mutate \
  -H "Content-Type: application/json" -d '{"action":"change_approvers"}'

# Change dependents — an open Publish modal should refresh.
curl -X POST http://localhost:8000/api/dev/mutate \
  -H "Content-Type: application/json" -d '{"action":"change_dependents"}'
```

## Design notes & assumptions

- **Concurrency.** Uvicorn runs one asyncio event loop, so the only hazard is
  interleaving at `await` points. All read-modify-writes run under `state_lock`,
  making the version check + mutation atomic. Socket I/O is kept *outside*
  `state_lock` and serialized by a separate `send_lock` in the connection
  manager, so a slow WebSocket client can never stall state mutations and a
  single socket is never written by two coroutines at once.
- **Version semantics.** `version` is the document's *content* version. It is
  bumped only by edits (here simulated via `increment_version`). Approving or
  publishing changes `status` but does **not** bump `version`, so a context
  fetched before a status change still submits cleanly.
- **CORS** is open to the Vite dev server origins (`localhost:5173`,
  `127.0.0.1:5173`).
