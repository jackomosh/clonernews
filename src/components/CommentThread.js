// src/components/CommentThread.js

import { hnApi } from '../api/hnApi.js';

/**
 * Formats a Unix timestamp into a relative time string.
 * @param {number} unixTimestamp 
 * @returns {string}
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
 * Recursively fetches and renders comments ordered from newest to oldest.
 * 
 * @param {number[]} commentIds - Array of comment item IDs to fetch and display.
 * @param {HTMLElement} parentContainer - DOM node where rendered comments will append.
 * @param {number|string} parentPostId - ID of the root post or parent item.
 * @param {number} [depth=0] - Current recursion depth for styling hierarchy.
 */
export async function renderCommentThread(commentIds, parentContainer, parentPostId, depth = 0) {
  if (!Array.isArray(commentIds) || commentIds.length === 0) return;

  // 1. Fetch batch of comment payloads
  const rawComments = await hnApi.getItemsBatch(commentIds);

  // 2. Filter out null entries and sort newest to oldest per requirements
  const comments = rawComments
    .filter((comment) => comment !== null)
    .sort((a, b) => (b.time || 0) - (a.time || 0));

  if (comments.length === 0) return;

  const fragment = document.createDocumentFragment();

  for (const comment of comments) {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment-item';
    commentEl.dataset.id = comment.id;
    commentEl.dataset.parentId = comment.parent || parentPostId;
    commentEl.dataset.depth = depth;

    // Handle deleted or dead comments
    if (comment.deleted || comment.dead) {
      commentEl.classList.add('comment-deleted');
      commentEl.innerHTML = `
        <div class="comment-meta">
          <span class="comment-author">[deleted]</span> • 
          <span class="comment-time">${formatTimeAgo(comment.time)}</span>
        </div>
        <div class="comment-body muted"><em>[Comment deleted or flag-removed]</em></div>
      `;
      fragment.appendChild(commentEl);
      continue;
    }

    const author = comment.by || 'anonymous';
    const timeAgo = formatTimeAgo(comment.time);
    const hasReplies = Array.isArray(comment.kids) && comment.kids.length > 0;

    commentEl.innerHTML = `
      <div class="comment-meta">
        <button class="comment-collapse-btn" aria-label="Toggle thread" data-action="toggle">[-]</button>
        <span class="comment-author">${author}</span>
        <span class="comment-time">${timeAgo}</span>
      </div>
      <div class="comment-content-wrapper">
        <div class="comment-body">${comment.text || ''}</div>
        <div class="comment-replies" id="replies-${comment.id}"></div>
      </div>
    `;

    // 3. Attach collapse/expand toggle logic
    const collapseBtn = commentEl.querySelector('[data-action="toggle"]');
    const contentWrapper = commentEl.querySelector('.comment-content-wrapper');

    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCollapsed = commentEl.classList.toggle('collapsed');
      
      if (isCollapsed) {
        contentWrapper.style.display = 'none';
        collapseBtn.textContent = `[+ ${hasReplies ? comment.kids.length + 1 : 1}]`;
      } else {
        contentWrapper.style.display = 'block';
        collapseBtn.textContent = '[-]';
      }
    });

    // 4. Recursive fetch for nested child replies
    if (hasReplies) {
      const repliesContainer = commentEl.querySelector(`#replies-${comment.id}`);
      renderCommentThread(comment.kids, repliesContainer, parentPostId, depth + 1);
    }

    fragment.appendChild(commentEl);
  }

  parentContainer.appendChild(fragment);
}