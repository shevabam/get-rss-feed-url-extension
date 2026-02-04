importScripts('utilities.js');
importScripts('functions.js');

// Update badge for a tab
async function updateBadge(tabId, url) {
    // Ignore special URLs
    if (IGNORED_PROTOCOLS.includes(parseUrl(url).protocol)) {
        chrome.action.setBadgeText({ text: "", tabId: tabId });
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
            updateBadge(activeInfo.tabId, tab.url);
        }
    });
});

// Listen for page updates
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
        updateBadge(tabId, tab.url);
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