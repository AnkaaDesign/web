const PREFIX = "ankaa_";

export const getLocalStorage = (key: string): string | null => {
  try {
    const item = localStorage.getItem(PREFIX + key);
    return item;
  } catch (error) {
    return null;
  }
};

export const setLocalStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch (error) {
    // Silently fail
  }
};

export const removeLocalStorage = (key: string): void => {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (error) {
    // Silently fail
  }
};

// Refresh-token persistence
//
// The refresh token is a long-lived (60d) opaque string returned by /auth/login.
// It is stored under the real key `ankaa_refresh_token` (PREFIX + "refresh_token")
// and used by the axios 401 interceptor to obtain a fresh access token without
// forcing the user to log in again. It is non-rotating: /auth/refresh returns a new
// access token but keeps the same refresh token, so we never overwrite it on refresh.
export const setRefreshToken = (token: string): void => {
  setLocalStorage("refresh_token", token);
};

export const getRefreshToken = (): string | null => {
  return getLocalStorage("refresh_token");
};

export const removeRefreshToken = (): void => {
  removeLocalStorage("refresh_token");
};

export const clearLocalStorage = (): void => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    // Silently fail
  }
};

// User data persistence
//
// The cached user blob is versioned. Bump USER_SCHEMA_VERSION whenever the
// persisted User/sector shape changes: on a version mismatch getUserData()
// discards only the stale blob (the token is KEPT, so /auth/me repopulates a
// fresh user) instead of feeding an old-deploy shape into privilege checks —
// which could otherwise flash a wrong redirect or crash the first paint after
// an update. Discarding the user blob never logs anyone out.
const USER_SCHEMA_VERSION = "2026-06-17";

export const setUserData = (userData: unknown): void => {
  try {
    localStorage.setItem(PREFIX + "user", JSON.stringify({ v: USER_SCHEMA_VERSION, data: userData }));
  } catch (error) {
    // Silently fail
  }
};

export const getUserData = (): unknown | null => {
  try {
    const item = localStorage.getItem(PREFIX + "user");
    if (!item) return null;
    const parsed = JSON.parse(item);
    // Versioned format: honor only the current schema version.
    if (parsed && typeof parsed === "object" && "v" in parsed) {
      if (parsed.v !== USER_SCHEMA_VERSION) {
        localStorage.removeItem(PREFIX + "user"); // stale shape -> drop, KEEP token
        return null;
      }
      return parsed.data ?? null;
    }
    // Legacy unwrapped blob from before versioning -> treat as stale, refetch.
    localStorage.removeItem(PREFIX + "user");
    return null;
  } catch (error) {
    return null;
  }
};

export const removeUserData = (): void => {
  try {
    localStorage.removeItem(PREFIX + "user");
  } catch (error) {
    // Silently fail
  }
};
