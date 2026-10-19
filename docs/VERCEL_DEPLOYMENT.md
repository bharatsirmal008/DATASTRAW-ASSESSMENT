# Vercel deployment

The current interface can run on Vercel. The Express API currently stores call sessions in process memory; deploying it unchanged as a Vercel Function is unreliable because later requests can reach another instance or a cold start. That can lose the order context, transcript and post-call summary.

## Deploy the existing architecture

1. Deploy the Express backend as one continuously running Node web service, with repository root as its working directory. Build: `npm ci --include=dev --prefix server && npm ci --include=dev --prefix client && npm run build`. Start: `npm start`. Health check: `/api/health`.
2. Set backend secrets/configuration: `APP_MODE=assessment`, `AI_PROVIDER=gemini`, `SUMMARY_PROVIDER=gemini`, `GEMINI_API_KEY`, the model settings from `server/.env.example`, and `NODE_ENV=production`. Keep `CATALOG_API_URL` empty. Set `CLIENT_ORIGIN` to the final Vercel HTTPS origin.
3. Import `bharatsirmal008/DATASTRAW-ASSESSMENT` into Vercel. Set **Root Directory** to `client`, framework **Vite**, install command `npm ci --include=dev`, build command `npm run build`, output directory `dist`.
4. Add `VITE_API_URL` with the backend's HTTPS origin, without a trailing slash or `/api`. This is a public address, not a secret. Set it for the intended deployment environment before building. Redeploy the interface if it changes. Never put `GEMINI_API_KEY` in a `VITE_` variable.
5. On the public URL, check backend readiness, a full ORD-101 call with a contextual cancellation question, spoken Hindi/English switching, End Call, transcript and JSON summary. Verify microphone permission and audible output in Chrome or Edge.

The backend still loses sessions on restart and must stay at one instance with the present session store. A sleeping free service can add a delay to the first request. This layout does not make the app a production customer-order platform.

## If both interface and backend must run on Vercel

First replace the process-local session store with shared durable storage, including expiry, atomic per-session updates and concurrency handling. Adapt the API entry point and static-asset routing, then test that a conversation survives separate function instances and retries. Do not claim a complete Vercel deployment merely because the interface loads.

References: [Express on Vercel](https://vercel.com/docs/frameworks/backend/express), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).
