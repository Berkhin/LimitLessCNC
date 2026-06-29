"""WebSocket endpoint: pushes STATE_UPDATED events to connected clients."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from state import build_state_update
from ws_manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
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
