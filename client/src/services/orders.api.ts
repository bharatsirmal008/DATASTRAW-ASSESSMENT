import type { MockOrder, ApiSuccessResponse, ApiErrorResponse } from '../types/order';

const API_URL = import.meta.env.VITE_API_URL || '';

export async function fetchTestOrders(): Promise<MockOrder[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${API_URL}/api/orders/test`, {
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorData: ApiErrorResponse = await res.json().catch(() => ({
        success: false,
        error: { code: 'HTTP_ERROR', message: `Server returned HTTP ${res.status}` },
      }));
      throw new Error(errorData.error.message || `HTTP error ${res.status}`);
    }

    const data: ApiSuccessResponse<MockOrder[]> = await res.json();
    return data.data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchOrderById(orderId: string): Promise<MockOrder> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const trimmed = orderId.trim();
    const res = await fetch(`${API_URL}/api/orders/${encodeURIComponent(trimmed)}`, {
      signal: controller.signal,
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      if (body && !body.success && body.error) {
        const error = new Error(body.error.message);
        (error as Error & { code?: string }).code = body.error.code;
        throw error;
      }
      throw new Error(`Failed to fetch order (HTTP ${res.status})`);
    }

    const data = body as ApiSuccessResponse<MockOrder>;
    return data.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Order lookup request timed out. Please check backend connection.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
