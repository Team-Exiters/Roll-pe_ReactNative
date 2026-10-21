import { apiUrl, requestJson } from '../../lib/api';
import { signUpError, type SignUpValues } from './validation';

function responseMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || !('message' in payload)) return null;
  if (typeof payload.message === 'string') return payload.message;
  // DRF field errors are dictionaries of message arrays, rather than a single string.
  if (!payload.message || typeof payload.message !== 'object' || Array.isArray(payload.message)) return null;
  const fields = payload.message as Record<string, unknown>;
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
  if (!apiUrl) throw new Error('회원가입 서버 주소가 설정되지 않았습니다.');
  const { response, payload } = await requestJson(`${apiUrl}/api/user/signup`, {
    name: values.name, email: values.email, password: values.password,
  }).catch(() => {
    throw new Error('회원가입 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.');
  });
  const message = responseMessage(payload);
  if (!response.ok) {
    if (response.status === 400 && message === '이미 가입된 이메일입니다.') {
      throw new Error(`${message}\n이메일 인증 전이라면 로그인 화면에서 로그인하여 인증 메일을 다시 받아주세요.`);
    }
    throw new Error(message || '회원가입에 실패했습니다. 다시 시도해주세요.');
  }
  if (!message) throw new Error('회원가입 응답을 확인할 수 없습니다.');
  return message;
}
