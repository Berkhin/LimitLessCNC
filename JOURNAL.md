# Design Journal

This journal documents my thought process and architectural decisions while building the document approval application. 

As requested, I am writing this incrementally as I build out both implementations. My goal here is to honestly evaluate the trade-offs between my preferred modern stack (TanStack Query + Zustand) and the classic Redux + Redux Saga approach. 

I'll be focusing specifically on how each architecture handles the four core orchestration challenges:
1. Sequential async flows with human-in-the-loop gates.
2. Mid-flight state invalidation via WebSockets.
3. Re-entrancy protection at the effect layer.
4. Graceful recovery from version conflicts.

---

## Implementation 1 — TanStack Query + Zustand

### Sequential async with user-input gates

_TBD_

### Mid-flight state invalidation via WebSocket

_TBD_

### Re-entrancy protection

_TBD_

### Version-conflict handling

_TBD_

---

## Implementation 2 — Redux Toolkit + Redux Saga

### Sequential async with user-input gates

_TBD_

### Mid-flight state invalidation via WebSocket

_TBD_

### Re-entrancy protection

_TBD_

### Version-conflict handling

_TBD_

---

## Overall Recommendation

_TBD_
