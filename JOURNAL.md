# Design & Architecture Journal

This journal documents my thought process and architectural decisions while building the document approval application for LimitlessCNC. 

As requested, I am writing this incrementally as I build out both implementations. My goal here is to honestly evaluate the trade-offs between my preferred modern stack (TanStack Query + Zustand) and the classic Redux + Redux Saga approach. 

I'll be focusing specifically on how each architecture handles the four core orchestration challenges, noting where the framework helped, where it fought me, and where the idiomatic answers surprised me.

---

## Implementation 1 — TanStack Query + Zustand

### 1. Sequential async with user-input gates
* **The Approach:** Used useQuery for fetching the approval/publish context and a lightweight Zustand store to manage the synchronous "is modal open" state.
* **Where it shined:** React Query elegantly handles the background loading states out of the box. There is no boilerplate for isLoading or isError.
* **Where it fought me:** Nothing significant. This is where this stack feels incredibly native and fast to develop with.
* **The Surprises:** The absolute separation of concerns. Server state stays in the Query cache; UI state (modals) stays in Zustand. They rarely bleed into each other.

### 2. Mid-flight state invalidation via WebSocket
* **The Approach:** Created a useSyncWebSocket hook that listens for STATE_UPDATED. If only context changes, it silently calls queryClient.invalidateQueries(). If the document version bumps mid-flight, it calls Zustand to abort the flow, close the modal, and show an alert.
* **Where it shined:** React Query's invalidateQueries is a fire-and-forget superpower. The UI effortlessly repaints with fresh data while the modal remains open.
* **Where it fought me:** Orchestration. Because Query and Zustand are separate, the WebSocket hook had to act as the "glue" orchestrator. It had to manually inspect the payload to decide whether to just invalidate queries or aggressively tell Zustand to close the UI.
* **The Surprises:** The UX asymmetry. I realized that a user-initiated 409 error should gracefully refetch and keep the modal open, but a background WebSocket version-bump feels safer as a hard abort to prevent the user from confirming a stale state.

### 3. Re-entrancy protection
* **The Approach:** Utilized the isPending flag from the useMutation hook at the effect layer. If isPending is true, the submit handler simply returns early, dropping duplicate clicks.
* **Where it shined:** The state is completely local to the hook utilizing the mutation. No complex saga cancellation logic was needed.
* **Where it fought me:** Unlike automated debounce or saga's takeLatest, you have to explicitly write the early-return guard in the event handler. It requires developer discipline to remember to check isPendin before triggering the mutation again.
* **The Surprises:** How simple and effective this is compared to heavier generic debounce utility functions.

### 4. Version-conflict handling
* **The Approach:** Caught the 409 Conflict within the mutation's onError callback. Narrowed the error type, triggered a queryClient.invalidateQueries() to fetch the fresh context, and deliberately kept the modal open.
* **Where it shined:** The recovery is completely transparent to the user. The submit fails, the data refreshes instantly, and they can review the new context without losing their place.
* **Where it fought me:** Standardizing the error boundary. Fetch API errors need to be carefully parsed and thrown as custom error instances (ConflictError) so that onError can reliably distinguish a 409 from a generic 500 or network failure.
* **The Surprises:** React Query makes conditional retries and custom error-driven refetching surprisingly ergonomic once the error shapes are strictly typed.

---

## Implementation 2 — Redux Toolkit + Redux Saga

### 1. Sequential async with user-input gates
* **The Approach:** _TBD_
* **Where it shined:** _TBD_
* **Where it fought me:** _TBD_
* **The Surprises:** _TBD_

### 2. Mid-flight state invalidation via WebSocket
* **The Approach:** _TBD_
* **Where it shined:** _TBD_
* **Where it fought me:** _TBD_
* **The Surprises:** _TBD_

### 3. Re-entrancy protection
* **The Approach:** _TBD_
* **Where it shined:** _TBD_
* **Where it fought me:** _TBD_
* **The Surprises:** _TBD_

### 4. Version-conflict handling
* **The Approach:** _TBD_
* **Where it shined:** _TBD_
* **Where it fought me:** _TBD_
* **The Surprises:** _TBD_

---

## Overall Recommendation

_TBD_
