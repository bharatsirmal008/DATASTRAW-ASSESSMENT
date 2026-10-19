# Catalog Maker connection — 19 October 2026

User-approved scope: use published product/catalog data to answer customers. Source: https://github.com/bharatsirmal008/catalog-maker (master). Public service: https://catalog-maker-62d1.onrender.com/.

## Implemented

- Read-only server adapter for the existing public products, product-detail, category and catalog-config APIs.
- Dedicated Gemini catalog tools and JoJo Store identity; skincare-specific policy tools and UI references are excluded in catalog mode.
- Verified product IDs and recent result names retained for follow-up turns. Fresh details are fetched rather than trusting old availability.
- Source validation, explicit published currency, bounded pagination, product links on the configured origin, no admin credentials or mutations.
- UI connection card with published product count and a link to browse the actual catalog.
- Product-search/product-information summary intents and sanitized provider request-limit failures.

## Boundaries

No customer/order API is connected. No returns, shipping, payment or cancellation rules were provided by this public API. Aria cannot place orders, reserve inventory, send enquiries or perform admin actions. The upstream catalog may contain imported or seeded content; this integration faithfully reads what that application publishes and does not authenticate product provenance or guarantee physical inventory.

The local Aria assistant is connected. The Catalog Maker repository and Render deployment were not modified, and no assistant widget was embedded there.

## Validation

151 backend and 14 frontend tests passed. Both production builds passed. The live catalog returned JoJo Store and 50 published products. Real Gemini/tool calls verified Men Check Shirt at INR 1499.00 / OUT_OF_STOCK and a subsequent product-detail follow-up. A live return-policy question correctly requested store confirmation rather than applying the old skincare rule. The configured Gemini account hit a request quota during additional checks; quota handling now returns HTTP 429 with a retry message, without synthetic fallback.

## Operation

Keep CATALOG_API_URL and SUPPORT_BRAND_NAME in server/.env. Restart after environment changes; rebuild and restart after source changes. The combined production server needs outbound HTTPS to Gemini and Catalog Maker. Render service startup can temporarily make the catalog unavailable. Retry after startup; no stale product cache is used as a fallback.

Final live summary retry remained blocked by AI_RATE_LIMITED (HTTP 429). No successful live summary is claimed for the final catalog verification. Product answers, follow-up details, and honest policy handling were verified before the quota was exhausted.
