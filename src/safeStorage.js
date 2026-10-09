const memoryStore = new Map();
const volatileKeys = new Set();

// Cloud database snapshots must never persist on shared reception computers.
export function useMemoryStorage(key) {
  volatileKeys.add(key);
  try { window.localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
}


function canUseLocalStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const key = '__overview_storage_check__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

const useLocalStorage = canUseLocalStorage();

export function readStorage(key, fallback = null) {
  try {
    if (useLocalStorage && !volatileKeys.has(key)) {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    }
  } catch {
    // Fall through to the in-memory store.
  }

  return memoryStore.has(key) ? memoryStore.get(key) : fallback;
}

export function writeStorage(key, value) {
  const storedValue = String(value);
  memoryStore.set(key, storedValue);

  try {
    if (useLocalStorage && !volatileKeys.has(key)) {
      window.localStorage.setItem(key, storedValue);
    }
  } catch {
    // In-memory storage keeps the app usable for the current tab.
  }
}

export function removeStorage(key) {
  memoryStore.delete(key);

  try {
    if (useLocalStorage && !volatileKeys.has(key)) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore blocked storage.
  }
}
