import { t } from '@/i18n';
import { apiUrl, requestJson } from '@/lib/api';
import { resetCredentials, type ResetCredentials } from '@/utils/reset-link';
import { clearTokenStateIfCurrent, getTokenSnapshot } from '@/features/sign-in/token-state';
import { isRecoveryEmail, isRecoveryPassword } from '@/features/password-recovery/validation';

export class PasswordRecoveryError extends Error {
  constructor(
    message: string,
    public readonly invalidLink = false,
  ) {
    super(message);
    this.name = 'PasswordRecoveryError';
  }
}

async function requestRecovery(method: 'POST' | 'PATCH', body: object): Promise<string> {
  if (!apiUrl) throw new PasswordRecoveryError(t('common.serverMissing'));
  const { response, payload } = await requestJson(
    `${apiUrl}/api/user/forgot-password`,
    body,
    method,
  ).catch(() => {
    throw new PasswordRecoveryError(t('common.networkError'));
  });
  const message = typeof payload?.message === 'string' ? payload.message : null;
  if (!response.ok) {
    // Invalid, expired, and already-used reset links all require a fresh email.
    throw new PasswordRecoveryError(
      message || t('common.requestFailed'),
      method === 'PATCH' && [400, 403, 404, 410].includes(response.status),
    );
  }
  if (!message) throw new PasswordRecoveryError(t('common.responseInvalid'));
  return message;
}

export function requestPasswordEmail(email: string) {
  if (!isRecoveryEmail(email)) throw new PasswordRecoveryError(t('validation.email'));
  return requestRecovery('POST', { email: email.trim() });
}

export async function resetPassword(credentials: ResetCredentials, newPassword: string) {
  if (!resetCredentials(credentials))
    throw new PasswordRecoveryError(t('recovery.invalidCredentials'), true);
  if (!isRecoveryPassword(newPassword))
    throw new PasswordRecoveryError(t('recovery.invalidPassword'));
  // An unreadable local store must not prevent changing the password on the server.
  // undefined means identity could not be checked; null means no account is signed in.
  const startingToken = await getTokenSnapshot().catch(() => undefined);
  const message = await requestRecovery('PATCH', { ...credentials, newPassword });
  const cleanupFailureMessage = t('recovery.cleanupFailed', { message });
  if (startingToken === undefined) return cleanupFailureMessage;
  try {
    const currentToken = await getTokenSnapshot();
    // A delayed reset must not sign out another account or a newer sign-in. Token refresh
    // keeps the generation, so the reset account's rotated credentials are still removed.
    if (
      startingToken &&
      currentToken &&
      startingToken.generation === currentToken.generation &&
      currentToken.tokenState.user.identifyCode === credentials.identifyCode
    ) {
      await clearTokenStateIfCurrent(currentToken);
    }
  } catch {
    // The server has already consumed the link; this is still a successful reset.
    return cleanupFailureMessage;
  }
  return message;
}
