"""Document-approval backend.

A small in-memory FastAPI service backing the document-approval assignment.
It exposes the REST + WebSocket contract described in docs/3_API_CONTRACTS.md:

  * GET  /api/approval-context  - context for the Approve flow
  * POST /api/approve           - submit an approval (409 on version conflict)
  * GET  /api/publish-context   - context for the Publish flow
  * POST /api/publish           - submit a publish (409 on version conflict)
  * POST /api/dev/mutate        - dev-only trigger for mid-flight state changes
  * WS   /ws                    - pushes STATE_UPDATED events on every change

State lives in a single in-memory dict. Because Uvicorn drives one asyncio
event loop, the only concurrency hazard is interleaving at `await` points:
every read-modify-write runs inside `state_lock` so the version check and the
mutation are atomic. Socket I/O is deliberately kept OUT of that critical
section -- broadcasts happen after `state_lock` is released and are serialized
by the ConnectionManager's own `send_lock`, so a slow WebSocket client can
never stall state mutations (and a connection is only ever written to by one
coroutine at a time). Every event carries a full versioned document snapshot,
so a client can reconcile by version regardless of delivery timing.

Patterns follow the official FastAPI documentation (CORS middleware, Pydantic
request/response models, and the ConnectionManager WebSocket recipe).
"""

import asyncio
from typing import Literal

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DocStatus = Literal["draft", "approved", "published"]


# --------------------------------------------------------------------------- #
# Schemas (response/request models matching docs/3_API_CONTRACTS.md verbatim). #
# camelCase field names are intentional: they must serialize exactly as the    #
# frontend contract expects.                                                   #
# --------------------------------------------------------------------------- #
class DocumentState(BaseModel):
    id: str
    title: str
    body: str
    version: int
    status: DocStatus


class ApprovalContext(BaseModel):
    documentVersion: int
    requiredApprovers: list[str]
    currentUserRole: str


class PublishContext(BaseModel):
    dependentDocuments: list[str]
    subscribers: list[str]
    documentState: DocumentState


class VersionedPayload(BaseModel):
    """Body for /api/approve and /api/publish: the version the client was shown."""

    version: int


class MutatePayload(BaseModel):
    """Body for the dev-only mutation endpoint.

    `Literal` makes Pydantic reject unknown actions with a 422 automatically,
    so there is no manual validation branch to maintain.
    """

    action: Literal["increment_version", "change_approvers", "change_dependents"]


# --------------------------------------------------------------------------- #
# In-memory state.                                                             #
# --------------------------------------------------------------------------- #
STATE: dict = {
    "document": {
        "id": "doc-1",
        "title": "Engineering Proposal",
        "body": "This document outlines the architecture for the LimitlessCNC platform.",
        "version": 1,
        "status": "draft",
    },
    "requiredApprovers": ["Alice (Engineering Lead)", "Bob (Compliance)"],
    "currentUserRole": "Editor",
    "dependentDocuments": ["doc-2: API Spec", "doc-3: Deployment Runbook"],
    "subscribers": ["frontend-team@limitlesscnc.dev", "backend-team@limitlesscnc.dev"],
}

# Serializes every state read-modify-write (not socket I/O). See module docstring.
state_lock = asyncio.Lock()


# --------------------------------------------------------------------------- #
# WebSocket connection manager (official FastAPI recipe, hardened for          #
# dead-connection pruning so one disconnected client never breaks the          #
# fan-out to the rest).                                                        #
# --------------------------------------------------------------------------- #
class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        # Guards every socket write. This is intentionally NOT `state_lock`:
        # holding the state lock across network I/O would let one slow client
        # stall all state mutations. Serializing here instead means (a) only one
        # coroutine writes to a given connection at a time -- avoiding interleaved
        # sends on a single socket -- and (b) broadcasts are delivered in order.
        self.send_lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal(self, websocket: WebSocket, message: dict) -> None:
        """Send to a single connection (e.g. the initial snapshot on connect),
        serialized against broadcasts so the same socket is never written
        concurrently."""
        async with self.send_lock:
            try:
                await websocket.send_json(message)
            except (WebSocketDisconnect, RuntimeError):
                self.disconnect(websocket)

    async def broadcast(self, message: dict) -> None:
        async with self.send_lock:
            dead: list[WebSocket] = []
            for connection in list(self.active_connections):
                try:
                    await connection.send_json(message)
                except (WebSocketDisconnect, RuntimeError):
                    # Client vanished mid-send; collect and prune after the loop
                    # so we don't mutate the list we're iterating.
                    dead.append(connection)
            for connection in dead:
                self.disconnect(connection)


manager = ConnectionManager()


def build_state_update(approval_changed: bool, publish_changed: bool) -> dict:
    """Build a STATE_UPDATED event carrying a snapshot of the current document."""
    return {
        "type": "STATE_UPDATED",
        "payload": {
            "document": dict(STATE["document"]),
            "approvalContextChanged": approval_changed,
            "publishContextChanged": publish_changed,
        },
    }


# --------------------------------------------------------------------------- #
# App + CORS (allow the local Vite dev server).                               #
# --------------------------------------------------------------------------- #
app = FastAPI(title="Document Approval API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    """Liveness probe used to confirm the server is up."""
    return {"status": "ok"}


# --------------------------------------------------------------------------- #
# Approve flow.                                                                #
# --------------------------------------------------------------------------- #
@app.get("/api/approval-context", response_model=ApprovalContext)
async def get_approval_context() -> ApprovalContext:
    # Lock-free read: no `await` between field reads, so the single-threaded
    # event loop guarantees a consistent snapshot of an applied mutation.
    return ApprovalContext(
        documentVersion=STATE["document"]["version"],
        requiredApprovers=list(STATE["requiredApprovers"]),
        currentUserRole=STATE["currentUserRole"],
    )


@app.post("/api/approve")
async def approve(payload: VersionedPayload) -> dict:
    async with state_lock:
        current_version = STATE["document"]["version"]
        if payload.version != current_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Version conflict: the document changed since the approval context was fetched.",
                    "currentVersion": current_version,
                },
            )
        STATE["document"]["status"] = "approved"
        # Status changed -> the publish context (which embeds documentState) is
        # now stale for any open Publish modal; approval context is unaffected.
        message = build_state_update(approval_changed=False, publish_changed=True)
        result = {"status": "approved", "version": current_version}
    # Broadcast outside state_lock so socket I/O never stalls state mutations.
    await manager.broadcast(message)
    return result


# --------------------------------------------------------------------------- #
# Publish flow.                                                               #
# --------------------------------------------------------------------------- #
@app.get("/api/publish-context", response_model=PublishContext)
async def get_publish_context() -> PublishContext:
    return PublishContext(
        dependentDocuments=list(STATE["dependentDocuments"]),
        subscribers=list(STATE["subscribers"]),
        documentState=DocumentState(**STATE["document"]),
    )


@app.post("/api/publish")
async def publish(payload: VersionedPayload) -> dict:
    async with state_lock:
        current_version = STATE["document"]["version"]
        if payload.version != current_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Version conflict: the document changed since the publish context was fetched.",
                    "currentVersion": current_version,
                },
            )
        STATE["document"]["status"] = "published"
        message = build_state_update(approval_changed=False, publish_changed=True)
        result = {"status": "published", "version": current_version}
    await manager.broadcast(message)
    return result


# --------------------------------------------------------------------------- #
# Dev-only mutation endpoint: drives mid-flight state changes for testing.     #
# --------------------------------------------------------------------------- #
def _toggle(items: list[str], candidate: str) -> list[str]:
    """Add `candidate` if absent, remove it if present.

    Produces a visible, repeatable change so reviewers can watch an open modal
    react to the same trigger fired multiple times.
    """
    if candidate in items:
        return [item for item in items if item != candidate]
    return [*items, candidate]


@app.post("/api/dev/mutate")
async def dev_mutate(payload: MutatePayload) -> dict:
    async with state_lock:
        if payload.action == "increment_version":
            STATE["document"]["version"] += 1
            approval_changed, publish_changed = True, True
        elif payload.action == "change_approvers":
            STATE["requiredApprovers"] = _toggle(
                STATE["requiredApprovers"], "Carol (Security)"
            )
            approval_changed, publish_changed = True, False
        else:  # "change_dependents" (the only remaining Literal member)
            STATE["dependentDocuments"] = _toggle(
                STATE["dependentDocuments"], "doc-4: Security Review"
            )
            approval_changed, publish_changed = False, True

        message = build_state_update(approval_changed, publish_changed)
        result = {"applied": payload.action, "document": dict(STATE["document"])}
    await manager.broadcast(message)
    return result


# --------------------------------------------------------------------------- #
# WebSocket endpoint (official FastAPI pattern).                               #
# --------------------------------------------------------------------------- #
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        # Send the current snapshot so a freshly-connected client starts in sync.
        # Routed through the manager's send_lock so it never races a broadcast
        # writing to this same socket.
        await manager.send_personal(
            websocket, build_state_update(approval_changed=False, publish_changed=False)
        )
        # We expect no inbound messages; receive_text() blocks until the client
        # disconnects, which raises WebSocketDisconnect and ends the handler.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


if __name__ == "__main__":
    # Local convenience: `python main.py`. Production/dev usually uses the
    # Uvicorn CLI (`uvicorn main:app --reload`), so the import stays scoped here
    # to avoid an unused top-level dependency.
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
