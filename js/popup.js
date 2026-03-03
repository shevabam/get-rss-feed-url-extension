// Theme management
function initTheme() {
    // Load saved theme preference
    chrome.storage.sync.get(['theme'], function(result) {
        const isDark = result.theme === 'dark';
        if (isDark) {
            document.body.classList.add('dark-theme');
        }
    });

    // Setup theme toggle button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            const isDark = document.body.classList.toggle('dark-theme');
            const theme = isDark ? 'dark' : 'light';

            // Save theme preference
            chrome.storage.sync.set({ theme: theme });
        });
    }
}

// Initialize theme on page load
initTheme();

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('review-link').href = `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews`;

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const tab = tabs[0];
        const url = tab.url;

        // Determine hostname for the ignore feature (http/https only)
        let hostname = null;
        try {
            const urlObj = new URL(url);
            if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
                hostname = urlObj.hostname;
            }
        } catch(e) {}

        // Hide ignore button for non-http pages (chrome://, etc.)
        const ignoreBtn = document.getElementById('ignore-site');
        if (!hostname) {
            ignoreBtn.style.display = 'none';
        }

        // Check ignored sites list, then proceed
        chrome.storage.sync.get(['ignoredSites'], function(result) {
            const ignoredSites = result.ignoredSites || [];
            const isIgnored = hostname !== null && ignoredSites.includes(hostname);

            if (isIgnored) {
                ignoreBtn.classList.add('is-ignored');
                ignoreBtn.title = 'Enable RSS for this site';
                renderIgnoredState(hostname);
            }

            // Setup ignore button click handler
            if (hostname) {
                ignoreBtn.addEventListener('click', function() {
                    chrome.storage.sync.get(['ignoredSites'], function(result) {
                        let sites = result.ignoredSites || [];
                        const idx = sites.indexOf(hostname);

                        if (idx === -1) {
                            // Add to ignored list
                            sites.push(hostname);
                            chrome.storage.sync.set({ ignoredSites: sites }, function() {
                                chrome.runtime.sendMessage({ action: "updateBadge", tabId: tab.id, feedCount: 0 });
                                ignoreBtn.classList.add('is-ignored');
                                ignoreBtn.title = 'Enable RSS for this site';
                                renderIgnoredState(hostname);
                            });
                        } else {
                            // Remove from ignored list
                            sites.splice(idx, 1);
                            chrome.storage.sync.set({ ignoredSites: sites }, function() {
                                location.reload();
                            });
                        }
                    });
                });
            }

            if (!isIgnored) {
                // Warn the user if the search is taking longer than expected
                const slowTimer = setTimeout(() => {
                    const loaderText = document.querySelector('.loader-text');
                    if (loaderText) loaderText.textContent = 'Still searching, this may take a moment…';
                }, 3000);

                // Hard timeout: stop waiting after 10s
                const hardTimer = setTimeout(() => {
                    render('The search timed out. The page may be slow or blocking requests.');
                }, 10000);

                getFeedsURLs(url, function(feeds){
                    clearTimeout(slowTimer);
                    clearTimeout(hardTimer);

                    // Send feed count to background to update badge
                    chrome.runtime.sendMessage({
                        action: "updateBadge",
                        tabId: tab.id,
                        feedCount: feeds.length
                    });

                    if (feeds.length > 0) {
                        const feedsList = document.createElement('div');
                        feedsList.id = 'feeds-list';

                        for (let i = 0; i < feeds.length; i++) {
                            feedsList.appendChild(createFeedCard(feeds[i], tab.title));
                        }

                        const feedsEl = document.getElementById('feeds');
                        feedsEl.innerHTML = '';
                        feedsEl.appendChild(feedsList);
                        feedsEl.appendChild(createCopyAllContainer());

                        // Copy to clipboard feed URL
                        const copyButtons = document.getElementsByClassName('copyLink');

                        for (let i = 0; i < copyButtons.length; i++) {
                            copyButtons[i].addEventListener("click", function(e) {
                                e.preventDefault();
                                const button = this;
                                const url = button.getAttribute('data-url');
                                const btnText = button.querySelector('.btn-text');

                                // Visual feedback
                                button.classList.add('copied');
                                const originalText = btnText.textContent;
                                btnText.textContent = 'Copied!';

                                setTimeout(() => {
                                    button.classList.remove('copied');
                                    btnText.textContent = originalText;
                                }, 2000);

                                copyToClipboard(url);
                            });
                        }

                        // Copy to clipboard all feeds URLs
                        const copyButtonAll = document.getElementById('copyAllLinks');

                        copyButtonAll.addEventListener("click", function(e) {
                            e.preventDefault();
                            const button = this;
                            const links = document.getElementById('feeds-list').querySelectorAll('.feed-title.link');
                            const text = Array.from(links).map(a => a.getAttribute('href')).join('\n');

                            // Visual feedback
                            button.classList.add('copied');
                            const btnText = button.querySelector('.btn-text');
                            const originalText = btnText.textContent;
                            btnText.textContent = 'Copied!';

                            setTimeout(() => {
                                button.classList.remove('copied');
                                btnText.textContent = originalText;
                            }, 2000);

                            copyToClipboard(text);
                        });

                    } else {
                        renderEmptyState();
                    }
                });
            }
        });
    });
});

/**
 * Get feed type from MIME type or URL
 */
function getFeedType(typeOrUrl) {
    if (!typeOrUrl) return '';

    const type = typeOrUrl.toLowerCase();

    if (type.includes('rss')) return 'RSS';
    if (type.includes('atom')) return 'Atom';
    if (type.includes('rdf')) return 'RDF';

    return '';
}

/**
 * Render ignored state when site is in the ignore list
 */
function renderIgnoredState(hostname) {
    const container = document.createElement('div');
    container.className = 'ignored-state';

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'ignored-state-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    icon.innerHTML = '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M5.636 5.636L18.364 18.364" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

    const title = document.createElement('div');
    title.className = 'ignored-state-title';
    title.textContent = 'Site Ignored';

    const text = document.createElement('div');
    text.className = 'ignored-state-text';
    text.textContent = 'RSS feeds are not searched for this site.';

    const btn = document.createElement('button');
    btn.className = 'unignore-btn';
    btn.textContent = 'Enable for this site';
    btn.addEventListener('click', function() {
        chrome.storage.sync.get(['ignoredSites'], function(result) {
            let sites = result.ignoredSites || [];
            const idx = sites.indexOf(hostname);
            if (idx !== -1) sites.splice(idx, 1);
            chrome.storage.sync.set({ ignoredSites: sites }, function() {
                location.reload();
            });
        });
    });

    container.appendChild(icon);
    container.appendChild(title);
    container.appendChild(text);
    container.appendChild(btn);

    const feedsEl = document.getElementById('feeds');
    feedsEl.innerHTML = '';
    feedsEl.appendChild(container);
}

/**
 * Render empty state when no feeds found
 */
function renderEmptyState() {
    const html = `
        <div class="empty-state">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 11C6.38695 11 8.67613 11.9482 10.364 13.636C12.0518 15.3239 13 17.6131 13 20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M4 4C8.24346 4 12.3131 5.68571 15.3137 8.68629C18.3143 11.6869 20 15.7565 20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="5" cy="19" r="1" fill="currentColor"/>
            </svg>
            <div class="empty-state-title">No RSS Feeds Found</div>
            <div class="empty-state-text">This page doesn't appear to have any RSS or Atom feeds available.</div>
        </div>
    `;
    render(html);
}

/**
 * Create copy SVG icon (static content, no user data)
 */
function createSVGIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    return svg;
}

/**
 * Create a feed card DOM element (no innerHTML with user data)
 */
function createFeedCard(feed, tabTitle) {
    const feedType = getFeedType(feed.type || feed.url);

    const card = document.createElement('div');
    card.className = 'feed-card';

    const info = document.createElement('div');
    info.className = 'feed-info';

    const titleRow = document.createElement('div');
    titleRow.className = 'feed-title-row';

    const titleLink = document.createElement('a');
    titleLink.className = 'feed-title link';
    titleLink.href = feed.url;
    titleLink.title = feed.title;
    titleLink.setAttribute('data-tabtitle', tabTitle);
    titleLink.target = '_blank';
    titleLink.textContent = feed.title;
    titleRow.appendChild(titleLink);

    if (feedType) {
        const badge = document.createElement('span');
        badge.className = 'feed-type-badge';
        badge.textContent = feedType;
        titleRow.appendChild(badge);
    }

    const urlSpan = document.createElement('span');
    urlSpan.className = 'feed-url';
    urlSpan.title = feed.url;
    urlSpan.textContent = truncate(feed.url, 55);

    const actions = document.createElement('div');
    actions.className = 'feed-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn copyLink';
    copyBtn.title = 'Copy feed URL';
    copyBtn.setAttribute('aria-label', 'Copy feed URL');
    copyBtn.setAttribute('data-url', feed.url);
    copyBtn.appendChild(createSVGIcon());

    const btnText = document.createElement('span');
    btnText.className = 'btn-text';
    btnText.textContent = 'Copy URL';
    copyBtn.appendChild(btnText);

    actions.appendChild(copyBtn);
    info.appendChild(titleRow);
    info.appendChild(urlSpan);
    info.appendChild(actions);
    card.appendChild(info);

    return card;
}

/**
 * Create the "Copy All URLs" button container
 */
function createCopyAllContainer() {
    const container = document.createElement('div');
    container.className = 'copy-all-container';

    const btn = document.createElement('button');
    btn.id = 'copyAllLinks';
    btn.className = 'copy-all-btn';
    btn.title = 'Copy all feeds URLs';
    btn.setAttribute('aria-label', 'Copy all feeds URLs');
    btn.appendChild(createSVGIcon());

    const btnText = document.createElement('span');
    btnText.className = 'btn-text';
    btnText.textContent = 'Copy All URLs';
    btn.appendChild(btnText);

    container.appendChild(btn);
    return container;
}
