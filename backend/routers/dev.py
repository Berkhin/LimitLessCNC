"""Dev-only mutation endpoint: drives mid-flight state changes for testing."""

from fastapi import APIRouter

from models import MutatePayload
from state import STATE, build_state_update, state_lock
from ws_manager import manager

router = APIRouter(prefix="/api/dev", tags=["dev"])


def _toggle(items: list[str], candidate: str) -> list[str]:
    """Add `candidate` if absent, remove it if present.

    Produces a visible, repeatable change so reviewers can watch an open modal
    react to the same trigger fired multiple times.
    """
    if candidate in items:
        return [item for item in items if item != candidate]
    return [*items, candidate]


@router.post("/mutate")
async def mutate(payload: MutatePayload) -> dict:
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
