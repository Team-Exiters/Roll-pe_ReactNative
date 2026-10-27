import { isRecoveryPassword } from '@/features/password-recovery/validation';
import { clearTokenStateIfCurrent, getTokenSnapshot } from '@/features/sign-in/token-state';
import { t } from '@/i18n';
import { AuthenticationRequiredError, authenticatedTokenMutation } from '@/lib/authenticated-api';

export type AccountAction = 'logout' | 'withdraw' | 'changePassword';
export class AccountActionError extends Error {
  constructor(message: string) { super(message); this.name = 'AccountActionError'; }
}

export async function changeAccount(action: AccountAction, newPassword?: string, signal?: AbortSignal): Promise<string> {
  if (!['logout', 'withdraw', 'changePassword'].includes(action)) throw new AccountActionError(t('common.requestFailed'));
  if (action === 'changePassword' && (!newPassword || !isRecoveryPassword(newPassword))) throw new AccountActionError(t('validation.password'));
  if (action === 'changePassword' && newPassword !== newPassword?.trim()) throw new AccountActionError(t('validation.passwordWhitespace'));
  const starting = await getTokenSnapshot();
  if (!starting) throw new AuthenticationRequiredError();
  if (action === 'changePassword' && starting.tokenState.user.provider) throw new AccountActionError(t('account.socialPassword'));
  if (action === 'withdraw' && !starting.tokenState.user.identifyCode) throw new AccountActionError(t('account.missingIdentity'));
  const endpoint = action === 'withdraw' ? 'drop-user' : action === 'changePassword' ? 'change-password' : 'logout';
  const method = action === 'withdraw' ? 'DELETE' : action === 'changePassword' ? 'PATCH' : 'POST';
  let result: Awaited<ReturnType<typeof authenticatedTokenMutation>>;
  try {
    result = await authenticatedTokenMutation(`/api/user/${endpoint}`, method, snapshot => {
      if (snapshot.generation !== starting.generation) throw new AccountActionError(t('auth.changed'));
      return { refresh: snapshot.tokenState.refresh,
        ...(action === 'withdraw' ? { identifyCode: snapshot.tokenState.user.identifyCode } : {}),
        ...(action === 'changePassword' ? { newPassword } : {}) };
    }, signal);
  } catch (cause) {
    if (signal?.aborted || cause instanceof AuthenticationRequiredError || cause instanceof AccountActionError) throw cause;
    throw new AccountActionError(t('account.uncertain'));
  }
  if (result.response.status !== 200 || typeof result.payload?.message !== 'string' || !result.payload.message.trim()) {
    throw new AccountActionError(!result.response.ok && typeof result.payload?.message === 'string'
      ? result.payload.message : t('account.uncertain'));
  }
  let message = result.payload.message;
  const current = await getTokenSnapshot();
  if (!current || current.generation !== starting.generation) throw new AccountActionError(t('auth.changed'));
  try { await clearTokenStateIfCurrent(current); }
  catch { message = t('account.cleanupFailed', { message }); }
  // A newer sign-in may finish while secure storage is being cleared.
  if (await getTokenSnapshot()) throw new AccountActionError(t('auth.changed'));
  return message;
}
