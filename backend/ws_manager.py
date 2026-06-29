"""WebSocket connection manager.

Follows the official FastAPI ConnectionManager recipe, hardened so a single
disconnected client never breaks the fan-out to the rest. `send_lock` owns every
socket write: it is intentionally NOT the state lock, so holding it across
network I/O cannot stall state mutations. It also guarantees only one coroutine
writes to a given connection at a time (no interleaved sends on one socket) and
that broadcasts are delivered in order.
"""

import asyncio

from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
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


# Shared singleton imported by the routers.
manager = ConnectionManager()
