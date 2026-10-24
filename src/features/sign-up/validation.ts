
import { t } from '@/i18n';
export type SignUpValues = {
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
  ageChecked: boolean;
  termsChecked: boolean;
  privacyChecked: boolean;
};

function inputError(values: SignUpValues): string | null {
  if (values.email.length > 50 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    return t('validation.email');
  }
  if (Array.from(values.name).length < 2 || Array.from(values.name).length > 6) {
    return t('validation.nickname');
  }
  if (values.password.length > 50 || !/^(?=.*[a-zA-Z])(?=.*[!@#$%^*+=-])(?=.*[0-9]).{8,}$/.test(values.password)) {
    return t('validation.password');
  }
  if (values.password !== values.confirmPassword) return t('validation.passwordMismatch');
  if (!values.ageChecked || !values.termsChecked || !values.privacyChecked) return t('validation.agreements');
  return null;
}

export function canSignUp(values: SignUpValues) {
  return inputError(values) === null;
}

export function signUpError(values: SignUpValues): string | null {
  return inputError(values) || (values.password !== values.password.trim()
    ? t('validation.passwordWhitespace') : null);
}
