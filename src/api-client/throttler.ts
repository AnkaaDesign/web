import { apiClient } from "./axiosClient";

interface ThrottlerStats {
  totalKeys: number;
  activeKeys: number;
  blockedKeys: number;
  keysByType: Record<string, number>;
  keysByController: Record<string, number>;
  blockedDetails: Array<{
    key: string;
    ttl: number;
    expiresIn: string;
  }>;
}

interface ThrottlerKey {
  key: string;
  controller: string;
  method: string;
  throttlerName: string;
  identifier: string;
  isBlocked: boolean;
  hits: number | null;
  ttl: number;
  expiresIn: string;
}

interface BlockedKey {
  key: string;
  controller: string;
  method: string;
  throttlerName: string;
  identifierType: "user" | "ip" | "unknown";
  identifier: string;
  ttl: number;
  expiresIn: string;
}

interface ThrottlerStatsResponse {
  success: boolean;
  message: string;
  data: ThrottlerStats;
}

interface ThrottlerKeysResponse {
  success: boolean;
  message: string;
  data: ThrottlerKey[];
}

interface BlockedKeysResponse {
  success: boolean;
  message: string;
  data: BlockedKey[];
}

interface DeleteResponse {
  success: boolean;
  message: string;
  data: {
    deletedCount?: number;
    removed?: boolean;
  };
}

export const throttlerService = {
  /**
   * Get throttler statistics
   */
  getStats: () => {
    console.log("[Throttler API] Getting stats");
    return apiClient.get<ThrottlerStatsResponse>("/system/throttler/stats");
  },

  /**
   * Get throttler keys with optional filtering
   */
  getKeys: (pattern?: string, limit?: number) => {
    console.log("[Throttler API] Getting keys:", { pattern, limit });
    return apiClient.get<ThrottlerKeysResponse>("/system/throttler/keys", {
      params: { pattern, limit },
    });
  },

  /**
   * Get all blocked keys
   */
  getBlockedKeys: () => {
    console.log("[Throttler API] Getting blocked keys");
    return apiClient.get<BlockedKeysResponse>("/system/throttler/blocked-keys");
  },

  /**
   * Clear all throttler keys (with optional pattern filter)
   */
  clearKeys: (pattern?: string) => {
    console.log("[Throttler API] Clearing all keys, pattern:", pattern);
    return apiClient.delete<DeleteResponse>("/system/throttler/keys", {
      params: { pattern },
    }).then((response) => {
      console.log("[Throttler API] Clear all keys response:", response);
      return response;
    }).catch((error) => {
      console.error("[Throttler API] Clear all keys error:", error);
      throw error;
    });
  },

  /**
   * Clear a specific key
   */
  clearSpecificKey: (key: string) => {
    console.log("[Throttler API] Clearing specific key:", key);
    return apiClient.delete<DeleteResponse>("/system/throttler/key", {
      params: { key },
    }).then((response) => {
      console.log("[Throttler API] Clear specific key response:", response);
      return response;
    }).catch((error) => {
      console.error("[Throttler API] Clear specific key error:", error);
      throw error;
    });
  },

  /**
   * Clear all keys for a specific user
   */
  clearUserKeys: (userId?: string) => {
    console.log("[Throttler API] Clearing user keys:", userId);
    return apiClient.delete<DeleteResponse>("/system/throttler/user-keys", {
      params: { userId },
    });
  },

  /**
   * Clear all keys for a specific IP address
   */
  clearIpKeys: (ip: string) => {
    console.log("[Throttler API] Clearing IP keys:", ip);
    return apiClient.delete<DeleteResponse>("/system/throttler/ip-keys", {
      params: { ip },
    });
  },

  /**
   * Clear all blocked keys
   */
  clearBlockedKeys: () => {
    console.log("[Throttler API] Clearing blocked keys");
    return apiClient.delete<DeleteResponse>("/system/throttler/blocked-keys").then((response) => {
      console.log("[Throttler API] Clear blocked keys response:", response);
      return response;
    }).catch((error) => {
      console.error("[Throttler API] Clear blocked keys error:", error);
      throw error;
    });
  },
};

// Export types
export type {
  ThrottlerStats,
  ThrottlerKey,
  BlockedKey,
  ThrottlerStatsResponse,
  ThrottlerKeysResponse,
  BlockedKeysResponse,
  DeleteResponse,
};
