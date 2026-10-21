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
    return '이메일을 다시 확인하세요.';
  }
  if (Array.from(values.name).length < 2 || Array.from(values.name).length > 6) {
    return '닉네임은 2-6자로 적어주세요.';
  }
  if (values.password.length > 50 || !/^(?=.*[a-zA-Z])(?=.*[!@#$%^*+=-])(?=.*[0-9]).{8,}$/.test(values.password)) {
    return '비밀번호는 8자 이상이며 영문, 숫자, 특수문자(!@#$%^*+=-)를 포함해야 합니다.';
  }
  if (values.password !== values.confirmPassword) return '비밀번호가 일치하지 않습니다.';
  if (!values.ageChecked || !values.termsChecked || !values.privacyChecked) return '약관에 동의해주세요.';
  return null;
}

export function canSignUp(values: SignUpValues) {
  return inputError(values) === null;
}

export function signUpError(values: SignUpValues): string | null {
  return inputError(values) || (values.password !== values.password.trim()
    ? '비밀번호 앞뒤에 공백을 사용할 수 없습니다.' : null);
}
