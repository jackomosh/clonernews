// src/services/LivePoller.js

import { hnApi } from '../api/hnApi.js';

/**
 * Periodically polls the HN updates endpoint and notifies the user of fresh content.
 */
export class LivePoller {
  /**
   * @param {HTMLElement} bannerElement - Sticky DOM element used for displaying update counts.
   * @param {FeedManager} feedManager - Instance of FeedManager to handle prepending new posts.
   * @param {Object} [options]
   * @param {number} [options.intervalMs=5000] - Polling cadence in milliseconds (default: 5000ms per prompt spec).
   */
  constructor(bannerElement, feedManager, options = {}) {
    this.banner = bannerElement;
    this.feedManager = feedManager;
    this.intervalMs = options.intervalMs || 5000;

    /** @type {Set<number>} Set of IDs already known or rendered */
    this.seenIds = new Set();
    
    /** @type {number[]} Buffer of pending incoming item IDs */
    this.pendingItemIds = [];

    this.timer = null;
    this.isPolling = false;

    this._bindBannerEvents();
  }

  /**
   * Starts periodic polling at the specified interval.
   */
  start() {
    if (this.timer) return;

    // Seed initial batch of IDs to prevent immediate false update triggers
    this._seedInitialFeedIds();

    // Execute first poll immediately, then start interval loop
    this.poll();
    this.timer = setInterval(() => this.poll(), this.intervalMs);
  }

  /**
   * Stops the polling loop.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Seeds the seenIds Set with all IDs currently present in the feed manager.
   * @private
   */
  _seedInitialFeedIds() {
    if (this.feedManager && Array.isArray(this.feedManager.allFeedIds)) {
      this.feedManager.allFeedIds.forEach((id) => this.seenIds.add(id));
    }
  }

  /**
   * Executes a single poll against updates.json.
   */
  async poll() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const updates = await hnApi.getUpdates();
      if (!updates || !Array.isArray(updates.items)) {
        return;
      }

      // Filter out items already registered in seenIds or pending list
      const freshIds = updates.items.filter(
        (id) => !this.seenIds.has(id) && !this.pendingItemIds.includes(id)
      );

      if (freshIds.length > 0) {
        // Queue new IDs
        this.pendingItemIds.push(...freshIds);
        this._updateBannerUI();
      }
    } catch (err) {
      console.warn('[LivePoller] Polling cycle failed:', err);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Updates banner visibility and badge text.
   * @private
   */
  _updateBannerUI() {
    if (!this.banner) return;

    const count = this.pendingItemIds.length;
    if (count > 0) {
      const label = count === 1 ? '1 new story available' : `${count} new updates available`;
      this.banner.innerHTML = `
        <span class="live-pulse"></span>
        <span class="live-text">⚡ ${label}. <strong>Click to view</strong></span>
      `;
      this.banner.classList.remove('hidden');
    } else {
      this.banner.classList.add('hidden');
    }
  }

  /**
   * Binds user interactions to the live banner element.
   * @private
   */
  _bindBannerEvents() {
    if (!this.banner) return;

    const handleAction = async () => {
      if (this.pendingItemIds.length === 0) return;

      // Extract pending IDs and update UI state
      const idsToFetch = [...this.pendingItemIds];
      this.pendingItemIds = [];
      this._updateBannerUI();

      // Indicate loading status inside banner
      this.banner.classList.remove('hidden');
      this.banner.innerHTML = `<span class="live-text">Fetching live stories...</span>`;

      try {
        // Fetch payloads for incoming live items in batches
        const items = await hnApi.getItemsBatch(idsToFetch);

        // Mark items as seen
        idsToFetch.forEach((id) => this.seenIds.add(id));

        // Prepend items to top of main feed using FeedManager
        if (this.feedManager && typeof this.feedManager.prependItems === 'function') {
          this.feedManager.prependItems(items);
        }
      } catch (err) {
        console.error('[LivePoller] Failed to render live items:', err);
      } finally {
        this.banner.classList.add('hidden');
      }
    };

    this.banner.addEventListener('click', handleAction);
    this.banner.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleAction();
      }
    });
  }

  /**
   * Resets internal pending buffers when user switches feed tabs.
   */
  reset() {
    this.pendingItemIds = [];
    this.seenIds.clear();
    this._seedInitialFeedIds();
    this._updateBannerUI();
  }
}