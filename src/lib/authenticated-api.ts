import { isAxiosError } from 'axios';

import { apiClient, apiUrl } from '@/lib/api';
import {
  clearTokenStateIfCurrent, getTokenSnapshot, isCurrentTokenState, replaceTokens,
  type TokenSnapshot,
} from '@/features/sign-in/token-state';

export class AuthenticationRequiredError extends Error {
  constructor() { super('다시 로그인해주세요.'); this.name = 'AuthenticationRequiredError'; }
}

function cancelled() { const error = new Error('요청이 취소되었습니다.'); error.name = 'AbortError'; return error; }

async function authenticationFailure() {
  // An obsolete request must not send a newer login back to the welcome screen.
  return await getTokenSnapshot()
    ? new Error('로그인 정보가 변경되었습니다. 다시 시도해주세요.')
    : new AuthenticationRequiredError();
}

async function request(path: string, snapshot?: TokenSnapshot, signal?: AbortSignal, refresh?: string) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 20_000);
  try {
    return await apiClient.request<unknown>({
      url: path, method: refresh === undefined ? 'GET' : 'POST',
      headers: snapshot ? { Authorization: `Bearer ${snapshot.tokenState.access}` } : undefined,
      data: refresh === undefined ? undefined : { refresh }, signal: controller.signal,
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
    const response = await request('/api/user/token/refresh', undefined, undefined, snapshot.tokenState.refresh);
    if (!isCurrentTokenState(snapshot)) return null;
    if (response.status === 400 || response.status === 401) {
      await clearTokenStateIfCurrent(snapshot);
      throw await authenticationFailure();
    }
    const payload = response.data as Record<string, unknown> | null;
    if (response.status !== 200 || !payload || typeof payload.access !== 'string' || !payload.access
      || (payload.refresh !== undefined && (typeof payload.refresh !== 'string' || !payload.refresh))) {
      throw new Error('로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
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

export async function authenticatedGet(path: string, signal?: AbortSignal) {
  // Reject encoded path separators, dot traversal, protocol-relative and absolute URLs.
  if (!apiUrl || !/^\/api\/[A-Za-z0-9/_-]+(?:\?[^#\\]*)?$/.test(path)
    || /%(?:2f|5c|2e)/i.test(path) || path.includes('..')) {
    throw new Error('올바르지 않은 API 경로입니다.');
  }
  if (signal?.aborted) throw cancelled();
  let snapshot = await getTokenSnapshot();
  if (!snapshot) throw new AuthenticationRequiredError();
  let response = await request(path, snapshot, signal);
  if (!isCurrentTokenState(snapshot)) {
    const latest = await getTokenSnapshot();
    // Only a concurrent refresh for the same account may supply the retry token.
    if (!latest) throw new AuthenticationRequiredError();
    if (latest.generation !== snapshot.generation) throw new Error('로그인 정보가 변경되었습니다. 다시 시도해주세요.');
    snapshot = latest;
  }
  if (response.status === 401) {
    if (signal?.aborted) throw cancelled();
    if (response.config.headers.get('Authorization') === `Bearer ${snapshot.tokenState.access}`) {
      snapshot = await waitForRefresh(refreshTokens(snapshot), signal);
      if (!snapshot) throw await authenticationFailure();
    }
    if (signal?.aborted) throw cancelled();
    response = await request(path, snapshot, signal);
    if (response.status === 401) {
      await clearTokenStateIfCurrent(snapshot);
      throw await authenticationFailure();
    }
  }
  if (!isCurrentTokenState(snapshot)) throw new Error('로그인 정보가 변경되었습니다. 다시 시도해주세요.');
  const payload = response.data && typeof response.data === 'object' && !Array.isArray(response.data)
    ? response.data as Record<string, unknown> : null;
  return { response: { status: response.status, ok: response.status >= 200 && response.status < 300 }, payload };
}
