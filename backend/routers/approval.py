"""Approve flow: fetch approval context and submit an approval."""

from fastapi import APIRouter, HTTPException, status

from models import ApprovalContext, VersionedPayload
from state import STATE, build_state_update, state_lock
from ws_manager import manager

router = APIRouter(prefix="/api", tags=["approval"])


@router.get("/approval-context", response_model=ApprovalContext)
async def get_approval_context() -> ApprovalContext:
    # Lock-free read: no `await` between field reads, so the single-threaded
    # event loop guarantees a consistent snapshot of an applied mutation.
    return ApprovalContext(
        documentVersion=STATE["document"]["version"],
        requiredApprovers=list(STATE["requiredApprovers"]),
        currentUserRole=STATE["currentUserRole"],
    )


@router.post("/approve")
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
