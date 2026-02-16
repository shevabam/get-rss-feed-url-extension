importScripts('utilities.js');
importScripts('functions.js');

// Store pending timeouts for debouncing
const tabUpdateTimeouts = new Map();

// Debounce delay in milliseconds (wait for navigation to stabilize)
const DEBOUNCE_DELAY = 1000;

// Cache expiration time in milliseconds (1 hour)
const CACHE_EXPIRATION = 60 * 60 * 1000;

// Cache key prefix
const CACHE_PREFIX = 'getrss_cache_';

/**
 * Generate cache key for a given URL
 */
function getCacheKey(url) {
    try {
        const urlObj = new URL(url);
        return CACHE_PREFIX + urlObj.origin;
    } catch (error) {
        return null;
    }
}

/**
 * Get cached feed count for a URL
 */
async function getCachedFeedCount(url) {
    const cacheKey = getCacheKey(url);
    if (!cacheKey) return null;

    try {
        const result = await chrome.storage.local.get(cacheKey);
        const cached = result[cacheKey];

        if (cached && cached.expiresAt > Date.now()) {
            return cached.feedCount;
        }

        // Cache expired, remove it
        if (cached) {
            await chrome.storage.local.remove(cacheKey);
        }

        return null;
    } catch (error) {
        console.error('Error reading cache:', error);
        return null;
    }
}

/**
 * Save feed count to cache
 */
async function cacheFeedCount(url, feedCount) {
    const cacheKey = getCacheKey(url);
    if (!cacheKey) return;

    try {
        const cacheData = {
            feedCount: feedCount,
            timestamp: Date.now(),
            expiresAt: Date.now() + CACHE_EXPIRATION
        };

        await chrome.storage.local.set({ [cacheKey]: cacheData });
    } catch (error) {
        console.error('Error writing cache:', error);
    }
}

// Update badge for a tab
async function updateBadge(tabId, url) {
    // Ignore special URLs
    if (IGNORED_PROTOCOLS.includes(parseUrl(url).protocol)) {
        chrome.action.setBadgeText({ text: "", tabId: tabId });
        return;
    }

    // Check cache first
    const cachedCount = await getCachedFeedCount(url);
    if (cachedCount !== null) {
        // Use cached result
        if (cachedCount === 0) {
            chrome.action.setBadgeText({ text: "", tabId: tabId });
        } else {
            chrome.action.setBadgeText({ text: cachedCount.toString(), tabId: tabId });
            chrome.action.setBadgeBackgroundColor({ color: "#82b2faff", tabId: tabId });
        }
        return;
    }

    let feedCount = 0;

    // Check known services (YouTube, Reddit, GitHub, etc.)
    const knownFeeds = checkIfUrlIsKnown(url);
    if (knownFeeds && knownFeeds.length > 0) {
        feedCount = knownFeeds.length;
    } else {
        // Otherwise, fetch and parse the HTML
        try {
            const html = await fetchHtmlSource(url);
            if (html) {
                feedCount = countFeedsFromHtml(html);
            }

            // If no feed found in HTML, try common feed URL suffixes
            if (feedCount === 0) {
                feedCount = await tryToFindFeedCount(url);
            }
        } catch (error) {
            // Silent on error (CORS, etc.)
        }
    }

    // Save to cache
    await cacheFeedCount(url, feedCount);

    // Update badge
    if (feedCount === 0) {
        chrome.action.setBadgeText({ text: "", tabId: tabId });
    } else {
        chrome.action.setBadgeText({ text: feedCount.toString(), tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: "#82b2faff", tabId: tabId });
    }
}

// Listen for tab changes
chrome.tabs.onActivated.addListener(function(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function(tab) {
        if (tab && tab.url) {
            // Cancel any pending update for this tab
            if (tabUpdateTimeouts.has(activeInfo.tabId)) {
                clearTimeout(tabUpdateTimeouts.get(activeInfo.tabId));
            }
            // Update immediately when switching tabs
            updateBadge(activeInfo.tabId, tab.url);
        }
    });
});

// Listen for page updates
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    // Only trigger on actual URL changes or when page finishes loading
    if ((changeInfo.url || changeInfo.status === 'complete') && tab.url) {
        // Cancel any pending update for this tab
        if (tabUpdateTimeouts.has(tabId)) {
            clearTimeout(tabUpdateTimeouts.get(tabId));
        }

        // Debounce: wait for navigation to stabilize before updating
        const timeoutId = setTimeout(() => {
            updateBadge(tabId, tab.url);
            tabUpdateTimeouts.delete(tabId);
        }, DEBOUNCE_DELAY);

        tabUpdateTimeouts.set(tabId, timeoutId);
    }
});

// Clean up when tabs are closed to prevent memory leaks
chrome.tabs.onRemoved.addListener(function(tabId) {
    if (tabUpdateTimeouts.has(tabId)) {
        clearTimeout(tabUpdateTimeouts.get(tabId));
        tabUpdateTimeouts.delete(tabId);
    }
});

// Listen for messages from popup to update badge
chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === "updateBadge" && request.tabId) {
        if (request.feedCount === 0) {
            chrome.action.setBadgeText({ text: "", tabId: request.tabId });
        } else {
            chrome.action.setBadgeText({ text: request.feedCount.toString(), tabId: request.tabId });
            chrome.action.setBadgeBackgroundColor({ color: "#82b2faff", tabId: request.tabId });
        }
    }
});

async function removeAllContextMenus() {
    return new Promise((resolve) => {
        chrome.contextMenus.removeAll(() => {
            resolve();
        });
    });
}

async function createActionContextMenus() {
    await removeAllContextMenus();
    
    chrome.contextMenus.create({
        id: "support",
        title: "❤️ Support",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "issues",
        title: "🤔 Issues and Suggestions",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "github",
        title: "🌐 GitHub",
        parentId: "issues",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "reportIssue",
        title: "🐛 Report Issue",
        parentId: "issues",
        contexts: ["action"]
    });

    // Sous-menus de "Support"
    chrome.contextMenus.create({
        id: "donate",
        title: "🍕 Buy me a pizza",
        parentId: "support",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "review",
        title: "🌟 Leave a review",
        parentId: "support",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "projects",
        title: "🧪 More projects",
        parentId: "support",
        contexts: ["action"]
    });
}

chrome.runtime.onInstalled.addListener(async () => {
    await createActionContextMenus();
});

chrome.runtime.onStartup.addListener(async () => {
    await createActionContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    switch (info.menuItemId) {
        case "github":
            chrome.tabs.create({ url: 'https://github.com/shevabam/get-rss-feed-url-extension' });
            break;
        case "reportIssue":
            chrome.tabs.create({ url: 'https://github.com/shevabam/get-rss-feed-url-extension/issues' });
            break;
        case "donate":
            chrome.tabs.create({ url: 'https://buymeacoffee.com/shevabam' });
            break;
        case "review":
            chrome.tabs.create({ url: `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews` });
            break;
        case "projects":
        chrome.tabs.create({ url: `https://shevabam.fr` });
        break;
    }
});