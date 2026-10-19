import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import orderRoutes from "./routes/order.routes";
import policyRoutes from "./routes/policy.routes";
import conversationRoutes from "./routes/conversation.routes";
import { getServiceReadiness } from './services/readiness.service';
import path from 'node:path';
import { getCatalogInfo, searchCatalog, isCatalogConfigured } from './services/catalog.service';

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Allow frontend to communicate with backend
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN
      ? process.env.CLIENT_ORIGIN.split(',').map(origin => origin.trim())
      : ["http://localhost:5173", "http://127.0.0.1:5173"],
  })
);

// Enable JSON request handling
app.use(express.json({ limit: '32kb' }));
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

// Health check API (Phase 1 preserved)
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Aura AI Voice Agent API is running",
    readiness: getServiceReadiness(),
  });
});

app.get('/api/catalog/status', async (_req, res) => {
  try {
    const info = await getCatalogInfo();
    // Confirm a product response too, not just the configuration endpoint.
    const result = await searchCatalog({ query: '', sort: 'featured' });
    res.json({ success: true, data: { connected: true, ...info, totalProducts: result.totalBeforeBudgetFilter } });
  } catch (error: any) {
    res.status(error.status || 503).json({ success: false, error: { code: error.code || 'CATALOG_UNAVAILABLE', message: error.message || 'The catalog is unavailable.' } });
  }
});

// Phase 2: Order routes
app.use("/api/orders", orderRoutes);

// Phase 2: Policy routes
app.use('/api/policies', (_req, res, next) => {
  if (isCatalogConfigured()) {
    res.status(503).json({ success: false, error: { code: 'POLICIES_NOT_CONFIGURED', message: 'The connected catalog does not publish verified shipping, returns, cancellation or payment policies.' } });
    return;
  }
  next();
}, policyRoutes);

// Phase 3: Conversation routes
app.use("/api/conversations", conversationRoutes);

// 404 handler for unknown API routes (Express 5 named-splat syntax)
app.all("/api/{*path}", (_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "API route not found",
    },
  });
});

// Production serves the built interface and API from the same origin.
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const clientDirectory = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDirectory));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(clientDirectory, 'index.html')));
}

// Global JSON error handling middleware
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Malformed JSON payload provided.",
      },
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected internal server error occurred.",
    },
  });
});

export default app;
