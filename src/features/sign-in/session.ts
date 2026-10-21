import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type SignInSession = {
  access: string;
  refresh: string;
  user: {
    id: number;
    name: string;
    email: string | null;
    identifyCode: string | null;
    provider: string | null;
  };
};

const sessionKey = 'rollpe.session';
// undefined means storage has not been read; null means the running session is signed out.
let currentSession: SignInSession | null | undefined;

export function isSignInSession(value: unknown): value is SignInSession {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<SignInSession>;
  return typeof data.access === 'string' && data.access.length > 0
    && typeof data.refresh === 'string' && data.refresh.length > 0
    && typeof data.user?.id === 'number' && Number.isSafeInteger(data.user.id)
    && typeof data.user.name === 'string'
    && (typeof data.user.email === 'string' || data.user.email === null)
    && (typeof data.user.identifyCode === 'string' || data.user.identifyCode === null)
    && (data.user.provider === null || ['apple', 'google', 'kakao'].includes(data.user.provider));
}

export async function saveSession(session: SignInSession, keepSignIn = true) {
  const value = JSON.stringify(session);
  if (Platform.OS === 'web') {
    // Keep web credentials within this tab rather than persistent localStorage.
    if (keepSignIn) window.sessionStorage.setItem(sessionKey, value);
    else window.sessionStorage.removeItem(sessionKey);
  } else if (keepSignIn) {
    await SecureStore.setItemAsync(sessionKey, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } else {
    await SecureStore.deleteItemAsync(sessionKey);
  }
  currentSession = session;
}

export async function getSession(): Promise<SignInSession | null> {
  if (currentSession !== undefined) return currentSession;
  const value = Platform.OS === 'web'
    ? window.sessionStorage.getItem(sessionKey)
    : await SecureStore.getItemAsync(sessionKey);
  // A sign-in or clear may have completed while native storage was being read.
  if (currentSession !== undefined) return currentSession;
  try {
    const session: unknown = value ? JSON.parse(value) : null;
    currentSession = isSignInSession(session) ? session : null;
  } catch {
    currentSession = null;
  }
  return currentSession;
}

export async function clearSession() {
  currentSession = null;
  if (Platform.OS === 'web') {
    window.sessionStorage.removeItem(sessionKey);
  } else {
    await SecureStore.deleteItemAsync(sessionKey);
  }
}
