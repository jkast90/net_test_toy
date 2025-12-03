// Cache utility for storing API responses in localStorage
// Provides resilient data access when API is slow or unavailable

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

interface CacheConfig {
  ttl?: number; // Time to live in milliseconds
  version?: string; // Cache version for invalidation
}

interface CacheStatus {
  isCachedMode: boolean;
  lastApiSuccess: number | null;
  failedRequests: number;
}

const CACHE_PREFIX = "netstream_cache_";
const CACHE_STATUS_KEY = "netstream_cache_status";
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_VERSION = "1.0.0";

export class CacheManager {
  private static instance: CacheManager;
  private status: CacheStatus;
  private statusChangeListeners: Set<(status: CacheStatus) => void> = new Set();

  private constructor() {
    // Initialize cache on startup
    this.cleanExpiredEntries();

    // Initialize status
    this.status = this.loadStatus();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Store data in cache
   */
  set<T>(key: string, data: T, config?: CacheConfig): void {
    try {
      const cacheKey = this.getCacheKey(key);
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: config?.version || CACHE_VERSION,
      };

      localStorage.setItem(cacheKey, JSON.stringify(entry));
      console.log(`[Cache] Stored ${key}`, {
        size: JSON.stringify(data).length,
      });
    } catch (error) {
      // Handle quota exceeded or other storage errors
      console.error("[Cache] Failed to store", key, error);
      this.handleStorageError();
    }
  }

  /**
   * Retrieve data from cache
   */
  get<T>(key: string, config?: CacheConfig): T | null {
    try {
      const cacheKey = this.getCacheKey(key);
      const stored = localStorage.getItem(cacheKey);

      if (!stored) {
        console.log(`[Cache] Miss for ${key}`);
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(stored);

      // Check version
      if (entry.version !== (config?.version || CACHE_VERSION)) {
        console.log(`[Cache] Version mismatch for ${key}`);
        this.remove(key);
        return null;
      }

      // Check TTL
      const ttl = config?.ttl ?? DEFAULT_TTL;
      const age = Date.now() - entry.timestamp;

      if (age > ttl) {
        console.log(`[Cache] Expired ${key} (age: ${Math.round(age / 1000)}s)`);
        this.remove(key);
        return null;
      }

      console.log(`[Cache] Hit for ${key} (age: ${Math.round(age / 1000)}s)`);
      return entry.data;
    } catch (error) {
      console.error("[Cache] Failed to retrieve", key, error);
      return null;
    }
  }

  /**
   * Check if cache has valid data
   */
  has(key: string, config?: CacheConfig): boolean {
    return this.get(key, config) !== null;
  }

  /**
   * Remove specific cache entry
   */
  remove(key: string): void {
    try {
      const cacheKey = this.getCacheKey(key);
      localStorage.removeItem(cacheKey);
      console.log(`[Cache] Removed ${key}`);
    } catch (error) {
      console.error("[Cache] Failed to remove", key, error);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      console.log("[Cache] Cleared all entries");
    } catch (error) {
      console.error("[Cache] Failed to clear", error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { entries: number; size: number } {
    let entries = 0;
    let size = 0;

    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        entries++;
        const item = localStorage.getItem(key);
        if (item) {
          size += item.length;
        }
      }
    });

    return { entries, size };
  }

  /**
   * Clean expired entries
   */
  private cleanExpiredEntries(): void {
    try {
      const keys = Object.keys(localStorage);
      let cleaned = 0;

      keys.forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const entry: CacheEntry<any> = JSON.parse(stored);
              const age = Date.now() - entry.timestamp;

              // Remove entries older than 7 days regardless of TTL
              if (age > 7 * 24 * 60 * 60 * 1000) {
                localStorage.removeItem(key);
                cleaned++;
              }
            } catch {
              // Remove corrupted entries
              localStorage.removeItem(key);
              cleaned++;
            }
          }
        }
      });

      if (cleaned > 0) {
        console.log(`[Cache] Cleaned ${cleaned} expired entries`);
      }
    } catch (error) {
      console.error("[Cache] Failed to clean expired entries", error);
    }
  }

  /**
   * Handle storage errors (quota exceeded, etc.)
   */
  private handleStorageError(): void {
    // Try to free up space by removing oldest entries
    try {
      const cacheEntries: Array<{ key: string; timestamp: number }> = [];

      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const entry = JSON.parse(stored);
              cacheEntries.push({ key, timestamp: entry.timestamp });
            } catch {
              // Remove corrupted entry
              localStorage.removeItem(key);
            }
          }
        }
      });

      // Sort by timestamp (oldest first)
      cacheEntries.sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest 25% of entries
      const toRemove = Math.ceil(cacheEntries.length * 0.25);
      for (let i = 0; i < toRemove; i++) {
        localStorage.removeItem(cacheEntries[i].key);
      }

      console.log(`[Cache] Freed space by removing ${toRemove} old entries`);
    } catch (error) {
      console.error("[Cache] Failed to handle storage error", error);
    }
  }

  /**
   * Get prefixed cache key
   */
  private getCacheKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
  }

  /**
   * Load cache status from localStorage
   */
  private loadStatus(): CacheStatus {
    try {
      const stored = localStorage.getItem(CACHE_STATUS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error("[Cache] Failed to load status", error);
    }

    return {
      isCachedMode: false,
      lastApiSuccess: null,
      failedRequests: 0,
    };
  }

  /**
   * Save cache status to localStorage
   */
  private saveStatus(): void {
    try {
      localStorage.setItem(CACHE_STATUS_KEY, JSON.stringify(this.status));
    } catch (error) {
      console.error("[Cache] Failed to save status", error);
    }
  }

  /**
   * Update cache status and notify listeners
   */
  private updateStatus(updates: Partial<CacheStatus>): void {
    this.status = { ...this.status, ...updates };
    this.saveStatus();
    this.notifyStatusListeners();
  }

  /**
   * Notify all status change listeners
   */
  private notifyStatusListeners(): void {
    this.statusChangeListeners.forEach((listener) => {
      try {
        listener(this.status);
      } catch (error) {
        console.error("[Cache] Error in status listener", error);
      }
    });
  }

  /**
   * Subscribe to cache status changes
   */
  onStatusChange(listener: (status: CacheStatus) => void): () => void {
    this.statusChangeListeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.statusChangeListeners.delete(listener);
    };
  }

  /**
   * Get current cache status
   */
  getStatus(): CacheStatus {
    return { ...this.status };
  }

  /**
   * Record successful API call
   */
  recordApiSuccess(): void {
    this.updateStatus({
      isCachedMode: false,
      lastApiSuccess: Date.now(),
      failedRequests: 0,
    });
  }

  /**
   * Record failed API call
   */
  recordApiFailure(): void {
    const failedRequests = this.status.failedRequests + 1;

    // Enter cached mode after 3 consecutive failures or if last success was > 30 seconds ago
    const shouldEnterCachedMode =
      failedRequests >= 3 ||
      (this.status.lastApiSuccess &&
        Date.now() - this.status.lastApiSuccess > 30000);

    this.updateStatus({
      isCachedMode: shouldEnterCachedMode,
      failedRequests,
    });

    if (shouldEnterCachedMode && !this.status.isCachedMode) {
      console.warn(
        "[Cache] Entering cached mode - edit/delete functionality will be disabled",
      );
    }
  }

  /**
   * Check if we're in cached mode
   */
  isCachedMode(): boolean {
    return this.status.isCachedMode;
  }
}

// Export singleton instance
export const cache = CacheManager.getInstance();

// Cache keys for different data types
export const CACHE_KEYS = {
  WORKSPACES: "workspaces",
  WORKSPACE_DETAILS: (id: number) => `workspace_${id}`,
  GROUPS: "groups",
  GROUP_DETAILS: (id: number) => `group_${id}`,
  LINKS: "links",
  GROUP_LINKS: (groupId: number) => `group_${groupId}_links`,
  NOTES: "notes",
  GROUP_NOTES: (groupId: number) => `group_${groupId}_notes`,
  USER_PREFERENCES: "user_preferences",
  WORKSPACE_PREFERENCES: (id: number) => `workspace_${id}_preferences`,
} as const;

// Helper function to cache API responses
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    ttl?: number;
    forceRefresh?: boolean;
    onCacheHit?: (data: T) => void;
    onCacheMiss?: () => void;
    onFreshData?: (data: T) => void;
  },
): Promise<T> {
  const { ttl, forceRefresh, onCacheHit, onCacheMiss, onFreshData } =
    options || {};

  // Try to get from cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = cache.get<T>(key, { ttl });
    if (cached !== null) {
      onCacheHit?.(cached);

      // Still fetch fresh data in background to update cache
      fetcher()
        .then((freshData) => {
          cache.set(key, freshData, { ttl });
          cache.recordApiSuccess();
          // Notify about fresh data if it's different from cached
          if (JSON.stringify(freshData) !== JSON.stringify(cached)) {
            onFreshData?.(freshData);
          }
        })
        .catch((error) => {
          console.error("[Cache] Background refresh failed", key, error);
          cache.recordApiFailure();
        });

      return cached;
    }
  }

  // Cache miss or force refresh
  onCacheMiss?.();

  try {
    const freshData = await fetcher();
    cache.set(key, freshData, { ttl });
    cache.recordApiSuccess();
    return freshData;
  } catch (error) {
    cache.recordApiFailure();

    // If fetch fails, try to return stale cached data
    const staleData = cache.get<T>(key, { ttl: Infinity });
    if (staleData !== null) {
      console.warn("[Cache] Using stale data due to fetch error", key);
      return staleData;
    }
    throw error;
  }
}
