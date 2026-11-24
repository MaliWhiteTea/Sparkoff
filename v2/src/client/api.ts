let csrfToken = sessionStorage.getItem('sparkoff-csrf') || '';
import { demoApi } from './demo';
export function setCsrf(value: string) { csrfToken = value; sessionStorage.setItem('sparkoff-csrf', value); }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (import.meta.env.VITE_DEMO_MODE === 'true') return demoApi<T>(path, options);
  const method = options.method || 'GET';
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...options, headers: { ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...(!['GET', 'HEAD'].includes(method) ? { 'x-csrf-token': csrfToken } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data as T;
}
