import { isAssessmentMode, supportBrandName } from '../config/application';
import { isCatalogConfigured } from './catalog.service';

/** Public capabilities only: never expose credentials or environment values. */
export function getServiceReadiness() {
  const aiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  return {
    ready: aiConfigured,
    aiConfigured,
    orderConnected: isAssessmentMode(),
    applicationMode: isAssessmentMode() ? 'assessment' : 'store',
    provider: 'GEMINI' as const,
    catalogConfigured: isCatalogConfigured(),
    brandName: supportBrandName(),
    message: aiConfigured
      ? isAssessmentMode() ? 'Live AI with the three supplied assessment orders.' : 'AI support is configured. Order tracking will be available after the store connection is added.'
      : 'AI support is not available yet. Configure the server-side Gemini API key to enable conversations.',
  };
}

export function requireLiveAI(): void {
  if (process.env.NODE_ENV === 'test') return;
  if (!getServiceReadiness().aiConfigured) {
    throw Object.assign(new Error('AI support is not configured. Add GEMINI_API_KEY to server/.env on the server.'), {
      code: 'AI_NOT_CONFIGURED', status: 503,
    });
  }
}
