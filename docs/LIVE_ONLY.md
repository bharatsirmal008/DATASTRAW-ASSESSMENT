# Live-only conversion — 18 October 2026

Historical conversion notes. The current application still uses live Gemini conversations, with APP_MODE=assessment explicitly enabling the PDF's required mock order data. See ASSESSMENT_CHECKLIST.md for the current status. Store mode continues to exclude assessment orders.

## Changed

- Application conversations always select Gemini. Only the explicit isolated test environment can load a fixture provider.
- Application summaries always use Gemini, reject a request for demo mode, and do not silently fall back after provider failure.
- Fictional orders and the deterministic provider moved to server/tests/fixtures; obsolete generated fixture files were removed.
- Sample order routes return 404 outside tests. Order lookup returns ORDER_SERVICE_NOT_CONFIGURED rather than fake records.
- The UI no longer shows sample people, sample IDs, scripted evaluator prompts, demo badges, a policy tester, or a manual mock lookup.
- Public history listing is disabled until authenticated access is implemented.
- Readiness reports actual AI configuration and order connection status; start and chat controls are disabled without live AI configuration.
- npm start serves the built UI and API from Express on a single origin with NODE_ENV=production.
- The default Gemini model is now gemini-3.8-flash, verified against Google's current official model catalogue. An environment override remains available.

## Required from the owner

Add GEMINI_API_KEY directly to server/.env and restart. Identify the real store/platform and authenticated order API. No credentials should be sent in chat. There is currently no configured key or real order connection; no live AI response or real transaction lookup was verified.

## Scope

This conversion removes simulated application behavior. It does not by itself provide store authentication, durable storage, public hosting, native streamed audio, or a fully verified production deployment. The assessment’s original sample-order helper is intentionally no longer in the application.

## Validation

128 backend tests and 14 frontend tests passed. Both production builds passed. The running combined server was checked: the sample endpoint returns 404, disconnected order lookup and unconfigured AI return 503, and the interface shows unavailable status with disabled call/chat controls. Live responses remain unverified because no key is configured.
