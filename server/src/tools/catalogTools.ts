import type { ToolDefinition } from './toolRegistry';
import { searchCatalog, getCatalogProduct, getCatalogCategories, getCatalogInfo } from '../services/catalog.service';

export const CATALOG_TOOLS: Record<string, ToolDefinition> = {
  search_catalog: { name: 'search_catalog', description: 'Read the current public product catalog. Use for product names, price, published availability and budget searches. Search q matches name/SKU; use category slugs from get_catalog_categories to browse a category. Empty query browses products. No mutations or purchases.',
    parameters: { type: 'object', properties: {
      query: { type: 'string', description: 'Short product name or SKU, not a full customer question. Omit to browse a category.' },
      category: { type: 'string', description: 'Exact slug returned by get_catalog_categories. Never guess the slug.' },
      availability: { type: 'string', description: 'Published stock filter.', enum: ['all', 'in_stock', 'not_in_stock'] },
      sort: { type: 'string', description: 'Sort the result set.', enum: ['featured', 'newest', 'price_asc', 'price_desc', 'name_asc'] },
      max_price: { type: 'number', description: 'Optional maximum displayed price in the product currency; do not convert currencies or assume all prices are INR.' },
      currency: { type: 'string', description: 'Required with max_price. Use the customer’s requested currency.', enum: ['INR', 'USD', 'EUR', 'GBP'] },
    }, required: [] }, execute: searchCatalog },
  get_catalog_product: { name: 'get_catalog_product', description: 'Read fresh details, description and publicly listed variants for a product ID obtained from search or verified conversation context. Use for follow-up questions and recheck prices/availability.',
    parameters: { type: 'object', properties: { product_id: { type: 'string', description: 'Exact UUID returned by catalog search.' } }, required: ['product_id'] }, execute: args => getCatalogProduct(args.product_id) },
  get_catalog_categories: { name: 'get_catalog_categories', description: 'Read current public categories and their exact slugs before searching a category.',
    parameters: { type: 'object', properties: {}, required: [] }, execute: getCatalogCategories },
  get_catalog_info: { name: 'get_catalog_info', description: 'Read the published business name, catalog link and verified WhatsApp enquiry link. This does not send an enquiry. No store policies or order tracking are available through this API.',
    parameters: { type: 'object', properties: {}, required: [] }, execute: getCatalogInfo },
};
