// src/main.js

import { FeedManager } from './services/FeedManager.js';
import { LivePoller } from './services/LivePoller.js';

document.addEventListener('DOMContentLoaded', () => {
  const feedContainer = document.getElementById('feed-container');
  const loadMoreBtn = document.getElementById('load-more-btn'); // Updated selector
  const liveBanner = document.getElementById('live-banner');
  const navButtons = document.querySelectorAll('.nav-btn');

  if (!feedContainer || !loadMoreBtn || !liveBanner) {
    console.error('[App Init] Required DOM elements not found.');
    return;
  }

  // Pass loadMoreBtn to FeedManager
  const feedManager = new FeedManager(feedContainer, loadMoreBtn, {
    pageSize: 15,
  });

  const livePoller = new LivePoller(liveBanner, feedManager, {
    intervalMs: 5000,
  });

  const initialFeed = 'newstories';
  feedManager.setFeed(initialFeed).then(() => {
    livePoller.start();
  });

  navButtons.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const selectedFeed = e.currentTarget.dataset.feed;
      if (!selectedFeed || e.currentTarget.classList.contains('active')) return;

      navButtons.forEach((b) => b.classList.remove('active'));
      e.currentTarget.classList.add('active');

      await feedManager.setFeed(selectedFeed);
      livePoller.reset();
    });
  });

  window.addEventListener('beforeunload', () => {
    livePoller.stop();
    feedManager.destroy();
  });
});