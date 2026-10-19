import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import app from '../src/app';

let server: Server;
let baseUrl: string;

describe('HTTP API Endpoints - Phase 1 & Phase 2', () => {
  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('GET /api/health (Preserved from Phase 1)', () => {
    it('should return HTTP 200 with success: true', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.message, 'Aura AI Voice Agent API is running');
      assert.equal(data.readiness.provider, 'GEMINI');
      assert.equal(typeof data.readiness.aiConfigured, 'boolean');
      assert.equal(data.readiness.orderConnected, false);
    });
  });

  describe('GET /api/orders/test', () => {
    it('should return all three mock orders with success: true envelope', async () => {
      const res = await fetch(`${baseUrl}/api/orders/test`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(Array.isArray(body.data), true);
      assert.equal(body.data.length, 3);
      assert.equal(body.data[0].orderId, 'ORD-101');
      assert.equal(body.data[1].orderId, 'ORD-102');
      assert.equal(body.data[2].orderId, 'ORD-103');
    });
  });

  describe('GET /api/orders/:orderId', () => {
    it('should return ORD-101 details for valid ID', async () => {
      const res = await fetch(`${baseUrl}/api/orders/ORD-101`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.orderId, 'ORD-101');
      assert.equal(body.data.customer, 'Priya Sharma');
      assert.equal(body.data.courier, 'BlueDart');
      assert.equal(body.data.isScenarioData, true);
    });

    it('should normalize lowercase order IDs (ord-102)', async () => {
      const res = await fetch(`${baseUrl}/api/orders/ord-102`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.orderId, 'ORD-102');
      assert.equal(body.data.customer, 'Rahul Verma');
    });

    it('should return HTTP 404 for unknown order ID (ORD-999)', async () => {
      const res = await fetch(`${baseUrl}/api/orders/ORD-999`);
      assert.equal(res.status, 404);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'NOT_FOUND');
    });

    it('should return HTTP 400 for malformed order ID (BAD_ID)', async () => {
      const res = await fetch(`${baseUrl}/api/orders/BAD_ID`);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'INVALID_ORDER_ID');
    });
  });

  describe('GET /api/policies', () => {
    it('should return Aura Skincare published brand policies', async () => {
      const res = await fetch(`${baseUrl}/api/policies`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.brand.name, 'Aura Skincare');
      assert.equal(body.data.shipping.freeShippingThresholdInr, 499);
      assert.equal(body.data.cashOnDelivery.maxThresholdInr, 2500);
    });
  });

  describe('POST /api/policies/evaluate', () => {
    it('should evaluate SHIPPING for ₹699 (free shipping)', async () => {
      const res = await fetch(`${baseUrl}/api/policies/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyType: 'SHIPPING', orderValueInr: 699 }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'eligible');
      assert.equal(body.data.policyCode, 'FREE_SHIPPING');
    });

    it('should evaluate SHIPPING boundary for exactly ₹499 (UNSPECIFIED_POLICY_BOUNDARY)', async () => {
      const res = await fetch(`${baseUrl}/api/policies/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyType: 'SHIPPING', orderValueInr: 499 }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'unspecified');
      assert.equal(body.data.policyCode, 'UNSPECIFIED_POLICY_BOUNDARY');
    });

    it('should evaluate CANCELLATION for Processing (eligible)', async () => {
      const res = await fetch(`${baseUrl}/api/policies/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyType: 'CANCELLATION', orderStatus: 'Processing' }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'eligible');
      assert.equal(body.data.policyCode, 'CANCELLATION_ELIGIBLE');
    });

    it('should evaluate CANCELLATION for Out for Delivery (ineligible, doorstep refusal allowed)', async () => {
      const res = await fetch(`${baseUrl}/api/policies/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyType: 'CANCELLATION', orderStatus: 'Out for Delivery' }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'ineligible');
      assert.equal(body.data.policyCode, 'CANCELLATION_INELIGIBLE_IN_TRANSIT');
      assert.equal(body.data.details.doorstepRefusalAllowed, true);
    });

    it('should evaluate RETURN for delivered 14 days ago (ineligible - window expired)', async () => {
      const res = await fetch(`${baseUrl}/api/policies/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyType: 'RETURN',
          daysSinceDelivery: 14,
          isUnopened: true,
          isUnused: true,
          hasOriginalPackaging: true,
        }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'ineligible');
      assert.equal(body.data.policyCode, 'RETURN_WINDOW_EXPIRED');
    });

    it('should evaluate COD for ₹2500 (eligible) vs ₹2501 (ineligible)', async () => {
      const res2500 = await fetch(`${baseUrl}/api/policies/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyType: 'COD', orderValueInr: 2500 }),
      });
      const body2500 = await res2500.json();
      assert.equal(body2500.data.status, 'eligible');

      const res2501 = await fetch(`${baseUrl}/api/policies/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyType: 'COD', orderValueInr: 2501 }),
      });
      const body2501 = await res2501.json();
      assert.equal(body2501.data.status, 'ineligible');
      assert.equal(body2501.data.policyCode, 'COD_THRESHOLD_EXCEEDED');
    });

    it('should return HTTP 400 for missing policyType', async () => {
      const res = await fetch(`${baseUrl}/api/policies/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'INVALID_POLICY_TYPE');
    });
  });

  describe('Route 404 Catch-All', () => {
    it('should return HTTP 404 JSON for unknown API routes', async () => {
      const res = await fetch(`${baseUrl}/api/non-existent-endpoint`);
      assert.equal(res.status, 404);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'ROUTE_NOT_FOUND');
    });
  });
});
