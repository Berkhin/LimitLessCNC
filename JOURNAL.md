# Design & Architecture Journal

This journal documents my thought process and architectural decisions while building the document approval application for LimitlessCNC. 

As requested, I am writing this incrementally as I build out both implementations. My goal here is to honestly evaluate the trade-offs between my preferred modern stack (TanStack Query + Zustand) and the classic Redux + Redux Saga approach. 

I'll be focusing specifically on how each architecture handles the four core orchestration challenges, noting where the framework helped, where it fought me, and where the idiomatic answers surprised me.

---

## Implementation 1 - TanStack Query + Zustand

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

## Implementation 2 - Redux Toolkit + Redux Saga

### 1. Sequential async with user-input gates
* **The Approach:** Modeled each flow as a single imperative saga (runApproveFlow / runPublishFlow): call the context fetch, dispatch flowStarted to open the modal, then pause at a take(confirmRequested) gate. The whole sequence reads top-to-bottom like synchronous code.
* **Where it shined:** The human-in-the-loop gate is Saga's home turf. yield take(confirmRequested) literally suspends the flow until the user acts - the async steps and the synchronous gate live in one readable function, with no scattered callbacks or "what step am I on" flags.
* **Where it fought me:** Far more upfront ceremony than the Query stack. Before anything runs you wire intent actions, a slice, the middleware and a root saga. And because redux-saga's yield is typed any, every result (const ctx: ApprovalContext = yield call(...)) needs a manual annotation to stay strict.
* **The Surprises:** How *linear* the flow reads compared to Impl 1. In Query the sequence was implicit (enabled query → modal → mutate, spread across hooks); in Saga it is an explicit recipe you can follow with your finger.

### 2. Mid-flight state invalidation via WebSocket
* **The Approach:** Bridged the framework-agnostic WS singleton into saga-land with eventChannel, pumping each payload as a stateUpdated action. The flow's race includes take(stateUpdated), so a server push while the modal is open resolves the race; the saga then branches on the payload flags - refetch (relevant flag), abort (both flags = version bump), or ignore (irrelevant).
* **Where it shined:** All mid-flight logic lives in **one place** - inside the flow loop. The race over confirm / cancel / stateUpdated is a gorgeous, declarative "whatever happens first." This is the opposite of Impl 1, where a separate WS hook had to orchestrate Query (invalidate) and Zustand (abort) as glue.
* **Where it fought me:** eventChannel is non-obvious the first time - you must return the unsubscribe from the subscriber and pump it in a dedicated while (take(channel)) loop. You also have to reason about timing: the race only listens while the saga is actually sitting at the gate.
* **The Surprises:** The same race produces both the "refresh in place" and the "abort" outcomes - just different if branches on the flags. In Impl 1 those were two genuinely different code paths in two modules; Saga unified them into one.

### 3. Re-entrancy protection
* **The Approach:** takeLeading on the trigger actions runs the first flow and ignores repeat triggers until it finishes. Duplicate *confirms* are dropped for free, because during yield call(submit) the saga simply isn't take-ing confirmRequested.
* **Where it shined:** This is the "right-shaped" answer the brief asks for: re-entrancy is one idiomatic operator (takeLeading), not a hand-written guard. Verified live - spamming Confirm under Slow 3G produced exactly one POST, with the button never disabled.
* **Where it fought me:** Honestly nothing. It is less code than Impl 1's isPending early-return, and it sits at the effect layer where it belongs.
* **The Surprises:** How much thinner the container became. AppSaga has no isPending check, no mutation.reset(), no error-to-notice mapping - all of that moved into the saga/slice, leaving the view as pure dispatch-and-render.

### 4. Version-conflict handling
* **The Approach:** try/catch around call(submit, version). On ConflictError, set a notice, mark needFetch, and continue the loop - which refetches fresh context and re-opens the gate with the modal still mounted.
* **Where it shined:** The retry is just another turn of the loop: continue, and you are back at "fetch → gate." It reads more naturally than Impl 1's onError → invalidate → keep-open coordination.
* **Where it fought me:** *Reaching* it. The WS abort from Behavior 2 is so robust that a version bump aborts the active flow before a stale submit can ever happen. I could not reliably silence the live socket from DevTools - Chrome buffers the WS frame and delivers it on reconnect, and "Block request URL" doesn't close an already-open socket - so the abort kept winning. In practice the 409 path is a **safety net**, not a common occurrence; I verified it via code review and a contract-level 409 (POST /api/approve with a stale version → 409 { currentVersion }).
* **The Surprises:** Unlike Impl 1, Saga has no refetchOnReconnect quietly healing the conflict for you. There is no hidden magic - the conflict behavior is exactly and only what you wrote in the saga: explicit, predictable, and a little more verbose.

---

## Overall Recommendation

For most real codebases I would still reach for **TanStack Query + Zustand first**. It deletes the most boilerplate, hands you caching / dedup / refetchOnReconnect for free, and keeps server state (Query cache) and UI state (Zustand) cleanly apart. Its weakness showed up exactly where this assignment pushes hardest: a complex multi-step flow with mid-flight invalidation became an *orchestration* problem smeared across hooks, and the WS "glue" hook had to coordinate two libraries.

**Redux Toolkit + Redux Saga** shines precisely where the flow *is* the product - long sequential async with human gates, cancellation, and re-entrancy. Saga expresses those as a single readable script with first-class operators (take-gate, race, takeLeading, eventChannel), and it concentrates the logic in one place instead of spreading it across view + hooks + store. The price is real: upfront ceremony, manually-typed yields, and re-implementing the caching that Query gives away.

**My rule of thumb:** default to Query + Zustand for typical server-state / CRUD apps; reach for Saga when the core complexity is orchestrating long-lived, interruptible, multi-step side-effect flows. For *this* problem specifically - which is essentially a flow-orchestration exercise - Saga modeled the four behaviors most faithfully, but Query + Zustand reached a correct, shippable solution with noticeably less code. If I had to ship one tomorrow for a product that is mostly screens over an API, I would ship the Query version; if the product were a workflow engine, I would ship the Saga version.
