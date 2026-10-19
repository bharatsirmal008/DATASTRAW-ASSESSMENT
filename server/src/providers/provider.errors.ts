/** Preserve actionable status without returning provider payloads or credentials. */
export function providerStatus(error: any): number {
  let status = Number(error?.status || error?.code);
  if (!Number.isFinite(status)) {
    try { status = Number(JSON.parse(String(error?.message || '{}'))?.error?.code); } catch { /* SDK may return a plain network message. */ }
  }
  return status;
}

export function providerFailure(error: any, summary = false): Error {
  const status = providerStatus(error);
  if (status === 429) return Object.assign(new Error('The configured AI models have reached their request limits. Please try again later or check your Gemini quota.'), { code: 'AI_RATE_LIMITED', status: 429 });
  return Object.assign(new Error(summary ? 'The AI summary could not be generated. Your transcript is preserved; please retry the summary.' : 'The AI service could not respond. Please try again shortly.'), {
    code: summary ? 'AI_SUMMARY_ERROR' : 'GEMINI_API_ERROR', status: 502,
  });
}
