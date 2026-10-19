import type { BrandPolicies, PolicyEvaluationResult } from '../types/policy';

const API_URL = import.meta.env.VITE_API_URL || '';

export async function fetchPolicies(): Promise<BrandPolicies> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${API_URL}/api/policies`, {
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Failed to load brand policies (HTTP ${res.status})`);
    }

    const json = await res.json();
    return json.data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function evaluatePolicy(payload: Record<string, unknown>): Promise<PolicyEvaluationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${API_URL}/api/policies/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      if (json && !json.success && json.error) {
        throw new Error(json.error.message);
      }
      throw new Error(`Policy evaluation failed with status ${res.status}`);
    }

    return json.data;
  } finally {
    clearTimeout(timeout);
  }
}
