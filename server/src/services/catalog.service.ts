import { isAssessmentMode } from '../config/application';

const AVAILABILITY = new Set(['IN_STOCK', 'OUT_OF_STOCK', 'BACKORDER', 'UNAVAILABLE']);
const CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export interface CatalogProduct {
  id: string; name: string; price: string; currency: string; availability: string;
  category: { name: string; slug: string } | null; url: string;
  description?: string; variants?: Array<{ title: string; price: string; availability: string; stockQuantity: number | null }>;
}
function failure(code: string, message: string, status = 502): Error {
  return Object.assign(new Error(message), { code, status });
}
export function catalogBaseUrl(): string {
  const configured = isAssessmentMode() ? undefined : process.env.CATALOG_API_URL?.trim();
  if (!configured) throw failure('CATALOG_NOT_CONFIGURED', 'The product catalog is not connected.', 503);
  let url: URL;
  try { url = new URL(configured); } catch { throw failure('CATALOG_CONFIGURATION_ERROR', 'The catalog connection is not configured correctly.', 503); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw failure('CATALOG_CONFIGURATION_ERROR', 'The catalog must use an HTTPS origin without credentials or a path.', 503);
  }
  return url.origin;
}
export function isCatalogConfigured(): boolean { return !isAssessmentMode() && Boolean(process.env.CATALOG_API_URL?.trim()); }
async function readCatalog(path: string, query?: Record<string, string>): Promise<any> {
  const url = new URL(path, catalogBaseUrl());
  if (query) for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'error', headers: { Accept: 'application/json' } });
    if (response.status === 404) throw failure('CATALOG_NOT_FOUND', 'That product is not present in the published catalog.', 404);
    if (!response.ok) throw failure('CATALOG_UNAVAILABLE', 'The catalog service is temporarily unavailable. No product information was verified.', 503);
    // Bound remote data before parsing; Render wake-up HTML is not a valid API response.
    if (!response.headers.get('content-type')?.includes('application/json')) throw failure('CATALOG_INVALID_RESPONSE', 'The catalog is starting or returned an invalid response. Please retry shortly.');
    const reader = response.body?.getReader();
    if (!reader) throw failure('CATALOG_INVALID_RESPONSE', 'The catalog returned an empty response.');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 1_000_000) { await reader.cancel(); throw failure('CATALOG_INVALID_RESPONSE', 'The catalog response exceeded the supported size.'); }
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error: any) {
    if (String(error?.code || '').startsWith('CATALOG_')) throw error;
    throw failure('CATALOG_UNAVAILABLE', 'Could not reach the product catalog. No current price or availability was verified.', 503);
  }
}
function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw failure('CATALOG_INVALID_RESPONSE', 'The catalog returned invalid product data.');
  return value.trim();
}
function price(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value)) throw failure('CATALOG_INVALID_RESPONSE', 'The catalog returned an invalid price.');
  return value;
}
function availability(value: unknown): string {
  if (typeof value !== 'string' || !AVAILABILITY.has(value)) throw failure('CATALOG_INVALID_RESPONSE', 'The catalog returned an invalid availability value.');
  return value;
}
export function parseCatalogProduct(row: any): CatalogProduct {
  if (!row || !UUID.test(row.id) || !CURRENCIES.has(row.currency)) throw failure('CATALOG_INVALID_RESPONSE', 'The catalog returned invalid product data.');
  const product: CatalogProduct = { id: row.id, name: text(row.name, 160), price: price(row.price), currency: row.currency,
    availability: availability(row.availability), category: row.category ? { name: text(row.category.name, 100), slug: text(row.category.slug, 100) } : null,
    url: `${catalogBaseUrl()}/products/${row.id}` };
  if (typeof row.description === 'string') product.description = row.description.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 4000).trim();
  if (Array.isArray(row.variants)) product.variants = row.variants.slice(0, 30).map((variant: any) => ({
    title: text(variant.title, 300), price: price(variant.price), availability: availability(variant.availability),
    stockQuantity: Number.isSafeInteger(variant.stockQuantity) && variant.stockQuantity >= 0 ? variant.stockQuantity : null,
  }));
  return product;
}
export async function getCatalogInfo() {
  const body = await readCatalog('/api/catalog/config');
  const businessName = text(body?.data?.businessName, 100);
  const number = body?.data?.whatsappNumber;
  return { businessName, catalogUrl: catalogBaseUrl(), whatsappUrl: typeof number === 'string' && /^[1-9]\d{6,14}$/.test(number) ? `https://wa.me/${number}` : null,
    checkedAt: new Date().toISOString(), policyAvailable: false, orderTrackingAvailable: false };
}
export async function getCatalogCategories() {
  const body = await readCatalog('/api/categories');
  if (!Array.isArray(body?.data)) throw failure('CATALOG_INVALID_RESPONSE', 'The catalog returned invalid categories.');
  return { categories: body.data.slice(0, 100).map((row: any) => ({ name: text(row.name, 100), slug: text(row.slug, 100) })), checkedAt: new Date().toISOString() };
}
export interface CatalogSearch { query?: string; category?: string; availability?: string; sort?: string; max_price?: number; currency?: string; }
export async function searchCatalog(args: CatalogSearch = {}) {
  if (!args || typeof args !== 'object') throw failure('INVALID_CATALOG_QUERY', 'Provide a product search.', 400);
  if (args.query !== undefined && (typeof args.query !== 'string' || args.query.length > 100)) throw failure('INVALID_CATALOG_QUERY', 'Search text must be at most 100 characters.', 400);
  if (args.category !== undefined && (typeof args.category !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.category) || args.category.length > 100)) throw failure('INVALID_CATALOG_QUERY', 'Use a category slug returned by the category tool.', 400);
  const sort = args.sort || 'featured';
  if (!['featured', 'newest', 'price_asc', 'price_desc', 'name_asc'].includes(sort)) throw failure('INVALID_CATALOG_QUERY', 'Unsupported product sorting.', 400);
  if (args.availability && !['all', 'in_stock', 'not_in_stock'].includes(args.availability)) throw failure('INVALID_CATALOG_QUERY', 'Unsupported availability filter.', 400);
  if (args.max_price !== undefined && (!Number.isFinite(args.max_price) || args.max_price < 0)) throw failure('INVALID_CATALOG_QUERY', 'Budget must be a non-negative number.', 400);
  if (args.currency !== undefined && !CURRENCIES.has(args.currency)) throw failure('INVALID_CATALOG_QUERY', 'Unsupported budget currency.', 400);
  if (args.max_price !== undefined && !args.currency) throw failure('INVALID_CATALOG_QUERY', 'Specify the customer’s budget currency; do not compare different currencies.', 400);
  const query: Record<string, string> = { limit: '48', sort };
  if (args.query?.trim()) query.q = args.query.trim();
  if (args.category) query.category = args.category;
  if (args.availability && args.availability !== 'all') query.available = String(args.availability === 'in_stock');
  const products: CatalogProduct[] = []; let total = 0; let totalPages = 1; let pagesRead = 0;
  // The upstream API has no budget filter. Bound traversal and explicitly report
  // incomplete coverage rather than pretending a partial search is exhaustive.
  for (let page = 1; page <= Math.min(totalPages, 2); page++) {
    const body = await readCatalog('/api/products', { ...query, page: String(page) });
    if (!Array.isArray(body?.data) || !Number.isSafeInteger(body?.pagination?.total) || body.pagination.total < 0 || !Number.isSafeInteger(body?.pagination?.totalPages) || body.pagination.totalPages < 0) throw failure('CATALOG_INVALID_RESPONSE', 'The catalog returned invalid search results.');
    total = body.pagination.total; totalPages = body.pagination.totalPages; pagesRead++;
    products.push(...body.data.map(parseCatalogProduct));
    if ((args.max_price === undefined && !args.currency) || products.filter(product => (!args.currency || product.currency === args.currency) && (args.max_price === undefined || Number(product.price) <= args.max_price)).length >= 8) break;
  }
  const matches = products.filter(product => (!args.currency || product.currency === args.currency) && (args.max_price === undefined || Number(product.price) <= args.max_price));
  return { products: matches.slice(0, 8), totalBeforeBudgetFilter: total, complete: pagesRead >= totalPages && matches.length <= 8,
    checkedAt: new Date().toISOString(), source: catalogBaseUrl(), note: 'Availability is the catalog’s published status; it is not a reservation or a guarantee of physical inventory. Results may be limited.' };
}
export async function getCatalogProduct(productId: string) {
  if (typeof productId !== 'string' || !UUID.test(productId)) throw failure('INVALID_PRODUCT_ID', 'Use a product ID returned by catalog search.', 400);
  const body = await readCatalog(`/api/products/${encodeURIComponent(productId)}`);
  const product = parseCatalogProduct(body?.data);
  if (product.id !== productId) throw failure('CATALOG_INVALID_RESPONSE', 'The catalog returned a different product.');
  return { product, checkedAt: new Date().toISOString(), source: catalogBaseUrl() };
}
