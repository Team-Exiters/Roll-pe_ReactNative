import { create, type AxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';

export const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export const apiClient = create({
  baseURL: apiUrl,
  adapter: Platform.OS === 'web' ? 'fetch' : 'xhr',
  timeout: 20_000,
  withCredentials: false,
  withXSRFToken: false,
  headers: { 'Content-Type': 'application/json' },
  responseType: 'json',
  transitional: { silentJSONParsing: false },
  validateStatus: () => true,
});

export async function requestApi(
  config: Pick<AxiosRequestConfig, 'url' | 'method' | 'data' | 'headers'>, signal?: AbortSignal,
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 20_000);
  try {
    return await apiClient.request<unknown>({ ...config, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export function jsonResult(result: { status: number; data: unknown }) {
  const payload = result.data && typeof result.data === 'object' && !Array.isArray(result.data)
    ? result.data as Record<string, unknown> : null;
  // HTTP failures still carry domain-specific errors for each feature to interpret.
  return { response: { status: result.status, ok: result.status >= 200 && result.status < 300 }, payload };
}

export async function requestJson(
  url: string, body?: object, method: 'GET' | 'POST' | 'PATCH' = 'POST', signal?: AbortSignal,
) {
  return jsonResult(await requestApi({ url, method, data: body }, signal));
}
