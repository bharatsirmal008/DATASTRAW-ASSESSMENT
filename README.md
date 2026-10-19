# Aria - Aura Skincare Voice CX Agent

Assessment version of a browser-based voice customer-support agent. Aria uses live Gemini reasoning, browser speech recognition and speech synthesis, the assignment's three mock orders, and deterministic Aura policy tools. The sample data is clearly labelled; conversations are not scripted.

## Run locally

Requires Node.js >=22.12 and npm.

```powershell
npm.cmd --prefix server ci
npm.cmd --prefix client ci
Copy-Item server/.env.example server/.env
```

Only copy the environment example on a new installation. Do not overwrite an existing private `.env`. Add `GEMINI_API_KEY` directly to `server/.env`; never put it in client code or commit it.

```dotenv
APP_MODE=assessment
AI_PROVIDER=gemini
SUMMARY_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_FALLBACK_MODELS=gemini-3.1-flash-lite,gemini-3.8-flash
```

```powershell
npm.cmd run build
npm.cmd start
```

Open http://127.0.0.1:5173. Chrome or Edge is recommended for microphone input. Allow microphone access, click Start Call, speak, and click End Call to see the transcript and formatted JSON outcome. Typed input during a call and separate text chat are available. Stop the server with Ctrl+C. Rebuild after source changes; restart after environment changes. `npm.cmd` avoids PowerShell script-execution-policy problems on Windows; `npm` also works where scripts are enabled.

For separate development servers use `npm.cmd --prefix server run dev` (port 5000) and `npm.cmd --prefix client run dev` (port 5173, API proxy). The production build serves frontend and API from one Express origin. Leave `VITE_API_URL` empty for that setup.

## Assessment features

- Aria persona: friendly, professional, concise support for the fictional Aura Skincare brand.
- Browser microphone -> speech recognition (`en-IN`) -> Gemini tool reasoning -> browser speech synthesis. An Indian English voice is preferred when installed; otherwise an available English voice is used.
- Start/End Call, Listening/Thinking/Speaking feedback, mute, speech-speed control, a live transcript, and typed fallback.
- Visible test-order cards with all three supplied IDs, customers, products, prices, statuses, couriers/tracking and scenario notes.
- `get_order_details(order_id)` performs a backend lookup rather than asking the model to recall orders. Spoken identifiers such as "O R D one zero one" are normalized without guessing unknown orders.
- Shipping, cancellation, returns, damage and COD tools enforce the supplied brand rules. Ineligible requests are declined and missing details are clarified. Exactly INR 499 is left unspecified because the brief does not define that shipping boundary.
- Full chronological customer/Aria transcript, live AI JSON summary, intent, referenced order IDs, resolution status, tool metadata and TXT/JSON exports after ending a call.
- Summary failures retain the transcript and offer retry. In-flight replies cannot reopen an ended voice call.
- HTTP 429 triggers automatic model fallback in configured order. Exhausted models are skipped for 60 seconds across chats and summaries. At most three distinct models are attempted; an empty `GEMINI_FALLBACK_MODELS` disables switching. Other provider errors remain explicit errors. A backup needs available quota and model access; switching does not reset project quota.

The order database contains the PDF's fictional scenarios: ORD-101 is out for delivery with BlueDart, expected by 6 PM; ORD-102 was delivered 14 days ago; ORD-103 is Processing and eligible for cancellation. These relative times are fixed scenario facts, not current shipment dates. The agent checks eligibility only: no cancellation, refund, replacement or support contact is actually performed.

## Architecture and approach

```text
Microphone -> browser STT -> Express conversation/session service
                                      |
                              Gemini function calling
                                      |
                         Order lookup + Aura policy tools
                                      |
Transcript/UI <- response <- Gemini <- verified tool results
      |
Browser TTS -> speakers
      |
End Call -> transcript + schema-validated Gemini JSON summary
```

React/TypeScript implements the voice lifecycle and interface. Express/TypeScript owns the secret key, session context, tools and validation. The model receives recent dialogue and verified context, while the full transcript is retained separately. The system prompt limits the brand/scope and forbids invented orders, unsupported actions and contact details; policy decisions are also implemented as deterministic functions. Transcript contents are treated as data by the summary prompt, with schema and known-order-ID validation before display.

Key code: `client/src/hooks/useVoiceSession.ts`, `server/src/providers/gemini.provider.ts`, `server/src/tools/toolRegistry.ts`, `server/src/data/assessmentOrders.ts`, `server/src/services/policy.service.ts`, and `server/src/services/summary.service.ts`.

## Why this architecture and stack? (Section 9.1)

The modular pipeline makes each stage understandable and testable within the assignment's time budget. React provides clear interaction states, TypeScript shares contracts across the interface and API, and Express keeps credentials and business rules on the server. Browser speech APIs avoid telephony setup, while Gemini handles natural paraphrases and tool selection. The tradeoff is browser-dependent recognition and a turn-based experience rather than native streaming speech-to-speech.

## Most difficult part and solution (Section 9.2)

The hardest part was coordinating asynchronous microphone, model, speech and call-ending events while preserving a truthful transcript. Generation tokens and explicit voice states reject late replies after End Call, recognition pauses during playback, and failures retain readable dialogue with summary retry. Policy tools and known-order validation keep the model grounded rather than relying on conversational agreement. Tests now mount the actual hooks to exercise these races, not just a separate state-machine example.

## With one more week (Section 9.3)

First measure and improve real microphone-to-speaker latency on the deployed URL, including permission denial, unclear speech and poor connections. Then add interruption handling and stronger ambiguous-intent tests. These improve the main conversation experience more than extra dashboards or unrelated tools.

## At 1,000 conversations per day (Section 9.4)

Harden shared-session storage with access controls, define transcript consent/retention, and add provider-budget limits, per-client rate limits, monitoring and load tests. Measure tokens, latency, tool failures and summary quality before sizing capacity. Model fallback helps availability only when the project's permitted models have quota. Move post-call work to a retryable job if it becomes slow, and use a shared cooldown/queue when running multiple server instances.

## Validation

```powershell
npm.cmd test
npm.cmd run build
npm.cmd --prefix client run lint
```

The test runner bundles locally with declared esbuild and runs Node tests; browser hooks use Testing Library and jsdom with mocked microphone, recognition, TTS and HTTP APIs. Tests cover actual duplicate starts, permission denial, end-during-thinking/speaking, summary retry, policy boundaries, unknown orders, session isolation, exports/summary contracts and quota switching. Test-only scripted fixtures cannot be selected by application environment variables in production.

Final checks: 170 backend and 37 frontend tests passed (207 total), both builds passed, and lint completed with seven existing warnings and no errors. Real Gemini checks on 19 October 2026 verified an order lookup from spoken-style text, contextual cancellation refusal, opened-product return refusal, a missing-ID clarification followed by ORD-103 eligibility, an out-of-scope refusal, and a live structured summary with 12 chronological messages. The six recorded answer times ranged from 0.8 to 2.9 seconds on this local test; this is not a production latency guarantee. Evidence: `output/assessment/live-verification.json`.

A final targeted check verified honest cancellation guidance without invented account screens, unknown ORD-999 handling, the unspecified INR-499 shipping boundary and another generated summary. A headless Chrome check verified no horizontal overflow at 390px and completed a real ORD-102 text chat through End and the rendered JSON/transcript screen. Evidence and reviewed screenshots are under `output/assessment/`, including `targeted-verification.json` and `ui-verification.json`.

Physical microphone/speaker quality still needs a human check in a supported browser and on the public HTTPS URL. Mocked browser tests do not prove that hardware experience. Current provider access/quota and network conditions can still affect results.

## English speech and natural conversation

English is the default, with Indian English preferred; each utterance has an explicit English locale. Speech preparation reads prices, order IDs and delivery times as English words while preserving the original transcript. Choose a voice and try the pronunciation preview under **Voice & pronunciation settings**. Recognition joins sentence fragments, avoids duplicate final events and reuses microphone permission across turns. Live answers are kept concise and context-aware. See `docs/VOICE_FIXES.md` for implementation, tests, measured local latency and the remaining hardware audio check.

## Optional Hindi voice

Before starting a voice call, choose **Conversation language > Hindi**. This switches recognition to `hi-IN`, requests Hindi replies from Gemini, and selects an installed Hindi voice. **Voice & pronunciation settings** lists matching Hindi voices and includes a Hindi preview. If no Hindi voice is installed, the app reports that and retains text support; it never silently uses an English voice for Hindi audio. The dropdown is locked during a call, but you can say "Can you talk in Hindi?", "Speak in English" or "Hindi mein baat karo" to switch without ending it. Recognition, reply language and voice switch together while order context stays in the same session. English remains the default and keeps its English number pronunciation. Post-call summaries remain in English, with the original Hindi dialogue preserved in the transcript.

## Public deployment

Use one Node web service with repository root as the working directory. Build command: `npm ci --prefix server && npm ci --prefix client && npm run build`. Start command: `npm start`. Set `APP_MODE=assessment`, `AI_PROVIDER=gemini`, `SUMMARY_PROVIDER=gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`, `NODE_ENV=production`, and `CLIENT_ORIGIN` to the actual public HTTPS origin. The host's `PORT` is respected. Keep `CATALOG_API_URL` empty for the assessment. Health path: `/api/health` (configuration presence is not a live provider-quota probe).

Source repository: https://github.com/bharatsirmal008/DATASTRAW-ASSESSMENT. For the requested entire application on Vercel, see [Vercel deployment](docs/VERCEL_DEPLOYMENT.md). The checked-in configuration serves the interface and Express API together with shared Redis sessions. Import the repository root, configure server-side Gemini and Upstash credentials, and keep `VITE_API_URL` unset. Public hosting and real cloud verification remain pending account connection and credentials.

No custom domain or phone number is required. Choose a host with outbound HTTPS and browser-compatible HTTPS hosting. Re-test microphone access and the complete call/summary flow at the final URL.

## Current limits and deferred store work

Local sessions use memory, bounded to 500 sessions with a two-hour inactivity lifetime. With Upstash configured, HTTP sessions use shared Redis storage and per-session leases; Vercel refuses calls if storage is absent. Redis transcripts/context/post-call artifacts expire after two hours. Five additional command-contract tests verify persistence and concurrency behavior (207 tests total); actual Vercel/Redis integration still needs cloud verification. Session URLs use random IDs and act as bearer access links; there is no customer-account authentication. Global call-history listing is disabled. This is an assessment application, not a production store/order platform. Barge-in and Hinglish are optional and are not implemented as verified features.

JoJo Store integration is preserved for later. `APP_MODE=assessment` ignores the saved catalog URL and store branding. To resume store work later, set `APP_MODE=store`, restore/configure `CATALOG_API_URL` and `SUPPORT_BRAND_NAME`, then restart. Store mode does not expose assessment orders and still needs a real authenticated order integration. See `docs/CATALOG_CONNECTION.md` for that separate work.

## Submission materials

See `docs/ASSESSMENT_CHECKLIST.md` for requirement coverage and remaining validation, and `docs/SUBMISSION.md` for the 3-5 minute video outline, approach note and submission checklist. A public application URL, published source repository, real voice demonstration recording and the owner's LinkedIn link remain external deliverables. No email has been sent and no submission has been made.
