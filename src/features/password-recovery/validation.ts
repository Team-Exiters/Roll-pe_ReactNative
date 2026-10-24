export function isRecoveryEmail(email: string) {
  return email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Match the existing iOS policy; passwords are never trimmed.
export function isRecoveryPassword(password: string) {
  return password.length <= 128 && /^(?=.*[a-zA-Z])(?=.*[!@#$%^*+=-])(?=.*[0-9]).{8,}$/.test(password);
}
