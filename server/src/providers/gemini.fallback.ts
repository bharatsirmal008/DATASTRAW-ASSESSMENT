import { providerStatus } from './provider.errors';

/** Shared by chat and summaries. Only quota errors trigger model switching. */
export function createGeminiFallback(now: () => number = Date.now) {
  const unavailableUntil = new Map<string, number>();

  return async function withGeminiFallback<T>(primary: string, request: (model: string) => Promise<T>): Promise<T> {
    // Explicitly empty disables fallback; cap the chain to bound request latency/cost.
    const configured = process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-3.5-flash-lite';
    const models = [...new Set([primary, ...configured.split(',').map(model => model.trim()).filter(Boolean)])].slice(0, 3);
    const available = models.filter(model => (unavailableUntil.get(model) || 0) <= now());
    let lastError: unknown = Object.assign(new Error('Configured Gemini models are cooling down.'), { status: 429 });

    for (const model of available) {
      try {
        const response = await request(model);
        unavailableUntil.delete(model);
        return response;
      } catch (error) {
        if (providerStatus(error) !== 429) throw error;
        lastError = error;
        // Avoid repeatedly spending requests on an exhausted model across turns.
        unavailableUntil.set(model, now() + 60_000);
        console.warn(`[Gemini] ${model} reached its quota; trying the next configured model.`);
      }
    }
    throw lastError;
  };
}

export const withGeminiFallback = createGeminiFallback();
