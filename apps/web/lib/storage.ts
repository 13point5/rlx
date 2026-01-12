/**
 * LocalStorage utility with automatic key prefixing
 * Uses "rlx-dev" prefix in development and "rlx" in production
 */

const isDev = process.env.NODE_ENV === "development";
const PREFIX = isDev ? "rlx-dev" : "rlx";

/**
 * Get the prefixed key for localStorage
 */
function getPrefixedKey(key: string): string {
  return `${PREFIX}:${key}`;
}

/**
 * Get an item from localStorage with automatic prefixing
 */
export function getStorageItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(getPrefixedKey(key));
}

/**
 * Set an item in localStorage with automatic prefixing
 */
export function setStorageItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getPrefixedKey(key), value);
}

/**
 * Remove an item from localStorage with automatic prefixing
 */
export function removeStorageItem(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getPrefixedKey(key));
}

/**
 * Clear all items with the current prefix from localStorage
 */
export function clearStorage(): void {
  if (typeof window === "undefined") return;

  const keys = Object.keys(localStorage);
  keys.forEach((key) => {
    if (key.startsWith(`${PREFIX}:`)) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * Get a JSON item from localStorage with automatic prefixing
 */
export function getStorageJSON<T>(key: string): T | null {
  const item = getStorageItem(key);
  if (!item) return null;

  try {
    return JSON.parse(item) as T;
  } catch {
    return null;
  }
}

/**
 * Set a JSON item in localStorage with automatic prefixing
 */
export function setStorageJSON<T>(key: string, value: T): void {
  setStorageItem(key, JSON.stringify(value));
}
