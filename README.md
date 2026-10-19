# Aria ? Aura Skincare Voice Agent

Browser voice and text support for the Datastraw assessment. Aria uses live Gemini reasoning, verified policy tools and the three fictional orders supplied in the assessment. English and Hindi are supported, including spoken language switching during a call.

## Local setup

Use Node.js 22.12 or newer. Copy server/.env.example to server/.env and configure GEMINI_API_KEY and APP_MODE=assessment. Never commit credentials.

    npm ci --prefix server
    npm ci --prefix client
    npm run build
    npm start

Open http://localhost:5000 (or the PORT configured in server/.env). For development, run npm --prefix server run dev and npm --prefix client run dev in separate terminals; the interface runs on port 5173 and proxies the API to port 5000. On Windows PowerShell use npm.cmd if script execution is blocked.

## Features and architecture

React handles microphone recognition, speech synthesis, call states and transcripts. Express keeps Gemini credentials, order/policy tools and summary validation on the server. End Call produces a chronological transcript and structured JSON outcome. Indian English voices are preferred when installed; Hindi requires an installed Hindi voice. Say ?Speak in Hindi? or ?Speak in English? during a call to switch while retaining context.

The assessment orders ORD-101, ORD-102 and ORD-103 are intentionally retained. Aria provides eligibility and policy guidance; it does not execute cancellations, refunds or replacements. There is no scripted/demo AI fallback.

## Vercel deployment

Import this repository with the repository root as Root Directory and framework Other. The checked-in vercel.json installs/builds both packages, serves client/dist and routes /api to Express. Keep VITE_API_URL unset for same-origin requests.

Configure server-side APP_MODE=assessment, AI_PROVIDER=gemini, SUMMARY_PROVIDER=gemini, GEMINI_API_KEY, permitted GEMINI_MODEL/GEMINI_FALLBACK_MODELS, NODE_ENV=production and CLIENT_ORIGIN with the final HTTPS origin. Keep CATALOG_API_URL empty for the assessment.

Connect a durable Upstash Redis database and set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. Keep both credentials server-side; never use VITE_ for secrets. Use separate preview and production databases. Vercel refuses calls without shared storage. Local runs can use memory when Redis is absent.

Shared sessions retain context, transcripts and summaries for two hours. Per-session leases prevent concurrent overwrites, and success responses wait for persistence. End Call retries a busy session while an answer finishes. Session URLs act as bearer access links; there is no customer-account authentication or public call-history endpoint.

Check /api/health and complete a real Chrome/Edge voice call on the deployed HTTPS URL, including order context, language switching, End Call and JSON output. Readiness checks configuration presence, not provider quota or storage connectivity. Public deployment verification is still pending account connection and credentials.

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
