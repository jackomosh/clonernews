# ⚡ Hacker News Live Reader

A fast, minimalist, and responsive web interface for reading Hacker News. Built with vanilla JavaScript, HTML5, and CSS3, this application consumes the official REST API to render heterogeneous post types, live updates, and deeply nested comment discussions with minimal browser overhead.

---

## 🚀 Features

* **Multi-Feed & Heterogeneous Post Support**
  * Seamlessly browse **Stories**, **Jobs**, and **Polls**.
  * Renders specialized UI cards for each post type, including interactive poll options with percentage visualizer bars.
* **Incremental & Event-Driven Loading**
  * Employs `IntersectionObserver` to auto-paginate and load content on-demand without spamming the API or overcrowding the DOM.
* **Live Updates (5-Second Interval)**
  * Polls `/v0/updates.json` every **5 seconds** to surface real-time story changes.
  * Displays a non-intrusive live banner notifying users of newly published stories with a single-click merge option.
* **Hierarchical Comment Threads (Bonus)**
  * Renders recursive, nested comment threads with custom left-border line indicators.
  * Allows expanding/collapsing individual comment sub-trees for improved readability.
* **Strict Sorting & Deduplication**
  * Enforces **newest-to-oldest** chronological sorting for both main feed posts and comment threads.
  * Implements payload caching and request deduplication to conserve bandwidth and respect API guidelines.

---

## 📁 Project Structure

```text
├── index.html              # Main HTML entry point
├── styles/
│   ├── main.css            # Base design system, CSS variables, and reset
│   ├── components.css      # Feed controls, post cards, polls, and live banner
│   └── comments.css        # Nested thread lines and comment action controls
├── api/
│   └── hnApi.js            # REST API service wrapper & payload caching
├── components/
│   ├── PostCard.js         # Post card generator for Stories, Jobs, and Polls
│   └── CommentThread.js    # Recursive comment renderer & collapse toggling
├── services/
│   ├── FeedManager.js      # Pagination, feed switching, and scroll observer
│   └── LivePoller.js       # 5-second interval updates poller
└── main.js                 # App initialization and event coordination
```

---

## 🛠️ Installation and Setup

Because this application relies on ES Modules (import/export), it must be served over HTTP rather than opened as a local file (file://).

Prerequisites
* Python 3.x OR Node.js installed on your machine.

---

### Running the Application
* Clone and Navigate to the src/ directory:

```bash
cd src
```

* Start a local HTTP server:

    Using Python 3:
```bash
python3 -m http.server 8000
```

* Open the browser:
```bash
http://localhost:8000
```

---

### 🌐 API Reference

This project utilizes the official Firebase-backed Hacker News API:

* Item Details: https://hacker-news.firebaseio.com/v0/item/<id>.json

* Live Updates: https://hacker-news.firebaseio.com/v0/updates.json

* Feed Lists: topstories.json, newstories.json, jobstories.json

