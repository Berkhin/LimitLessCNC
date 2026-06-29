# Design & Architecture Journal

This journal documents my thought process and architectural decisions while building the document approval application for LimitlessCNC. 

As requested, I am writing this incrementally as I build out both implementations. My goal here is to honestly evaluate the trade-offs between my preferred modern stack (TanStack Query + Zustand) and the classic Redux + Redux Saga approach. 

I'll be focusing specifically on how each architecture handles the four core orchestration challenges, noting where the framework helped, where it fought me, and where the idiomatic answers surprised me.

---

## Implementation 1 — TanStack Query + Zustand

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
* **The Surprises:** refetchOnReconnect kept healing the conflict out from under me during manual testing. To force the 409 UI path, the plan was to toggle DevTools to "Offline", bump the document version server-side, then come back online and submit the now-stale version. But React Query's default refetchOnReconnect refetched the active approval-context query the instant the browser reconnected, so the modal silently corrected itself to the new version before I could click "Confirm" - the conflict healed faster than I could trigger it. I only reproduced a genuine 409 by explicitly blocking the WebSocket URL in DevTools so the context query couldn't auto-refetch. It's a great reminder that the 409 handler is a true safety net: React Query's defaults (refetchOnReconnect, on top of our WebSocket-driven invalidation/abort) already dissolve most conflicts before submit, so the server's 409 only surfaces in the narrow window where the client genuinely missed the update. An excellent out-of-the-box resilience win - and a hilarious hurdle for manual testing.

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
