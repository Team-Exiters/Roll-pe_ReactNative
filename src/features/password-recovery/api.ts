import { apiUrl } from '../sign-in/api';
import { clearSession } from '../sign-in/session';
import { isRecoveryEmail, isRecoveryPassword, resetCredentials, type ResetCredentials } from './validation';

export class PasswordRecoveryError extends Error {
  constructor(message: string, public readonly invalidLink = false) {
    super(message);
    this.name = 'PasswordRecoveryError';
  }
}

async function requestRecovery(method: 'POST' | 'PATCH', body: object): Promise<string> {
  if (!apiUrl) throw new PasswordRecoveryError('서버 주소가 설정되지 않았습니다.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(`${apiUrl}/api/user/forgot-password`, {
      method, headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
      signal: controller.signal, body: JSON.stringify(body),
    });
    payload = await response.json();
  } catch {
    throw new PasswordRecoveryError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.');
  } finally {
    clearTimeout(timer);
  }
  const message = payload && typeof payload === 'object' && 'message' in payload
    && typeof payload.message === 'string' ? payload.message : null;
  if (!response.ok) {
    // Invalid, expired, and already-used reset links all require a fresh email.
    throw new PasswordRecoveryError(message || '요청을 처리하지 못했습니다. 다시 시도해주세요.',
      method === 'PATCH' && [400, 403, 404, 410].includes(response.status));
  }
  if (!message) throw new PasswordRecoveryError('서버 응답을 확인할 수 없습니다. 다시 시도해주세요.');
  return message;
}

export function requestPasswordEmail(email: string) {
  if (!isRecoveryEmail(email)) throw new PasswordRecoveryError('이메일을 다시 확인하세요.');
  return requestRecovery('POST', { email: email.trim() });
}

export async function resetPassword(credentials: ResetCredentials, newPassword: string) {
  if (!resetCredentials(credentials)) throw new PasswordRecoveryError('올바르지 않은 인증 링크입니다.', true);
  if (!isRecoveryPassword(newPassword)) throw new PasswordRecoveryError('새 비밀번호 형식을 확인해주세요.');
  const message = await requestRecovery('PATCH', { ...credentials, newPassword });
  try {
    await clearSession();
  } catch {
    // The server has already consumed the link; this is still a successful reset.
    return `${message}\n기기에 저장된 로그인 정보를 삭제하지 못했습니다. 다시 로그인해주세요.`;
  }
  return message;
}
