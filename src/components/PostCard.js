// src/components/PostCard.js

import { hnApi } from '../api/hnApi.js';
import { renderCommentThread } from './CommentThread.js';

/**
 * Formats a Unix timestamp into a human-readable relative time string.
 * @param {number} unixTimestamp 
 * @returns {string} e.g., "15m ago", "2h ago", "3d ago"
 */
function formatTimeAgo(unixTimestamp) {
  if (!unixTimestamp) return '';
  const seconds = Math.floor((Date.now() - unixTimestamp * 1000) / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Extracts domain name from a URL for clean display.
 * @param {string} urlStr 
 * @returns {string}
 */
function getDomain(urlStr) {
  try {
    const url = new URL(urlStr);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Renders heterogeneous post cards based on item type (story, job, poll).
 * @param {Object} item - HN item payload
 * @returns {HTMLElement} Card DOM element
 */
export function renderPostCard(item) {
  if (!item || item.deleted || item.dead) return null;

  const card = document.createElement('article');
  card.className = `post-card post-type-${item.type || 'story'}`;
  card.dataset.id = item.id;

  const type = item.type || 'story';
  const title = item.title || 'Untitled';
  const author = item.by || 'anonymous';
  const timeAgo = formatTimeAgo(item.time);
  const score = item.score || 0;
  const commentCount = item.descendants || (item.kids ? item.kids.length : 0);

  // 1. Badge Renderer
  const badgeHtml = `<span class="badge badge-${type}">${type.toUpperCase()}</span>`;

  // 2. Title & External Link Header
  let titleHtml = '';
  if (item.url) {
    const domain = getDomain(item.url);
    titleHtml = `
      <h2 class="post-title">
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">${title}</a>
        ${domain ? `<span class="post-domain">(${domain})</span>` : ''}
      </h2>
    `;
  } else {
    titleHtml = `<h2 class="post-title">${title}</h2>`;
  }

  // 3. Self-Text / Body Content (if present)
  const textHtml = item.text ? `<div class="post-body">${item.text}</div>` : '';

  // 4. Metadata Line (score, author, time)
  let metaHtml = '';
  if (type === 'job') {
    metaHtml = `<span class="post-meta">Posted by <strong>${author}</strong> • ${timeAgo}</span>`;
  } else {
    metaHtml = `
      <span class="post-meta">
        <strong>${score}</strong> points by <strong>${author}</strong> • ${timeAgo}
      </span>
    `;
  }

  // 5. Action Bar (Comments Button)
  const showCommentsBtn = type !== 'job';
  const commentsBtnHtml = showCommentsBtn ? `
    <button class="comments-toggle-btn" data-action="toggle-comments">
      💬 ${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}
    </button>
  ` : '';

  // Assemble Main Card Skeleton
  card.innerHTML = `
    <div class="post-header">
      ${badgeHtml}
      ${titleHtml}
    </div>
    ${textHtml}
    <div class="poll-options-container" id="poll-container-${item.id}"></div>
    <div class="post-footer">
      ${metaHtml}
      ${commentsBtnHtml}
    </div>
    <div class="comments-container hidden" id="comments-container-${item.id}"></div>
  `;

  // 6. Handle Poll Options (if item is a Poll)
  if (type === 'poll' && Array.isArray(item.parts) && item.parts.length > 0) {
    const pollContainer = card.querySelector(`#poll-container-${item.id}`);
    renderPollOptions(item.parts, pollContainer);
  }

  // 7. Attach Expand/Collapse Comments Event Listener
  if (showCommentsBtn) {
    const toggleBtn = card.querySelector('[data-action="toggle-comments"]');
    const commentsContainer = card.querySelector(`#comments-container-${item.id}`);
    let isLoaded = false;

    toggleBtn.addEventListener('click', async () => {
      const isHidden = commentsContainer.classList.contains('hidden');

      if (isHidden) {
        commentsContainer.classList.remove('hidden');
        toggleBtn.classList.add('active');

        // Lazy-load comments thread on first expand
        if (!isLoaded) {
          commentsContainer.innerHTML = '<div class="spinner-small">Loading comments...</div>';
          if (item.kids && item.kids.length > 0) {
            commentsContainer.innerHTML = '';
            await renderCommentThread(item.kids, commentsContainer, item.id);
          } else {
            commentsContainer.innerHTML = '<p class="no-comments">No comments yet.</p>';
          }
          isLoaded = true;
        }
      } else {
        commentsContainer.classList.add('hidden');
        toggleBtn.classList.remove('active');
      }
    });
  }

  return card;
}

/**
 * Fetches option payloads for a poll and builds score bars.
 * @param {number[]} optionIds - Array of pollopt item IDs
 * @param {HTMLElement} container 
 */
async function renderPollOptions(optionIds, container) {
  container.innerHTML = '<div class="spinner-small">Loading poll choices...</div>';
  
  try {
    const options = await hnApi.getItemsBatch(optionIds);
    const validOptions = options.filter(Boolean);
    const totalVotes = validOptions.reduce((acc, opt) => acc + (opt.score || 0), 0);

    container.innerHTML = '';
    
    validOptions.forEach((opt) => {
      const optScore = opt.score || 0;
      const percentage = totalVotes > 0 ? Math.round((optScore / totalVotes) * 100) : 0;

      const optEl = document.createElement('div');
      optEl.className = 'poll-option';
      optEl.innerHTML = `
        <div class="poll-option-label">
          <span>${opt.text || ''}</span>
          <strong>${optScore} votes (${percentage}%)</strong>
        </div>
        <div class="poll-bar-background">
          <div class="poll-bar-fill" style="width: ${percentage}%"></div>
        </div>
      `;
      container.appendChild(optEl);
    });
  } catch (err) {
    console.error('[PostCard] Failed to render poll options:', err);
    container.innerHTML = '<p class="error-text">Failed to load poll options.</p>';
  }
}