import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { rollpeDestination } from '@/utils/rollpe-link';

type Destination = NonNullable<ReturnType<typeof rollpeDestination>>;
type PendingRollpe = { destination: Destination; expiresAt: number };
const storageKey = 'rollpe.pending-rollpe';
const lifetime = 24 * 60 * 60 * 1000;
let current: PendingRollpe | null | undefined;
let revision = 0;
let storageQueue: Promise<void> = Promise.resolve();

function serverRender() { return Platform.OS === 'web' && typeof window === 'undefined'; }

function persist(value: PendingRollpe | null) {
  const expected = revision;
  const operation = storageQueue.then(async () => {
    if (expected !== revision) return;
    if (Platform.OS === 'web') {
      if (value) window.sessionStorage.setItem(storageKey, JSON.stringify(value));
      else window.sessionStorage.removeItem(storageKey);
    } else if (value) {
      await SecureStore.setItemAsync(storageKey, JSON.stringify(value), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    } else await SecureStore.deleteItemAsync(storageKey);
  });
  // Navigation still works in memory when persistent storage is unavailable.
  storageQueue = operation.catch(() => {});
  return storageQueue;
}

export async function rememberRollpeDestination(value: unknown): Promise<Destination | null> {
  const destination = rollpeDestination(value);
  if (!destination || serverRender()) return null;
  current = { destination, expiresAt: Date.now() + lifetime };
  ++revision;
  await persist(current);
  return destination;
}

export async function getPendingRollpeDestination(): Promise<Destination | null> {
  if (serverRender()) return null;
  if (current === undefined) {
    const expected = revision;
    let stored: unknown;
    try {
      const value = Platform.OS === 'web' ? window.sessionStorage.getItem(storageKey) : await SecureStore.getItemAsync(storageKey);
      stored = value ? JSON.parse(value) : null;
    } catch { stored = null; }
    // A new link or cancellation may have arrived while native storage was read.
    if (expected !== revision) return getPendingRollpeDestination();
    const data = stored as Partial<PendingRollpe> | null;
    const destination = rollpeDestination(data?.destination);
    current = destination && typeof data?.expiresAt === 'number' && Number.isFinite(data.expiresAt)
      && data.expiresAt > Date.now() && data.expiresAt <= Date.now() + lifetime
      ? { destination, expiresAt: data.expiresAt } : null;
    if (!current) { ++revision; await persist(null); }
  }
  if (current && current.expiresAt <= Date.now()) {
    current = null; ++revision; await persist(null);
  }
  return current?.destination ?? null;
}

export async function clearPendingRollpeDestination(expected?: string): Promise<void> {
  if (serverRender()) return;
  if (current === undefined) await getPendingRollpeDestination();
  if (expected && current?.destination && current.destination !== expected) return;
  current = null; ++revision; await persist(null);
}

export async function resolveRollpeDestination(value?: unknown): Promise<Destination | null> {
  return rollpeDestination(value) ?? getPendingRollpeDestination();
}
