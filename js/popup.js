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
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const tab = tabs[0];
        const url = tab.url;

        getFeedsURLs(url, function(feeds){

            // Send feed count to background to update badge
            chrome.runtime.sendMessage({
                action: "updateBadge",
                tabId: tab.id,
                feedCount: feeds.length
            });

            if (feeds.length > 0) {
                let html = '<div id="feeds-list">';

                for (let i = 0; i < feeds.length; i++) {
                    const feedType = getFeedType(feeds[i].type || feeds[i].url);

                    html += '<div class="feed-card">';
                    html +=   '<div class="feed-info">';
                    html +=     '<div class="feed-title-row">';
                    html +=       '<a class="feed-title link" href="'+feeds[i].url+'" title="'+feeds[i].title+'" data-tabtitle="'+tab.title+'" target="_blank">'+feeds[i].title+'</a>';
                    if (feedType) {
                        html +=   '<span class="feed-type-badge">'+feedType+'</span>';
                    }
                    html +=     '</div>';
                    html +=     '<span class="feed-url" title="'+feeds[i].url+'">'+truncate(feeds[i].url, 55)+'</span>';
                    html +=     '<div class="feed-actions">';
                    html +=       '<button class="copy-btn copyLink" title="Copy feed URL" data-url="'+feeds[i].url+'">';
                    html +=         '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">';
                    html +=           '<rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
                    html +=           '<path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
                    html +=         '</svg>';
                    html +=         '<span class="btn-text">Copy URL</span>';
                    html +=       '</button>';
                    html +=     '</div>';
                    html +=   '</div>';
                    html += '</div>';
                }

                html += '</div>';

                html += '<div class="copy-all-container">';
                html +=   '<button id="copyAllLinks" class="copy-all-btn" title="Copy all feeds URLs">';
                html +=     '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">';
                html +=       '<rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
                html +=       '<path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
                html +=     '</svg>';
                html +=     'Copy All URLs';
                html +=   '</button>';
                html += '</div>';

                render(html);


                // Copy to clipboard feed URL
                const copyButtons = document.getElementsByClassName('copyLink');

                for (let i = 0; i < copyButtons.length; i++) {
                    copyButtons[i].addEventListener("click", function(e) {
                        e.preventDefault();
                        const button = this;
                        const url = button.getAttribute('data-url');
                        const feed = button.closest('.feed-card').querySelector('a.link');
                        const tabTitle = feed.getAttribute('data-tabtitle');
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
                    const feeds_list = document.getElementById('feeds-list').querySelectorAll('.feed-title.link');

                    let text = '';
                    for (let j = 0; j < feeds_list.length; j++) {
                        text += feeds_list[j].getAttribute('href') + "\n";
                    }
                    const textToCopy = text.substring(0, text.length - 1);

                    // Visual feedback
                    button.classList.add('copied');
                    const originalText = button.innerHTML;
                    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Copied!';

                    setTimeout(() => {
                        button.classList.remove('copied');
                        button.innerHTML = originalText;
                    }, 2000);

                    copyToClipboard(textToCopy);
                });

            } else {
                renderEmptyState();
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
