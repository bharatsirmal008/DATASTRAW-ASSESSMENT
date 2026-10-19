export interface HealthCheckResponse {
  success: boolean;
  message: string;
  readiness?: { ready: boolean; aiConfigured: boolean; orderConnected: boolean; provider: 'GEMINI'; message: string; catalogConfigured?: boolean; brandName?: string; applicationMode?: 'assessment' | 'store' };
}

export interface CatalogConnection {
  connected: boolean; businessName: string; catalogUrl: string; whatsappUrl: string | null; totalProducts: number; checkedAt: string;
}
export async function checkCatalogConnection(): Promise<CatalogConnection> {
  const response = await fetch(`${API_URL}/api/catalog/status`, { signal: AbortSignal.timeout(25000) });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.error?.message || 'Could not connect to the catalog.');
  return body.data;
}

const API_URL = import.meta.env.VITE_API_URL || '';

export async function checkBackendHealth(): Promise<HealthCheckResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${API_URL}/api/health`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data: HealthCheckResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Health check timed out — is the backend running?');
    }
    if (error instanceof TypeError) {
      throw new Error('Cannot reach backend — is the server running on ' + API_URL + '?');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
