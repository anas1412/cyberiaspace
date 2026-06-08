/**
 * Global test setup for bun test.
 *
 * Polyfills IndexedDB with fake-indexeddb so Dexie works in the test runner.
 * This runs before every test file via bunfig.toml [test] preload.
 */
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

// Dexie reads globalThis.indexedDB and globalThis.IDBKeyRange at module load time
// (see dexie.mjs lines 5697-5706). Both must be set for full Dexie functionality.
// Without IDBKeyRange, cursor-based operations (toArray, count, where, update)
// throw MissingAPIError — only key-based ops (add, get, put, delete) work.
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;
