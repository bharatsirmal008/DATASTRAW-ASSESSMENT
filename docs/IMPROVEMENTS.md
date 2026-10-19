> Historical review: the current application uses the live-only behavior described in [LIVE_ONLY.md](LIVE_ONLY.md).

# Local improvement pass — 18 October 2026

## Conversation

- Pending requests survive missing-order-ID questions; the last verified order remains available to follow-ups.
- Spoken/spaced order IDs are normalized. Multiple IDs trigger clarification instead of silent selection.
- Damage complaints take priority over tracking; timing and photo follow-ups remain in that flow.
- Shipping/COD use the customer's supplied amount or the known order's value.
- Return timing and product condition are remembered; unsupported returns are declined.
- Short tracking answers replace long spoken fixture dumps. Tracking number, delay, and cancellation confirmations have contextual replies.
- Unsupported actions, stock/offers, product suitability, address changes, refunds, and support contact details receive honest limitations.
- Gemini receives the current user message once, verified session context, concise-answer instructions, and a provider timeout.

## Interface

Kept prominent: voice/text choice, call controls, state, conversation transcript, sample order details, and post-call JSON outcome.

Moved to disclosures: manual order lookup, full policy reference, policy tester, audio engine details, and chat tool metadata.

Removed from the main experience: development phase labels, the separate backend-debug banner, repeated order inspectors, lengthy evaluator scripts, and automatic scrolling on first load.

Added: typed input during a voice call, visible summary failure and retry, disabled chat switching while a call is active, responsive sample cards, keyboard focus styles, and reduced-motion support.

## Reliability and setup

- Full text history is kept; only model reasoning history is bounded.
- A late provider response cannot append to an ended session.
- A pending microphone permission request cannot start recognition after the call ends.
- Summary validation rejects fabricated order IDs even for calls containing no order IDs.
- Root build/test/start commands and a local API proxy remove avoidable setup friction.
- Tests compile locally using esbuild instead of requiring an npx download or the failing tsx OS-user lookup.

## Validation

120 backend tests and 14 frontend tests passed; 18 backend tests cover the newly fixed conversational and summary cases. Production builds passed. Manual browser checks covered cancellation after a spoken order number and a three-turn damage conversation. Physical microphone/audio behavior and live Gemini were not validated.

## Remaining

External setup remains deferred: Gemini key and live conversation validation, HTTPS hosting, source publishing, demo video, and submission links. Rule-based demo mode still has a bounded language understanding range; it is not equivalent to a live language model. Barge-in and Hinglish are optional future work. Actual React voice-hook integration tests remain a follow-up; the existing lifecycle model tests are not those integration tests.
