# Aria - Aura Skincare Voice Agent

Browser voice and text support for the Datastraw assessment. Aria uses live Gemini reasoning, verified policy tools and the three fictional orders supplied in the assessment. English and Hindi are supported, including spoken language switching during a call.

## Local setup

Use Node.js 22.12 or newer. Copy server/.env.example to server/.env and configure GEMINI_API_KEY and APP_MODE=assessment. Never commit credentials.

    npm ci --prefix server
    npm ci --prefix client
    npm run build
    npm start

Open http://localhost:5000 (or the PORT configured in server/.env). For development, run npm --prefix server run dev and npm --prefix client run dev in separate terminals; the interface runs on port 5173 and proxies the API to port 5000. On Windows PowerShell use npm.cmd if script execution is blocked.

## Features and architecture

React handles microphone recognition, speech synthesis, call states and transcripts. Express keeps Gemini credentials, order/policy tools and summary validation on the server. End Call produces a chronological transcript and structured JSON outcome. Indian English voices are preferred when installed; Hindi requires an installed Hindi voice. Say "Speak in Hindi" or "Speak in English" during a call to switch while retaining context.

The assessment orders ORD-101, ORD-102 and ORD-103 are intentionally retained. Aria provides eligibility and policy guidance; it does not execute cancellations, refunds or replacements. There is no scripted/demo AI fallback.

## Separate client and server deployments on Vercel

Import the same GitHub repository twice as two Vercel projects. Each folder has its own vercel.json. Do not import the repository root as a combined project.

| Setting | Server project | Client project |
| --- | --- | --- |
| Root Directory | server | client |
| Framework | Express | Vite |
| Install | npm ci --include=dev | npm ci --include=dev |
| Build | npm run build | npm run build |
| Output | Framework managed | dist |

1. Create the server project first. Configure server-only APP_MODE=assessment, AI_PROVIDER=gemini, SUMMARY_PROVIDER=gemini, GEMINI_API_KEY, permitted GEMINI_MODEL/GEMINI_FALLBACK_MODELS and NODE_ENV=production. Keep CATALOG_API_URL empty.
2. Connect a durable Upstash Redis database and set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN on the server project. Keep preview/production storage separate. Never put these secrets on the client project.
3. On the client project, set VITE_API_URL to the actual server HTTPS origin, without /api. The Vercel client build rejects a missing/invalid origin. Changing this variable requires a client rebuild.
4. Set server CLIENT_ORIGIN to the exact deployed client HTTPS origin and redeploy the server. Additional trusted preview origins can be comma-separated; do not use a wildcard. Ensure both production URLs are publicly accessible for reviewers and browser API requests.
5. Check the server's /api/health, then open the client and run a complete Chrome/Edge voice call. Verify context, language switching, End Call, transcript and JSON outcome. Readiness reports configuration presence, not quota or Redis connectivity.

Shared sessions retain context, transcripts and summaries for two hours. Per-session leases prevent concurrent overwrites, and success responses wait for persistence. End Call retries a busy session while an answer finishes. Vercel refuses calls without shared storage; local Node runs may use memory. Session URLs act as bearer access links; there is no customer-account authentication or public call-history endpoint.

Public deployment and cloud verification remain pending Vercel access and server credentials. The local server can still serve the built client for local use.

## Assessment reflections (Section 9)

### Why this architecture and stack?

React, TypeScript and Express keep the browser voice lifecycle separate from server credentials and deterministic business rules. Browser speech APIs avoid telephony setup, while Gemini handles natural paraphrases and tool selection. The tradeoff is browser-dependent voices and turn-based latency.

### Most difficult part and solution

Coordinating microphone, provider, speech and End Call events required explicit states and guards against late replies. Provider context is bounded separately from the full transcript. Tools and summary validation prevent unsupported order/action claims.

### With one more week

Measure deployed microphone-to-speaker latency, improve interruption handling and validate ambiguous speech across devices. Repeat physical microphone and speaker checks on the public URL.

### At 1,000 conversations per day

Add authentication, per-client rate limits and provider budgets, transcript consent/retention, monitoring and load tests. Harden Redis access and add message idempotency for lost HTTP responses. Size capacity from measured tokens, latency and failures.

## Maintenance

Build with npm run build and check frontend lint with npm --prefix client run lint. Documentation folders, helper scripts, test suites, test-only providers and unused screens/assets have been removed. The short setup and assessment reflections remain here.

JoJo catalog integration remains available for later through APP_MODE=store, CATALOG_API_URL and SUPPORT_BRAND_NAME. Store mode does not expose assessment orders and still requires an authenticated real order integration.
