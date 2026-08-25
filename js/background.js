importScripts('utilities.js');
importScripts('functions.js');

// Store pending timeouts for debouncing
const tabUpdateTimeouts = new Map();

// Debounce delay in milliseconds (wait for navigation to stabilize)
const DEBOUNCE_DELAY = 1000;

// Cache expiration time for positive results (feeds found) - 24 hours
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

// Cache expiration time for negative results (no feeds found) - 7 days
const CACHE_EXPIRATION_NEGATIVE = 7 * 24 * 60 * 60 * 1000;

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
        const urlObj = new URL(url);
        const result = await chrome.storage.local.get(cacheKey);
        const cached = result[cacheKey];

        if (cached && cached.expiresAt > Date.now()) {
            // For "suffixes" source, cache is valid for the entire origin
            // For "known" and "html" sources, validate pathname matches
            if (cached.source !== "suffixes") {
                if (cached.pathname && cached.pathname !== urlObj.pathname) {
                    // Pathname changed, invalidate cache
                    await chrome.storage.local.remove(cacheKey);
                    return null;
                }
            }
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
 * @param {string} source - Source of the feed count: "known", "html", or "suffixes"
 */
async function cacheFeedCount(url, feedCount, source = "html") {
    const cacheKey = getCacheKey(url);
    if (!cacheKey) return;

    try {
        const urlObj = new URL(url);
        const expiration = feedCount === 0 ? CACHE_EXPIRATION_NEGATIVE : CACHE_EXPIRATION;
        const cacheData = {
            feedCount: feedCount,
            pathname: urlObj.pathname,
            source: source,
            timestamp: Date.now(),
            expiresAt: Date.now() + expiration
        };

        await chrome.storage.local.set({ [cacheKey]: cacheData });
    } catch (error) {
        console.error('Error writing cache:', error);
    }
}

/**
 * Clean expired cache entries from storage
 */
async function cleanExpiredCache() {
    try {
        const allData = await chrome.storage.local.get(null);
        const now = Date.now();
        const keysToRemove = [];

        // Find all expired cache entries
        for (const [key, value] of Object.entries(allData)) {
            if (key.startsWith(CACHE_PREFIX)) {
                if (value && value.expiresAt && value.expiresAt < now) {
                    keysToRemove.push(key);
                }
            }
        }

        // Remove expired entries
        if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
        }
    } catch (error) {
        console.error('Error cleaning expired cache:', error);
    }
}

// Update badge for a tab
async function updateBadge(tabId, url) {
    // Ignore special URLs
    if (IGNORED_PROTOCOLS.includes(parseUrl(url).protocol)) {
        chrome.action.setBadgeText({ text: "", tabId: tabId });
        return;
    }

    const { ignoredSites = [], showBadge = true } = await chrome.storage.sync.get(['ignoredSites', 'showBadge']);

    // Badge display is off — stop here, before touching the cache or the network at all.
    // (Previously this was only checked when actually setting the badge text, so turning the
    // badge off did not stop the page fetch + suffix probing from happening on every page.)
    if (!showBadge) {
        chrome.action.setBadgeText({ text: "", tabId: tabId });
        return;
    }

    // Skip sites the user has chosen to ignore
    try {
        if (isHostnameIgnored(new URL(url).hostname, ignoredSites)) {
            chrome.action.setBadgeText({ text: "", tabId: tabId });
            return;
        }
    } catch (e) {
        // Non-standard URL (e.g. some internal browser pages) — continue without the ignoredSites check
    }

    // Check cache first
    const cachedCount = await getCachedFeedCount(url);
    if (cachedCount !== null) {
        // Use cached result
        if (cachedCount === 0) {
            chrome.action.setBadgeText({ text: "", tabId: tabId });
        } else {
            chrome.action.setBadgeText({ text: cachedCount.toString(), tabId: tabId });
            chrome.action.setBadgeBackgroundColor({ color: "#82b2fa", tabId: tabId });
        }
        return;
    }

    let feedCount = 0;
    let source = "html"; // Default source
    let fetchFailed = false; // true if we couldn't get a definitive answer (network/anti-bot, not "no feeds")

    // Check known services (YouTube, Reddit, GitHub, etc.)
    const knownFeeds = checkIfUrlIsKnown(url);
    if (knownFeeds && knownFeeds.length > 0) {
        feedCount = knownFeeds.length;
        source = "known";
    } else {
        // Otherwise, fetch and parse the HTML
        try {
            const html = await fetchHtmlSource(url);
            fetchFailed = html === null;
            if (html) {
                feedCount = countFeedsFromHtml(html);
            }

            // If no feed found in HTML, try common feed URL suffixes
            if (feedCount === 0) {
                const suffixCount = await tryToFindFeedCount(url);
                if (suffixCount > 0) {
                    // Only claim the origin-wide "suffixes" source when the probe actually found
                    // something — otherwise a zero here would bypass the per-path cache
                    // invalidation below and hide real feeds on other pages of the same site.
                    feedCount = suffixCount;
                    source = "suffixes";
                    fetchFailed = false; // the suffix probe did give us a definitive answer
                }
            }
        } catch (error) {
            fetchFailed = true; // Silent on error (CORS, etc.)
        }
    }

    // Save to cache — unless the page fetch itself failed and the suffix probe found nothing
    // either. In that case we don't actually know whether the site has no feeds or we were just
    // blocked/offline, so skip the cache entirely rather than locking in a false "0" for up to
    // 7 days (CACHE_EXPIRATION_NEGATIVE).
    if (!fetchFailed || feedCount > 0) {
        await cacheFeedCount(url, feedCount, source);
    }

    // Update badge
    if (feedCount === 0) {
        chrome.action.setBadgeText({ text: "", tabId: tabId });
    } else {
        chrome.action.setBadgeText({ text: feedCount.toString(), tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: "#82b2fa", tabId: tabId });
    }
}

// Listen for tab changes
chrome.tabs.onActivated.addListener(function(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function(tab) {
        if (tab && tab.url) {
            // Cancel any pending update for this tab
            if (tabUpdateTimeouts.has(activeInfo.tabId)) {
                clearTimeout(tabUpdateTimeouts.get(activeInfo.tabId));
                tabUpdateTimeouts.delete(activeInfo.tabId);
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
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // Only trust messages from this extension's own pages (popup/options) — without this,
    // any other installed extension could set an arbitrary badge on an arbitrary tab.
    if (sender.id !== chrome.runtime.id) return;
    if (request.action !== "updateBadge") return;
    if (!Number.isInteger(request.tabId) || !Number.isInteger(request.feedCount)) return;

    chrome.storage.sync.get(['showBadge'], async function(result) {
        const showBadge = result.showBadge !== false;
        if (request.feedCount === 0 || !showBadge) {
            chrome.action.setBadgeText({ text: "", tabId: request.tabId });
        } else {
            chrome.action.setBadgeText({ text: request.feedCount.toString(), tabId: request.tabId });
            chrome.action.setBadgeBackgroundColor({ color: "#82b2fa", tabId: request.tabId });
        }

        // The popup's own detection is more thorough than the worker's (it also runs the
        // suffix fallback), so let it refresh the cache too — otherwise the badge can keep
        // flipping between the popup's and the worker's answer for the same page (Finding 7).
        if (typeof request.url === 'string') {
            await cacheFeedCount(request.url, request.feedCount, "popup");
        }

        sendResponse();
    });
    // Keep the message channel open until the async storage.sync.get callback above completes,
    // otherwise Chrome may suspend the service worker before the badge gets updated.
    return true;
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
    await cleanExpiredCache();
});

chrome.runtime.onStartup.addListener(async () => {
    // Context menus don't need to be recreated here: Chrome persists them across browser
    // restarts, and re-creating them on every startup risked racing with onInstalled's own
    // removeAll()/create() calls on a Chrome update (duplicate-id / missing-parent errors).
    await cleanExpiredCache();
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
            chrome.tabs.create({ url: getReviewUrl() });
            break;
        case "projects":
        chrome.tabs.create({ url: `https://shevabam.fr` });
        break;
    }
});