# Phase 2 — Brand Knowledge, Mock Order Database, Order Tools, & Policy Guardrails

## 1. Overview & Architecture

Phase 2 establishes the deterministic business data, brand knowledge, and policy guardrail foundation for **Aria**, the AI customer support voice agent for **Aura Skincare**. 

In Phase 3, an LLM agent will invoke tools and reason over policies. To prevent hallucinations and enforce strict business logic, Phase 2 implements pure, independently testable services and tools that govern orders and customer policies.

```
┌─────────────────────────────────────────────────────────────┐
│                       Client (React)                        │
│   • Evaluator Sample Cards (ORD-101, ORD-102, ORD-103)      │
│   • Order Lookup Tool (Verified Backend Data)               │
│   • Policy Guardrails Explorer (Interactive Rules Test)     │
│   • Brand Knowledge Display (Aura Skincare Policies)        │
└───────────────▲─────────────────────────────▲───────────────┘
                │                             │
    HTTP GET/POST /api/orders      HTTP GET/POST /api/policies
                │                             │
┌───────────────▼─────────────────────────────▼───────────────┐
│                    Express Backend (API)                    │
│   • /api/health (Phase 1 preserved)                         │
│   • /api/orders/test & /api/orders/:orderId                 │
│   • /api/policies & /api/policies/evaluate                  │
└───────────────▲─────────────────────────────▲───────────────┘
                │                             │
┌───────────────▼────────────────┐ ┌──────────▼───────────────┐
│       Order Service & Tool     │ │      Policy Engine       │
│ • findOrderById()              │ │ • calculateShippingFee() │
│ • get_order_details(order_id)  │ │ • checkCancellation()    │
│ • Mock Orders Fixture (JSON)   │ │ • checkReturn()          │
│ • Trim/Case Normalization      │ │ • checkDamage()          │
│                                │ │ • checkCod()             │
└────────────────────────────────┘ └──────────────────────────┘
```

---

## 2. Directory & Folder Responsibilities

```
aura-ai-voice-agent/
├── server/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── order.controller.ts    # Handlers for /api/orders
│   │   │   └── policy.controller.ts   # Handlers for /api/policies
│   │   ├── data/
│   │   │   ├── mockOrders.json        # Assessment sample fixture (ORD-101..103)
│   │   │   └── mockOrders.ts          # Typed loader/export
│   │   ├── knowledge/
│   │   │   └── brandPolicies.ts       # Structured Aura Skincare brand rules
│   │   ├── routes/
│   │   │   ├── order.routes.ts        # Express routing for orders
│   │   │   └── policy.routes.ts       # Express routing for policies
│   │   ├── services/
│   │   │   ├── order.service.ts       # Normalization & pure lookup engine
│   │   │   └── policy.service.ts      # Deterministic policy guardrails
│   │   ├── tools/
│   │   │   └── getOrderDetails.ts     # Agent tool contract: get_order_details()
│   │   ├── types/
│   │   │   └── order.types.ts         # TypeScript interfaces & unions
│   │   ├── app.ts                     # Express config & middleware
│   │   └── server.ts                  # Server entry point
│   └── tests/
│       ├── orders.test.ts             # Unit tests for orders & lookup tool
│       ├── policies.test.ts           # Unit tests for policy boundaries
│       └── api.test.ts                # HTTP integration tests
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TestOrders.tsx         # Sample order cards
│   │   │   ├── OrderLookup.tsx        # Search form & validation
│   │   │   ├── OrderDetails.tsx       # Verified details display
│   │   │   ├── BrandPolicies.tsx      # Published brand policy cards
│   │   │   └── PolicyExplorer.tsx     # Interactive policy tester
│   │   ├── services/
│   │   │   ├── api.ts                 # Health check service (Phase 1)
│   │   │   ├── orders.api.ts          # Order API client
│   │   │   └── policies.api.ts        # Policy API client
│   │   ├── types/                     # Frontend TypeScript types
│   │   └── App.tsx                    # Main Phase 2 application view
├── docs/
│   └── PHASE_2.md                     # This document
└── README.md                          # Main project guide
```

---

## 3. How to Start

### Prerequisites
- Node.js ≥ 18 (Tested on Node v26.7.0)
- npm ≥ 9

### Step 1: Start Backend Server
```bash
cd server
npm run dev
```
Backend runs at `http://localhost:5000`.

### Step 2: Start Frontend Application
```bash
cd client
npm run dev
```
Frontend runs at `http://localhost:5173`.

### Step 3: Run Automated Test Suite
```bash
cd server
npm test
```
Executes all 48 unit and integration tests across order services, boundary conditions, and HTTP routes.

---

## 4. API Endpoints Reference

### 1. `GET /api/health` (Preserved from Phase 1)
- **Status:** `200 OK`
- **Response:**
```json
{
  "success": true,
  "message": "Aura AI Voice Agent API is running"
}
```

---

### 2. `GET /api/orders/test`
Returns the 3 assessment scenario orders for evaluator convenience.
- **Status:** `200 OK`
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "orderId": "ORD-101",
      "customer": "Priya Sharma",
      "product": "Vitamin C Serum (30ml)",
      "valueInr": 699,
      "status": "Out for Delivery",
      "courier": "BlueDart",
      "trackingNumber": "BD-982103",
      "estimatedDelivery": "Expected by 6 PM today (assessment scenario only)",
      "isScenarioData": true
    },
    {
      "orderId": "ORD-102",
      "customer": "Rahul Verma",
      "product": "Hydrating Sunscreen SPF 50",
      "valueInr": 499,
      "status": "Delivered",
      "courier": "Delhivery",
      "trackingNumber": "DL-441029",
      "delivered": "14 days ago (assessment scenario only)",
      "isScenarioData": true
    },
    {
      "orderId": "ORD-103",
      "customer": "Ananya Patel",
      "product": "Green Tea Face Wash + Toner",
      "valueInr": 850,
      "status": "Processing",
      "note": "Ordered 3 hours ago; eligible for cancellation (assessment scenario only)",
      "isScenarioData": true
    }
  ]
}
```

---

### 3. `GET /api/orders/:orderId`
Retrieves a single order by ID with case-normalization and whitespace trimming.

#### Success (`200 OK`):
`GET /api/orders/ord-101`
```json
{
  "success": true,
  "data": {
    "orderId": "ORD-101",
    "customer": "Priya Sharma",
    "product": "Vitamin C Serum (30ml)",
    "valueInr": 699,
    "status": "Out for Delivery",
    "courier": "BlueDart",
    "trackingNumber": "BD-982103",
    "estimatedDelivery": "Expected by 6 PM today (assessment scenario only)",
    "isScenarioData": true
  }
}
```

#### Unknown Order (`404 Not Found`):
`GET /api/orders/ORD-999`
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Order with ID \"ORD-999\" was not found in the Aura Skincare database."
  }
}
```

#### Malformed Order ID (`400 Bad Request`):
`GET /api/orders/INVALID_ID`
```json
{
  "success": false,
  "error": {
    "code": "INVALID_ORDER_ID",
    "message": "Invalid Order ID format \"INVALID_ID\". Expected format like ORD-101."
  }
}
```

---

### 4. `GET /api/policies`
Returns brand overview and published policies.
- **Status:** `200 OK`
- **Response excerpt:**
```json
{
  "success": true,
  "data": {
    "brand": {
      "name": "Aura Skincare",
      "description": "Aura Skincare is a premium organic Indian skincare brand focused on simple, effective skincare made from thoughtfully selected ingredients."
    },
    "shipping": {
      "freeShippingThresholdInr": 499,
      "standardShippingFeeInr": 50,
      "deliveryTimeframe": "3–5 business days"
    },
    "cancellation": {
      "cancellableStatuses": ["Processing"],
      "nonCancellableStatuses": ["Shipped", "Out for Delivery", "Delivered"],
      "doorstepRefusalAllowed": true
    },
    "returns": {
      "windowDays": 7,
      "acceptedConditions": ["unopened", "unused", "in original packaging"]
    },
    "cashOnDelivery": {
      "maxThresholdInr": 2500,
      "acceptedPaymentModes": ["Cash", "UPI"]
    }
  }
}
```

---

### 5. `POST /api/policies/evaluate`
Discriminated policy evaluation endpoint.

#### Example A: Shipping for ₹499 (Ambiguous Boundary)
**Request:**
```json
{
  "policyType": "SHIPPING",
  "orderValueInr": 499
}
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "status": "unspecified",
    "policyCode": "UNSPECIFIED_POLICY_BOUNDARY",
    "message": "The Aura Skincare policy does not specify shipping rates for orders of exactly ₹499. Please confirm with support.",
    "details": {}
  }
}
```

#### Example B: Cancellation for "Out for Delivery"
**Request:**
```json
{
  "policyType": "CANCELLATION",
  "orderStatus": "Out for Delivery"
}
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "status": "ineligible",
    "policyCode": "CANCELLATION_INELIGIBLE_IN_TRANSIT",
    "message": "Orders that are Out for Delivery cannot be cancelled once dispatched. However, customers may refuse delivery at the doorstep.",
    "details": {
      "doorstepRefusalAllowed": true
    }
  }
}
```

---

## 5. Architectural & Design Decisions

### 1. In-Memory Mock Database vs MongoDB
- The assessment specifies three exact sample records.
- Storing them in a local typed JSON fixture guarantees zero external database setup, deterministic test runs, and instant evaluator reproducibility.
- The service interface (`findOrderById`, `get_order_details`) is decoupled from the underlying storage, so a real MongoDB/Postgres repository can be swapped in without modifying controllers or tools.

### 2. Eligibility Checking vs Mutating Actions
- Checking cancellation eligibility (`checkCancellationEligibility`) is strictly **idempotent and read-only**.
- Evaluating ORD-103 indicates it is *eligible* for cancellation, but does not cancel or mutate the record. State transitions (e.g. cancellation execution) are reserved for a dedicated action layer.

### 3. Exact ₹499 Shipping Ambiguity
- The brand policy states:
  - Free shipping strictly above ₹499 (`> 499`)
  - ₹50 fee strictly below ₹499 (`< 499`)
- Rather than fabricating a rule for exactly ₹499, the policy engine explicitly returns `UNSPECIFIED_POLICY_BOUNDARY` with status `'unspecified'`. This ensures the AI agent will ask for clarification or escalate rather than hallucinate a fee.

### 4. Assessment Fixture & Relative Date Caveats
- Relative dates such as *"Expected by 6 PM today"*, *"14 days ago"*, and *"Ordered 3 hours ago"* are explicitly tagged as `isScenarioData: true`.
- Dynamic courier tracking is not simulated or faked.

---

## 6. What Remains for Phase 3

- **AI Voice Agent Core**: Speech-to-Text (STT) and Text-to-Speech (TTS) integration.
- **LLM Function Calling Adapter**: Connecting the `get_order_details(order_id)` tool and policy evaluation engine directly to LLM tool-calling schemas.
- **Conversational State & Memory**: Turn-taking, interruptions, and session context.
- **Live Call UI**: Enabling the currently disabled "Start Call" and "End Call" placeholders.
