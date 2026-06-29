# Document Approval — Full Stack

A small document-approval app built **twice** over the same shared UI and API, to
compare two state-management approaches for orchestrating asynchronous flows with
user-input gates, mid-flight WebSocket changes, re-entrancy, and version conflicts.

- **Implementation 1 — TanStack Query (server state) + Zustand (UI state)**
- **Implementation 2 — Redux Toolkit + Redux Saga**

Both implementations share the same backend, API client, WebSocket client, and
presentational components — only the **state + side-effects layer** differs. Each
is lazy-loaded, so only the selected one (and its store/WebSocket) is ever
evaluated. See [JOURNAL.md](JOURNAL.md) for the design comparison and recommendation.

## Stack

- **Backend:** Python / FastAPI, in-memory state, native WebSockets — see [backend/README.md](backend/README.md)
- **Frontend:** React + TypeScript + Vite

## Prerequisites

- Python 3.10+
- Node.js 20+ (npm)

## Run

The stack is two processes — the backend (port `8000`) and the Vite dev server
(port `5173`). Use two terminals.

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows:       .venv\Scripts\activate
# macOS/Linux:   source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app
```

Verify: `curl http://localhost:8000/api/health` → `{"status":"ok"}`

On Windows there are helper scripts (no need to hunt for the PID):

```powershell
.\backend\start.ps1     # start
.\backend\stop.ps1      # stop (frees port 8000)
.\backend\restart.ps1   # stop + start
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Switching between the two implementations

Controlled by `VITE_STATE_MODE` in [frontend/.env](frontend/.env):

```dotenv
VITE_STATE_MODE='query'    # Implementation 1 (TanStack Query + Zustand)
# VITE_STATE_MODE='saga'   # Implementation 2 (Redux Toolkit + Redux Saga)
```

Comment/uncomment to choose the implementation, then **restart the Vite dev
server** — Vite reads environment variables only at startup.

## Triggering mid-flight state changes (for testing)

A dev-only endpoint forces a server-side change and broadcasts it over the
WebSocket, so you can watch an open modal react (refresh, or abort on a version
bump):

```bash
# Bump the document version (drives the abort / 409 path)
curl -X POST http://localhost:8000/api/dev/mutate \
  -H "Content-Type: application/json" -d '{"action":"increment_version"}'
```

Actions: `increment_version`, `change_approvers`, `change_dependents`. Full
details — including the HTTP endpoints, the `409` conflict shape, and the
`STATE_UPDATED` WebSocket event — are in [backend/README.md](backend/README.md).

## Tests

The orchestration logic is covered by a focused [Vitest](https://vitest.dev) suite:

```bash
cd frontend
npm test          # run once
npm run test:watch
```

It exercises the saga flows as pure generators (the confirm gate, mid-flight
refetch/abort, 409 recovery), a single-flight integration test that asserts an
Approve→Publish→Confirm sequence fires exactly one submit, and the shared
version-detection helper. See the *Testing* section of [JOURNAL.md](JOURNAL.md).

## Design journal

[JOURNAL.md](JOURNAL.md) covers how each implementation handled the four
orchestration behaviors (sequential async with gates, mid-flight WebSocket
invalidation, re-entrancy, version-conflict recovery) and the overall
recommendation.
