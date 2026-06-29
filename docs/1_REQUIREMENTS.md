Full Stack Engineer (Frontend-Leaning)

Home Assignment

Overview
You will build a small document approval application that contains two flows. Each flow involves
a sequence of asynchronous steps gated by user input, with the additional complication that the
underlying state can change while the flow is in progress. You will implement the application
twice: once using the state management approach you would reach for naturally, and once
using Redux + Redux Saga. The goal is for us — and for you — to develop a deep
understanding of the pros and cons of each approach for orchestrating complex flows and side
effects.
You should plan to spend roughly 10 to 14 hours on this. We know that is a real ask. The
assignment is structured this way because the comparison only produces useful signal if both
implementations are real. If a piece of the work would take longer than the budget allows,
document what you would have done and why, and move on.
A Note on AI Tools
We actively encourage the use of LLMs, AI coding assistants, and any other tools you would
normally use. We are not interested in whether you can write boilerplate from memory — we are
interested in how you wield modern tools to ship better work faster. Use them however you find
useful, especially for boilerplate and for the backend.
The walkthrough will involve a live conversation about your code and your reasoning. Make sure
you understand and can defend everything in your submission as your own.
What You Will Build
A minimal document approval application. A document has a title, body, version number, and
approval status. Multiple users can interact with the same document. The UI does not need to
look polished — clean and legible is enough.
Two flows must be implemented. Both flows are triggered by the user clicking a button on the
document.
Flow 1 — Approve Document
1. User clicks Approve.
2. App fetches approval context from the server (current document version, list of
approvers required after this one, and the current user’s role).
3. A modal opens showing the context and asking for confirmation.

Page 2 of

4. User confirms.
5. App submits the approval, referencing the version it was shown.
6. If the server reports a version conflict (the document changed since the context was
fetched), the app must refetch the context and present the updated modal to the user.
The user then confirms again with the fresh information.
Flow 2 — Publish Document
7. User clicks Publish.
8. App fetches publish context (list of dependent documents that will be updated, list of
subscribers who will be notified, and the current document state).
9. A modal opens showing the cascade impact.
10. While the modal is open, a state change may arrive over WebSocket — the document
was edited, dependents changed, etc. If the change is relevant to the modal’s content,
the modal must reflect the new state. If the change makes the flow no longer valid, the
flow must abort cleanly and inform the user.
11. User confirms.
12. App submits the publish request.
Behaviors That Matter
Beyond getting the happy paths working, there are four behaviors we care about. Each
implementation must handle all four.
Sequential async with user input gates
Each flow is a sequence of asynchronous steps with a synchronous human-in-the-loop step in
the middle. The orchestration of that sequence is the central problem this assignment exercises.
Mid-flight state invalidation via WebSocket
State changes pushed by the server during a flow can invalidate or modify what the user is
being asked to confirm. Your implementation must react to these changes correctly —
refetching, updating the modal, or aborting the flow depending on what makes sense.
Re-entrancy protection without UI-level debouncing
Clicking the trigger button rapidly must not start the flow multiple times. We are explicitly not
interested in solutions that operate at the UI layer — disabling the button visually, debouncing
the click handler, throttling, or any similar pattern. We want to see how your chosen state
management approach idiomatically handles re-entrancy at the action or effect layer. There is a

Page 3 of

right-shaped answer for every serious state management library; show us the one for yours, and
for Redux Saga.
Version-conflict handling
Both flows can fail with a version conflict at submit time. Recovery must be graceful and the
user must end up looking at correct information before confirming again.
The Two Implementations
You will build the full application twice.
Implementation 1 — Your favorite approach
• Pick the state management approach you would reach for in a real project. Any library,
any philosophy.
• If your favorite approach is already Redux + Redux Saga, pick your second-favorite — or
any meaningfully different approach — for this implementation.
Implementation 2 — Redux + Redux Saga
• Modern Redux (Redux Toolkit) for the store; Redux Saga for the async flows and side
effects.
• If you have not used Saga before, that is fine. The discovery is part of the assignment.
Sharing code between implementations
The UI components, the backend, and the API client should be shared across implementations
as much as is reasonable. The state and side-effects layer is what varies. Make the two
implementations switchable however you find cleanest — build flag, route, environment
variable.
Design Journal
A markdown file in the repo (we suggest JOURNAL.md). Write it as you go, not at the end. For
each implementation, reflect on how it handled each of the four behaviors above — where the
framework helped, where it fought you, where the idiomatic answer surprised you. Close with an
overall recommendation for what you would use in a real codebase, and the reasoning behind it.
Length is up to you; we care about substance, not word count.
Backend
You will build the backend yourself. Use whatever framework, language, and WebSocket library
you prefer. Lean on AI tools — the backend is plumbing, not what we are evaluating.

Page 4 of
• In-memory state is fine. No database required.
• You will need: endpoints for fetching approval context, fetching publish context,
submitting approval, submitting publish; WebSocket events for document edits and state
changes; and a way to simulate a version conflict on submit.
• Document the HTTP endpoints and WebSocket event protocol in the README.
• We will run docker-compose up (or a single npm command) and expect the full stack to
come up. Make this easy.
• Provide a simple way to drive WebSocket events for testing — a dev-only endpoint, a
button in the UI, anything. We need to be able to trigger mid-flight state changes when
we review.
Deliverables
Submit a public GitHub repository containing:
13. The working application with both state management implementations included and
switchable.
14. A README explaining how to run it, how to switch between implementations, the
HTTP/WebSocket protocol, and how to trigger mid-flight state changes for testing.
15. JOURNAL.md with your design journal and recommendation.
Constraints
• Time budget: 10 to 14 hours. Hard ceiling at 14. If you hit it, stop and document the rest.
• Desktop browsers only. Latest Chrome is fine as a target.
• No need to deploy. Local is sufficient. We will run it ourselves.
• Authentication, accounts, and user management are out of scope. A name in
localStorage or a query parameter is fine.
• Polished visual design is out of scope. Do not spend time on aesthetics.
What We Evaluate
Your submission will be assessed across the following dimensions. The first two carry the most
weight.
Dimension Description
Async flow design How you orchestrate sequential async work with user input

gates, mid-flight state changes, and re-entrancy.

Framework idiomaticity Whether each implementation uses its framework’s native idioms

Page 5 of
or fights them.

Comparison quality Depth and honesty of the journal. Whether the trade-offs

identified hold up under questioning.

Frontend craft The taste a senior frontend engineer brings to a codebase.
Code quality Readable, maintainable code across both implementations.
Documentation clarity Documentation an engineer joining the team next week could act

on.

Submission
16. Push your work to a public GitHub repository.
17. Email the repository link to your point of contact at LimitlessCNC.
18. Include in your email a one-line note on roughly how long you spent.
After we review your submission, we will schedule a 45-minute walkthrough where you live-
demo both implementations, walk us through your design journal, and answer follow-up
questions. The walkthrough matters as much as the artifact.
A Note on Scope
The single biggest mistake candidates make on this assignment is over-building. The
application is deliberately small. The signal we are buying with the time budget is two real
implementations of the same flows, written thoughtfully enough to compare. Treat it that way.
Questions
If anything in this brief is ambiguous, you have two options: make a reasonable assumption and
document it in the README, or email us and ask. Both are acceptable; we are also evaluating
how you handle ambiguity.
Good luck. We look forward to the walkthrough.