import * as SecureStore from 'expo-secure-store';

/**
 * Supabase persists one JSON session value. Split it before storing because
 * native secure stores can reject larger values on some OS versions. Every
 * part stays in Keychain/Keystore-backed storage; no plaintext fallback is
 * used for an authenticated native session.
 */
const SESSION_PART_LENGTH = 1_800;
const MAX_SESSION_PARTS = 64;

type SessionManifest = {
  partCount: number;
  version: string;
};

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const manifestKey = (key: string) => `${key}.manifest`;
const partKey = (key: string, version: string, index: number) => `${key}.${version}.${index}`;

function isManifest(value: unknown): value is SessionManifest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SessionManifest>;
  return typeof candidate.version === 'string'
    && /^[a-z0-9-]+$/i.test(candidate.version)
    && typeof candidate.partCount === 'number'
    && Number.isInteger(candidate.partCount)
    && candidate.partCount > 0
    && candidate.partCount <= MAX_SESSION_PARTS;
}

async function readManifest(key: string): Promise<SessionManifest | null> {
  const raw = await SecureStore.getItemAsync(manifestKey(key), secureStoreOptions);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isManifest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function removeParts(key: string, manifest: SessionManifest | null): Promise<void> {
  if (!manifest) return;
  await Promise.all(
    Array.from({ length: manifest.partCount }, (_, index) =>
      SecureStore.deleteItemAsync(partKey(key, manifest.version, index), secureStoreOptions),
    ),
  );
}

async function cleanUpPreviousSession(key: string, previous: SessionManifest | null): Promise<void> {
  try {
    await Promise.all([
      removeParts(key, previous),
      SecureStore.deleteItemAsync(key, secureStoreOptions),
    ]);
  } catch {
    // The current manifest already points to the fresh encrypted session. A
    // best-effort cleanup failure must not prevent Supabase from continuing.
  }
}

/** A small async storage adapter for Supabase Auth on native platforms. */
export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const manifest = await readManifest(key);
    if (manifest) {
      const parts = await Promise.all(
        Array.from({ length: manifest.partCount }, (_, index) =>
          SecureStore.getItemAsync(partKey(key, manifest.version, index), secureStoreOptions),
        ),
      );
      return parts.every((part): part is string => typeof part === 'string') ? parts.join('') : null;
    }

    // Support a prior encrypted single-value session during an app upgrade.
    // It remains protected by SecureStore and will be moved to chunked storage
    // the next time Supabase refreshes or writes the session.
    return SecureStore.getItemAsync(key, secureStoreOptions);
  },

  async setItem(key: string, value: string): Promise<void> {
    const parts = value.match(new RegExp(`.{1,${SESSION_PART_LENGTH}}`, 'g')) ?? [''];
    if (parts.length > MAX_SESSION_PARTS) {
      throw new Error('The secure session is too large to store on this device.');
    }

    const previous = await readManifest(key);
    const version = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const manifest: SessionManifest = { version, partCount: parts.length };

    try {
      await Promise.all(
        parts.map((part, index) =>
          SecureStore.setItemAsync(partKey(key, version, index), part, secureStoreOptions),
        ),
      );
      // Writing this last preserves the previous complete session if a native
      // write fails part way through the new one.
      await SecureStore.setItemAsync(manifestKey(key), JSON.stringify(manifest), secureStoreOptions);
    } catch (error) {
      await removeParts(key, manifest).catch(() => undefined);
      throw error;
    }

    await cleanUpPreviousSession(key, previous);
  },

  async removeItem(key: string): Promise<void> {
    const manifest = await readManifest(key);
    await Promise.all([
      removeParts(key, manifest),
      SecureStore.deleteItemAsync(manifestKey(key), secureStoreOptions),
      SecureStore.deleteItemAsync(key, secureStoreOptions),
    ]);
  },
};
