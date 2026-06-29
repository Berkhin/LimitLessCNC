# Tech Stack & Architecture

## Backend (Python / FastAPI)
- Framework: FastAPI (Uvicorn for server).
- State: In-memory dictionary (no database).
- Real-time: native FastAPI WebSockets.
- Guidelines: Strictly follow official FastAPI documentation for routing, dependency injection, and WebSockets. Do not use outdated internet solutions.

## Frontend (React / TypeScript / Vite)
- UI: React, functional components, hooks. Minimal styling (clean and legible, no polished CSS needed).
- API Client: native fetch API.
- Switchable Implementations: Use an environment variable (e.g., VITE_STATE_MODE = 'query' or 'saga') to dynamically render the chosen state management tree.
- **Implementation 1 (Modern):** TanStack Query (React Query) for server state orchestration and caching + Zustand for local UI/modal state.
- **Implementation 2 (Redux):** Redux Toolkit + Redux Saga for orchestrating async flows, cancellation, and re-entrancy.
- Guidelines: Strictly use official documentation for TanStack Query v5, Zustand, RTK, and Redux Saga.