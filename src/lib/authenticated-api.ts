import { isAxiosError } from 'axios';

import { t } from '@/i18n';
import { apiClient, apiUrl } from '@/lib/api';
import {
  clearTokenStateIfCurrent, getTokenSnapshot, isCurrentTokenState, replaceTokens,
  type TokenSnapshot, type TokenState,
} from '@/features/sign-in/token-state';

export class AuthenticationRequiredError extends Error {
  constructor() { super(t('auth.signInAgain')); this.name = 'AuthenticationRequiredError'; }
}

function cancelled() { const error = new Error(t('auth.cancelled')); error.name = 'AbortError'; return error; }

async function authenticationFailure() {
  // An obsolete request must not send a newer login back to the welcome screen.
  return await getTokenSnapshot()
    ? new Error(t('auth.changed'))
    : new AuthenticationRequiredError();
}

type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function request(path: string, snapshot?: TokenSnapshot, signal?: AbortSignal, body?: object,
  method: ApiMethod = body === undefined ? 'GET' : 'POST') {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 20_000);
  try {
    return await apiClient.request<unknown>({
      url: path, method,
      headers: snapshot ? { Authorization: `Bearer ${snapshot.tokenState.access}` } : undefined,
      data: body, signal: controller.signal,
    });
  } catch (error) {
    // Authentication status remains authoritative when its error body is not valid JSON.
    if (isAxiosError<unknown>(error) && error.response
      && (error.response.status === 400 || error.response.status === 401)) return error.response;
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

let refreshing: { generation: number; promise: Promise<TokenSnapshot | null> } | undefined;

function refreshTokens(snapshot: TokenSnapshot) {
  // Rotation changes the revision before persistence completes; keep sharing until it settles.
  if (refreshing?.generation === snapshot.generation) return refreshing.promise;
  const promise = (async () => {
    const response = await request('/api/user/token/refresh', undefined, undefined, { refresh: snapshot.tokenState.refresh });
    if (!isCurrentTokenState(snapshot)) return null;
    if (response.status === 400 || response.status === 401) {
      await clearTokenStateIfCurrent(snapshot);
      throw await authenticationFailure();
    }
    const payload = response.data as Record<string, unknown> | null;
    if (response.status !== 200 || !payload || typeof payload.access !== 'string' || !payload.access
      || (payload.refresh !== undefined && (typeof payload.refresh !== 'string' || !payload.refresh))) {
      throw new Error(t('auth.restoreFailed'));
    }
    return replaceTokens(snapshot, payload.access, (payload.refresh as string | undefined) ?? snapshot.tokenState.refresh);
  })();
  refreshing = { generation: snapshot.generation, promise };
  void promise.finally(() => { if (refreshing?.promise === promise) refreshing = undefined; }).catch(() => {});
  return promise;
}

function waitForRefresh(promise: Promise<TokenSnapshot | null>, signal?: AbortSignal) {
  if (!signal) return promise;
  return new Promise<TokenSnapshot | null>((resolve, reject) => {
    const abort = () => { cleanup(); reject(cancelled()); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

export async function restoreTokenState(signal?: AbortSignal): Promise<TokenState | null> {
  if (signal?.aborted) throw cancelled();
  const snapshot = await getTokenSnapshot();
  if (signal?.aborted) throw cancelled();
  if (!snapshot) return null;
  if (!apiUrl) throw new Error(t('common.serverMissing'));
  try {
    const restored = await waitForRefresh(refreshTokens(snapshot), signal);
    if (signal?.aborted) throw cancelled();
    return restored && isCurrentTokenState(restored) ? restored.tokenState : null;
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return null;
    throw error;
  }
}

async function authenticatedRequest(path: string, signal?: AbortSignal, body?: object,
  method: ApiMethod = body === undefined ? 'GET' : 'POST') {
  // Reject encoded path separators, dot traversal, protocol-relative and absolute URLs.
  const pathname = path.split('?')[0];
  if (!apiUrl || !/^\/api\/[A-Za-z0-9/_-]+(?:\?[^#\\]*)?$/.test(path)
    || /%(?:2f|5c|2e)/i.test(pathname) || pathname.includes('..')) {
    throw new Error(t('auth.invalidApiPath'));
  }
  if (signal?.aborted) throw cancelled();
  let snapshot = await getTokenSnapshot();
  if (!snapshot) throw new AuthenticationRequiredError();
  let response = await request(path, snapshot, signal, body, method);
  if (!isCurrentTokenState(snapshot)) {
    const latest = await getTokenSnapshot();
    // Only a concurrent refresh for the same account may supply the retry token.
    if (!latest) throw new AuthenticationRequiredError();
    if (latest.generation !== snapshot.generation) throw new Error(t('auth.changed'));
    snapshot = latest;
  }
  if (response.status === 401) {
    if (signal?.aborted) throw cancelled();
    if (response.config.headers.get('Authorization') === `Bearer ${snapshot.tokenState.access}`) {
      snapshot = await waitForRefresh(refreshTokens(snapshot), signal);
      if (!snapshot) throw await authenticationFailure();
    }
    if (signal?.aborted) throw cancelled();
    response = await request(path, snapshot, signal, body, method);
    if (response.status === 401) {
      await clearTokenStateIfCurrent(snapshot);
      throw await authenticationFailure();
    }
  }
  if (!isCurrentTokenState(snapshot)) throw new Error(t('auth.changed'));
  const payload = response.data && typeof response.data === 'object' && !Array.isArray(response.data)
    ? response.data as Record<string, unknown> : null;
  return { response: { status: response.status, ok: response.status >= 200 && response.status < 300 }, payload };
}

export function authenticatedGet(path: string, signal?: AbortSignal) {
  return authenticatedRequest(path, signal);
}

export function authenticatedPost(path: string, body: object, signal?: AbortSignal) {
  return authenticatedRequest(path, signal, body);
}

export function authenticatedPatch(path: string, body: object, signal?: AbortSignal) {
  return authenticatedRequest(path, signal, body, 'PATCH');
}

export function authenticatedDelete(path: string, body?: object, signal?: AbortSignal) {
  return authenticatedRequest(path, signal, body, 'DELETE');
}
