"""In-memory document state and its concurrency primitive.

Because Uvicorn drives one asyncio event loop, the only concurrency hazard is
interleaving at `await` points. Every read-modify-write runs inside `state_lock`
so the version check and the mutation are atomic. Socket I/O is deliberately
kept OUT of that critical section (see ws_manager) so a slow WebSocket client
can never stall state mutations.

Modules import these objects by reference; `STATE` is mutated in place and never
rebound, so all importers share the same state.
"""

import asyncio

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


def build_state_update(approval_changed: bool, publish_changed: bool) -> dict:
    """Build a STATE_UPDATED event carrying a snapshot of the current document.

    Every event ships a full versioned snapshot, so a client can reconcile by
    version regardless of delivery timing.
    """
    return {
        "type": "STATE_UPDATED",
        "payload": {
            "document": dict(STATE["document"]),
            "approvalContextChanged": approval_changed,
            "publishContextChanged": publish_changed,
        },
    }
