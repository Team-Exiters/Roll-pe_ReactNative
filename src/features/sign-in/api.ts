import { t } from '@/i18n';
import { apiUrl, requestJson } from '@/lib/api';
import { isTokenState, saveTokenState, type TokenState } from '@/features/sign-in/token-state';

export type SocialProvider = 'kakao' | 'google' | 'apple';
export type SocialCredential = { accessToken: string; code?: string; nonce?: string; name?: string };
export type EmailCredentials = { email: string; password: string; keepSignIn: boolean };

class EmailVerificationRequiredError extends Error {}

export async function requestSignIn(
  url: string, body: object, keepSignIn = true, provider?: SocialProvider,
): Promise<TokenState> {
  const { response, payload } = await requestJson(url, body).catch(() => {
    throw new Error(t('auth.networkError'));
  });
  if (!provider && url === `${apiUrl}/api/user/signin` && response.status === 403
    && payload?.status_code === 403 && payload.code === 'FORBIDDEN' && payload.link === '/login'
    && payload.message === '이메일 인증을 진행해주세요.' && payload.data === null) {
    throw new EmailVerificationRequiredError(payload.message);
  }
  if (!response.ok || !isTokenState(payload?.data)
    || (provider && payload.data.user.provider !== provider)) {
    throw new Error(typeof payload?.message === 'string' ? payload.message : t('auth.responseInvalid'));
  }
  await saveTokenState(payload.data, keepSignIn);
  return payload.data;
}

export async function signInWithEmail({ email, password, keepSignIn }: EmailCredentials) {
  if (!apiUrl) throw new Error(t('auth.serverMissing'));
  const normalizedEmail = email.trim();
  try {
    return await requestSignIn(`${apiUrl}/api/user/signin`, { email: normalizedEmail, password }, keepSignIn);
  } catch (error) {
    if (!(error instanceof EmailVerificationRequiredError)) throw error;
    // Keep this within the existing sign-in busy guard, including the resend request.
    await resendVerificationEmail(normalizedEmail);
    throw new Error(t('auth.verificationSent'));
  }
}

async function resendVerificationEmail(email: string) {
  const failureMessage = t('auth.verificationFailed');
  const { response, payload } = await requestJson(`${apiUrl}/api/user/verify-email`, {
    email, pathCode: 'email',
  }, 'PATCH').catch(() => { throw new Error(failureMessage); });
  if (!response.ok || typeof payload?.message !== 'string') throw new Error(failureMessage);
}

export function signInWithSocial(provider: SocialProvider, credential: SocialCredential) {
  if (!apiUrl) throw new Error(t('auth.serverMissing'));
  return requestSignIn(`${apiUrl}/api/user/social/login/${provider}`, credential, true, provider);
}
