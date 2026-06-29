"""Publish flow: fetch publish context and submit a publish."""

from fastapi import APIRouter, HTTPException, status

from models import DocumentState, PublishContext, VersionedPayload
from state import STATE, build_state_update, state_lock
from ws_manager import manager

router = APIRouter(prefix="/api", tags=["publish"])


@router.get("/publish-context", response_model=PublishContext)
async def get_publish_context() -> PublishContext:
    return PublishContext(
        dependentDocuments=list(STATE["dependentDocuments"]),
        subscribers=list(STATE["subscribers"]),
        documentState=DocumentState(**STATE["document"]),
    )


@router.post("/publish")
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
