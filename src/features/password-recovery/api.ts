import { apiUrl, requestJson } from '@/lib/api';
import { resetCredentials, type ResetCredentials } from '@/utils/reset-link';
import { clearTokenStateIfCurrent, getTokenSnapshot } from '@/features/sign-in/token-state';
import { isRecoveryEmail, isRecoveryPassword } from '@/features/password-recovery/validation';

export class PasswordRecoveryError extends Error {
  constructor(message: string, public readonly invalidLink = false) {
    super(message);
    this.name = 'PasswordRecoveryError';
  }
}

async function requestRecovery(method: 'POST' | 'PATCH', body: object): Promise<string> {
  if (!apiUrl) throw new PasswordRecoveryError('서버 주소가 설정되지 않았습니다.');
  const { response, payload } = await requestJson(`${apiUrl}/api/user/forgot-password`, body, method).catch(() => {
    throw new PasswordRecoveryError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.');
  });
  const message = typeof payload?.message === 'string' ? payload.message : null;
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
  // An unreadable local store must not prevent changing the password on the server.
  // undefined means identity could not be checked; null means no account is signed in.
  const startingToken = await getTokenSnapshot().catch(() => undefined);
  const message = await requestRecovery('PATCH', { ...credentials, newPassword });
  const cleanupFailureMessage = `${message}\n기기에 저장된 로그인 정보를 삭제하지 못했습니다. 다시 로그인해주세요.`;
  if (startingToken === undefined) return cleanupFailureMessage;
  try {
    const currentToken = await getTokenSnapshot();
    // A delayed reset must not sign out another account or a newer sign-in. Token refresh
    // keeps the generation, so the reset account's rotated credentials are still removed.
    if (startingToken && currentToken && startingToken.generation === currentToken.generation
      && currentToken.tokenState.user.identifyCode === credentials.identifyCode) {
      await clearTokenStateIfCurrent(currentToken);
    }
  } catch {
    // The server has already consumed the link; this is still a successful reset.
    return cleanupFailureMessage;
  }
  return message;
}
