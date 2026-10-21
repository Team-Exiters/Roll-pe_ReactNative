import { isSignInSession, saveSession, type SignInSession } from './session';

export type SocialProvider = 'kakao' | 'google' | 'apple';
export type SocialCredential = { accessToken: string; code?: string; nonce?: string; name?: string };
export type EmailCredentials = { email: string; password: string; keepSignIn: boolean };

export const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export async function requestSession(
  url: string, body: object, keepSignIn = true, provider?: SocialProvider,
): Promise<SignInSession> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  let payload: { data?: unknown; message?: unknown } | null;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    payload = await response.json();
  } catch {
    throw new Error('로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.');
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok || !isSignInSession(payload?.data)
    || (provider && payload.data.user.provider !== provider)) {
    throw new Error(typeof payload?.message === 'string' ? payload.message : '로그인 응답을 확인할 수 없습니다.');
  }
  await saveSession(payload.data, keepSignIn);
  return payload.data;
}

export function signInWithEmail({ email, password, keepSignIn }: EmailCredentials) {
  if (!apiUrl) throw new Error('로그인 서버 주소가 설정되지 않았습니다.');
  return requestSession(`${apiUrl}/api/user/signin`, { email: email.trim(), password }, keepSignIn);
}

export function signInWithSocial(provider: SocialProvider, credential: SocialCredential) {
  if (!apiUrl) throw new Error('로그인 서버 주소가 설정되지 않았습니다.');
  return requestSession(`${apiUrl}/api/user/social/login/${provider}`, credential, true, provider);
}
