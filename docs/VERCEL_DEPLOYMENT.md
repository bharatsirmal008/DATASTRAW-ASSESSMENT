# Entire application on Vercel

The repository now includes `vercel.json` and `api/index.js` for a single Vercel project. Keep **Root Directory at the repository root**, framework **Other**. The checked-in configuration builds both packages, publishes `client/dist` and routes `/api/*` to Express. No Render service is required.

Connect a durable Upstash Redis database using Vercel Marketplace or an existing account. Set server-only `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` using the database's HTTPS REST endpoint and read/write token. Map integration-prefixed variables to these exact names if necessary. Use an available free plan when suitable; paid upgrades require the owner's approval. Keep preview and production databases separate.

Also set `APP_MODE=assessment`, `AI_PROVIDER=gemini`, `SUMMARY_PROVIDER=gemini`, `GEMINI_API_KEY`, the permitted model settings from `server/.env.example`, `NODE_ENV=production` and `CLIENT_ORIGIN` to the final HTTPS origin. Keep `CATALOG_API_URL` empty and **`VITE_API_URL` unset** for same-origin API requests. Never put a key or token in a `VITE_` variable.

Each call request loads an isolated session snapshot from Redis. A 90-second per-session lease prevents concurrent overwrites; an atomic Lua operation verifies ownership, saves the snapshot and releases the lease before returning JSON. The function maximum duration is 60 seconds. Transcripts, context and post-call artifacts expire after two hours. Missing shared storage on Vercel or a storage outage returns 503; there is no silent memory fallback. Overlapping requests return `409 SESSION_BUSY`, including End Call during an active answer; the End Call client retries explicit busy responses while waiting for the current request to finish.

Local Node runs may still use memory when Redis credentials are absent. Five command-contract tests check recovery after clearing local state, competing writes, lease loss, outages and absent credentials. These do not prove actual cloud integration. Check `/api/health`, then test a complete Chrome/Edge voice call, context, language switching, End Call and transcript/JSON on the final URL. Health readiness checks configuration presence, not live network access/quota.

Public deployment still needs Vercel connection and server credentials. Future production store work needs authentication, budgets/rate limits, retention controls and message idempotency after lost HTTP responses. Session URLs act as bearer access links; protect them like transcripts.

References: [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [Node.js functions](https://vercel.com/docs/functions/runtimes/node-js), [Upstash REST API](https://upstash.com/docs/redis/features/restapi).
