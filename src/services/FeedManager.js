// src/services/FeedManager.js

import { hnApi } from '../api/hnApi.js';
import { renderPostCard } from '../components/PostCard.js';

/**
 * Manages fetching, sorting, and progressive rendering (infinite scroll)
 * for Hacker News feeds.
 */
export class FeedManager {
  /**
   * @param {HTMLElement} container - DOM element where post cards will be appended.
   * @param {HTMLElement} sentinel - DOM element targeted by IntersectionObserver for infinite scrolling.
   * @param {Object} [options]
   * @param {number} [options.pageSize=15] - Number of posts to fetch per batch.
   */
  constructor(container, sentinel, options = {}) {
    this.container = container;
    this.sentinel = sentinel;
    this.pageSize = options.pageSize || 15;

    this.currentFeed = 'newstories';
    this.allFeedIds = [];
    this.currentIndex = 0;
    this.isLoading = false;
    this.observer = null;

    this._initObserver();
  }

  /**
   * Sets up the IntersectionObserver on the sentinel element.
   * @private
   */
  _initObserver() {
    if (!this.sentinel) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !this.isLoading && this.hasMore()) {
          this.loadNextChunk();
        }
      },
      {
        root: null, // viewport
        rootMargin: '300px', // trigger 300px before reaching bottom
        threshold: 0.1,
      }
    );

    this.observer.observe(this.sentinel);
  }

  /**
   * Checks if there are more IDs left to load in the current feed.
   * @returns {boolean}
   */
  hasMore() {
    return this.currentIndex < this.allFeedIds.length;
  }

  /**
   * Switch to a new feed type and reset state.
   * @param {'newstories' | 'topstories' | 'beststories' | 'jobstories'} feedType
   */
  async setFeed(feedType) {
    this.currentFeed = feedType;
    this.allFeedIds = [];
    this.currentIndex = 0;
    this.container.innerHTML = '';
    this._renderLoadingState();

    try {
      const ids = await hnApi.getFeedIds(feedType);
      this.allFeedIds = ids || [];
      this.container.innerHTML = '';

      if (this.allFeedIds.length === 0) {
        this._renderEmptyState();
        return;
      }

      // Initial load of the first chunk
      await this.loadNextChunk();
    } catch (err) {
      console.error(`[FeedManager] Error loading feed '${feedType}':`, err);
      this._renderErrorState(err.message);
    }
  }

  /**
   * Fetches, sorts (newest first), and renders the next batch of posts.
   */
  async loadNextChunk() {
    if (this.isLoading || !this.hasMore()) return;

    this.isLoading = true;
    this._showSentinelSpinner();

    try {
      // 1. Slice next batch of IDs
      const nextIds = this.allFeedIds.slice(
        this.currentIndex,
        this.currentIndex + this.pageSize
      );

      // 2. Batch fetch payloads using deduplicated API client
      const items = await hnApi.getItemsBatch(nextIds);

      // 3. Filter invalid items and ensure Newest -> Oldest order by Unix timestamp
      const validSortedItems = items
        .filter((item) => item && !item.deleted && !item.dead)
        .sort((a, b) => (b.time || 0) - (a.time || 0));

      // 4. Render each item card
      validSortedItems.forEach((item) => {
        const cardEl = renderPostCard(item);
        if (cardEl) this.container.appendChild(cardEl);
      });

      // 5. Advance index
      this.currentIndex += this.pageSize;
    } catch (err) {
      console.error('[FeedManager] Error fetching post batch:', err);
    } finally {
      this.isLoading = false;
      this._hideSentinelSpinner();
    }
  }

  /**
   * Prepend new live posts to the top of the container without resetting the feed.
   * @param {Object[]} items - Array of HN post objects
   */
  prependItems(items = []) {
    const sorted = [...items]
      .filter((item) => item && !item.deleted && !item.dead)
      .sort((a, b) => (b.time || 0) - (a.time || 0));

    sorted.forEach((item) => {
      // Add ID to top of internal array if not present
      if (!this.allFeedIds.includes(item.id)) {
        this.allFeedIds.unshift(item.id);
        this.currentIndex++;
      }

      const cardEl = renderPostCard(item);
      if (cardEl) {
        this.container.prepend(cardEl);
      }
    });
  }

  // UI State Helpers

  _renderLoadingState() {
    this.container.innerHTML = `
      <div class="feed-state-message">
        <div class="spinner"></div>
        <p>Loading ${this.currentFeed}...</p>
      </div>
    `;
  }

  _renderEmptyState() {
    this.container.innerHTML = `
      <div class="feed-state-message">
        <p>No stories found for this feed.</p>
      </div>
    `;
  }

  _renderErrorState(message) {
    this.container.innerHTML = `
      <div class="feed-state-message error">
        <p>⚠️ Failed to load feed: ${message}</p>
        <button class="retry-btn" onclick="window.location.reload()">Retry</button>
      </div>
    `;
  }

  _showSentinelSpinner() {
    if (this.sentinel) {
      this.sentinel.innerHTML = `<div class="spinner-small"></div>`;
    }
  }

  _hideSentinelSpinner() {
    if (this.sentinel) {
      this.sentinel.innerHTML = '';
    }
  }

  /**
   * Cleanup observer instance when destroying component.
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}