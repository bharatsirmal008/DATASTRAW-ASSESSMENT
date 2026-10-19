import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import app from '../src/app';
import { getServiceReadiness } from '../src/services/readiness.service';
import { getAIProvider } from '../src/services/conversation.service';
import { executeTool, getAvailableTools } from '../src/tools/toolRegistry';
import { get_order_details } from '../src/tools/getOrderDetails';
import { assessmentOrders } from '../src/data/assessmentOrders';

let server: Server;
let url: string;
const names = ['NODE_ENV', 'APP_MODE', 'CATALOG_API_URL', 'SUPPORT_BRAND_NAME', 'AI_PROVIDER'];
const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
before(async () => {
  Object.assign(process.env, { NODE_ENV: 'production', APP_MODE: 'assessment', CATALOG_API_URL: 'https://store.example', SUPPORT_BRAND_NAME: 'JoJo Store', AI_PROVIDER: 'demo' });
  await new Promise<void>(resolve => { server = app.listen(0, () => { url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; resolve(); }); });
});
after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
});

it('isolates the assessment brand and tools from saved store settings', () => {
  const readiness = getServiceReadiness();
  assert.equal(readiness.brandName, 'Aura Skincare');
  assert.equal(readiness.applicationMode, 'assessment');
  assert.equal(readiness.orderConnected, true);
  assert.equal(readiness.catalogConfigured, false);
  assert.ok(getAvailableTools().get_order_details);
  assert.ok(getAvailableTools().get_brand_policies);
  assert.equal(getAvailableTools().search_catalog, undefined);
  assert.equal(getAIProvider().mode, 'GEMINI');
});
it('serves all three PDF orders with full scenario details outside the test environment', async () => {
  const response = await fetch(`${url}/api/orders/test`);
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.deepEqual(data, assessmentOrders);
  assert.deepEqual(data.map((order: any) => order.orderId), ['ORD-101', 'ORD-102', 'ORD-103']);
  assert.equal(data[0].trackingNumber, 'BD-982103');
  assert.equal(data[1].valueInr, 499);
  assert.equal(data[2].status, 'Processing');
});
it('looks up spoken IDs through the live tool without inventing missing orders', async () => {
  const result = await get_order_details('O R D one zero one');
  assert.ok(result.found);
  if (result.found) assert.equal(result.order.status, 'Out for Delivery');
  assert.equal((await get_order_details('ORD-999')).found, false);
  assert.equal((await get_order_details('')).code, 'INVALID_ORDER_ID');
  assert.equal((await fetch(`${url}/api/orders/ORD-999`)).status, 404);
  assert.equal((await fetch(`${url}/api/orders/invalid`)).status, 400);
});
it('exposes Aura policies and enforces cancellation, return, damage and fee boundaries', async () => {
  assert.equal((await fetch(`${url}/api/policies`)).status, 200);
  assert.equal((await executeTool('check_cancellation_eligibility', { order_status: 'Processing' })).status, 'eligible');
  assert.equal((await executeTool('check_cancellation_eligibility', { order_status: 'Out for Delivery' })).status, 'ineligible');
  assert.equal((await executeTool('check_return_eligibility', { days_since_delivery: 20, is_unopened: false, is_unused: false, has_original_packaging: true })).status, 'ineligible');
  assert.equal((await executeTool('check_damage_replacement_eligibility', { hours_since_delivery: 49, has_photos: true })).status, 'ineligible');
  assert.equal((await executeTool('calculate_shipping_fee', { order_value_inr: 499 })).status, 'unspecified');
  assert.equal((await executeTool('check_cod_eligibility', { order_value_inr: 2501 })).status, 'ineligible');
  const result = await get_order_details('ORD-103');
  assert.ok(result.found && result.order.status === 'Processing');
});
it('keeps saved catalog data unavailable in assessment mode', async () => {
  assert.equal((await fetch(`${url}/api/catalog/status`)).status, 503);
});
