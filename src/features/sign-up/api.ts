import { t } from '@/i18n';
import { apiUrl, requestJson } from '@/lib/api';
import { signUpError, type SignUpValues } from '@/features/sign-up/validation';

function responseMessage(message: unknown): string | null {
  if (typeof message === 'string') return message;
  // DRF field errors are dictionaries of message arrays, rather than a single string.
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null;
  const fields = message as Record<string, unknown>;
  const messages = ['email', 'name', 'password', 'non_field_errors'].flatMap((field) => {
    const value = fields[field];
    return typeof value === 'string' ? [value] : Array.isArray(value)
      ? value.filter((message): message is string => typeof message === 'string') : [];
  });
  return messages.length ? messages.join('\n') : null;
}

export async function signUp(values: SignUpValues): Promise<string> {
  const error = signUpError(values);
  if (error) throw new Error(error);
  if (!apiUrl) throw new Error(t('signup.serverMissing'));
  const { response, payload } = await requestJson(`${apiUrl}/api/user/signup`, {
    name: values.name, email: values.email, password: values.password,
  }).catch(() => {
    throw new Error(t('signup.networkError'));
  });
  const message = responseMessage(payload?.message);
  if (!response.ok) {
    if (response.status === 400 && message === '이미 가입된 이메일입니다.') {
      throw new Error(t('signup.duplicateHelp', { message }));
    }
    throw new Error(message || t('signup.failed'));
  }
  if (!message) throw new Error(t('signup.responseInvalid'));
  return message;
}
