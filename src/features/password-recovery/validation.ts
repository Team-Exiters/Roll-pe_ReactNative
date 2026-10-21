export { resetCredentials, type ResetCredentials } from '../../utils/reset-link';

export const passwordPolicyMessage = '비밀번호는 8자 이상이며 영문, 숫자, 특수문자(!@#$%^*+=-)를 포함해야 합니다.';

export function isRecoveryEmail(email: string) {
  return email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Match the existing iOS policy; passwords are never trimmed.
export function isRecoveryPassword(password: string) {
  return password.length <= 128 && /^(?=.*[a-zA-Z])(?=.*[!@#$%^*+=-])(?=.*[0-9]).{8,}$/.test(password);
}
