// src/services/FeedManager.js

import { hnApi } from '../api/hnApi.js';
import { renderPostCard } from '../components/PostCard.js';

/**
 * Manages fetching, sorting, and manual pagination (View More)
 * for Hacker News feeds.
 */
export class FeedManager {
  /**
   * @param {HTMLElement} container - DOM element where post cards will be appended.
   * @param {HTMLElement} loadMoreBtn - DOM element for the "View More" button.
   * @param {Object} [options]
   * @param {number} [options.pageSize=15] - Number of posts to fetch per batch.
   */
  constructor(container, loadMoreBtn, options = {}) {
    this.container = container;
    this.loadMoreBtn = loadMoreBtn;
    this.pageSize = options.pageSize || 15;

    this.currentFeed = 'newstories';
    this.allFeedIds = [];
    this.currentIndex = 0;
    this.isLoading = false;

    this._bindButtonEvents();
  }

  /**
   * Attaches event listener to the "View More" button.
   * @private
   */
  _bindButtonEvents() {
    if (!this.loadMoreBtn) return;

    this.loadMoreBtn.addEventListener('click', () => {
      if (!this.isLoading && this.hasMore()) {
        this.loadNextChunk();
      }
    });
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
   * @param {'newstories' | 'topstories' | 'beststories' | 'jobstories' | 'askstories' | 'showstories'} feedType
   */
  async setFeed(feedType) {
    this.currentFeed = feedType;
    this.allFeedIds = [];
    this.currentIndex = 0;
    this.container.innerHTML = '';
    this._hideLoadMoreButton();
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
    this._setButtonLoadingState(true);

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
      this._setButtonLoadingState(false);
      this._updateButtonVisibility();
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

  _updateButtonVisibility() {
    if (!this.loadMoreBtn) return;
    if (this.hasMore()) {
      this.loadMoreBtn.classList.remove('hidden');
    } else {
      this.loadMoreBtn.classList.add('hidden');
    }
  }

  _hideLoadMoreButton() {
    if (this.loadMoreBtn) {
      this.loadMoreBtn.classList.add('hidden');
    }
  }

  _setButtonLoadingState(loading) {
    if (!this.loadMoreBtn) return;
    if (loading) {
      this.loadMoreBtn.disabled = true;
      this.loadMoreBtn.textContent = 'Loading...';
    } else {
      this.loadMoreBtn.disabled = false;
      this.loadMoreBtn.textContent = 'View More';
    }
  }

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

  destroy() {
    // No observer cleanup required
  }
}