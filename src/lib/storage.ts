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
export const setUserData = (userData: unknown): void => {
  try {
    localStorage.setItem(PREFIX + "user", JSON.stringify(userData));
  } catch (error) {
    // Silently fail
  }
};

export const getUserData = (): unknown | null => {
  try {
    const item = localStorage.getItem(PREFIX + "user");
    return item ? JSON.parse(item) : null;
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
