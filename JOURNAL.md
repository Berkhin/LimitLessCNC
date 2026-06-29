# Design & Architecture Journal

Notes from building the document approval app for LimitlessCNC, comparing TanStack Query + Zustand against Redux + Redux Saga across the four orchestration challenges.

---

## Implementation 1 - TanStack Query + Zustand

### 1. Sequential async with user-input gates
useQuery fetches the context, Zustand tracks the modal, and the sequence lives in two hooks (useApproveFlow / usePublishFlow). Loading/error states come free, but the flow isn't written down anywhere until you pull it into a hook by hand - that's the cost Saga makes explicit.

### 2. Mid-flight state invalidation via WebSocket
A useSyncWebSocket hook handles STATE_UPDATED: invalidateQueries on a context change, abort if the version bumped. The WS hook becomes glue between Query and Zustand. I first inferred the version bump from the context flags (brittle), then moved it to a shared isVersionChanged comparison.

### 3. Re-entrancy protection
A synchronous useRef latch, not isPending - isPending is render state and updates a tick late, so two same-frame clicks slip through. Query dedupes queries, not mutations, so the guard is hand-written.

### 4. Version-conflict handling
Catch the 409 in onError, refetch, keep the modal open. The hook blocks re-confirmation while refetching so the user can't resubmit stale. Most of the work is ordering ("fresh before confirm"), not error handling.

---

## Implementation 2 - Redux Toolkit + Redux Saga

### 1. Sequential async with user-input gates
Each flow is one saga: fetch, open the modal, pause at take(confirmRequested). Reads top-to-bottom like sync code - the human gate is Saga's home turf. The price is upfront ceremony and manually-typed yields.

### 2. Mid-flight state invalidation via WebSocket
eventChannel bridges the WS into a stateUpdated action; the flow's race branches to abort, refetch, or ignore. All mid-flight logic sits in one place. Gotcha: an unbuffered channel drops bursts, so it uses an expanding buffer.

### 3. Re-entrancy protection
One takeLeading over a single flowRequested trigger. My first version used two watchers, but takeLeading only dedupes the same pattern - so Approve + Publish could double-submit on one Confirm. The fix is the invariant "one flow in flight," now covered by a regression test.

### 4. Version-conflict handling
try/catch around submit; on ConflictError set a notice and continue the loop to refetch. Hard to reach live because the WS abort wins first, so it's pinned by a generator unit test instead.

---

## Overall Recommendation

For most codebases, **Query + Zustand first** - least boilerplate, caching and dedup for free, server and UI state cleanly apart. Its weakness shows in multi-step flows, where orchestration smears across hooks.

**Redux Saga** shines when the flow is the product - sequential async, human gates, cancellation, re-entrancy - as one readable script. The price is ceremony and re-implementing the caching Query gives away.

Rule of thumb: Query + Zustand for typical CRUD; Saga when the core complexity is orchestrating long, interruptible flows. This task is flow-orchestration, so Saga modeled it most faithfully, but Query reached a shippable answer with less code.

---

## Testing

cd frontend && npm test (Vitest). Focused on orchestration, not UI:

* **Saga generators** (approveSaga.test.ts, publishSaga.test.ts) - drive each flow with .next()/.throw() and assert effects; pin all four behaviors.
* **Re-entrancy invariant** (rootSaga.test.ts) - dispatches Approve→Publish→Confirm and asserts exactly one submit (the cross-flow regression).
* **Protocol boundary** (stateUpdate.test.ts) - proves isVersionChanged keys off the version, not the context flags.

## Addendum - hardening pass

After an adversarial review I made a correctness pass - find the invariant, make it structural, test it:

1. **Cross-flow re-entrancy.** One flowRequested trigger under one takeLeading + regression test.
2. **Protocol semantics.** Replaced the flag-inference in three places with one shared isVersionChanged.
3. **Impl 1 re-entrancy & ordering.** Ref latch instead of isPending, blocked re-confirm during refetch, clear cache on open.
4. **Impl 1 orchestration.** Moved the choreography into the flow hooks.
5. **Hygiene.** Saga failures log, WS channel buffers bursts, dead code removed, test runner added.

The honest takeaway: I reasoned about re-entrancy as an operator (takeLeading) instead of an invariant (one flow in flight), and verified by hand on one flow. The fix wasn't more code - it was naming the invariant and writing the cross-flow test.
