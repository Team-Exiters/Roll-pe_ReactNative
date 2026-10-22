import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type TokenState = {
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

// Preserve previously saved JWT credentials across the internal module rename.
const tokenStorageKey = 'rollpe.session';
// undefined means storage has not been read; null means there is no active login.
let currentTokenState: TokenState | null | undefined;
let tokenRevision = 0;
let tokenGeneration = 0;
let retainTokenState = false;
let storageQueue: Promise<void> = Promise.resolve();

function persist(tokenState: TokenState | null, keepSignIn: boolean, revision: number) {
  const operation = storageQueue.then(async () => {
    if (revision !== tokenRevision) return;
    if (Platform.OS === 'web') {
      if (tokenState && keepSignIn) window.sessionStorage.setItem(tokenStorageKey, JSON.stringify(tokenState));
      else window.sessionStorage.removeItem(tokenStorageKey);
    } else if (tokenState && keepSignIn) {
      await SecureStore.setItemAsync(tokenStorageKey, JSON.stringify(tokenState), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } else {
      await SecureStore.deleteItemAsync(tokenStorageKey);
    }
  });
  storageQueue = operation.catch(() => {});
  return operation;
}

export function isTokenState(value: unknown): value is TokenState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<TokenState>;
  return typeof data.access === 'string' && data.access.length > 0
    && typeof data.refresh === 'string' && data.refresh.length > 0
    && typeof data.user?.id === 'number' && Number.isSafeInteger(data.user.id)
    && typeof data.user.name === 'string'
    && (typeof data.user.email === 'string' || data.user.email === null)
    && (typeof data.user.identifyCode === 'string' || data.user.identifyCode === null)
    && (data.user.provider === null || ['apple', 'google', 'kakao'].includes(data.user.provider));
}

export async function saveTokenState(tokenState: TokenState, keepSignIn = true) {
  const revision = ++tokenRevision;
  ++tokenGeneration;
  currentTokenState = tokenState;
  retainTokenState = keepSignIn;
  try {
    await persist(tokenState, keepSignIn, revision);
  } catch (error) {
    if (tokenRevision === revision) {
      currentTokenState = null;
      retainTokenState = false;
      ++tokenRevision;
    }
    throw error;
  }
}

export async function getTokenState(): Promise<TokenState | null> {
  if (currentTokenState !== undefined) return currentTokenState;
  const value = Platform.OS === 'web'
    ? window.sessionStorage.getItem(tokenStorageKey)
    : await SecureStore.getItemAsync(tokenStorageKey);
  // A sign-in or clear may have completed while native storage was being read.
  if (currentTokenState !== undefined) return currentTokenState;
  try {
    const tokenState: unknown = value ? JSON.parse(value) : null;
    currentTokenState = isTokenState(tokenState) ? tokenState : null;
    retainTokenState = currentTokenState !== null;
  } catch {
    currentTokenState = null;
  }
  return currentTokenState;
}

export async function clearTokenState() {
  ++tokenGeneration;
  currentTokenState = null;
  retainTokenState = false;
  await persist(null, false, ++tokenRevision);
}

export type TokenSnapshot = { tokenState: TokenState; revision: number; generation: number };

export async function getTokenSnapshot(): Promise<TokenSnapshot | null> {
  await getTokenState();
  return currentTokenState ? { tokenState: currentTokenState, revision: tokenRevision, generation: tokenGeneration } : null;
}

export function isCurrentTokenState(snapshot: TokenSnapshot) {
  return snapshot.revision === tokenRevision && snapshot.tokenState === currentTokenState;
}

export async function clearTokenStateIfCurrent(snapshot: TokenSnapshot) {
  if (isCurrentTokenState(snapshot)) await clearTokenState();
}

export async function replaceTokens(snapshot: TokenSnapshot, access: string, refresh: string) {
  if (!isCurrentTokenState(snapshot)) return null;
  const tokenState = { ...snapshot.tokenState, access, refresh };
  // The server may already have invalidated the previous refresh token. Keep the rotation
  // available for retry even when persisting it fails.
  currentTokenState = tokenState;
  const revision = ++tokenRevision;
  await persist(tokenState, retainTokenState, revision);
  return isCurrentTokenState({ tokenState, revision, generation: tokenGeneration })
    ? { tokenState, revision, generation: tokenGeneration } : null;
}
