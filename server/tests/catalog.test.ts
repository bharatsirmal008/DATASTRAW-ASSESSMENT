import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getCatalogInfo, getCatalogCategories, getCatalogProduct, searchCatalog, parseCatalogProduct, catalogBaseUrl } from '../src/services/catalog.service';
import { executeTool, getAvailableTools } from '../src/tools/toolRegistry';
import { GeminiProvider } from '../src/providers/gemini.provider';
import { validateSummaryOutcome, summaryResponseSchema } from '../src/validators/summary.validator';
import { providerFailure } from '../src/providers/provider.errors';

const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const product = { id, name: 'Test shoes', price: '499.00', currency: 'INR', availability: 'OUT_OF_STOCK', category: { name: 'Footwear', slug: 'footwear' } };
const list = (data: any[], total = data.length, totalPages = 1) => ({ data, pagination: { page: 1, limit: 48, total, totalPages } });
const originalFetch = globalThis.fetch;
let previousUrl: string | undefined;
let previousBrand: string | undefined;
function mock(handler: (url: URL) => any) {
  globalThis.fetch = (async (input: any, options: any) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://catalog.example.test');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, undefined);
    return Response.json(await handler(url));
  }) as typeof fetch;
}
describe('Read-only Catalog Maker connection', () => {
  beforeEach(() => {
    previousUrl = process.env.CATALOG_API_URL;
    previousBrand = process.env.SUPPORT_BRAND_NAME;
    process.env.CATALOG_API_URL = 'https://catalog.example.test';
    process.env.SUPPORT_BRAND_NAME = 'Test Store';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.CATALOG_API_URL; else process.env.CATALOG_API_URL = previousUrl;
    if (previousBrand === undefined) delete process.env.SUPPORT_BRAND_NAME; else process.env.SUPPORT_BRAND_NAME = previousBrand;
  });
  it('reads the published business information and enquiry link', async () => {
    mock(url => { assert.equal(url.pathname, '/api/catalog/config'); return { data: { businessName: 'Test Store', whatsappNumber: '911234567890', adminSecret: 'discard-me' } }; });
    const info = await getCatalogInfo();
    assert.equal(info.businessName, 'Test Store');
    assert.equal(info.whatsappUrl, 'https://wa.me/911234567890');
    assert.equal(info.orderTrackingAvailable, false);
    assert.equal('adminSecret' in info, false);
  });
  it('does not manufacture a contact link when none is published', async () => {
    mock(() => ({ data: { businessName: 'Test Store', whatsappNumber: null } }));
    assert.equal((await getCatalogInfo()).whatsappUrl, null);
  });
  it('loads category names and exact slugs', async () => {
    mock(() => ({ data: [{ name: 'Footwear', slug: 'footwear' }] }));
    assert.deepEqual((await getCatalogCategories()).categories, [{ name: 'Footwear', slug: 'footwear' }]);
  });
  it('encodes query values without introducing arbitrary query parameters', async () => {
    mock(url => { assert.equal(url.searchParams.get('q'), 'shirt&admin=true'); assert.equal(url.searchParams.get('admin'), null); return list([product]); });
    const result = await searchCatalog({ query: 'shirt&admin=true' });
    assert.equal(result.products[0].availability, 'OUT_OF_STOCK');
    assert.equal(result.products[0].price, '499.00');
  });
  it('uses upstream availability/category filters without guessing slugs', async () => {
    mock(url => { assert.equal(url.searchParams.get('category'), 'footwear'); assert.equal(url.searchParams.get('available'), 'true'); return list([]); });
    assert.equal((await searchCatalog({ category: 'footwear', availability: 'in_stock' })).products.length, 0);
  });
  it('applies a budget only to the specified currency', async () => {
    mock(() => list([product, { ...product, id: otherId, currency: 'USD', price: '5.00' }]));
    const result = await searchCatalog({ max_price: 500, currency: 'INR' });
    assert.equal(result.products.length, 1);
    assert.equal(result.products[0].currency, 'INR');
  });
  it('reads later pages for a budget search and marks bounded results incomplete', async () => {
    let requests = 0;
    mock(url => { requests++; return list([{ ...product, price: url.searchParams.get('page') === '1' ? '800.00' : '400.00' }], 150, 4); });
    const result = await searchCatalog({ max_price: 500, currency: 'INR' });
    assert.equal(requests, 2);
    assert.equal(result.products[0].price, '400.00');
    assert.equal(result.complete, false);
  });
  it('returns genuine empty results without substituting products', async () => {
    mock(() => list([], 0, 0));
    const result = await searchCatalog({ query: 'missing-product' });
    assert.deepEqual(result.products, []);
    assert.equal(result.complete, true);
  });
  it('bounds model output to eight products and reports partial coverage', async () => {
    mock(() => list(Array.from({ length: 12 }, () => product)));
    const result = await searchCatalog();
    assert.equal(result.products.length, 8);
    assert.equal(result.complete, false);
  });
  it('builds product links from the trusted catalog origin', async () => {
    mock(() => ({ data: { ...product, sourceUrl: 'https://untrusted.example.test' } }));
    const result = await getCatalogProduct(id);
    assert.equal(result.product.url, `https://catalog.example.test/products/${id}`);
  });
  it('does not request a model-supplied URL as a product identifier', async () => {
    let requested = false; mock(() => { requested = true; return {}; });
    await assert.rejects(getCatalogProduct('https://untrusted.example.test'), (error: any) => error.code === 'INVALID_PRODUCT_ID');
    assert.equal(requested, false);
  });
  it('rejects a detail response for a different product', async () => {
    mock(() => ({ data: { ...product, id: otherId } }));
    await assert.rejects(getCatalogProduct(id), (error: any) => error.code === 'CATALOG_INVALID_RESPONSE');
  });
  it('rejects malformed prices and availability rather than inventing values', () => {
    assert.throws(() => parseCatalogProduct({ ...product, price: 'free' }));
    assert.throws(() => parseCatalogProduct({ ...product, availability: 'probably' }));
  });
  it('rejects an ambiguous budget currency before fetching', async () => {
    await assert.rejects(searchCatalog({ max_price: 500 }), (error: any) => error.status === 400);
  });
  it('restricts the configured source to a credential-free HTTPS origin', () => {
    for (const url of ['http://catalog.example.test', 'https://user:password@catalog.example.test', 'https://catalog.example.test/admin']) {
      process.env.CATALOG_API_URL = url;
      assert.throws(catalogBaseUrl);
    }
  });
  it('handles Render startup HTML as unavailable data', async () => {
    globalThis.fetch = (async () => new Response('<html>Starting</html>', { headers: { 'Content-Type': 'text/html' } })) as typeof fetch;
    await assert.rejects(searchCatalog(), (error: any) => error.code === 'CATALOG_INVALID_RESPONSE');
  });
  it('does not reuse old product data after an outage', async () => {
    mock(() => list([product])); await searchCatalog();
    globalThis.fetch = (async () => { throw new Error('Network unavailable'); }) as typeof fetch;
    await assert.rejects(searchCatalog(), (error: any) => error.code === 'CATALOG_UNAVAILABLE');
  });
  it('exposes only catalog tools and blocks unrelated policy tools in catalog mode', async () => {
    assert.deepEqual(Object.keys(getAvailableTools()).sort(), ['get_catalog_categories', 'get_catalog_info', 'get_catalog_product', 'search_catalog']);
    await assert.rejects(executeTool('check_return_eligibility', {}), /not registered/);
  });
  it('executes a real tool loop and keeps product identities for follow-up turns', async () => {
    mock(() => list([product]));
    const provider = new GeminiProvider(); let calls = 0;
    (provider as any).getClient = () => ({ model: 'test', ai: { models: { generateContent: async (request: any) => {
      assert.ok(request.config.tools[0].functionDeclarations.some((tool: any) => tool.name === 'search_catalog'));
      assert.ok(!request.config.tools[0].functionDeclarations.some((tool: any) => tool.name === 'get_order_details'));
      assert.match(request.config.systemInstruction, /Test Store/);
      return ++calls === 1 ? { candidates: [{ content: { role: 'model', parts: [{ text: 'Checking…' }, { functionCall: { name: 'search_catalog', args: { query: 'shoes' } } }] } }] }
        : { candidates: [{ content: { role: 'model', parts: [{ text: 'Test shoes is listed at INR 499 and is out of stock.' }] } }] };
    } } } });
    const result = await provider.generateResponse({ userMessage: 'Find shoes', messages: [], context: {} });
    assert.doesNotMatch(result.content, /Checking/);
    assert.equal(result.contextPatch?.latestProductId, id);
    assert.deepEqual(result.contextPatch?.recentCatalogProducts, [{ id, name: 'Test shoes' }]);
    assert.match(result.toolCalls[0].resultSummary, /catalog matches checked/);
  });
  it('accepts catalog intents in factual post-call summaries', () => {
    const result = validateSummaryOutcome({ customer_intent: 'PRODUCT_SEARCH', resolution_status: 'RESOLVED', order_id: null, order_ids: [], call_summary: 'Customer asked about listed shoes and received the published price and availability.', tools_used: ['search_catalog'], summary_mode: 'GEMINI' });
    assert.equal(result.isValid, true);
  });
  it('reports provider request limits without exposing the provider payload', () => {
    const error = providerFailure({ status: 429, message: 'private provider payload' }) as any;
    assert.equal(error.status, 429);
    assert.equal(error.code, 'AI_RATE_LIMITED');
    assert.doesNotMatch(error.message, /private/);
  });
  it('constrains catalog summaries to no invented order IDs and real tool names', () => {
    const schema = summaryResponseSchema([], ['search_catalog']);
    assert.deepEqual(schema.properties.order_id, { type: 'null' });
    assert.equal(schema.properties.order_ids.maxItems, 0);
    assert.deepEqual(schema.properties.tools_used.items.enum, ['search_catalog']);
    assert.ok(schema.properties.customer_intent.enum.includes('PRODUCT_SEARCH'));
  });
  it('preserves rate-limit status for summary retry and sanitizes other failures', () => {
    assert.equal((providerFailure({ message: JSON.stringify({ error: { code: 429 } }) }, true) as any).status, 429);
    const error = providerFailure({ status: 500, message: 'private provider payload' }, true);
    assert.match(error.message, /transcript is preserved/);
    assert.doesNotMatch(error.message, /private/);
  });
});
