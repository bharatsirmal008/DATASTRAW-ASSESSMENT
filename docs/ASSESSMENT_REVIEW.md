> Historical review. The current assessment status is in [ASSESSMENT_CHECKLIST.md](ASSESSMENT_CHECKLIST.md); the live-only conversion below was later superseded by explicit assessment/store modes.

# Assessment readiness review

This is the original audit. Several findings were addressed in the subsequent implementation pass; see [Improvements](IMPROVEMENTS.md) and the current README for current status.

Reviewed: 18 October 2026. Scope: compare local project with `D:/download/AI+Tech intern-assesment (1).pdf`, inspect implementation, and run available local checks. External accounts, API setup, deployment, publishing, and submission were deferred. The PDF was treated as assessment criteria, not authorization to submit or contact anyone.

## Verdict

This project is suitable for the assignment. Its architecture and major features align with the brief, but it needs conversation fixes, real microphone validation, updated documentation, and the eventual submission deliverables before it is ready to submit. No application source was changed during this review.

## Requirement coverage

| Assessment requirement | Evidence and status |
| --- | --- |
| Browser voice conversation | Implemented using browser speech recognition, backend conversation turns, and browser speech synthesis. Actual microphone/audio quality and latency were not validated. |
| Aria persona and brand knowledge | Present in the prompt, brand policy data, and demo provider. |
| Policy guardrails and unknown information | Deterministic policy tools and fallback responses are present. Live model policy compliance remains unverified. |
| Order tool | `get_order_details` and the three supplied fixtures are implemented. |
| Context across turns | Latest order ID is retained; demo mode does not retain a pending cancellation request when it asks for an order ID. |
| Transcript and structured JSON summary | Implemented, with dashboard, exports, analytics, and call history. README incorrectly describes this as future work. |
| Start/End, state indicator, sample order helper | Present in the React components and App. |
| Public application URL | No deployment configuration or verified public URL found in the inspected files. Deferred. |
| GitHub repository | Current folder is not a Git repository; an existing remote repository could not be verified. Deferred. |
| README reflection answers | The four required Section 9 answers are missing. |
| Demo video, approach note, LinkedIn link | Not found in the inspected project documents. Prepare before submission. |

## Local verification

- Backend production build: passed (`npm run build`).
- Frontend production build: passed (`npm run build`).
- Frontend lint: completed successfully with 14 warnings, including hook dependencies, ref access, and state updates in effects.
- Automated test results: unverified. Backend `tsx` fails before executing assertions with `uv_os_get_passwd returned ENOMEM`. Direct runner attempts with the bundled Node runtime hit the same error. Frontend has no local `tsx` dependency and uses `npx tsx`; its normal test command failed attempting to fetch `tsx` from the npm registry with EACCES. A direct attempt using the installed backend loader hit the same Windows user-info error.
- README's claim of 93 tests with 100% pass rate cannot be confirmed. It also omits the added post-call test suite from its count.
- Direct checks against compiled backend demo code reproduced the issues below.
- Live Gemini calls and real browser voice conversations were not tested.

## Fix first: no external setup required

1. **Retain pending intent.** After "Can I cancel my order?", replying "ORD-103" currently enters tracking rather than continuing the cancellation eligibility flow. Store the pending intent in session context and resume it after receiving the ID. See `server/src/providers/demo.provider.ts` and `server/src/services/session.service.ts`.
2. **Prioritize damage complaints over generic tracking.** "My ORD-101 arrived damaged" currently returns tracking details because any explicit order ID triggers the tracking branch before damage handling. Recognize the damage intent, acknowledge the inconsistent delivery report, and ask for the necessary delivery timing/photos without promising an unsupported action.
3. **Normalize spoken IDs.** "Where is order O R D 101?" is not recognized as ORD-101. Support common recognition output such as spaced letters and missing hyphens, with confirmation for ambiguous input.
4. **Remove duplicate Gemini user turns.** The conversation service records the current message before calling the provider; the provider then converts that history and appends the same message again. Ensure the current user turn appears only once. See `server/src/services/conversation.service.ts` and `server/src/providers/gemini.provider.ts`.
5. **Strengthen call finalization.** A provider response arriving after End Call can attempt to append to an ended backend session. Handle in-flight turns explicitly and keep the final transcript/summary consistent. The UI currently catches post-call failures only in the console; show a visible error and retry while preserving the transcript. See `client/src/hooks/useVoiceSession.ts` and the conversation service/controller.
6. **Preserve the complete transcript separately from model context.** The session store drops older messages after 50 messages. Keep a full call log while limiting only the history sent to the model.
7. **Test the actual voice hooks.** Most lifecycle tests use a separate state-machine class rather than mounting `useVoiceSession`; these do not demonstrate that real asynchronous recognition/TTS behavior works. Cover rapid Start clicks, End during initialization/thinking/speaking, mute, network errors, and summary retry using mocked browser APIs.
8. **Make test tooling reproducible.** Add `tsx` as a client dev dependency and use the local binary in the test script. Resolve the environment runner issue and rerun both suites before reporting a pass rate.
9. **Update README.** Document the existing post-call features, add the four Section 9 reflections, fix missing `docs/PHASE_1.md` references, remove the nonexistent provider `index.ts` from the tree, and update Node requirements. Installed Vite requires Node `^20.19.0 || >=22.12.0`; README currently says Node >=18. Add a concise architecture explanation and the required 2-3 sentence approach note.
10. **Make spoken responses shorter.** Demo tracking currently reads customer, product, value, status, courier, and fixture notes. Lead with status and ETA; show secondary details in the UI. Keep fixture explanations in documentation/UI.

## Validate later with external setup

1. Configure a server-side Gemini key and choose live mode, then test natural paraphrases, multi-turn tool use, policy refusal, invalid IDs, rate-limit failures, and provider latency. Keep demo mode clearly labeled.
2. Test microphone and speaker behavior in supported browsers, including Indian voice availability, unclear speech, denied permission, and slow connections. Browser-based speech does not guarantee offline operation.
3. Publish the frontend and backend over HTTPS, configure API URL and CORS, and verify microphone access from the public URL.
4. Publish the source repository and record the required 3-5 minute video showing order lookup, policy discussion, transcript/JSON summary, and architecture.
5. Assemble the public URL, repository link, video link, LinkedIn profile, and approach note. Submission itself was not authorized or performed.

## Optional after core readiness

- Add interruption handling or Hinglish only if the main voice flow is reliable; neither is required by the assessment.
- For higher traffic, add durable session storage, per-session access controls, protected history access, request limits, provider timeouts, and operational monitoring. Current history is publicly retrievable through the API and session data resets on restart. These are scaling/public deployment improvements, not a requirement to build a production platform for this assignment.
- A paid phone number, telephony setup, CRM, additional tools, and a purchased domain are unnecessary for the core brief.
