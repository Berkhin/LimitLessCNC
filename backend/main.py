"""Document-approval backend (application entry point).

A small in-memory FastAPI service backing the document-approval assignment.
Concerns are split across modules (official FastAPI "Bigger Applications" layout):

  * models.py             - Pydantic request/response schemas
  * state.py              - in-memory state, state_lock, STATE_UPDATED builder
  * ws_manager.py         - WebSocket ConnectionManager (+ send_lock)
  * routers/approval.py   - GET /api/approval-context, POST /api/approve
  * routers/publish.py    - GET /api/publish-context, POST /api/publish
  * routers/dev.py        - POST /api/dev/mutate (drives mid-flight changes)
  * routers/websocket.py  - WS /ws

See README.md for the full HTTP/WebSocket contract and run instructions.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import approval, dev, publish, websocket

app = FastAPI(title="Document Approval API")

# Allow the local Vite dev server to call the API and open the WebSocket.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(approval.router)
app.include_router(publish.router)
app.include_router(dev.router)
app.include_router(websocket.router)


@app.get("/api/health")
async def health() -> dict:
    """Liveness probe used to confirm the server is up."""
    return {"status": "ok"}


if __name__ == "__main__":
    # Local convenience: `python main.py`. Production/dev usually uses the
    # Uvicorn CLI (`uvicorn main:app --reload`), so the import stays scoped here
    # to avoid an unused top-level dependency.
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
