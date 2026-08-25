// src/main.js

import { FeedManager } from './services/FeedManager.js';
import { LivePoller } from './services/LivePoller.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Core DOM Element Selectors
  const feedContainer = document.getElementById('feed-container');
  const scrollSentinel = document.getElementById('scroll-sentinel');
  const liveBanner = document.getElementById('live-banner');
  const navButtons = document.querySelectorAll('.nav-btn');

  if (!feedContainer || !scrollSentinel || !liveBanner) {
    console.error('[App Init] Required DOM elements not found.');
    return;
  }

  // 2. Initialize Core Services
  const feedManager = new FeedManager(feedContainer, scrollSentinel, {
    pageSize: 15,
  });

  // 5-second interval poller per project requirements
  const livePoller = new LivePoller(liveBanner, feedManager, {
    intervalMs: 5000,
  });

  // 3. Initial Feed Load ('newstories' default per instructions for newest-first stream)
  const initialFeed = 'newstories';
  feedManager.setFeed(initialFeed).then(() => {
    // Start live poller after initial feed is primed
    livePoller.start();
  });

  // 4. Navigation Tab Switch Handler
  navButtons.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const selectedFeed = e.currentTarget.dataset.feed;
      if (!selectedFeed || e.currentTarget.classList.contains('active')) return;

      // Update Active Navigation Tab UI
      navButtons.forEach((b) => b.classList.remove('active'));
      e.currentTarget.classList.add('active');

      // Switch Feed & Reset Live Poller State for the new feed context
      await feedManager.setFeed(selectedFeed);
      livePoller.reset();
    });
  });

  // 5. Cleanup on window unload to prevent memory leaks or background orphan requests
  window.addEventListener('beforeunload', () => {
    livePoller.stop();
    feedManager.destroy();
  });
});