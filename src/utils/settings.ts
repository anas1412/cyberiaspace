import { db } from '../db';

// Sync in-memory cache — populated from Dexie before app renders
const cache = new Map<string, string>();

// All known setting keys (for migration from localStorage)
const SETTING_KEYS = [
  'theme',
  'active-space-id',
  'physics-enabled',
  'physics-intensity',
  'node-bg',
  'accent',
  'secondary',
  'ai-model',
  'models-url',
  'openrouter-key',
  'system-prompt',
] as const;

/** Load all settings from Dexie into cache. Call once before app mount. */
export async function initSettings(): Promise<void> {
  const all = await db.settings.toArray();
  for (const s of all) {
    cache.set(s.key, s.value);
  }

  // Migrate legacy localStorage keys to Dexie on first launch
  for (const key of SETTING_KEYS) {
    if (cache.has(key)) continue; // already in Dexie
    const legacyKey = `cyberia-${key}`;
    try {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy !== null) {
        await db.settings.put({ key, value: legacy });
        cache.set(key, legacy);
        localStorage.removeItem(legacyKey);
      }
    } catch { /* noop */ }
  }
}

/** Synchronous read — safe to use in Zustand initializers. */
export function getSetting(key: string): string | undefined {
  return cache.get(key);
}

/** Async write to Dexie + sync cache. */
export async function setSetting(key: string, value: string): Promise<void> {
  cache.set(key, value);
  await db.settings.put({ key, value });
}

/** Remove a setting from Dexie + cache. */
export async function removeSetting(key: string): Promise<void> {
  cache.delete(key);
  await db.settings.delete(key);
}
