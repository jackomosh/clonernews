// src/api/hnApi.js

const BASE_URL = 'https://hacker-news.firebaseio.com/v0';

/**
 * Handles communication with the Hacker News Firebase REST API.
 * Features in-memory caching, request deduplication, and safe batching.
 */
class HNApi {
  constructor() {
    /** @type {Map<number|string, Object>} In-memory store for fetched items */
    this.cache = new Map();

    /** @type {Map<number|string, Promise<Object>>} In-flight request deduplication registry */
    this.pendingRequests = new Map();
  }

  /**
   * Helper method for basic JSON fetches with status check.
   * @private
   * @param {string} endpoint 
   * @returns {Promise<any>}
   */
  async _fetchJSON(endpoint) {
    const res = await fetch(`${BASE_URL}/${endpoint}`);
    if (!res.ok) {
      throw new Error(`[HN API Error] HTTP ${res.status} when fetching: ${endpoint}`);
    }
    return res.json();
  }

  /**
   * Fetches an array of item IDs for a given feed endpoint.
   * @param {'newstories' | 'topstories' | 'beststories' | 'jobstories' | 'askstories' | 'showstories'} feedType 
   * @returns {Promise<number[]>} Array of item IDs
   */
  async getFeedIds(feedType = 'newstories') {
    return this._fetchJSON(`${feedType}.json`);
  }

  /**
   * Fetches a single HN item (Story, Job, Poll, PollOpt, or Comment) by ID.
   * Leverages caching and request deduplication.
   * 
   * @param {number|string} id 
   * @param {Object} [options]
   * @param {number} [options.retries=2] Number of retries on network error
   * @returns {Promise<Object|null>} Resolved item object or null if invalid
   */
  async getItem(id, { retries = 2 } = {}) {
    if (!id) return null;

    // 1. Return cached item immediately if available
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }

    // 2. Return existing in-flight Promise if request is already ongoing
    if (this.pendingRequests.has(id)) {
      return this.pendingRequests.get(id);
    }

    // 3. Construct new fetch request with deduplication wrapper & exponential backoff retry logic
    const requestPromise = (async () => {
      let attempt = 0;
      while (attempt <= retries) {
        try {
          const item = await this._fetchJSON(`item/${id}.json`);
          if (item) {
            this.cache.set(id, item);
          }
          return item;
        } catch (err) {
          attempt++;
          if (attempt > retries) {
            console.error(`[HN API] Failed to fetch item ${id} after ${retries + 1} attempts.`, err);
            return null;
          }
          // Exponential backoff delay (200ms, 400ms...)
          await new Promise((resolve) => setTimeout(resolve, attempt * 200));
        }
      }
    })().finally(() => {
      // Clean up pending request entry once settled
      this.pendingRequests.delete(id);
    });

    this.pendingRequests.set(id, requestPromise);
    return requestPromise;
  }

  /**
   * Batches multiple item fetches concurrently with a concurrency bottleneck limit
   * to avoid overwhelming browser sockets or triggering rate limits.
   * 
   * @param {Array<number|string>} ids Array of item IDs to retrieve
   * @param {number} [concurrencyLimit=6] Max simultaneous fetch requests
   * @returns {Promise<Object[]>} Array of fetched items (null items filtered out)
   */
  async getItemsBatch(ids = [], concurrencyLimit = 6) {
    if (!ids.length) return [];

    const results = [];
    const queue = [...ids];

    // Worker pool processor
    const worker = async () => {
      while (queue.length > 0) {
        const id = queue.shift();
        if (id !== undefined) {
          const item = await this.getItem(id);
          if (item) results.push(item);
        }
      }
    };

    // Spawn up to concurrencyLimit worker promises
    const workers = Array.from(
      { length: Math.min(concurrencyLimit, ids.length) },
      () => worker()
    );

    await Promise.all(workers);
    return results;
  }

  /**
   * Fetches real-time updates containing modified/new item IDs and profiles.
   * @returns {Promise<{items: number[], profiles: string[]}>}
   */
  async getUpdates() {
    return this._fetchJSON('updates.json');
  }

  /**
   * Manually prime/seed the cache (e.g., when loading pre-stored or offline data).
   * @param {Object} item 
   */
  setCacheItem(item) {
    if (item && item.id) {
      this.cache.set(item.id, item);
    }
  }

  /**
   * Clears all cached items and resets in-flight handlers.
   */
  clearCache() {
    this.cache.clear();
    this.pendingRequests.clear();
  }
}

// Export singleton instance for global use across services and components
export const hnApi = new HNApi();